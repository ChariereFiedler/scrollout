/**
 * ECHA Visualizer — REST API routes via Prisma.
 */

import { IncomingMessage, ServerResponse } from 'http';
import prisma from '../db/client';

type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void>;

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  {
    method: 'GET',
    pattern: /^\/api\/sessions$/,
    handler: async (_req, res) => {
      const sessions = await prisma.session.findMany({
        orderBy: { capturedAt: 'desc' },
        take: 50,
        include: { _count: { select: { posts: true } } },
      });
      json(res, sessions);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/sessions\/([^/]+)\/posts$/,
    handler: async (_req, res, params) => {
      const posts = await prisma.post.findMany({
        where: { sessionId: params.id },
        orderBy: { dwellTimeMs: 'desc' },
      });
      json(res, posts);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/posts\/([^/]+)$/,
    handler: async (_req, res, params) => {
      const post = await prisma.post.findUnique({
        where: { id: params.id },
        include: { enrichment: true },
      });
      if (!post) { json(res, { error: 'Not found' }, 404); return; }
      json(res, post);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/stats$/,
    handler: async (_req, res) => {
      const [totalSessions, totalPosts, categories, attention, topUsers] = await Promise.all([
        prisma.session.count(),
        prisma.post.count(),
        prisma.post.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
        prisma.post.groupBy({ by: ['attentionLevel'], _count: true }),
        prisma.post.groupBy({ by: ['username'], _count: true, orderBy: { _count: { username: 'desc' } }, take: 20 }),
      ]);
      json(res, { totalSessions, totalPosts, categories, attention, topUsers });
    },
  },
  // ── Enrichment endpoints ──────────────────────────────────────────
  {
    method: 'GET',
    pattern: /^\/api\/enrichment\/stats$/,
    handler: async (_req, res) => {
      const [totalPosts, totalEnriched, byPolitical, byNarrative, reviewFlagged] = await Promise.all([
        prisma.post.count(),
        prisma.postEnriched.count(),
        prisma.postEnriched.groupBy({ by: ['politicalExplicitnessScore'], _count: true, orderBy: { politicalExplicitnessScore: 'asc' } }),
        prisma.postEnriched.groupBy({ by: ['narrativeFrame'], _count: true, orderBy: { _count: { narrativeFrame: 'desc' } } }),
        prisma.postEnriched.count({ where: { reviewFlag: true } }),
      ]);

      // Aggregate polarization buckets
      const allEnriched = await prisma.postEnriched.findMany({ select: { polarizationScore: true, mainTopics: true, confidenceScore: true } });
      const polarBuckets = { low: 0, medium: 0, high: 0, extreme: 0 };
      let polarSum = 0;
      let confSum = 0;
      const topicCounts: Record<string, number> = {};

      for (const e of allEnriched) {
        const p = e.polarizationScore;
        polarSum += p;
        confSum += e.confidenceScore;
        if (p < 0.2) polarBuckets.low++;
        else if (p < 0.5) polarBuckets.medium++;
        else if (p < 0.8) polarBuckets.high++;
        else polarBuckets.extreme++;

        try {
          const topics = JSON.parse(e.mainTopics) as string[];
          for (const t of topics) { topicCounts[t] = (topicCounts[t] || 0) + 1; }
        } catch { /* ignore */ }
      }

      const n = allEnriched.length || 1;
      const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

      json(res, {
        totalPosts,
        totalEnriched,
        enrichmentRate: totalPosts > 0 ? Math.round(totalEnriched / totalPosts * 100) : 0,
        avgPolarization: Math.round(polarSum / n * 100) / 100,
        avgConfidence: Math.round(confSum / n * 100) / 100,
        reviewFlagged,
        byPolitical,
        byNarrative: byNarrative.filter(n => n.narrativeFrame !== ''),
        polarBuckets,
        topTopics,
      });
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/enrichment\/posts$/,
    handler: async (req, res) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const politicalMin = parseInt(url.searchParams.get('political_min') || '0', 10);
      const politicalMax = parseInt(url.searchParams.get('political_max') || '4', 10);
      const narrative = url.searchParams.get('narrative') || undefined;
      const reviewOnly = url.searchParams.get('review') === '1';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

      const where: any = {
        politicalExplicitnessScore: { gte: politicalMin, lte: politicalMax },
      };
      if (narrative) where.narrativeFrame = narrative;
      if (reviewOnly) where.reviewFlag = true;

      const posts = await prisma.postEnriched.findMany({
        where,
        take: limit,
        orderBy: { polarizationScore: 'desc' },
        include: { post: { select: { username: true, caption: true, mediaType: true, attentionLevel: true, dwellTimeMs: true, isSponsored: true } } },
      });

      json(res, posts);
    },
  },
  // ── Debug history / session metrics ───────────────────────────────
  {
    method: 'GET',
    pattern: /^\/api\/debug\/history$/,
    handler: async (_req, res) => {
      const sessions = await prisma.session.findMany({
        where: { captureMode: 'visualizer-live' },
        orderBy: { capturedAt: 'desc' },
        take: 50,
        include: { metrics: true, _count: { select: { posts: true } } },
      });

      const history = sessions.map(s => ({
        sessionId: s.id,
        capturedAt: s.capturedAt,
        durationSec: s.durationSec,
        totalPosts: s.totalPosts,
        totalEvents: s.totalEvents,
        metrics: s.metrics ? {
          parseRate: s.metrics.parseRate,
          parseErrors: s.metrics.parseErrors,
          chunkSuccess: s.metrics.chunkSuccess,
          chunkFails: s.metrics.chunkFails,
          bridgeEvents: s.metrics.bridgeEvents,
          bridgeErrors: s.metrics.bridgeErrors,
          mlkitResults: s.metrics.mlkitResults,
          enrichedPosts: s.metrics.enrichedPosts,
          avgPoliticalScore: s.metrics.avgPoliticalScore,
          avgPolarization: s.metrics.avgPolarization,
          avgConfidence: s.metrics.avgConfidence,
        } : null,
      }));

      json(res, history);
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/debug\/session\/([^/]+)$/,
    handler: async (_req, res, params) => {
      const metrics = await prisma.sessionMetrics.findUnique({
        where: { sessionId: params.id },
      });
      if (!metrics) { json(res, { error: 'Not found' }, 404); return; }

      const enrichedPosts = await prisma.postEnriched.findMany({
        where: { post: { sessionId: params.id } },
        include: { post: { select: { username: true, caption: true, mediaType: true, dwellTimeMs: true } } },
        orderBy: { polarizationScore: 'desc' },
      });

      json(res, {
        metrics,
        errorLog: JSON.parse(metrics.errorLog || '[]'),
        enrichedPosts,
      });
    },
  },
];

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const method = req.method || 'GET';

  for (const route of routes) {
    if (route.method !== method) continue;
    const match = url.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      if (match[1]) params.id = decodeURIComponent(match[1]);
      try {
        await route.handler(req, res, params);
      } catch (err) {
        console.error(`[api] Error ${url}:`, err);
        json(res, { error: 'Internal server error' }, 500);
      }
      return true;
    }
  }
  return false;
}
