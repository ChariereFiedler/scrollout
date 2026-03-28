/**
 * Prompts d'enrichissement — classification multi-label d'un post Instagram.
 * Conforme à la taxonomie ROADMAP §6.4.
 */

export const ENRICHMENT_SYSTEM_PROMPT = `Tu es un analyste de contenu spécialisé dans l'analyse de posts Instagram francophones.
Tu dois produire une analyse structurée en JSON, rigoureuse et factuelle.

IMPORTANT :
- Tu mesures le CONTENU du post, pas l'opinion de l'auteur ni du lecteur.
- Tu évalues l'EXPOSITION à un type de contenu, pas l'adhésion.
- Sois conservateur dans tes scores : en cas de doute, score bas.
- Justifie toujours tes scores politiques et de polarisation.
- Pour les vidéos/reels, le texte peut contenir des marqueurs [OCR], [SUBTITLES] ou [AUDIO_TRANSCRIPT] indiquant la provenance. Croise ces sources pour comprendre le message global du média.`;

export interface EnrichmentPromptInput {
  normalizedText: string;
  username: string;
  hashtags: string[];
  mediaType: string;
  rulesHints: {
    mainTopics: string[];
    subjects: { id: string; label: string; themeId: string }[];
    politicalScore: number;
    polarizationScore: number;
    detectedActors: string[];
  };
  candidatePreciseSubjects?: { id: string; statement: string }[];
}

export function buildEnrichmentPrompt(input: EnrichmentPromptInput): string {
  const hashtagStr = input.hashtags.length > 0 ? input.hashtags.join(', ') : '(aucun)';
  const subjectsStr = input.rulesHints.subjects.length > 0
    ? `, subjects=[${input.rulesHints.subjects.map(s => s.id).join(',')}]`
    : '';
  const rulesContext = input.rulesHints.mainTopics.length > 0
    ? `\nIndices pré-calculés (règles) : topics=[${input.rulesHints.mainTopics.join(',')}]${subjectsStr}, political_score=${input.rulesHints.politicalScore}, polarization=${input.rulesHints.polarizationScore}, actors=[${input.rulesHints.detectedActors.join(',')}]`
    : '';

  // Sujets précis candidats pour matching cross-perspectives
  let preciseSubjectsBlock = '';
  if (input.candidatePreciseSubjects && input.candidatePreciseSubjects.length > 0) {
    const lines = input.candidatePreciseSubjects.map(ps => `  - ${ps.id}: "${ps.statement}"`).join('\n');
    preciseSubjectsBlock = `\n\nSUJETS PRÉCIS CANDIDATS (choisis ceux qui correspondent au post, 0 à 3 max) :\n${lines}`;
  }

  const isVideo = ['video', 'reel'].includes(input.mediaType);
  const videoInstruction = isVideo
    ? `\nATTENTION : Ce post est une vidéo/reel. Le texte peut inclure des marqueurs :
- [OCR] = texte incrusté/overlay détecté dans la vidéo (titres, sous-titres brûlés)
- [SUBTITLES] = sous-titres auto-générés par Instagram
- [AUDIO_TRANSCRIPT] = transcription de la piste audio
Croise TOUTES les sources disponibles pour déterminer le message et l'intention du média. Le champ "media_message" doit synthétiser le propos global, pas juste la caption.\n`
    : '';

  return `Analyse ce post Instagram et produis un JSON structuré.

IMPORTANT — RÈGLES CRITIQUES :
1. Le nom d'utilisateur (@username) est un signal sémantique fort. Utilise-le pour inférer le domaine du compte (ex: @boardgamegeek → jeux de société, @franceculture → culture/média, @tagheuer → luxe/horlogerie).
2. main_topics ne doit JAMAIS être vide []. Même un post très pauvre en texte a un domaine identifiable via le username, le type de média, ou les hashtags. En dernier recours, utilise "divertissement" ou "lifestyle".
3. secondary_topics doit être rempli dès qu'un thème secondaire est détectable, même faiblement.

--- POST ---
Auteur : @${input.username}
Type : ${input.mediaType}
Hashtags : ${hashtagStr}
Texte :
${input.normalizedText || '(texte vide ou non disponible)'}
${rulesContext}${videoInstruction}${preciseSubjectsBlock}
--- FIN POST ---

LISTE DES 24 THÈMES (utilise UNIQUEMENT ces identifiants) :
- actualite : info, breaking news, faits divers
- politique : élections, partis, lois, institutions FR
- geopolitique : conflits internationaux, diplomatie, guerres
- economie : emploi, inflation, pouvoir d'achat, réformes
- ecologie : climat, biodiversité, pollution, transition
- immigration : migration, intégration, frontières
- securite : police, délinquance, terrorisme, justice pénale
- justice : droit, procès, réformes judiciaires
- sante : médecine, épidémies, système de santé, bien-être physique
- religion : islam, christianisme, laïcité, spiritualité
- education : école, université, formation, pédagogie
- culture : cinéma, musique, séries, littérature, art, patrimoine
- humour : memes, satire, parodie, blagues
- divertissement : gaming, jeux de société, people, anime, téléréalité, contenus viraux
- lifestyle : food, cuisine, voyage, déco, animaux, quotidien
- beaute : skincare, maquillage, coiffure, mode, fashion
- sport : football, fitness, MMA, JO, compétitions sportives (PAS jeux de société)
- business : entrepreneuriat, crypto, coaching, investissement, hustle
- developpement_personnel : méditation, motivation, coaching bien-être, astrologie
- technologie : IA, dev, startups tech, gadgets, apps
- feminisme : droits des femmes, patriarcat, charge mentale
- masculinite : manosphère, redpill, masculinité positive, paternité
- identite : racisme, LGBTQ+, diaspora, représentation
- societe : inégalités, urbanisme, éducation civique, vivre-ensemble

Produis un JSON avec EXACTEMENT ces champs :

{
  "semantic_summary": "résumé en 1-2 phrases du contenu du post",
  "main_topics": ["1-3 thèmes principaux parmi la liste ci-dessus. JAMAIS vide."],
  "secondary_topics": ["0-3 thèmes secondaires. Un post food peut aussi être lifestyle. Un post politique peut aussi être humour. Ne laisse [] que si vraiment mono-thème."],
  "subjects": ["IDs des sujets détectés (niveau 3 de la taxonomie), issus des indices pré-calculés ou identifiés par toi"],
  "precise_subjects": [{"id": "ID du sujet précis si candidat fourni, sinon null", "position": "pour | contre | neutre | ambigu", "confidence": 0.0 à 1.0}],
  "content_domain": "un mot résumant le domaine : actualité | divertissement | lifestyle | politique | éducation | business | autre",
  "audience_target": "grand public | militant | niche | communautaire | professionnel",
  "persons": ["personnes nommées dans le post"],
  "organizations": ["organisations mentionnées"],
  "institutions": ["institutions publiques mentionnées"],
  "countries": ["pays mentionnés"],
  "tone": "informatif | émotionnel | sarcastique | militant | neutre | inspirant | alarmiste",
  "primary_emotion": "colère | joie | peur | tristesse | dégoût | surprise | fierté | espoir | neutre",
  "emotion_intensity": 0.0 à 1.0,
  "political_explicitness_score": 0 à 4,
  "political_explicitness_justification": "justification en 1 phrase",
  "political_issue_tags": ["enjeux politiques identifiés"],
  "public_policy_tags": ["politiques publiques mentionnées"],
  "institutional_reference_score": 0.0 à 1.0,
  "activism_signal": true/false,
  "polarization_score": 0.0 à 1.0,
  "polarization_justification": "justification en 1 phrase",
  "ingroup_outgroup_signal": true/false,
  "conflict_signal": true/false,
  "moral_absolute_signal": true/false,
  "enemy_designation_signal": true/false,
  "narrative_frame": "un parmi: declin | urgence | injustice | revelation | mobilisation | denonciation | empowerment | ordre | menace | aspiration | inspiration | derision | victimisation | heroisation | aucun",
  "call_to_action_type": "un parmi: aucun | commenter | partager | sindigner | sinformer | voter | soutenir | boycotter | manifester | acheter | suivre_le_compte",
  "problem_solution_pattern": "description du pattern problème-solution si présent, sinon vide",
  "media_message": "message principal véhiculé par le média (1-2 phrases, en croisant caption + texte overlay + sous-titres + audio si disponibles). Vide si le post est une simple photo sans message clair.",
  "media_intent": "un parmi: informer | divertir | vendre | convaincre | emouvoir | eduquer | provoquer | aucun",
  "confidence_score": 0.0 à 1.0
}

ÉCHELLE POLITIQUE :
0 = apolitique (beauté, food, gaming, jeux de société...)
1 = sujet social/culturel sans enjeu public clair (bien-être, développement perso avec mention vague de société)
2 = enjeu public indirect (économie, santé publique, éducation — sans militantisme)
3 = sujet politique explicite (élections, partis, lois, institutions nommées)
4 = contenu militant / propagandiste / mobilisation (appel à l'action politique, slogan, dénonciation directe)

ÉCHELLE POLARISATION :
0 = neutre, factuel, sans prise de position marquée
0.1-0.3 = légèrement orienté mais nuancé
0.3-0.6 = prise de position nette, vocabulaire chargé
0.6-0.8 = forte opposition binaire, indignation, ennemi désigné
0.8-1.0 = contenu hautement polarisant, cadrage moral absolu, appel à la confrontation

Réponds UNIQUEMENT avec le JSON, sans commentaire.`;
}

export const ENRICHMENT_INDEX = { ENRICHMENT_SYSTEM_PROMPT, buildEnrichmentPrompt };
