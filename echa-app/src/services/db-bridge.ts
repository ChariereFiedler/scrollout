/**
 * DB Bridge — queries mobile SQLite via Capacitor InstaWebView plugin.
 * Replaces api.ts (PC visualizer) for local-first data access.
 */

function getPlugin(): any {
  if ((window as any).Capacitor?.Plugins?.InstaWebView) {
    return (window as any).Capacitor.Plugins.InstaWebView;
  }
  // Mock for browser dev
  console.warn('[ECHA] DB bridge: plugin not available (browser mode)');
  return {
    querySessions: async () => ({ sessions: '[]' }),
    queryPosts: async () => ({ posts: '[]' }),
    queryStats: async () => ({
      totalSessions: 0, totalPosts: 0, totalEnriched: 0,
      attention: {}, political: {}, axes: {},
      topCategories: '[]', topUsers: '[]',
    }),
    queryExportSession: async () => ({ data: '{}' }),
  };
}

// ── Types ────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  capturedAt: number;
  durationSec: number;
  totalPosts: number;
  captureMode: string;
  postCount: number;
}

export interface PostEntry {
  id: string;
  sessionId: string;
  postId: string;
  username: string;
  caption: string;
  mediaType: string;
  likeCount: number;
  isSponsored: boolean;
  isSuggested: boolean;
  dwellTimeMs: number;
  attentionLevel: string;
  allText: string;
  seenCount: number;
  enrichment?: {
    politicalScore: number;
    polarizationScore: number;
    confidenceScore: number;
    mainTopics: string;
    axisEconomic: number;
    axisSocietal: number;
    axisAuthority: number;
    axisSystem: number;
    dominantAxis: string;
    mediaCategory: string;
    mediaQuality: string;
  };
}

export interface DbStats {
  totalSessions: number;
  totalPosts: number;
  totalEnriched: number;
  attention: Record<string, number>;
  political: Record<string, number>;
  axes?: { economic: number; societal: number; authority: number; system: number };
  avgPolarization?: number;
  avgConfidence?: number;
  topCategories: Array<{ category: string; count: number }>;
  topUsers: Array<{ username: string; count: number; totalDwellMs: number }>;
}

// ── Queries ──────────────────────────────────────────────────

export async function getSessions(): Promise<SessionSummary[]> {
  const result = await getPlugin().querySessions();
  try {
    return JSON.parse(result.sessions || '[]');
  } catch {
    return [];
  }
}

export async function getPosts(sessionId: string, offset = 0, limit = 50): Promise<PostEntry[]> {
  const result = await getPlugin().queryPosts({ sessionId, offset, limit });
  try {
    return JSON.parse(result.posts || '[]');
  } catch {
    return [];
  }
}

export async function getStats(): Promise<DbStats> {
  const result = await getPlugin().queryStats();
  // Parse nested JSON strings if needed
  const stats: DbStats = {
    totalSessions: result.totalSessions || 0,
    totalPosts: result.totalPosts || 0,
    totalEnriched: result.totalEnriched || 0,
    attention: typeof result.attention === 'string' ? JSON.parse(result.attention) : (result.attention || {}),
    political: typeof result.political === 'string' ? JSON.parse(result.political) : (result.political || {}),
    topCategories: typeof result.topCategories === 'string' ? JSON.parse(result.topCategories) : (result.topCategories || []),
    topUsers: typeof result.topUsers === 'string' ? JSON.parse(result.topUsers) : (result.topUsers || []),
  };
  if (result.axes) {
    stats.axes = typeof result.axes === 'string' ? JSON.parse(result.axes) : result.axes;
  }
  if (result.avgPolarization !== undefined) stats.avgPolarization = result.avgPolarization;
  if (result.avgConfidence !== undefined) stats.avgConfidence = result.avgConfidence;
  return stats;
}

export async function exportSession(sessionId: string): Promise<any> {
  const result = await getPlugin().queryExportSession({ sessionId });
  try {
    return JSON.parse(result.data || '{}');
  } catch {
    return {};
  }
}

export function safeParse(json: string | null | undefined): string[] {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}
