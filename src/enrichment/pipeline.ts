/**
 * Pipeline d'enrichissement — orchestre normalize → rules → LLM → persist.
 * Mode batch (tous les posts non enrichis) ou incrémental.
 */
import prisma from '../db/client';
import { normalizePostText } from './normalize';
import { applyRules } from './rules-engine';
import type { LLMProvider } from './llm/provider';
import { ENRICHMENT_SYSTEM_PROMPT, buildEnrichmentPrompt } from './llm/prompts';

export interface EnrichmentOptions {
  llmProvider: LLMProvider;
  batchSize?: number;
  delayMs?: number; // délai entre appels LLM (rate limiting)
  rulesOnly?: boolean; // skip LLM, enrichissement rules-only
  dryRun?: boolean; // ne pas persister, juste afficher
  postIds?: string[]; // enrichir seulement ces posts
}

interface LLMEnrichmentResult {
  semantic_summary: string;
  main_topics: string[];
  secondary_topics: string[];
  content_domain: string;
  audience_target: string;
  persons: string[];
  organizations: string[];
  institutions: string[];
  countries: string[];
  tone: string;
  primary_emotion: string;
  emotion_intensity: number;
  political_explicitness_score: number;
  political_explicitness_justification: string;
  political_issue_tags: string[];
  public_policy_tags: string[];
  institutional_reference_score: number;
  activism_signal: boolean;
  polarization_score: number;
  polarization_justification: string;
  ingroup_outgroup_signal: boolean;
  conflict_signal: boolean;
  moral_absolute_signal: boolean;
  enemy_designation_signal: boolean;
  narrative_frame: string;
  call_to_action_type: string;
  problem_solution_pattern: string;
  media_message: string;
  media_intent: string;
  confidence_score: number;
}

function parseHashtags(json: string): string[] {
  try { return JSON.parse(json); } catch { return []; }
}

/**
 * Charge les posts à enrichir (ceux sans PostEnriched associé).
 */
async function loadPostsToEnrich(postIds?: string[], batchSize = 50) {
  const where = postIds
    ? { id: { in: postIds }, enrichment: null }
    : { enrichment: null };

  return prisma.post.findMany({
    where: where as any,
    take: batchSize,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Appelle le LLM pour enrichir un post.
 */
async function callLLM(
  provider: LLMProvider,
  normalizedText: string,
  username: string,
  hashtags: string[],
  mediaType: string,
  rulesResult: ReturnType<typeof applyRules>,
): Promise<LLMEnrichmentResult | null> {
  const prompt = buildEnrichmentPrompt({
    normalizedText,
    username,
    hashtags,
    mediaType,
    rulesHints: {
      mainTopics: rulesResult.mainTopics,
      politicalScore: rulesResult.politicalExplicitnessScore,
      polarizationScore: rulesResult.polarizationScore,
      detectedActors: rulesResult.politicalActors,
    },
  });

  try {
    const response = await provider.call(
      [
        { role: 'system', content: ENRICHMENT_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.2, maxTokens: 2000, responseFormat: 'json' },
    );

    return JSON.parse(response.content) as LLMEnrichmentResult;
  } catch (err) {
    console.error(`[enrich] LLM error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fusionne les résultats rules + LLM.
 * Le LLM a priorité sauf si son score de confiance est bas.
 */
function mergeResults(
  rules: ReturnType<typeof applyRules>,
  llm: LLMEnrichmentResult | null,
  normalizedText: string,
  language: string,
  keywordTerms: string[],
  providerName: string,
  modelName: string,
) {
  // Si pas de LLM, on utilise uniquement les règles
  if (!llm) {
    return {
      provider: 'rules',
      model: 'rules-v1',
      normalizedText,
      semanticSummary: '',
      keywordTerms: JSON.stringify(keywordTerms),
      mainTopics: JSON.stringify(rules.mainTopics),
      secondaryTopics: JSON.stringify(rules.secondaryTopics),
      contentDomain: '',
      audienceTarget: '',
      persons: '[]',
      organizations: '[]',
      institutions: JSON.stringify(rules.institutions),
      countries: '[]',
      locations: '[]',
      politicalActors: JSON.stringify(rules.politicalActors),
      tone: 'neutral',
      primaryEmotion: '',
      emotionIntensity: 0,
      politicalExplicitnessScore: rules.politicalExplicitnessScore,
      politicalIssueTags: JSON.stringify(rules.politicalIssueTags),
      publicPolicyTags: '[]',
      institutionalReferenceScore: rules.institutions.length > 0 ? 0.5 : 0,
      activismSignal: rules.activismSignal,
      polarizationScore: rules.polarizationScore,
      ingroupOutgroupSignal: rules.ingroupOutgroupSignal,
      conflictSignal: rules.conflictSignal,
      moralAbsoluteSignal: rules.moralAbsoluteSignal,
      enemyDesignationSignal: rules.enemyDesignationSignal,
      axisEconomic: rules.politicalAxes.economic,
      axisSocietal: rules.politicalAxes.societal,
      axisAuthority: rules.politicalAxes.authority,
      axisSystem: rules.politicalAxes.system,
      dominantAxis: rules.dominantAxis || '',
      mediaCategory: rules.mediaCategory,
      mediaQuality: rules.mediaQuality,
      narrativeFrame: '',
      callToActionType: 'aucun',
      problemSolutionPattern: '',
      mediaMessage: '',
      mediaIntent: '',
      confidenceScore: rules.confidenceScore * 0.6, // confiance réduite sans LLM
      reviewFlag: rules.confidenceScore < 0.4,
      reviewReason: rules.confidenceScore < 0.4 ? 'low_confidence_rules_only' : '',
    };
  }

  // Merge : LLM prend le lead, rules corrige si divergence forte
  const politicalScore = Math.max(rules.politicalExplicitnessScore, llm.political_explicitness_score);
  const polarizationScore = (rules.polarizationScore * 0.3 + llm.polarization_score * 0.7);
  const confidence = (rules.confidenceScore * 0.3 + llm.confidence_score * 0.7);

  // Flag review si forte divergence entre rules et LLM
  const politicalDivergence = Math.abs(rules.politicalExplicitnessScore - llm.political_explicitness_score);
  const polarizationDivergence = Math.abs(rules.polarizationScore - llm.polarization_score);
  const needsReview = politicalDivergence >= 2 || polarizationDivergence > 0.4 || confidence < 0.4;

  return {
    provider: providerName,
    model: modelName,
    normalizedText,
    semanticSummary: llm.semantic_summary,
    keywordTerms: JSON.stringify(keywordTerms),
    mainTopics: JSON.stringify(llm.main_topics),
    secondaryTopics: JSON.stringify(llm.secondary_topics),
    contentDomain: llm.content_domain,
    audienceTarget: llm.audience_target,
    persons: JSON.stringify(llm.persons),
    organizations: JSON.stringify(llm.organizations),
    institutions: JSON.stringify([...new Set([...rules.institutions, ...llm.institutions])]),
    countries: JSON.stringify(llm.countries),
    locations: '[]',
    politicalActors: JSON.stringify([...new Set([...rules.politicalActors, ...(llm.persons || [])])]),
    tone: llm.tone,
    primaryEmotion: llm.primary_emotion,
    emotionIntensity: llm.emotion_intensity,
    politicalExplicitnessScore: politicalScore,
    politicalIssueTags: JSON.stringify([...new Set([...rules.politicalIssueTags, ...llm.political_issue_tags])]),
    publicPolicyTags: JSON.stringify(llm.public_policy_tags),
    institutionalReferenceScore: llm.institutional_reference_score,
    activismSignal: rules.activismSignal || llm.activism_signal,
    polarizationScore: Math.round(polarizationScore * 100) / 100,
    ingroupOutgroupSignal: rules.ingroupOutgroupSignal || llm.ingroup_outgroup_signal,
    conflictSignal: rules.conflictSignal || llm.conflict_signal,
    moralAbsoluteSignal: rules.moralAbsoluteSignal || llm.moral_absolute_signal,
    enemyDesignationSignal: rules.enemyDesignationSignal || llm.enemy_designation_signal,
    axisEconomic: rules.politicalAxes.economic,
    axisSocietal: rules.politicalAxes.societal,
    axisAuthority: rules.politicalAxes.authority,
    axisSystem: rules.politicalAxes.system,
    dominantAxis: rules.dominantAxis || '',
    mediaCategory: rules.mediaCategory,
    mediaQuality: rules.mediaQuality,
    narrativeFrame: llm.narrative_frame,
    callToActionType: llm.call_to_action_type,
    problemSolutionPattern: llm.problem_solution_pattern,
    mediaMessage: llm.media_message || '',
    mediaIntent: llm.media_intent || '',
    confidenceScore: Math.round(confidence * 100) / 100,
    reviewFlag: needsReview,
    reviewReason: needsReview
      ? `divergence: political=${politicalDivergence}, polarization=${polarizationDivergence.toFixed(2)}`
      : '',
  };
}

/**
 * Enrichit un batch de posts.
 * Retourne le nombre de posts enrichis avec succès.
 */
export async function enrichBatch(options: EnrichmentOptions): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}> {
  const { llmProvider, batchSize = 20, delayMs = 500, rulesOnly = false, dryRun = false, postIds } = options;
  const stats = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };

  const posts = await loadPostsToEnrich(postIds, batchSize);
  console.log(`[enrich] ${posts.length} posts à enrichir`);

  for (const post of posts) {
    stats.processed++;
    const hashtags = parseHashtags(post.hashtags);

    // 1. Normalize (include video sources if available)
    const { normalizedText, language, keywordTerms } = normalizePostText({
      caption: post.caption,
      imageDesc: post.imageDesc,
      allText: post.allText,
      hashtags,
      ocrText: post.ocrText || undefined,
      subtitles: post.subtitles || undefined,
    });

    // Skip si texte trop court
    if (normalizedText.length < 5) {
      console.log(`[enrich] #${stats.processed} @${post.username} — skip (texte vide)`);
      stats.skipped++;
      continue;
    }

    // 2. Rules
    const rulesResult = applyRules({ normalizedText, hashtags, username: post.username });

    // 3. LLM (optionnel)
    let llmResult: LLMEnrichmentResult | null = null;
    if (!rulesOnly) {
      llmResult = await callLLM(llmProvider, normalizedText, post.username, hashtags, post.mediaType, rulesResult);
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }

    // 4. Merge
    const merged = mergeResults(
      rulesResult, llmResult, normalizedText, language, keywordTerms,
      rulesOnly ? 'rules' : llmProvider.name,
      rulesOnly ? 'rules-v1' : (llmResult ? llmProvider.name : 'rules-v1'),
    );

    // Log
    const pol = merged.politicalExplicitnessScore;
    const polar = merged.polarizationScore;
    const conf = merged.confidenceScore;
    const flag = merged.reviewFlag ? ' ⚠️ REVIEW' : '';
    console.log(`[enrich] #${stats.processed} @${post.username} — pol=${pol} polar=${polar} conf=${conf}${flag}`);

    if (dryRun) {
      console.log(JSON.stringify(merged, null, 2));
      stats.succeeded++;
      continue;
    }

    // 5. Persist
    try {
      await prisma.postEnriched.create({
        data: {
          postId: post.id,
          ...merged,
        },
      });
      stats.succeeded++;
    } catch (err) {
      console.error(`[enrich] persist error for ${post.id}:`, err instanceof Error ? err.message : err);
      stats.failed++;
    }
  }

  console.log(`[enrich] Done: ${stats.succeeded}/${stats.processed} enrichis, ${stats.failed} erreurs, ${stats.skipped} skippés`);
  return stats;
}
