/**
 * Graph Ingest Mobile — Transforme un enrichissement en observations de graphe.
 * Utilise le plugin Capacitor pour résoudre les entités et persister dans SQLite mobile.
 *
 * Réutilise la logique d'extraction d'observations du module PC (même algorithme).
 */

// ── Types ──────────────────────────────────────────────────────

export interface ObservationInput {
  entityName: string;
  entityType: string;
  relation: string;
  stance?: string;
  intensity?: number;
  confidence: number;
  evidence?: string;
  source: string;
}

export interface MobileEnrichment {
  mainTopics: string;
  secondaryTopics: string;
  subjects?: string;
  preciseSubjects?: string;
  politicalActors: string;
  institutions?: string;
  narrativeFrame: string;
  primaryEmotion: string;
  tone: string;
  confidenceScore: number;
  provider: string;
  persons?: string;
  organizations?: string;
  countries?: string;
  audienceTarget?: string;
}

// ── Plugin access ──────────────────────────────────────────────

function getPlugin(): any {
  return (window as any).Capacitor?.Plugins?.InstaWebView;
}

// ── Helpers ────────────────────────────────────────────────────

function safeParseArray(json: string | undefined): any[] {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}

function canonicalize(name: string): string {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// ── Observation extraction (same logic as PC) ──────────────────

export function extractObservations(enrichment: MobileEnrichment): ObservationInput[] {
  const obs: ObservationInput[] = [];
  const conf = enrichment.confidenceScore;
  const src = enrichment.provider;

  // Main topics → isAbout (intensity 1.0)
  for (const topic of safeParseArray(enrichment.mainTopics)) {
    if (typeof topic === 'string' && topic) {
      obs.push({ entityName: topic, entityType: 'Theme', relation: 'isAbout', intensity: 1.0, confidence: conf, source: src });
    }
  }

  // Secondary topics → isAbout (intensity 0.5)
  for (const topic of safeParseArray(enrichment.secondaryTopics)) {
    if (typeof topic === 'string' && topic) {
      obs.push({ entityName: topic, entityType: 'Theme', relation: 'isAbout', intensity: 0.5, confidence: conf, source: src });
    }
  }

  // Subjects (level 3)
  for (const subj of safeParseArray(enrichment.subjects)) {
    if (subj?.label) {
      obs.push({ entityName: subj.label, entityType: 'Subject', relation: 'isAbout', intensity: 0.8, confidence: conf, source: src });
    }
  }

  // Precise subjects (level 4) → takesPosition with stance
  for (const ps of safeParseArray(enrichment.preciseSubjects)) {
    if (ps?.id) {
      obs.push({
        entityName: ps.statement || ps.id, entityType: 'PreciseSubject',
        relation: 'takesPosition', stance: ps.position || 'neutre',
        intensity: ps.confidence || 0.5, confidence: ps.confidence || conf, source: src,
      });
    }
  }

  // Persons
  const personNames = new Set<string>();
  for (const person of safeParseArray(enrichment.persons)) {
    if (typeof person === 'string' && person) {
      personNames.add(canonicalize(person));
      obs.push({ entityName: person, entityType: 'Person', relation: 'mentions', confidence: conf, source: src });
    }
  }

  // Organizations
  for (const org of safeParseArray(enrichment.organizations)) {
    if (typeof org === 'string' && org) {
      obs.push({ entityName: org, entityType: 'Organization', relation: 'mentions', confidence: conf, source: src });
    }
  }

  // Institutions
  for (const inst of safeParseArray(enrichment.institutions)) {
    if (typeof inst === 'string' && inst) {
      obs.push({ entityName: inst, entityType: 'Institution', relation: 'mentions', confidence: conf, source: src });
    }
  }

  // Countries
  for (const country of safeParseArray(enrichment.countries)) {
    if (typeof country === 'string' && country) {
      obs.push({ entityName: country, entityType: 'Country', relation: 'mentions', confidence: conf, source: src });
    }
  }

  // Political actors (deduplicated against persons)
  for (const actor of safeParseArray(enrichment.politicalActors)) {
    if (typeof actor === 'string' && actor && !personNames.has(canonicalize(actor))) {
      obs.push({ entityName: actor, entityType: 'Person', relation: 'mentions', confidence: conf, source: src });
    }
  }

  // Narrative frame
  if (enrichment.narrativeFrame && enrichment.narrativeFrame !== 'aucun' && enrichment.narrativeFrame !== '') {
    obs.push({ entityName: enrichment.narrativeFrame, entityType: 'Narrative', relation: 'uses', confidence: conf, source: src });
  }

  // Emotion
  if (enrichment.primaryEmotion && enrichment.primaryEmotion !== 'neutre' && enrichment.primaryEmotion !== '') {
    obs.push({ entityName: enrichment.primaryEmotion, entityType: 'Emotion', relation: 'evokes', confidence: conf, source: src });
  }

  // Audience
  if (enrichment.audienceTarget && enrichment.audienceTarget !== '') {
    obs.push({ entityName: enrichment.audienceTarget, entityType: 'Audience', relation: 'targets', confidence: conf, source: src });
  }

  return obs;
}

// ── Graph ingest (via Capacitor plugin) ────────────────────────

export async function graphIngestMobile(
  postId: string,
  enrichment: MobileEnrichment,
): Promise<{ observationCount: number }> {
  const plugin = getPlugin();
  if (!plugin) return { observationCount: 0 };

  const observations = extractObservations(enrichment);
  if (observations.length === 0) return { observationCount: 0 };

  try {
    await plugin.saveGraphObservations({
      postId,
      observations: JSON.stringify(observations),
    });
    return { observationCount: observations.length };
  } catch (err) {
    console.error('[graph] ingest error:', err instanceof Error ? err.message : err);
    return { observationCount: 0 };
  }
}

// ── Graph stats query ──────────────────────────────────────────

export interface GraphStats {
  totalEntities: number;
  totalObservations: number;
  postsInGraph: number;
  entityTypes: Array<{ type: string; count: number }>;
  relationTypes: Array<{ relation: string; count: number }>;
  topEntities: Array<{ name: string; type: string; mentions: number }>;
  coOccurrences: Array<{ entity1: string; type1: string; entity2: string; type2: string; count: number }>;
  entityGroups: Array<{ type: string; members: Array<{ name: string; mentions: number }> }>;
  stanceDistribution: Array<{ stance: string; count: number }>;
}

export async function getGraphStats(): Promise<GraphStats | null> {
  const plugin = getPlugin();
  if (!plugin) return null;

  try {
    const result = await plugin.queryGraphStats();
    return JSON.parse(result.stats || '{}') as GraphStats;
  } catch (err) {
    console.error('[graph] queryGraphStats error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Backfill : peuple le graphe depuis les enrichissements existants ──

let backfillDone = false;

export async function backfillGraph(): Promise<{ processed: number }> {
  if (backfillDone) return { processed: 0 };

  const plugin = getPlugin();
  if (!plugin?.queryEnrichedWithoutGraph) return { processed: 0 };

  let totalProcessed = 0;
  const BATCH = 50;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await plugin.queryEnrichedWithoutGraph({ limit: BATCH });
    const posts: Array<MobileEnrichment & { postId: string }> = JSON.parse(result.posts || '[]');
    if (posts.length === 0) break;

    for (const post of posts) {
      try {
        const observations = extractObservations(post);
        if (observations.length > 0) {
          await plugin.saveGraphObservations({
            postId: post.postId,
            observations: JSON.stringify(observations),
          });
        }
        totalProcessed++;
      } catch {
        // skip individual errors
      }
    }

    console.log(`[graph:backfill] ${totalProcessed} posts ingested`);

    if (posts.length < BATCH) break; // dernière page
  }

  backfillDone = true;
  if (totalProcessed > 0) {
    console.log(`[graph:backfill] Done — ${totalProcessed} posts ingested`);
  }
  return { processed: totalProcessed };
}
