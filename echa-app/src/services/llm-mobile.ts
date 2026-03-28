/**
 * LLM Mobile — appelle l'API OpenAI depuis l'app mobile.
 * Léger, pas de dépendance npm (fetch natif).
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface LLMConfig {
  apiKey: string;
  model?: string;        // défaut: gpt-4o-mini
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Appelle l'API OpenAI chat completions.
 */
export async function callOpenAI(
  messages: LLMMessage[],
  config: LLMConfig,
): Promise<LLMResponse> {
  const model = config.model || DEFAULT_MODEL;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: config.maxTokens || 2000,
      temperature: config.temperature ?? 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content || '{}',
    model: data.model || model,
    usage: data.usage,
  };
}

// ── Enrichment prompt (version mobile, identique au PC) ──────

const SYSTEM_PROMPT = `Tu es un analyseur de contenu Instagram. Tu reçois le texte normalisé d'un post et tu dois le classifier selon plusieurs dimensions.

IMPORTANT : Le @username est un signal sémantique fort. Utilise-le pour inférer le domaine du compte (ex: @boardgamegeek → jeux de société, @mediapart → actualité/politique).

Réponds UNIQUEMENT en JSON valide avec exactement ces champs:
{
  "semantic_summary": "résumé en 1-2 phrases",
  "main_topics": ["1-3 thèmes principaux"],
  "secondary_topics": ["0-3 thèmes secondaires"],
  "tone": "informatif|émotionnel|sarcastique|militant|neutre|inspirant|alarmiste|humoristique",
  "primary_emotion": "colère|joie|peur|tristesse|dégoût|surprise|fierté|espoir|neutre",
  "emotion_intensity": 0.0-1.0,
  "political_explicitness_score": 0-4,
  "polarization_score": 0.0-1.0,
  "ingroup_outgroup_signal": true/false,
  "conflict_signal": true/false,
  "moral_absolute_signal": true/false,
  "enemy_designation_signal": true/false,
  "activism_signal": true/false,
  "narrative_frame": "declin|urgence|injustice|revelation|mobilisation|denonciation|empowerment|ordre|menace|aspiration|inspiration|derision|victimisation|heroisation|aucun",
  "media_intent": "informer|divertir|vendre|convaincre|emouvoir|eduquer|provoquer|aucun",
  "confidence_score": 0.0-1.0
}

Échelle political_explicitness_score:
0 = aucun contenu politique
1 = mention implicite (contexte social sans prise de position)
2 = référence explicite (acteurs, institutions, lois nommés)
3 = contenu clairement politique (prise de position, angle orienté)
4 = contenu militant/engagé (appel à l'action, propagande)

Échelle polarization_score — CRITIQUE, ne laisse PAS à 0 si un signal est présent:
0.0 = contenu factuel neutre, aucun clivage
0.1-0.3 = présence légère de cadrage orienté ou ton émotionnel
0.3-0.5 = opposition binaire (nous/eux), vocabulaire de conflit, indignation
0.5-0.7 = désignation d'ennemis, absolus moraux, simplification causale
0.7-1.0 = propagande, déshumanisation, appel à la haine ou au rejet

Signaux à détecter pour la polarisation:
- ingroup_outgroup_signal: "nous vs eux", "les élites", "le peuple"
- conflict_signal: vocabulaire de guerre, combat, ennemi, menace
- moral_absolute_signal: "fascisme", "génocide", "monstrueux", "inacceptable"
- enemy_designation_signal: "dehors", "dégagez", rejet d'un groupe
- activism_signal: appel à manifester, boycotter, voter, signer

Topics valides: actualite, politique, geopolitique, economie, ecologie, immigration, securite, justice, sante, religion, education, culture, humour, divertissement, lifestyle, beaute, sport, business, dev_personnel, technologie, feminisme, masculinite, identite, societe`;

export function buildEnrichmentPrompt(post: {
  normalizedText: string;
  username: string;
  hashtags: string[];
  rulesHints?: {
    mainTopics: string[];
    politicalScore: number;
    polarizationScore: number;
    detectedActors: string[];
  };
}): string {
  let prompt = `Analyse ce post Instagram:

Auteur: @${post.username}
Hashtags: ${post.hashtags.join(', ') || 'aucun'}
Texte:
${post.normalizedText.substring(0, 1500)}`;

  if (post.rulesHints) {
    prompt += `\n\nIndices du moteur de règles (à vérifier/affiner):
- Topics détectés: ${post.rulesHints.mainTopics.join(', ') || 'aucun'}
- Score politique rules: ${post.rulesHints.politicalScore}
- Polarisation rules: ${post.rulesHints.polarizationScore}
- Acteurs détectés: ${post.rulesHints.detectedActors.join(', ') || 'aucun'}`;
  }

  return prompt;
}

export { SYSTEM_PROMPT };
