/**
 * Mots-clés par thème — taxonomie 24 thèmes (ROADMAP §6.4).
 * Chaque thème a un ensemble de termes discriminants.
 * Utilisé pour la classification multi-label rule-based.
 */

export interface TopicDefinition {
  id: string;
  label: string;
  keywords: string[];
}

export const TOPICS: TopicDefinition[] = [
  {
    id: 'actualite',
    label: 'Actualité',
    keywords: ['breaking', 'flash info', 'alerte info', 'dernière minute', 'derniere minute', 'urgent', 'en direct', 'journal', 'jt', 'bfm', 'cnews', 'lci', 'france info', 'franceinfo', 'le monde', 'libération', 'figaro', 'mediapart', 'reuters', 'afp'],
  },
  {
    id: 'politique',
    label: 'Politique',
    keywords: ['élection', 'election', 'vote', 'scrutin', 'candidat', 'député', 'depute', 'sénateur', 'senateur', 'ministre', 'président', 'president', 'loi', 'projet de loi', 'réforme', 'reforme', 'parlement', 'politique', 'campagne'],
  },
  {
    id: 'geopolitique',
    label: 'Géopolitique',
    keywords: ['géopolitique', 'geopolitique', 'diplomatie', 'conflit', 'guerre', 'traité', 'traite', 'sanctions', 'embargo', 'otan', 'nato', 'onu', 'union européenne', 'moyen-orient', 'moyen orient', 'ukraine', 'russie', 'chine', 'usa', 'états-unis', 'etats-unis'],
  },
  {
    id: 'economie',
    label: 'Économie',
    keywords: ['économie', 'economie', 'inflation', 'bourse', 'cac40', 'pib', 'chômage', 'chomage', 'emploi', 'salaire', 'smic', 'pouvoir d\'achat', 'pouvoir dachat', 'croissance', 'récession', 'recession', 'dette', 'budget', 'impôt', 'impot', 'taxe', 'fiscal'],
  },
  {
    id: 'ecologie',
    label: 'Écologie',
    keywords: ['écologie', 'ecologie', 'climat', 'climatique', 'réchauffement', 'rechauffement', 'co2', 'carbone', 'renouvelable', 'biodiversité', 'biodiversite', 'pollution', 'plastique', 'déforestation', 'deforestation', 'environnement', 'giec', 'cop', 'vert', 'durable'],
  },
  {
    id: 'immigration',
    label: 'Immigration',
    keywords: ['immigration', 'immigré', 'immigre', 'migrant', 'migrants', 'réfugié', 'refugie', 'asile', 'frontière', 'frontiere', 'clandestin', 'sans-papiers', 'sans papiers', 'expulsion', 'régularisation', 'regularisation', 'oqtf', 'lampedusa', 'calais'],
  },
  {
    id: 'securite',
    label: 'Sécurité',
    keywords: ['sécurité', 'securite', 'police', 'gendarmerie', 'délinquance', 'delinquance', 'criminalité', 'criminalite', 'agression', 'vol', 'cambriolage', 'terrorisme', 'attentat', 'vidéosurveillance', 'prison', 'garde à vue', 'interpellation'],
  },
  {
    id: 'justice',
    label: 'Justice',
    keywords: ['justice', 'tribunal', 'procès', 'proces', 'condamnation', 'acquittement', 'avocat', 'magistrat', 'juge', 'peine', 'amende', 'prison', 'détention', 'detention', 'plainte', 'garde à vue', 'instruction', 'parquet', 'cour d\'appel'],
  },
  {
    id: 'sante',
    label: 'Santé',
    keywords: ['santé', 'sante', 'hôpital', 'hopital', 'médecin', 'medecin', 'soignant', 'infirmier', 'vaccin', 'vaccination', 'covid', 'maladie', 'épidémie', 'epidemie', 'urgences', 'sécurité sociale', 'securite sociale', 'médicament', 'medicament', 'ars'],
  },
  {
    id: 'religion',
    label: 'Religion',
    keywords: ['religion', 'religieux', 'islam', 'musulman', 'chrétien', 'chretien', 'catholique', 'juif', 'judaïsme', 'judaisme', 'laïcité', 'laicite', 'voile', 'mosquée', 'mosquee', 'église', 'eglise', 'synagogue', 'ramadan', 'prière', 'priere', 'dieu', 'allah', 'bible', 'coran'],
  },
  {
    id: 'education',
    label: 'Éducation',
    keywords: ['éducation', 'education', 'école', 'ecole', 'lycée', 'lycee', 'collège', 'college', 'université', 'universite', 'professeur', 'enseignant', 'bac', 'baccalauréat', 'baccalaureat', 'parcoursup', 'étudiant', 'etudiant', 'rentrée', 'rentree', 'programme scolaire'],
  },
  {
    id: 'culture',
    label: 'Culture',
    keywords: ['culture', 'art', 'musée', 'musee', 'exposition', 'cinéma', 'cinema', 'film', 'série', 'serie', 'livre', 'littérature', 'litterature', 'théâtre', 'theatre', 'concert', 'festival', 'patrimoine', 'artiste', 'œuvre', 'oeuvre'],
  },
  {
    id: 'humour',
    label: 'Humour',
    keywords: ['mdr', 'ptdr', 'lol', 'humour', 'blague', 'sketch', 'parodie', 'satire', 'drôle', 'drole', 'hilarant', 'mort de rire', 'troll', 'ironie', 'meme', 'mème', 'shitpost'],
  },
  {
    id: 'divertissement',
    label: 'Divertissement',
    keywords: ['divertissement', 'entertainment', 'tv', 'télé', 'tele', 'émission', 'emission', 'téléréalité', 'telerealite', 'reality', 'people', 'célébrité', 'celebrite', 'star', 'buzz', 'viral', 'trend', 'tendance', 'challenge'],
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    keywords: ['lifestyle', 'mode de vie', 'routine', 'morning routine', 'organisation', 'productivité', 'productivite', 'minimalisme', 'slow life', 'bien-être', 'bien etre', 'bienetre', 'self care', 'selfcare', 'cocooning', 'home', 'déco', 'deco', 'intérieur', 'interieur'],
  },
  {
    id: 'beaute',
    label: 'Beauté',
    keywords: ['beauté', 'beaute', 'maquillage', 'makeup', 'skincare', 'soin', 'crème', 'creme', 'sérum', 'serum', 'mascara', 'rouge à lèvres', 'foundation', 'fond de teint', 'coiffure', 'cheveux', 'ongles', 'nails', 'glow', 'tutorial', 'tuto'],
  },
  {
    id: 'sport',
    label: 'Sport',
    keywords: ['sport', 'foot', 'football', 'rugby', 'tennis', 'basket', 'nba', 'ligue 1', 'champions league', 'psg', 'om', 'match', 'goal', 'but', 'joueur', 'athlète', 'athlete', 'musculation', 'fitness', 'crossfit', 'running', 'marathon', 'jeux olympiques'],
  },
  {
    id: 'business',
    label: 'Business',
    keywords: ['business', 'entrepreneur', 'startup', 'entreprise', 'investissement', 'crypto', 'bitcoin', 'trading', 'freelance', 'revenus', 'passifs', 'formation', 'coaching', 'mindset', 'succès', 'succes', 'hustle', 'dropshipping', 'e-commerce', 'ecommerce'],
  },
  {
    id: 'developpement_personnel',
    label: 'Développement personnel',
    keywords: ['développement personnel', 'developpement personnel', 'motivation', 'confiance en soi', 'méditation', 'meditation', 'pleine conscience', 'mindfulness', 'gratitude', 'affirmation', 'loi d\'attraction', 'manifestation', 'croissance personnelle', 'résilience', 'resilience', 'stoïcisme', 'stoicisme'],
  },
  {
    id: 'technologie',
    label: 'Technologie',
    keywords: ['technologie', 'tech', 'ia', 'intelligence artificielle', 'ai', 'chatgpt', 'openai', 'robot', 'smartphone', 'iphone', 'android', 'apple', 'google', 'meta', 'microsoft', 'app', 'application', 'algorithme', 'data', 'cloud', 'cyber'],
  },
  {
    id: 'feminisme',
    label: 'Féminisme',
    keywords: ['féminisme', 'feminisme', 'féministe', 'feministe', 'patriarcat', 'sexisme', 'sexiste', 'misogynie', 'inégalité', 'inegalite', 'genre', 'droit des femmes', 'empowerment', 'sororité', 'sororite', 'charge mentale', 'harcèlement', 'harcelement', 'consentement', 'metoo'],
  },
  {
    id: 'masculinite',
    label: 'Masculinité',
    keywords: ['masculinité', 'masculinite', 'virilité', 'virilite', 'red pill', 'redpill', 'alpha', 'sigma', 'grindset', 'andrew tate', 'tate', 'mgtow', 'manosphere', 'masculinisme', 'homme moderne', 'high value', 'stoïque', 'stoique', 'discipline'],
  },
  {
    id: 'identite',
    label: 'Identité',
    keywords: ['identité', 'identite', 'identitaire', 'communauté', 'communaute', 'diaspora', 'racines', 'origine', 'culture', 'tradition', 'fierté', 'fierte', 'appartenance', 'représentation', 'representation', 'visibilité', 'visibilite', 'minorité', 'minorite', 'lgbtq', 'queer', 'transgenre', 'non-binaire'],
  },
  {
    id: 'societe',
    label: 'Société',
    keywords: ['société', 'societe', 'social', 'solidarité', 'solidarite', 'précarité', 'precarite', 'pauvreté', 'pauvrete', 'inégalités', 'inegalites', 'classe moyenne', 'banlieue', 'quartier', 'discrimination', 'intégration', 'integration', 'vivre ensemble', 'lien social', 'fracture sociale'],
  },
];

/**
 * Classifie un texte en thèmes (multi-label).
 * Retourne les thèmes triés par nombre de matches décroissant.
 */
export function classifyTopics(text: string): { id: string; label: string; matchCount: number }[] {
  const lower = text.toLowerCase();
  const results: { id: string; label: string; matchCount: number }[] = [];

  for (const topic of TOPICS) {
    const matchCount = topic.keywords.filter(kw => lower.includes(kw)).length;
    if (matchCount > 0) {
      results.push({ id: topic.id, label: topic.label, matchCount });
    }
  }

  return results.sort((a, b) => b.matchCount - a.matchCount);
}
