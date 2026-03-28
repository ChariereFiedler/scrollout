import { getPosts, getSessions, safeParse, type PostEntry, type SessionSummary } from './db-bridge.js';

export type VisualizationMode =
  | 'bubble'
  | 'bar'
  | 'radar'
  | 'scatter'
  | 'heatmap'
  | 'treemap'
  | 'donut';

export type CognitiveMetricKey =
  | 'frequency'
  | 'durationTotalMs'
  | 'durationAverageMs'
  | 'engagement'
  | 'engagedShare'
  | 'politicalScore'
  | 'polarization'
  | 'confidence';

export type CognitiveThemeSource = 'mainTopics' | 'mediaCategory' | 'fallback';

export interface CognitiveMetricDefinition {
  key: CognitiveMetricKey;
  label: string;
  description: string;
  unit: string;
}

export interface CognitiveMetricRanges {
  frequency: { min: number; max: number };
  durationTotalMs: { min: number; max: number };
  durationAverageMs: { min: number; max: number };
  engagement: { min: number; max: number };
  engagedShare: { min: number; max: number };
  politicalScore: { min: number; max: number };
  polarization: { min: number; max: number };
  confidence: { min: number; max: number };
}

export interface CognitiveThemeAggregate {
  themeId: string;
  themeLabel: string;
  source: CognitiveThemeSource;
  postCount: number;
  totalDwellTimeMs: number;
  averageDwellTimeMs: number;
  engagementScore: number;
  engagedShare: number;
  politicalScoreAverage: number;
  polarizationAverage: number;
  confidenceAverage: number;
  enrichedPostCount: number;
  samplePostIds: string[];
  sampleUsers: string[];
  rawMetrics: Record<CognitiveMetricKey, number>;
  normalizedMetrics?: Partial<Record<CognitiveMetricKey, number>>;
}

export interface CognitiveBubbleDataset {
  session: SessionSummary | null;
  posts: PostEntry[];
  themes: CognitiveThemeAggregate[];
  metricRanges: CognitiveMetricRanges;
  totalPosts: number;
  totalAvailablePosts: number;
  totalThemes: number;
  isPartial: boolean;
}

export interface CognitiveBubbleLoadOptions {
  sessionId?: string;
  limit?: number;
}

export const COGNITIVE_METRICS: CognitiveMetricDefinition[] = [
  {
    key: 'frequency',
    label: 'Fréquence',
    description: 'Nombre de posts vus dans la thématique.',
    unit: 'posts',
  },
  {
    key: 'durationTotalMs',
    label: 'Durée totale',
    description: 'Temps d’exposition cumulé pour la thématique.',
    unit: 'ms',
  },
  {
    key: 'durationAverageMs',
    label: 'Durée moyenne',
    description: 'Temps moyen passé par post dans la thématique.',
    unit: 'ms',
  },
  {
    key: 'engagement',
    label: 'Engagement',
    description: 'Score moyen d’attention calculé à partir de la durée et du niveau d’attention.',
    unit: '0-100',
  },
  {
    key: 'engagedShare',
    label: 'Part engagée',
    description: 'Part des posts vus au niveau viewed/engaged.',
    unit: '%',
  },
  {
    key: 'politicalScore',
    label: 'Score politique',
    description: 'Score politique moyen des posts enrichis de la thématique.',
    unit: '0-4',
  },
  {
    key: 'polarization',
    label: 'Polarisation',
    description: 'Polarisation moyenne des posts enrichis de la thématique.',
    unit: '0-1',
  },
  {
    key: 'confidence',
    label: 'Confiance',
    description: 'Confiance moyenne des enrichissements.',
    unit: '0-1',
  },
];

const ATTENTION_SCORES: Record<string, number> = {
  skipped: 0,
  glanced: 33,
  viewed: 66,
  engaged: 100,
};

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'non-classe';
}

function parseTopics(post: PostEntry): string[] {
  const topics = post.enrichment ? safeParse(post.enrichment.mainTopics) : [];
  return topics.map(t => String(t).trim()).filter(Boolean);
}

function resolveTheme(post: PostEntry): { themeLabel: string; source: CognitiveThemeSource } {
  const topics = parseTopics(post);
  if (topics.length > 0) {
    return { themeLabel: topics[0], source: 'mainTopics' };
  }

  const mediaCategory = post.enrichment?.mediaCategory?.trim();
  if (mediaCategory) {
    return { themeLabel: mediaCategory, source: 'mediaCategory' };
  }

  return { themeLabel: 'non classifié', source: 'fallback' };
}

function resolveAttentionScore(post: PostEntry): number {
  const fromLevel = ATTENTION_SCORES[post.attentionLevel || ''];
  if (fromLevel !== undefined) return fromLevel;

  const dwellSec = Math.max(0, asNumber(post.dwellTimeMs) / 1000);
  if (dwellSec < 0.5) return ATTENTION_SCORES.skipped;
  if (dwellSec < 2) return ATTENTION_SCORES.glanced;
  if (dwellSec < 5) return ATTENTION_SCORES.viewed;
  return ATTENTION_SCORES.engaged;
}

function metricValue(theme: CognitiveThemeAggregate, key: CognitiveMetricKey): number {
  switch (key) {
    case 'frequency':
      return theme.postCount;
    case 'durationTotalMs':
      return theme.totalDwellTimeMs;
    case 'durationAverageMs':
      return theme.averageDwellTimeMs;
    case 'engagement':
      return theme.engagementScore;
    case 'engagedShare':
      return theme.engagedShare;
    case 'politicalScore':
      return theme.politicalScoreAverage;
    case 'polarization':
      return theme.polarizationAverage;
    case 'confidence':
      return theme.confidenceAverage;
  }
}

export function getCognitiveMetricDefinition(key: CognitiveMetricKey): CognitiveMetricDefinition | undefined {
  return COGNITIVE_METRICS.find(metric => metric.key === key);
}

export function getCognitiveMetricValue(theme: CognitiveThemeAggregate, key: CognitiveMetricKey): number {
  return metricValue(theme, key);
}

export function aggregateCognitiveThemes(posts: PostEntry[]): CognitiveThemeAggregate[] {
  const buckets = new Map<string, {
    themeLabel: string;
    source: CognitiveThemeSource;
    postCount: number;
    totalDwellTimeMs: number;
    attentionSum: number;
    engagedCount: number;
    politicalSum: number;
    politicalCount: number;
    polarizationSum: number;
    polarizationCount: number;
    confidenceSum: number;
    confidenceCount: number;
    enrichedPostCount: number;
    samplePostIds: string[];
    sampleUsers: Set<string>;
  }>();

  for (const post of posts) {
    const { themeLabel, source } = resolveTheme(post);
    const themeId = normalizeLabel(themeLabel);
    const dwellTimeMs = Math.max(0, asNumber(post.dwellTimeMs));
    const attentionScore = clamp(resolveAttentionScore(post), 0, 100);
    const enrichment = post.enrichment;

    let bucket = buckets.get(themeId);
    if (!bucket) {
      bucket = {
        themeLabel,
        source,
        postCount: 0,
        totalDwellTimeMs: 0,
        attentionSum: 0,
        engagedCount: 0,
        politicalSum: 0,
        politicalCount: 0,
        polarizationSum: 0,
        polarizationCount: 0,
        confidenceSum: 0,
        confidenceCount: 0,
        enrichedPostCount: 0,
        samplePostIds: [],
        sampleUsers: new Set<string>(),
      };
      buckets.set(themeId, bucket);
    }

    bucket.postCount += 1;
    bucket.totalDwellTimeMs += dwellTimeMs;
    bucket.attentionSum += attentionScore;
    if (attentionScore >= 66) bucket.engagedCount += 1;

    if (enrichment) {
      bucket.enrichedPostCount += 1;
      bucket.politicalSum += asNumber(enrichment.politicalScore);
      bucket.politicalCount += 1;

      bucket.polarizationSum += clamp(asNumber(enrichment.polarizationScore), 0, 1);
      bucket.polarizationCount += 1;

      bucket.confidenceSum += clamp(asNumber(enrichment.confidenceScore), 0, 1);
      bucket.confidenceCount += 1;
    }

    if (post.postId && bucket.samplePostIds.length < 5) {
      bucket.samplePostIds.push(post.postId);
    }
    if (post.username) {
      bucket.sampleUsers.add(post.username);
    }
  }

  const themes = [...buckets.entries()].map(([themeId, bucket]) => {
    const averageDwellTimeMs = bucket.postCount > 0 ? bucket.totalDwellTimeMs / bucket.postCount : 0;
    const engagementScore = bucket.postCount > 0 ? bucket.attentionSum / bucket.postCount : 0;
    const engagedShare = bucket.postCount > 0 ? (bucket.engagedCount / bucket.postCount) * 100 : 0;
    const politicalScoreAverage = bucket.politicalCount > 0 ? bucket.politicalSum / bucket.politicalCount : 0;
    const polarizationAverage = bucket.polarizationCount > 0 ? bucket.polarizationSum / bucket.polarizationCount : 0;
    const confidenceAverage = bucket.confidenceCount > 0 ? bucket.confidenceSum / bucket.confidenceCount : 0;

    const rawMetrics: Record<CognitiveMetricKey, number> = {
      frequency: bucket.postCount,
      durationTotalMs: bucket.totalDwellTimeMs,
      durationAverageMs: averageDwellTimeMs,
      engagement: engagementScore,
      engagedShare,
      politicalScore: politicalScoreAverage,
      polarization: polarizationAverage,
      confidence: confidenceAverage,
    };

    return {
      themeId,
      themeLabel: bucket.themeLabel,
      source: bucket.source,
      postCount: bucket.postCount,
      totalDwellTimeMs: bucket.totalDwellTimeMs,
      averageDwellTimeMs,
      engagementScore,
      engagedShare,
      politicalScoreAverage,
      polarizationAverage,
      confidenceAverage,
      enrichedPostCount: bucket.enrichedPostCount,
      samplePostIds: bucket.samplePostIds,
      sampleUsers: [...bucket.sampleUsers].slice(0, 5),
      rawMetrics,
    } satisfies CognitiveThemeAggregate;
  });

  return themes.sort((a, b) => {
    if (b.totalDwellTimeMs !== a.totalDwellTimeMs) return b.totalDwellTimeMs - a.totalDwellTimeMs;
    if (b.postCount !== a.postCount) return b.postCount - a.postCount;
    return a.themeLabel.localeCompare(b.themeLabel, 'fr');
  });
}

export function normalizeCognitiveThemes(
  themes: CognitiveThemeAggregate[],
): { themes: CognitiveThemeAggregate[]; metricRanges: CognitiveMetricRanges } {
  const ranges = COGNITIVE_METRICS.reduce((acc, metric) => {
    const values = themes.map(theme => metricValue(theme, metric.key));
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    acc[metric.key] = { min, max };
    return acc;
  }, {} as CognitiveMetricRanges);

  const normalizedThemes = themes.map(theme => {
    const normalizedMetrics = COGNITIVE_METRICS.reduce((acc, metric) => {
      const value = metricValue(theme, metric.key);
      const { min, max } = ranges[metric.key];
      acc[metric.key] = max === min
        ? (max === 0 ? 0 : 50)
        : ((value - min) / (max - min)) * 100;
      return acc;
    }, {} as Partial<Record<CognitiveMetricKey, number>>);

    return {
      ...theme,
      normalizedMetrics,
    };
  });

  return { themes: normalizedThemes, metricRanges: ranges };
}

export async function loadCognitiveBubbleData(options: CognitiveBubbleLoadOptions = {}): Promise<CognitiveBubbleDataset> {
  const sessions = await getSessions();
  const session = resolveSession(sessions, options.sessionId);
  if (!session) {
    const emptyThemes: CognitiveThemeAggregate[] = [];
    const normalized = normalizeCognitiveThemes(emptyThemes);
    return {
      session: null,
      posts: [],
      themes: normalized.themes,
      metricRanges: normalized.metricRanges,
      totalPosts: 0,
      totalAvailablePosts: 0,
      totalThemes: 0,
      isPartial: false,
    };
  }

  const totalAvailablePosts = session.postCount;
  const fetchLimit = options.limit ?? totalAvailablePosts;
  const posts = await getPosts(session.id, 0, fetchLimit);
  const themes = aggregateCognitiveThemes(posts);
  const normalized = normalizeCognitiveThemes(themes);

  return {
    session,
    posts,
    themes: normalized.themes,
    metricRanges: normalized.metricRanges,
    totalPosts: posts.length,
    totalAvailablePosts,
    totalThemes: normalized.themes.length,
    isPartial: posts.length < totalAvailablePosts,
  };
}

function resolveSession(sessions: SessionSummary[], sessionId?: string): SessionSummary | null {
  if (sessionId) {
    const byId = sessions.find(session => session.id === sessionId);
    if (byId) return byId;
  }

  if (sessions.length === 0) return null;

  return [...sessions].sort((a, b) => {
    if (b.capturedAt !== a.capturedAt) return b.capturedAt - a.capturedAt;
    return b.postCount - a.postCount;
  })[0] ?? null;
}
