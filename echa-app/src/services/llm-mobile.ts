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

const SYSTEM_PROMPT = `Tu es un analyste de contenu spécialisé dans l'analyse de posts Instagram francophones.
Tu dois produire une analyse structurée en JSON, rigoureuse et factuelle.

IMPORTANT :
- Tu mesures le CONTENU du post, pas l'opinion de l'auteur ni du lecteur.
- Tu évalues l'EXPOSITION à un type de contenu, pas l'adhésion.
- Sois conservateur dans tes scores : en cas de doute, score bas.
- main_topics ne doit JAMAIS être vide []. Même un post très pauvre a un domaine identifiable via le username ou le type de média.

Réponds UNIQUEMENT en JSON valide.`;

export function buildEnrichmentPrompt(post: {
  normalizedText: string;
  username: string;
  hashtags: string[];
  mediaType?: string;
  rulesHints?: {
    mainTopics: string[];
    politicalScore: number;
    polarizationScore: number;
    detectedActors: string[];
  };
}): string {
  const rulesContext = post.rulesHints?.mainTopics.length
    ? `\nIndices pré-calculés (règles) : topics=[${post.rulesHints.mainTopics.join(',')}], political_score=${post.rulesHints.politicalScore}, polarization=${post.rulesHints.polarizationScore}, actors=[${post.rulesHints.detectedActors.join(',')}]`
    : '';

  return `Analyse ce post Instagram et produis un JSON structuré.

IMPORTANT — RÈGLES CRITIQUES :
1. Le @username est un signal sémantique fort (ex: @boardgamegeek → jeux de société, @franceculture → culture/média).
2. main_topics ne doit JAMAIS être vide []. En dernier recours, utilise "divertissement" ou "lifestyle".

--- POST ---
Auteur : @${post.username}
Type : ${post.mediaType || 'photo'}
Hashtags : ${post.hashtags.join(', ') || '(aucun)'}
Texte :
${post.normalizedText.substring(0, 1500)}
${rulesContext}
--- FIN POST ---

LISTE DES 24 THÈMES (utilise UNIQUEMENT ces identifiants) :
- actualite : info, breaking news, faits divers
- politique : élections, partis, lois, institutions FR
- geopolitique : conflits internationaux, diplomatie
- economie : emploi, inflation, pouvoir d'achat
- ecologie : climat, biodiversité, pollution
- immigration : migration, intégration, frontières
- securite : police, délinquance, terrorisme
- justice : droit, procès, réformes judiciaires
- sante : médecine, bien-être physique
- religion : islam, christianisme, laïcité, spiritualité
- education : école, université, formation
- culture : cinéma, musique, séries, littérature, art
- humour : memes, satire, parodie
- divertissement : gaming, jeux de société, people, anime, contenus viraux
- lifestyle : food, voyage, déco, animaux
- beaute : skincare, maquillage, coiffure, mode
- sport : football, fitness, MMA, JO (PAS jeux de société)
- business : entrepreneuriat, crypto, coaching, investissement
- developpement_personnel : méditation, motivation, astrologie
- technologie : IA, dev, gadgets, apps
- feminisme : droits des femmes, patriarcat
- masculinite : manosphère, redpill, masculinité positive
- identite : racisme, LGBTQ+, diaspora
- societe : inégalités, vivre-ensemble

Produis un JSON avec ces champs :
{
  "semantic_summary": "résumé en 1-2 phrases",
  "main_topics": ["1-3 thèmes. JAMAIS vide."],
  "secondary_topics": ["0-3 thèmes secondaires"],
  "tone": "informatif|émotionnel|sarcastique|militant|neutre|inspirant|alarmiste",
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

ÉCHELLE POLITIQUE : 0=apolitique, 1=social sans enjeu, 2=enjeu public indirect, 3=politique explicite, 4=militant
ÉCHELLE POLARISATION : 0=neutre, 0.1-0.3=orienté, 0.3-0.6=position nette, 0.6-0.8=opposition binaire, 0.8-1.0=hautement polarisant

Réponds UNIQUEMENT avec le JSON.`;
}

export { SYSTEM_PROMPT };
