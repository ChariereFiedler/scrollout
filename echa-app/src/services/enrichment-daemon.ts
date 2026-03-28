/**
 * Enrichment Daemon Mobile — tourne dans l'app Capacitor,
 * enrichit automatiquement les posts via rules + LLM (OpenAI API).
 *
 * Architecture:
 * 1. Vérifie périodiquement les posts non enrichis (via plugin Capacitor → SQLite)
 * 2. Applique les rules (enrichment.js réutilisé)
 * 3. Appelle l'API OpenAI pour enrichissement LLM
 * 4. Sauvegarde via plugin Capacitor → SQLite
 */

import {
  callOpenAI,
  buildEnrichmentPrompt,
  SYSTEM_PROMPT,
  type LLMConfig,
  type LLMMessage,
} from './llm-mobile';
import { applyRulesShared, inferFallbackTopic, type RulesInput } from './rules-engine-shared';

// ── Types ────────────────────────────────────────────────────

interface UnenrichedPost {
  id: string;           // DB row id (sessionId:username:postId)
  postId: string;       // Instagram post id
  username: string;
  caption: string;
  fullCaption: string;
  hashtags: string;     // JSON array
  imageAlts: string;    // JSON array
  allText: string;
  ocrText: string;
  mlkitLabels: string;  // JSON array
  mediaType: string;
  isSponsored: boolean;
  isSuggested: boolean;
  imageUrls: string;    // JSON array of CDN URLs
  videoUrl: string;     // CDN URL for video/reel
}

interface LLMEnrichmentResult {
  semantic_summary: string;
  main_topics: string[];
  secondary_topics: string[];
  tone: string;
  primary_emotion: string;
  emotion_intensity: number;
  political_explicitness_score: number;
  polarization_score: number;
  narrative_frame: string;
  confidence_score: number;
}

export interface DaemonConfig {
  /** Intervalle de vérification en secondes (défaut: 120) */
  intervalSec: number;
  /** Taille du batch (défaut: 10) */
  batchSize: number;
  /** Seuil minimum de posts pour déclencher un batch (défaut: 3) */
  threshold: number;
  /** Clé API OpenAI */
  apiKey: string;
  /** Modèle OpenAI (défaut: gpt-4o-mini) */
  model?: string;
  /** Mode rules-only (pas de LLM) */
  rulesOnly?: boolean;
  /** Active la transcription Whisper API pour vidéos sans texte */
  enableTranscription?: boolean;
  /** Active l'analyse vision pour posts visuels à faible signal */
  enableVision?: boolean;
}

export interface DaemonStatus {
  running: boolean;
  lastCheckAt: string | null;
  lastEnrichAt: string | null;
  pendingPosts: number;
  totalProcessed: number;
  totalSucceeded: number;
  totalFailed: number;
  totalSkipped: number;
}

// TODO: Pour la production, supprimer la clé hardcodée et forcer la saisie utilisateur.
// La clé est injectée ici pour la démo uniquement (app non distribuée).

// ── Plugin access ────────────────────────────────────────────

function getPlugin(): any {
  return (window as any).Capacitor?.Plugins?.InstaWebView;
}

// ── Rules engine (shared module — même code que le PC) ───────

function applyRulesFromShared(post: UnenrichedPost): ReturnType<typeof applyRulesShared> | null {
  try {
    const hashtags = safeParseArray(post.hashtags);
    return applyRulesShared({
      username: post.username,
      caption: post.caption,
      fullCaption: post.fullCaption,
      imageAlts: post.imageAlts,
      allText: post.allText,
      hashtags,
      ocrText: post.ocrText,
      mlkitLabelsText: safeParseArray(post.mlkitLabels).length > 0 ? post.mlkitLabels : undefined,
      isSponsored: post.isSponsored,
    });
  } catch (err) {
    log(`rules error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function safeParseArray(json: string): string[] {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}

// ── Daemon state ─────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let processing = false;
let config: DaemonConfig | null = null;
let listeners: Array<(status: DaemonStatus) => void> = [];

const stats: DaemonStatus = {
  running: false,
  lastCheckAt: null,
  lastEnrichAt: null,
  pendingPosts: 0,
  totalProcessed: 0,
  totalSucceeded: 0,
  totalFailed: 0,
  totalSkipped: 0,
};

function log(msg: string) {
  console.log(`[enrich:daemon] ${msg}`);
}

function notify() {
  for (const fn of listeners) fn({ ...stats });
}

// ── Core logic ───────────────────────────────────────────────

async function countPending(): Promise<number> {
  const plugin = getPlugin();
  if (!plugin) return 0;
  const result = await plugin.countUnenrichedPosts();
  return result.count || 0;
}

async function fetchUnenriched(limit: number): Promise<UnenrichedPost[]> {
  const plugin = getPlugin();
  if (!plugin) return [];
  const result = await plugin.queryUnenrichedPosts({ limit });
  return JSON.parse(result.posts || '[]');
}

async function saveEnrichment(dbPostId: string, enrichment: Record<string, any>): Promise<void> {
  const plugin = getPlugin();
  if (!plugin) return;
  await plugin.saveEnrichmentFromApp({
    dbPostId,
    enrichment: JSON.stringify(enrichment),
  });
}

// ── Enrichment level selection ───────────────────────────────

type EnrichmentLevel = 'rules-only' | 'text-llm' | 'vision';

function selectEnrichmentLevel(
  rulesConfidence: number,
  post: UnenrichedPost,
  llmConfig: LLMConfig | null,
  hasExtraVideoText: boolean,
): EnrichmentLevel {
  if (!llmConfig) return 'rules-only';
  if (rulesConfidence >= 0.65) return 'rules-only';
  if (rulesConfidence >= 0.35 || hasExtraVideoText) return 'text-llm';

  // Low confidence — use vision if images available
  const images = safeParseArray(post.imageUrls);
  if (images.length > 0 && config?.enableVision) return 'vision';

  return 'text-llm';
}

/**
 * Tente d'enrichir le signal vidéo : OCR existant puis Whisper API si nécessaire.
 * Retourne le texte additionnel à injecter, ou '' si rien de plus.
 */
async function enrichVideoSignal(
  post: UnenrichedPost,
  normalizedText: string,
  llmConfig: LLMConfig | null,
): Promise<{ text: string; source: 'ocr' | 'whisper' | 'none' }> {
  // L'OCR est déjà intégré dans normalizedText via rules-engine-shared.
  // Vérifier si le texte normalisé contient assez de signal.
  const words = normalizedText.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 20) {
    return { text: '', source: 'ocr' }; // OCR/subtitles suffisent
  }

  // Pas assez de texte — tenter Whisper API si activé et videoUrl dispo
  if (!config?.enableTranscription || !llmConfig?.apiKey || !post.videoUrl) {
    return { text: '', source: 'none' };
  }

  try {
    const { callWhisperAPI, evaluateTranscriptionQuality } = await import('./llm-mobile');
    const transcription = await callWhisperAPI(post.videoUrl, llmConfig.apiKey);

    if (!transcription) {
      log(`whisper @${post.username} — pas de réponse`);
      return { text: '', source: 'none' };
    }

    const quality = evaluateTranscriptionQuality(transcription);
    if (!quality.acceptable) {
      log(`whisper @${post.username} — qualité insuffisante: ${quality.reason}`);
      return { text: '', source: 'none' };
    }

    log(`whisper @${post.username} — ${transcription.length} chars, qualité OK`);
    return { text: `[AUDIO_TRANSCRIPT] ${transcription}`, source: 'whisper' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`whisper error @${post.username}: ${msg}`);
    return { text: '', source: 'none' };
  }
}

// ── Build enrichment data from rules ────────────────────────

function buildRulesEnrichment(
  rulesResult: ReturnType<typeof applyRulesShared>,
  normalizedText: string,
  post: UnenrichedPost,
  reviewFlag = false,
  reviewReason = '',
): Record<string, any> {
  const rulesTopics = rulesResult.mainTopics?.length
    ? rulesResult.mainTopics
    : [inferFallbackTopic(post.username, post.mediaType)];

  return {
    provider: 'rules',
    model: 'rules-v1',
    normalizedText,
    domains: JSON.stringify(rulesResult.domains || []),
    mainTopics: JSON.stringify(rulesTopics),
    secondaryTopics: JSON.stringify(rulesResult.secondaryTopics || []),
    politicalActors: JSON.stringify(rulesResult.politicalActors || []),
    institutions: JSON.stringify(rulesResult.institutions || []),
    politicalExplicitnessScore: rulesResult.politicalExplicitnessScore || 0,
    politicalIssueTags: JSON.stringify(rulesResult.politicalIssueTags || []),
    polarizationScore: rulesResult.polarizationScore || 0,
    ingroupOutgroupSignal: rulesResult.ingroupOutgroupSignal || false,
    conflictSignal: rulesResult.conflictSignal || false,
    moralAbsoluteSignal: rulesResult.moralAbsoluteSignal || false,
    enemyDesignationSignal: rulesResult.enemyDesignationSignal || false,
    activismSignal: rulesResult.activismSignal || false,
    axisEconomic: rulesResult.politicalAxes?.economic || 0,
    axisSocietal: rulesResult.politicalAxes?.societal || 0,
    axisAuthority: rulesResult.politicalAxes?.authority || 0,
    axisSystem: rulesResult.politicalAxes?.system || 0,
    dominantAxis: rulesResult.dominantAxis || '',
    mediaCategory: rulesResult.mediaCategory || '',
    mediaQuality: rulesResult.mediaQuality || '',
    confidenceScore: (rulesResult.confidenceScore || 0.3) * 0.6,
    reviewFlag: reviewFlag ? 1 : 0,
    reviewReason,
  };
}

// ── Merge rules + LLM ───────────────────────────────────────

function mergeLLMResult(
  enrichment: Record<string, any>,
  llm: LLMEnrichmentResult,
  rulesResult: ReturnType<typeof applyRulesShared>,
  post: UnenrichedPost,
  model: string,
): Record<string, any> {
  const polScore = Math.max(
    rulesResult.politicalExplicitnessScore || 0,
    llm.political_explicitness_score || 0,
  );
  const polarScore = Math.round(
    ((rulesResult.polarizationScore || 0) * 0.3 + (llm.polarization_score || 0) * 0.7) * 100,
  ) / 100;
  const conf = Math.round(
    ((rulesResult.confidenceScore || 0.3) * 0.3 + (llm.confidence_score || 0.5) * 0.7) * 100,
  ) / 100;

  const mergedTopics = llm.main_topics?.length ? llm.main_topics
    : rulesResult.mainTopics?.length ? rulesResult.mainTopics
    : [inferFallbackTopic(post.username, post.mediaType)];

  // Divergence detection → review flag
  const polDiv = Math.abs((rulesResult.politicalExplicitnessScore || 0) - (llm.political_explicitness_score || 0));
  const polarDiv = Math.abs((rulesResult.polarizationScore || 0) - (llm.polarization_score || 0));
  const needsReview = polDiv >= 2 || polarDiv > 0.4 || conf < 0.4;

  return {
    ...enrichment,
    provider: 'openai',
    model,
    mainTopics: JSON.stringify(mergedTopics),
    secondaryTopics: JSON.stringify(llm.secondary_topics || []),
    politicalExplicitnessScore: polScore,
    polarizationScore: polarScore,
    confidenceScore: conf,
    tone: llm.tone || '',
    semanticSummary: llm.semantic_summary || '',
    primaryEmotion: llm.primary_emotion || '',
    narrativeFrame: llm.narrative_frame || '',
    ingroupOutgroupSignal: (llm as any).ingroup_outgroup_signal || enrichment.ingroupOutgroupSignal,
    conflictSignal: (llm as any).conflict_signal || enrichment.conflictSignal,
    moralAbsoluteSignal: (llm as any).moral_absolute_signal || enrichment.moralAbsoluteSignal,
    enemyDesignationSignal: (llm as any).enemy_designation_signal || enrichment.enemyDesignationSignal,
    activismSignal: (llm as any).activism_signal || enrichment.activismSignal,
    reviewFlag: needsReview ? 1 : 0,
    reviewReason: needsReview ? `divergence: pol=${polDiv}, polar=${polarDiv.toFixed(2)}` : '',
  };
}

// ── Main enrichment function with cascade ───────────────────

async function enrichPost(
  post: UnenrichedPost,
  llmConfig: LLMConfig | null,
): Promise<'success' | 'skipped' | 'failed'> {
  // ━━ Phase 1 — Rules (toujours, gratuit) ━━
  const rulesResult = applyRulesFromShared(post);
  if (!rulesResult) {
    log(`skip @${post.username} — rules engine error`);
    return 'skipped';
  }

  let normalizedText = rulesResult.normalizedText || '';
  const words = normalizedText.split(/\s+/).filter((w: string) => w.length > 2);
  if (normalizedText.length < 10 || words.length < 3) {
    log(`skip @${post.username} — texte insuffisant`);
    return 'skipped';
  }

  // ━━ Phase 2 — Signal vidéo (si video/reel + confiance basse) ━━
  let videoSource: 'ocr' | 'whisper' | 'none' = 'none';
  if (['video', 'reel'].includes(post.mediaType) && rulesResult.confidenceScore < 0.65) {
    const videoSignal = await enrichVideoSignal(post, normalizedText, llmConfig);
    if (videoSignal.text) {
      normalizedText = normalizedText + '\n\n' + videoSignal.text;
      videoSource = videoSignal.source;
    }
  }

  // ━━ Phase 3 — Décision : quel niveau d'enrichissement ? ━━
  const level = selectEnrichmentLevel(
    rulesResult.confidenceScore,
    post,
    llmConfig,
    videoSource !== 'none',
  );

  let enrichment = buildRulesEnrichment(rulesResult, normalizedText, post);

  if (level === 'rules-only') {
    log(`@${post.username} — rules-only conf=${enrichment.confidenceScore} [${rulesResult.mainTopics}]`);
    // Add audio transcription if captured
    if (videoSource === 'whisper') {
      enrichment.audioTranscription = normalizedText.split('[AUDIO_TRANSCRIPT] ')[1] || '';
    }
  } else if (level === 'text-llm' || level === 'vision') {
    try {
      const hashtags = safeParseArray(post.hashtags);
      let llmResponse;

      if (level === 'vision') {
        // Vision mode — image + texte
        const images = safeParseArray(post.imageUrls);
        const { callOpenAIVision } = await import('./llm-mobile');
        llmResponse = await callOpenAIVision(
          images[0],
          { normalizedText, username: post.username, hashtags, mediaType: post.mediaType },
          llmConfig!,
        );
        log(`@${post.username} — vision used`);
      } else {
        // Text-only LLM
        const prompt = buildEnrichmentPrompt({
          normalizedText,
          username: post.username,
          hashtags,
          mediaType: post.mediaType,
          rulesHints: {
            mainTopics: rulesResult.mainTopics,
            politicalScore: rulesResult.politicalExplicitnessScore,
            polarizationScore: rulesResult.polarizationScore,
            detectedActors: rulesResult.politicalActors,
          },
        });

        const messages: LLMMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ];
        llmResponse = await callOpenAI(messages, llmConfig!);
      }

      const llm: LLMEnrichmentResult = JSON.parse(llmResponse.content);
      enrichment = mergeLLMResult(enrichment, llm, rulesResult, post, llmResponse.model);

      if (videoSource === 'whisper') {
        enrichment.audioTranscription = normalizedText.split('[AUDIO_TRANSCRIPT] ')[1] || '';
      }

      log(`@${post.username} — ${level} pol=${enrichment.politicalExplicitnessScore} conf=${enrichment.confidenceScore}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`LLM error @${post.username}: ${msg} — fallback rules`);
    }
  }

  // ━━ Persist ━━
  try {
    await saveEnrichment(post.id, enrichment);
    return 'success';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`persist error @${post.username}: ${msg}`);
    return 'failed';
  }
}

async function tick() {
  if (processing || !config) return;
  processing = true;

  try {
    stats.lastCheckAt = new Date().toISOString();
    const pending = await countPending();
    stats.pendingPosts = pending;

    if (pending < config.threshold) {
      log(`${pending} post(s) en attente (seuil: ${config.threshold}) — skip`);
      notify();
      return;
    }

    log(`${pending} posts en attente — batch de ${Math.min(pending, config.batchSize)}`);

    const posts = await fetchUnenriched(config.batchSize);

    const llmConfig: LLMConfig | null = config.rulesOnly
      ? null
      : { apiKey: config.apiKey, model: config.model };

    for (const post of posts) {
      const result = await enrichPost(post, llmConfig);
      stats.totalProcessed++;
      if (result === 'success') stats.totalSucceeded++;
      else if (result === 'failed') stats.totalFailed++;
      else stats.totalSkipped++;

      // Rate limiting entre appels (seulement si LLM actif)
      if (llmConfig) await sleep(300);
    }

    stats.lastEnrichAt = new Date().toISOString();
    log(`Batch terminé: ${stats.totalSucceeded} enrichis`);
    notify();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Erreur tick: ${msg}`);
  } finally {
    processing = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Public API ───────────────────────────────────────────────

export function startDaemon(daemonConfig: DaemonConfig): void {
  if (stats.running) {
    log('Daemon déjà en cours');
    return;
  }

  config = daemonConfig;
  stats.running = true;

  log(`Démarré — intervalle: ${config.intervalSec}s, batch: ${config.batchSize}, seuil: ${config.threshold}, LLM: ${config.rulesOnly ? 'non' : 'oui'}`);
  notify();

  // Premier tick immédiat
  tick();

  // Puis périodique
  intervalHandle = setInterval(() => tick(), config.intervalSec * 1000);
}

export function stopDaemon(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  stats.running = false;
  config = null;
  log(`Arrêté — total: ${stats.totalSucceeded} enrichis`);
  notify();
}

export function getDaemonStatus(): DaemonStatus {
  return { ...stats };
}

export function onStatusChange(fn: (status: DaemonStatus) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}

/** Déclenche un enrichissement immédiat (hors cycle) */
export async function triggerNow(): Promise<void> {
  if (processing) {
    log('Enrichissement déjà en cours');
    return;
  }
  await tick();
}
