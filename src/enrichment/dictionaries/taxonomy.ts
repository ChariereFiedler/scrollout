/**
 * Taxonomie à 5 niveaux pour la classification de contenu Instagram.
 *
 * Niveau 1 — Domaine (~6)      : macro-agrégation pour profil utilisateur
 * Niveau 2 — Thème (~24)       : classification multi-label principale
 * Niveau 3 — Sujet (~150)      : sous-catégorie stable dans le temps
 * Niveau 4 — Sujet précis      : proposition débattable, pivot pour le matching cross-perspectives
 * Niveau 5 — Marqueur/Entité   : détecté dynamiquement (politicalActors, persons, etc.)
 *
 * Les niveaux 1-4 sont définis ici. Le niveau 5 est détecté par les autres dictionnaires.
 */

// ─── Interfaces ──────────────────────────────────────────────

export interface KnownPosition {
  label: string;
  typicalNarratives: string[];
  typicalActors: string[];
}

export interface PreciseSubject {
  id: string;
  statement: string;           // proposition débattable
  knownPositions: KnownPosition[];
}

export interface Subject {
  id: string;
  label: string;
  keywords: string[];          // termes discriminants pour ce sujet
  preciseSubjects: PreciseSubject[];
}

export interface Theme {
  id: string;
  label: string;
  domainId: string;
  subjects: Subject[];
}

export interface Domain {
  id: string;
  label: string;
  themeIds: string[];
}

export interface TaxonomyMatch {
  domainId: string;
  themeId: string;
  subjectId: string | null;
  preciseSubjectId: string | null;
  matchCount: number;
}

// ─── Domaines (Niveau 1) ────────────────────────────────────

export const DOMAINS: Domain[] = [
  {
    id: 'politique_societe',
    label: 'Politique & Soci\u00e9t\u00e9',
    themeIds: ['politique', 'geopolitique', 'immigration', 'securite', 'justice', 'societe', 'feminisme', 'masculinite', 'identite'],
  },
  {
    id: 'economie_travail',
    label: '\u00c9conomie & Travail',
    themeIds: ['economie', 'business'],
  },
  {
    id: 'information_savoirs',
    label: 'Information & Savoirs',
    themeIds: ['actualite', 'education', 'technologie', 'sante'],
  },
  {
    id: 'culture_divertissement',
    label: 'Culture & Divertissement',
    themeIds: ['culture', 'humour', 'divertissement', 'sport'],
  },
  {
    id: 'lifestyle_bienetre',
    label: 'Lifestyle & Bien-\u00eatre',
    themeIds: ['lifestyle', 'beaute', 'developpement_personnel'],
  },
  {
    id: 'ecologie_environnement',
    label: '\u00c9cologie & Environnement',
    themeIds: ['ecologie'],
  },
  {
    id: 'religion_spiritualite',
    label: 'Religion & Spiritualit\u00e9',
    themeIds: ['religion'],
  },
];

// ─── Thèmes + Sujets + Sujets Précis (Niveaux 2-4) ────────

export const THEMES: Theme[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Politique & Société
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'politique',
    label: 'Politique',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'elections',
        label: '\u00c9lections',
        keywords: ['\u00e9lection', 'election', 'vote', 'scrutin', 'candidat', 'campagne', 'sondage', 'premier tour', 'second tour', 'urne', 'bulletin'],
        preciseSubjects: [
          {
            id: 'vote_obligatoire',
            statement: 'Le vote devrait \u00eatre obligatoire en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'ordre'], typicalActors: ['institutionnels', 'centristes'] },
              { label: 'contre', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['libertariens', 'abstentionnistes'] },
            ],
          },
          {
            id: 'proportionnelle',
            statement: 'La France devrait passer au scrutin proportionnel',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['petits partis', 'RN', 'LFI'] },
              { label: 'contre', typicalNarratives: ['ordre', 'declin'], typicalActors: ['partis de gouvernement', 'macronistes'] },
            ],
          },
        ],
      },
      {
        id: 'vie_politique',
        label: 'Vie politique int\u00e9rieure',
        keywords: ['d\u00e9put\u00e9', 'depute', 's\u00e9nateur', 'senateur', 'ministre', 'pr\u00e9sident', 'president', 'assembl\u00e9e', 'parlement', 'gouvernement', 'opposition', 'majorit\u00e9', 'remaniement', 'motion de censure'],
        preciseSubjects: [
          {
            id: '49_3_legitime',
            statement: 'Le recours au 49.3 est un d\u00e9ni de d\u00e9mocratie',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['LFI', 'RN', 'syndicats'] },
              { label: 'contre', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['Renaissance', 'institutionnels'] },
            ],
          },
        ],
      },
      {
        id: 'extreme_droite',
        label: 'Extr\u00eame droite',
        keywords: ['extr\u00eame droite', 'extreme droite', 'rn', 'rassemblement national', 'le pen', 'bardella', 'zemmour', 'reconqu\u00eate', 'identitaire', 'grand remplacement', 'r\u00e9migration', 'remigration'],
        preciseSubjects: [
          {
            id: 'rn_republicanise',
            statement: 'Le RN s\'est r\u00e9publicanis\u00e9 et est devenu un parti fr\u00e9quentable',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['aspiration', 'ordre'], typicalActors: ['RN', 'droite conservatrice'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['gauche', 'antifascistes', 'associations'] },
            ],
          },
        ],
      },
      {
        id: 'gauche',
        label: 'Gauche',
        keywords: ['gauche', 'lfi', 'france insoumise', 'm\u00e9lenchon', 'melenchon', 'nupes', 'nfp', 'nouveau front populaire', 'socialiste', 'communiste', 'pcf', 'eelv'],
        preciseSubjects: [
          {
            id: 'union_gauche_necessaire',
            statement: 'L\'union de la gauche est la seule alternative cr\u00e9dible',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'urgence'], typicalActors: ['NFP', 'LFI', 'militants'] },
              { label: 'contre', typicalNarratives: ['declin', 'derision'], typicalActors: ['droite', 'centre', 'PS r\u00e9formiste'] },
            ],
          },
        ],
      },
      {
        id: 'scandale_politique',
        label: 'Scandales politiques',
        keywords: ['affaire', 'scandale', 'corruption', 'mis en examen', 'proc\u00e8s', 'proces', 'fraude', 'conflit d\'int\u00e9r\u00eat', 'conflit dinteret', 'enrichissement'],
        preciseSubjects: [],
      },
      {
        id: 'reforme_institutions',
        label: 'R\u00e9forme des institutions',
        keywords: ['r\u00e9forme institutionnelle', 'constitution', 'r\u00e9f\u00e9rendum', 'referendum', 'initiative citoyenne', 'vi\u00e8me r\u00e9publique', 'vieme republique', 'd\u00e9centralisation', 'decentralisation', 'r\u00e9forme constitutionnelle'],
        preciseSubjects: [
          {
            id: 'ric_necessaire',
            statement: 'Le RIC (r\u00e9f\u00e9rendum d\'initiative citoyenne) est n\u00e9cessaire',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['gilets jaunes', 'LFI', 'RN'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['constitutionnalistes', 'centristes'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'geopolitique',
    label: 'G\u00e9opolitique',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'conflit_ukraine',
        label: 'Conflit Ukraine-Russie',
        keywords: ['ukraine', 'russie', 'zelensky', 'poutine', 'putin', 'kremlin', 'donbass', 'crim\u00e9e', 'crimee', 'otan', 'nato'],
        preciseSubjects: [
          {
            id: 'livraison_armes_ukraine',
            statement: 'L\'Europe doit continuer \u00e0 livrer des armes \u00e0 l\'Ukraine',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'mobilisation'], typicalActors: ['atlantistes', 'OTAN', 'UE'] },
              { label: 'contre', typicalNarratives: ['menace', 'declin'], typicalActors: ['souverainistes', 'pacifistes', 'LFI'] },
            ],
          },
        ],
      },
      {
        id: 'conflit_israel_palestine',
        label: 'Conflit Isra\u00ebl-Palestine',
        keywords: ['isra\u00ebl', 'israel', 'palestine', 'palestinien', 'gaza', 'hamas', 'netanyahu', 'cisjordanie', 'colonisation', 'bombardement', 'g\u00e9nocide', 'genocide', 'sionisme', 'antisionisme', 'c\u00e9sez-le-feu', 'cessez le feu'],
        preciseSubjects: [
          {
            id: 'genocide_gaza',
            statement: 'Ce qui se passe \u00e0 Gaza est un g\u00e9nocide',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['pro-palestiniens', 'LFI', 'ONG'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['pro-isra\u00e9liens', 'CRIF', 'Renaissance'] },
            ],
          },
          {
            id: 'boycott_israel',
            statement: 'Le boycott d\'Isra\u00ebl (BDS) est un moyen de pression l\u00e9gitime',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'injustice'], typicalActors: ['BDS', 'militants pro-palestiniens'] },
              { label: 'contre', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['organisations juives', 'gouvernement fran\u00e7ais'] },
            ],
          },
        ],
      },
      {
        id: 'relations_internationales',
        label: 'Relations internationales',
        keywords: ['diplomatie', 'trait\u00e9', 'traite', 'sanctions', 'embargo', 'onu', 'g7', 'g20', 'brics', 'sommet', 'alliance', 'multilat\u00e9ral'],
        preciseSubjects: [],
      },
      {
        id: 'union_europeenne',
        label: 'Union europ\u00e9enne',
        keywords: ['union europ\u00e9enne', 'union europeenne', 'bruxelles', 'commission europ\u00e9enne', 'parlement europ\u00e9en', 'schengen', 'frexit', 'trait\u00e9 europ\u00e9en', 'directive europ\u00e9enne'],
        preciseSubjects: [
          {
            id: 'souverainete_vs_ue',
            statement: 'L\'UE empi\u00e8te trop sur la souverainet\u00e9 nationale',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'declin'], typicalActors: ['souverainistes', 'RN', 'LFI'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'mobilisation'], typicalActors: ['europ\u00e9istes', 'Renaissance', 'Volt'] },
            ],
          },
        ],
      },
      {
        id: 'afrique',
        label: 'Afrique & post-colonialisme',
        keywords: ['afrique', 'fran\u00e7afrique', 'francafrique', 'colonisation', 'colonialisme', 'n\u00e9ocolonialisme', 'neocolonialisme', 'sahel', 'mali', 'niger', 's\u00e9n\u00e9gal', 'senegal', 'franc cfa', 'panafricanisme'],
        preciseSubjects: [
          {
            id: 'franc_cfa_neocolonial',
            statement: 'Le franc CFA est un outil n\u00e9ocolonial',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['panafricanistes', 'd\u00e9colonialistes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['\u00e9conomistes lib\u00e9raux', 'institutionnels'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'immigration',
    label: 'Immigration',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'immigration_clandestine',
        label: 'Immigration clandestin',
        keywords: ['clandestin', 'passeur', 'traversée', 'traversee', 'naufrage', 'manche', 'lampedusa', 'filière', 'filiere', 'sans-papiers', 'sans papiers'],
        preciseSubjects: [
          {
            id: 'regularisation_sans_papiers',
            statement: 'Les sans-papiers qui travaillent devraient \u00eatre r\u00e9gularis\u00e9s',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['associations', 'gauche', 'syndicats'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['droite', 'RN'] },
            ],
          },
        ],
      },
      {
        id: 'droit_asile',
        label: 'Droit d\'asile',
        keywords: ['r\u00e9fugi\u00e9', 'refugie', 'asile', 'demandeur', 'ofpra', 'cnda', 'protection internationale', 'dublin'],
        preciseSubjects: [],
      },
      {
        id: 'integration',
        label: 'Int\u00e9gration',
        keywords: ['int\u00e9gration', 'integration', 'assimilation', 'communautarisme', 'vivre ensemble', 'francisation', 'naturalisation'],
        preciseSubjects: [
          {
            id: 'assimilation_vs_integration',
            statement: 'L\'assimilation est pr\u00e9f\u00e9rable \u00e0 l\'int\u00e9gration multiculturelle',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'declin'], typicalActors: ['droite', 'r\u00e9publicains conservateurs'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['associations', 'gauche', 'd\u00e9colonialistes'] },
            ],
          },
        ],
      },
      {
        id: 'politique_migratoire',
        label: 'Politique migratoire',
        keywords: ['oqtf', 'expulsion', 'reconduite', 'quotas', 'immigration choisie', 'loi immigration', 'pacte migratoire', 'fronti\u00e8re', 'frontiere'],
        preciseSubjects: [
          {
            id: 'quotas_migratoires_ue',
            statement: 'L\'UE doit r\u00e9partir les migrants par quotas entre \u00c9tats membres',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'ordre'], typicalActors: ['europ\u00e9istes', 'ONG'] },
              { label: 'contre', typicalNarratives: ['menace', 'declin'], typicalActors: ['souverainistes', 'Orban', 'Meloni'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'securite',
    label: 'S\u00e9curit\u00e9',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'violences_urbaines',
        label: 'Violences urbaines',
        keywords: ['violence urbaine', '\u00e9meute', 'emeute', 'incendie', 'caillassage', 'banlieue', 'quartier', 'nuit de violences'],
        preciseSubjects: [],
      },
      {
        id: 'police',
        label: 'Police & maintien de l\'ordre',
        keywords: ['police', 'policier', 'gendarme', 'gendarmerie', 'bac', 'crs', 'brav-m', 'bavure', 'lbd', 'interpellation', 'garde \u00e0 vue'],
        preciseSubjects: [
          {
            id: 'violences_policieres_systemiques',
            statement: 'Les violences polici\u00e8res sont un probl\u00e8me syst\u00e9mique en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['gauche', 'associations', 'ACAB'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['syndicats police', 'droite'] },
            ],
          },
          {
            id: 'controles_facies',
            statement: 'Les contr\u00f4les au faci\u00e8s sont un probl\u00e8me syst\u00e9mique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['associations antiracistes', 'D\u00e9fenseur des droits'] },
              { label: 'contre', typicalNarratives: ['ordre'], typicalActors: ['syndicats police', 'droite'] },
            ],
          },
        ],
      },
      {
        id: 'terrorisme',
        label: 'Terrorisme',
        keywords: ['terrorisme', 'terroriste', 'attentat', 'radicalisation', 'djihad', 'jihadisme', 'fiche s', 'dgsi', 'vigipirate'],
        preciseSubjects: [],
      },
      {
        id: 'delinquance',
        label: 'D\u00e9linquance & criminalit\u00e9',
        keywords: ['d\u00e9linquance', 'delinquance', 'criminalit\u00e9', 'criminalite', 'agression', 'vol', 'cambriolage', 'narcotrafic', 'trafic', 'fusillade', 'r\u00e8glement de comptes'],
        preciseSubjects: [
          {
            id: 'ensauvagement',
            statement: 'La France conna\u00eet un "ensauvagement" de la soci\u00e9t\u00e9',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'menace'], typicalActors: ['droite', 'RN', 'Cnews'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['gauche', 'sociologues', 'Le Monde'] },
            ],
          },
        ],
      },
      {
        id: 'videosurveillance',
        label: 'Surveillance & libert\u00e9s',
        keywords: ['vid\u00e9osurveillance', 'videosurveillance', 'reconnaissance faciale', 'surveillance', 'big brother', 'libert\u00e9s publiques', 'cnil'],
        preciseSubjects: [
          {
            id: 'reconnaissance_faciale_securite',
            statement: 'La reconnaissance faciale doit \u00eatre utilis\u00e9e pour la s\u00e9curit\u00e9 publique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['droite s\u00e9curitaire', 'police'] },
              { label: 'contre', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['CNIL', 'La Quadrature', 'gauche'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'justice',
    label: 'Justice',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'justice_penale',
        label: 'Justice p\u00e9nale',
        keywords: ['tribunal', 'proc\u00e8s', 'proces', 'condamnation', 'peine', 'prison', 'amende', 'r\u00e9cidive', 'recidive', 'parquet', 'cour d\'appel', 'cassation'],
        preciseSubjects: [
          {
            id: 'laxisme_justice',
            statement: 'La justice fran\u00e7aise est trop laxiste',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'denonciation'], typicalActors: ['droite', 'RN', 'victimes'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['magistrats', 'gauche', 'avocats'] },
            ],
          },
        ],
      },
      {
        id: 'droits_fondamentaux',
        label: 'Droits fondamentaux',
        keywords: ['droit', 'libert\u00e9', 'libertes', 'cedh', 'conseil constitutionnel', 'droits de l\'homme', 'habeas corpus', '\u00e9tat de droit', 'etat de droit'],
        preciseSubjects: [],
      },
      {
        id: 'violences_sexuelles',
        label: 'Violences sexuelles & justice',
        keywords: ['viol', 'agression sexuelle', 'harc\u00e8lement', 'harcelement', 'consentement', 'plainte', 'classement sans suite', 'prescription'],
        preciseSubjects: [
          {
            id: 'presomption_innocence_metoo',
            statement: 'Le mouvement #MeToo fragilise la pr\u00e9somption d\'innocence',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['droite conservatrice', 'avocats p\u00e9nalistes'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'empowerment'], typicalActors: ['f\u00e9ministes', 'associations victimes'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'societe',
    label: 'Soci\u00e9t\u00e9',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'precarite',
        label: 'Pr\u00e9carit\u00e9 & pauvret\u00e9',
        keywords: ['pr\u00e9carit\u00e9', 'precarite', 'pauvret\u00e9', 'pauvrete', 'sdf', 'sans-abri', 'restos du coeur', 'aide alimentaire', 'minima sociaux', 'rsa'],
        preciseSubjects: [
          {
            id: 'rsa_conditionne_travail',
            statement: 'Le RSA doit \u00eatre conditionn\u00e9 \u00e0 des heures de travail',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['droite', 'Renaissance'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['associations', 'gauche', 'ATD Quart Monde'] },
            ],
          },
        ],
      },
      {
        id: 'inegalites',
        label: 'In\u00e9galit\u00e9s sociales',
        keywords: ['in\u00e9galit\u00e9', 'inegalite', 'classe', 'bourgeoisie', 'prolétaire', 'oligarchie', 'riches', 'milliardaire', 'fracture sociale', 'ascenseur social'],
        preciseSubjects: [],
      },
      {
        id: 'banlieues',
        label: 'Banlieues & quartiers',
        keywords: ['banlieue', 'quartier', 'cit\u00e9', 'cite', 'zup', 'qpv', 'ghetto', 's\u00e9gr\u00e9gation', 'segregation', 'politique de la ville'],
        preciseSubjects: [],
      },
      {
        id: 'solidarite',
        label: 'Solidarit\u00e9 & lien social',
        keywords: ['solidarit\u00e9', 'solidarite', 'entraide', 'b\u00e9n\u00e9volat', 'benevolat', 'association', 'don', 'caritatif', 'lien social'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'feminisme',
    label: 'F\u00e9minisme',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'harcelement',
        label: 'Harc\u00e8lement',
        keywords: ['harc\u00e8lement', 'harcelement', 'metoo', 'me too', 'balancetonporc', 'agression', 'harc\u00e8lement de rue', 'harcelement de rue', 'cyberharcèlement'],
        preciseSubjects: [],
      },
      {
        id: 'charge_mentale',
        label: 'Charge mentale',
        keywords: ['charge mentale', 'r\u00e9partition des t\u00e2ches', 'in\u00e9galit\u00e9s domestiques', 'congé parental', 'congé paternit\u00e9'],
        preciseSubjects: [],
      },
      {
        id: 'inegalites_salariales',
        label: 'In\u00e9galit\u00e9s salariales',
        keywords: ['in\u00e9galit\u00e9 salariale', 'inegalite salariale', '\u00e9cart de salaire', 'ecart de salaire', 'plafond de verre', 'index \u00e9galit\u00e9'],
        preciseSubjects: [],
      },
      {
        id: 'ivg',
        label: 'IVG & droits reproductifs',
        keywords: ['ivg', 'avortement', 'interruption', 'contraception', 'planning familial', 'droit \u00e0 l\'avortement', 'clause de conscience'],
        preciseSubjects: [
          {
            id: 'ivg_constitution',
            statement: 'L\'IVG doit \u00eatre un droit constitutionnel',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'mobilisation'], typicalActors: ['f\u00e9ministes', 'gauche', 'majorit\u00e9 transpartisane'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['conservateurs', 'religieux', 'Manif pour tous'] },
            ],
          },
        ],
      },
      {
        id: 'body_positivity',
        label: 'Body positivity & image',
        keywords: ['body positive', 'body positivity', 'grossophobie', 'normes de beaut\u00e9', 'injonction', 'body shaming'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'masculinite',
    label: 'Masculinit\u00e9',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'redpill',
        label: 'Red pill & manosph\u00e8re',
        keywords: ['red pill', 'redpill', 'alpha', 'sigma', 'grindset', 'andrew tate', 'tate', 'mgtow', 'manosph\u00e8re', 'manosphere', 'high value', 'hypergamie'],
        preciseSubjects: [
          {
            id: 'crise_masculinite',
            statement: 'Il existe une "crise de la masculinit\u00e9" dans la soci\u00e9t\u00e9 moderne',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['declin', 'victimisation'], typicalActors: ['manosph\u00e8re', 'conservateurs'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['f\u00e9ministes', 'sociologues'] },
            ],
          },
        ],
      },
      {
        id: 'masculinite_positive',
        label: 'Masculinit\u00e9 positive',
        keywords: ['masculinit\u00e9 positive', 'masculinite positive', 'homme moderne', 'paternit\u00e9', 'paternite', 'homme f\u00e9ministe', 'vuln\u00e9rabilit\u00e9', 'sant\u00e9 mentale homme'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'identite',
    label: 'Identit\u00e9',
    domainId: 'politique_societe',
    subjects: [
      {
        id: 'racisme',
        label: 'Racisme & antiracisme',
        keywords: ['racisme', 'raciste', 'antiracisme', 'discrimination', 'racis\u00e9', 'racise', 'woke', 'd\u00e9colonial', 'decolonial', 'privil\u00e8ge blanc', 'privilege blanc', 'racisme syst\u00e9mique'],
        preciseSubjects: [
          {
            id: 'racisme_systemique_france',
            statement: 'Le racisme syst\u00e9mique existe en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['antiracistes', 'd\u00e9colonialistes', 'gauche'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'ordre'], typicalActors: ['universalistes r\u00e9publicains', 'droite'] },
            ],
          },
        ],
      },
      {
        id: 'lgbtq',
        label: 'LGBTQ+',
        keywords: ['lgbtq', 'lgbt', 'gay', 'lesbienne', 'transgenre', 'trans', 'non-binaire', 'non binaire', 'queer', 'pride', 'marche des fiert\u00e9s', 'pma', 'gpa', 'drag', 'homophobie', 'transphobie'],
        preciseSubjects: [
          {
            id: 'gpa_legaliser',
            statement: 'La GPA doit \u00eatre l\u00e9galis\u00e9e en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['associations LGBT', 'gauche lib\u00e9rale'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['conservateurs', 'f\u00e9ministes anti-GPA', 'Manif pour tous'] },
            ],
          },
          {
            id: 'transition_genre_mineurs',
            statement: 'Les transitions de genre pour les mineurs doivent \u00eatre encadr\u00e9es strictement',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'menace'], typicalActors: ['conservateurs', 'certains m\u00e9decins'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['associations trans', 'OMS'] },
            ],
          },
        ],
      },
      {
        id: 'diaspora',
        label: 'Diaspora & origines',
        keywords: ['diaspora', 'racines', 'origine', 'binational', 'double culture', 'repr\u00e9sentation', 'representation', 'visibilit\u00e9', 'visibilite', 'minorit\u00e9', 'minorite'],
        preciseSubjects: [],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Économie & Travail
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'economie',
    label: '\u00c9conomie',
    domainId: 'economie_travail',
    subjects: [
      {
        id: 'fiscalite',
        label: 'Fiscalit\u00e9',
        keywords: ['imp\u00f4t', 'impot', 'taxe', 'fiscal', 'isf', 'tva', 'flat tax', 'niche fiscale', 'fraude fiscale', '\u00e9vasion fiscale', 'evasion fiscale', 'paradis fiscal'],
        preciseSubjects: [
          {
            id: 'retablir_isf',
            statement: 'L\'ISF doit \u00eatre r\u00e9tabli',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'mobilisation'], typicalActors: ['gauche', 'gilets jaunes'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['droite', 'patronat', 'lib\u00e9raux'] },
            ],
          },
        ],
      },
      {
        id: 'emploi_chomage',
        label: 'Emploi & ch\u00f4mage',
        keywords: ['ch\u00f4mage', 'chomage', 'emploi', 'p\u00f4le emploi', 'pole emploi', 'france travail', 'cdi', 'cdd', 'int\u00e9rim', 'interim', 'uber', 'auto-entrepreneur', 'plein emploi'],
        preciseSubjects: [
          {
            id: 'reforme_assurance_chomage',
            statement: 'Il faut durcir les conditions d\'acc\u00e8s \u00e0 l\'assurance ch\u00f4mage',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['MEDEF', 'Renaissance', 'droite'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['syndicats', 'gauche'] },
            ],
          },
        ],
      },
      {
        id: 'pouvoir_achat',
        label: 'Pouvoir d\'achat',
        keywords: ['pouvoir d\'achat', 'pouvoir dachat', 'inflation', 'prix', 'salaire', 'smic', 'vie ch\u00e8re', 'carburant', 'loyer'],
        preciseSubjects: [
          {
            id: 'smic_augmenter',
            statement: 'Le SMIC doit \u00eatre significativement augment\u00e9',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['injustice', 'mobilisation'], typicalActors: ['syndicats', 'gauche'] },
              { label: 'contre', typicalNarratives: ['menace', 'ordre'], typicalActors: ['patronat', 'lib\u00e9raux'] },
            ],
          },
        ],
      },
      {
        id: 'retraites',
        label: 'Retraites',
        keywords: ['retraite', 'pension', 'r\u00e9forme des retraites', 'reforme des retraites', '64 ans', '\u00e2ge de d\u00e9part', 'age de depart', 'cotisation', 'trimestre', 'agirc', 'arrco'],
        preciseSubjects: [
          {
            id: 'reforme_retraites_64',
            statement: 'Le recul de l\'\u00e2ge de d\u00e9part \u00e0 64 ans est n\u00e9cessaire',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'ordre'], typicalActors: ['Renaissance', 'patronat', 'droite'] },
              { label: 'contre', typicalNarratives: ['injustice', 'mobilisation', 'denonciation'], typicalActors: ['syndicats', 'gauche', 'gilets jaunes'] },
            ],
          },
        ],
      },
      {
        id: 'dette_budget',
        label: 'Dette & budget',
        keywords: ['dette', 'budget', 'd\u00e9ficit', 'deficit', 'aust\u00e9rit\u00e9', 'austerite', 'dette publique', 'pib', 'agences de notation', 'maastricht'],
        preciseSubjects: [
          {
            id: 'austerite_necessaire',
            statement: 'L\'aust\u00e9rit\u00e9 budg\u00e9taire est n\u00e9cessaire pour \u00e9viter la crise',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'ordre'], typicalActors: ['lib\u00e9raux', 'Cour des comptes'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['gauche', '\u00e9conomistes h\u00e9t\u00e9rodoxes'] },
            ],
          },
        ],
      },
      {
        id: 'bourse_finance',
        label: 'Bourse & finance',
        keywords: ['bourse', 'cac', 'cac40', 'march\u00e9s financiers', 'wall street', 'sp\u00e9culation', 'trader', 'dividende', 'actionnaire'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    domainId: 'economie_travail',
    subjects: [
      {
        id: 'entrepreneuriat',
        label: 'Entrepreneuriat',
        keywords: ['entrepreneur', 'startup', 'entreprise', 'cr\u00e9ation d\'entreprise', 'levée de fonds', 'scale', 'pitch', 'incubateur'],
        preciseSubjects: [],
      },
      {
        id: 'crypto_trading',
        label: 'Crypto & trading',
        keywords: ['crypto', 'bitcoin', 'ethereum', 'trading', 'blockchain', 'nft', 'defi', 'web3', 'token', 'altcoin', 'bull', 'bear'],
        preciseSubjects: [],
      },
      {
        id: 'coaching_hustle',
        label: 'Coaching & hustle culture',
        keywords: ['coaching', 'mindset', 'hustle', 'revenus passifs', 'formation', 'dropshipping', 'e-commerce', 'ecommerce', 'affiliation', 'money'],
        preciseSubjects: [
          {
            id: 'hustle_culture_toxique',
            statement: 'La "hustle culture" et les formations en ligne sont toxiques et arnaquent les gens',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['anti-hustle', 'journalistes'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['influenceurs business', 'coachs'] },
            ],
          },
        ],
      },
      {
        id: 'investissement',
        label: 'Investissement',
        keywords: ['investissement', 'immobilier', 'scpi', 'assurance vie', 'pea', 'bourse', 'patrimoine', 'rente'],
        preciseSubjects: [],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Information & Savoirs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'actualite',
    label: 'Actualit\u00e9',
    domainId: 'information_savoirs',
    subjects: [
      {
        id: 'fait_divers',
        label: 'Faits divers',
        keywords: ['fait divers', 'drame', 'accident', 'incendie', 'meurtre', 'disparition', 'alerte enl\u00e8vement'],
        preciseSubjects: [],
      },
      {
        id: 'media_info',
        label: 'M\u00e9dias & information',
        keywords: ['m\u00e9dia', 'media', 'journaliste', 'journalisme', 'presse', 'r\u00e9daction', 'breaking', 'flash info', 'fake news', 'd\u00e9sinformation', 'desinformation', 'fact-checking'],
        preciseSubjects: [
          {
            id: 'medias_mainstream_fiables',
            statement: 'Les m\u00e9dias mainstream sont globalement fiables',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['journalistes', 'institutionnels'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'revelation'], typicalActors: ['m\u00e9dias alternatifs', 'populistes', 'complotistes'] },
            ],
          },
        ],
      },
      {
        id: 'catastrophe_naturelle',
        label: 'Catastrophes naturelles',
        keywords: ['s\u00e9isme', 'seisme', 'tremblement de terre', 'ouragan', 'inondation', 'tsunami', 'tornade', 'canicule', 's\u00e9cheresse', 'secheresse'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'education',
    label: '\u00c9ducation',
    domainId: 'information_savoirs',
    subjects: [
      {
        id: 'ecole',
        label: '\u00c9cole & syst\u00e8me scolaire',
        keywords: ['\u00e9cole', 'ecole', 'lyc\u00e9e', 'lycee', 'coll\u00e8ge', 'college', 'professeur', 'enseignant', 'rentr\u00e9e', 'rentree', 'programme scolaire', 'bac', 'baccalaur\u00e9at'],
        preciseSubjects: [
          {
            id: 'uniforme_ecole',
            statement: 'L\'uniforme doit \u00eatre impos\u00e9 \u00e0 l\'\u00e9cole',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['droite', 'Attal'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'derision'], typicalActors: ['syndicats enseignants', 'gauche'] },
            ],
          },
        ],
      },
      {
        id: 'universite',
        label: 'Universit\u00e9 & enseignement sup\u00e9rieur',
        keywords: ['universit\u00e9', 'universite', '\u00e9tudiant', 'etudiant', 'parcoursup', 'fac', 'grandes \u00e9coles', 'master', 'doctorat', 'bourse \u00e9tudiante'],
        preciseSubjects: [
          {
            id: 'selection_universite',
            statement: 'La s\u00e9lection \u00e0 l\'universit\u00e9 est n\u00e9cessaire',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['droite', 'grandes \u00e9coles'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['syndicats \u00e9tudiants', 'gauche'] },
            ],
          },
        ],
      },
      {
        id: 'ecole_privee',
        label: '\u00c9cole priv\u00e9e & in\u00e9galit\u00e9s scolaires',
        keywords: ['\u00e9cole priv\u00e9e', 'ecole privee', 'priv\u00e9 hors contrat', 'stanislas', 'mixit\u00e9 scolaire', 'carte scolaire', 's\u00e9gr\u00e9gation scolaire'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'technologie',
    label: 'Technologie',
    domainId: 'information_savoirs',
    subjects: [
      {
        id: 'ia_generative',
        label: 'IA g\u00e9n\u00e9rative',
        keywords: ['intelligence artificielle', 'chatgpt', 'openai', 'claude ai', 'midjourney', 'stable diffusion', 'ia générative', 'ia generative', 'deepfake', 'gemini ai', 'dall-e', 'copilot ai'],
        preciseSubjects: [
          {
            id: 'ia_detruit_emplois',
            statement: 'L\'IA va d\u00e9truire plus d\'emplois qu\'elle n\'en cr\u00e9e',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'urgence'], typicalActors: ['syndicats', 'technocritiques'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'inspiration'], typicalActors: ['tech optimistes', 'startups IA'] },
            ],
          },
          {
            id: 'reguler_ia',
            statement: 'L\'IA doit \u00eatre r\u00e9gul\u00e9e strictement par l\'\u00c9tat',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'ordre'], typicalActors: ['UE', 'r\u00e9gulateurs', 'AI Safety'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'menace'], typicalActors: ['startups', 'Silicon Valley', 'acc\u00e9l\u00e9rationnistes'] },
            ],
          },
        ],
      },
      {
        id: 'reseaux_sociaux',
        label: 'R\u00e9seaux sociaux & plateformes',
        keywords: ['r\u00e9seau social', 'instagram', 'tiktok', 'twitter', 'x.com', 'facebook', 'meta', 'youtube', 'snapchat', 'algorithme', 'bulle de filtre', 'addiction', 'mod\u00e9ration'],
        preciseSubjects: [
          {
            id: 'reseaux_sociaux_mineurs',
            statement: 'Les r\u00e9seaux sociaux doivent \u00eatre interdits aux moins de 16 ans',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['menace', 'ordre'], typicalActors: ['parents', 'l\u00e9gislateurs', 'psychologues'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'denonciation'], typicalActors: ['plateformes', 'lib\u00e9raux'] },
            ],
          },
        ],
      },
      {
        id: 'cybersecurite',
        label: 'Cybers\u00e9curit\u00e9',
        keywords: ['cybers\u00e9curit\u00e9', 'cybersecurite', 'hacker', 'piratage', 'ransomware', 'phishing', 'donn\u00e9es personnelles', 'rgpd', 'fuite de donn\u00e9es'],
        preciseSubjects: [],
      },
      {
        id: 'tech_gadgets',
        label: 'Tech & gadgets',
        keywords: ['smartphone', 'iphone', 'android', 'apple', 'samsung', 'google', 'app', 'application', 'gadget', 'test', 'review', 'unboxing'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'sante',
    label: 'Sant\u00e9',
    domainId: 'information_savoirs',
    subjects: [
      {
        id: 'hopital_soins',
        label: 'H\u00f4pital & soins',
        keywords: ['h\u00f4pital', 'hopital', 'm\u00e9decin', 'medecin', 'soignant', 'infirmier', 'urgences', 'd\u00e9sert m\u00e9dical', 'desert medical', 'ap-hp', 'chu'],
        preciseSubjects: [
          {
            id: 'hopital_public_danger',
            statement: 'L\'h\u00f4pital public est en danger \u00e0 cause des coupes budg\u00e9taires',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['soignants', 'syndicats', 'gauche'] },
              { label: 'contre', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['lib\u00e9raux', 'gestionnaires'] },
            ],
          },
        ],
      },
      {
        id: 'vaccination',
        label: 'Vaccination',
        keywords: ['vaccin', 'vaccination', 'anti-vax', 'antivax', 'pfizer', 'moderna', 'dose', 'pass sanitaire', 'obligation vaccinale'],
        preciseSubjects: [
          {
            id: 'obligation_vaccinale',
            statement: 'La vaccination obligatoire est une atteinte aux libert\u00e9s',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'menace'], typicalActors: ['anti-vax', 'libertariens'] },
              { label: 'contre', typicalNarratives: ['ordre', 'urgence'], typicalActors: ['m\u00e9decins', 'autorit\u00e9s sanitaires'] },
            ],
          },
        ],
      },
      {
        id: 'sante_mentale',
        label: 'Sant\u00e9 mentale',
        keywords: ['sant\u00e9 mentale', 'sante mentale', 'd\u00e9pression', 'depression', 'anxi\u00e9t\u00e9', 'anxiete', 'burn-out', 'burnout', 'th\u00e9rapie', 'therapie', 'psychiatrie', 'psychologue'],
        preciseSubjects: [],
      },
      {
        id: 'drogue_addiction',
        label: 'Drogues & addictions',
        keywords: ['drogue', 'cannabis', 'l\u00e9galisation', 'legalisation', 'addiction', 'alcool', 'tabac', 'opio\u00efdes', 'opioides', 'crack', 'salle de shoot'],
        preciseSubjects: [
          {
            id: 'legalisation_cannabis',
            statement: 'Le cannabis doit \u00eatre l\u00e9galis\u00e9 en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'aspiration'], typicalActors: ['gauche', 'lib\u00e9raux', 'associations'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['droite', 'police', 'conservateurs'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Culture & Divertissement
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'culture',
    label: 'Culture',
    domainId: 'culture_divertissement',
    subjects: [
      {
        id: 'cinema',
        label: 'Cin\u00e9ma',
        keywords: ['cin\u00e9ma', 'cinema', 'film', 'r\u00e9alisateur', 'realisateur', 'acteur', 'actrice', 'cannes', 'c\u00e9sar', 'cesar', 'oscar', 'blockbuster', 'box office'],
        preciseSubjects: [],
      },
      {
        id: 'musique',
        label: 'Musique',
        keywords: ['musique', 'rappeur', 'rap', 'chanteur', 'chanteuse', 'album', 'single', 'concert', 'festival', 'spotify', 'victoires de la musique', 'playlist'],
        preciseSubjects: [],
      },
      {
        id: 'series_tv',
        label: 'S\u00e9ries & TV',
        keywords: ['s\u00e9rie', 'serie', 'netflix', 'disney+', 'prime video', '\u00e9mission', 'emission', 't\u00e9l\u00e9r\u00e9alit\u00e9', 'telerealite', 'saison', '\u00e9pisode', 'episode'],
        preciseSubjects: [],
      },
      {
        id: 'litterature',
        label: 'Litt\u00e9rature',
        keywords: ['livre', 'roman', 'auteur', 'autrice', 'litt\u00e9rature', 'litterature', 'goncourt', 'lecture', 'librairie', 'best-seller', 'bd', 'manga'],
        preciseSubjects: [],
      },
      {
        id: 'art_patrimoine',
        label: 'Art & patrimoine',
        keywords: ['mus\u00e9e', 'musee', 'exposition', 'galerie', 'patrimoine', '\u0153uvre', 'oeuvre', 'artiste', 'peinture', 'sculpture', 'street art', 'beaux-arts', 'art contemporain'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'humour',
    label: 'Humour',
    domainId: 'culture_divertissement',
    subjects: [
      {
        id: 'memes',
        label: 'M\u00e8mes & shitpost',
        keywords: ['meme', 'm\u00e8me', 'shitpost', 'mdr', 'ptdr', 'lol', 'troll', 'cursed', 'based', 'sus'],
        preciseSubjects: [],
      },
      {
        id: 'humour_sketch',
        label: 'Humour & sketches',
        keywords: ['humour', 'blague', 'sketch', 'parodie', 'satire', 'stand-up', 'humoriste', 'dr\u00f4le', 'drole', 'hilarant', 'ironie'],
        preciseSubjects: [],
      },
      {
        id: 'humour_politique',
        label: 'Humour politique & satire',
        keywords: ['caricature', 'satire politique', 'canard encha\u00een\u00e9', 'gorafi', 'charlie hebdo', 'd\u00e9tournement'],
        preciseSubjects: [
          {
            id: 'limites_humour',
            statement: 'L\'humour doit pouvoir rire de tout sans limites',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['empowerment', 'derision'], typicalActors: ['humoristes', 'Charlie Hebdo'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['associations', 'militants anti-discrimination'] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'divertissement',
    label: 'Divertissement',
    domainId: 'culture_divertissement',
    subjects: [
      {
        id: 'gaming',
        label: 'Jeux vid\u00e9o & gaming',
        keywords: ['jeu vid\u00e9o', 'jeu video', 'gaming', 'gamer', 'playstation', 'xbox', 'nintendo', 'switch', 'pc gaming', 'esport', 'twitch', 'stream', 'fortnite', 'minecraft'],
        preciseSubjects: [],
      },
      {
        id: 'people_celebrites',
        label: 'People & c\u00e9l\u00e9brit\u00e9s',
        keywords: ['people', 'c\u00e9l\u00e9brit\u00e9', 'celebrite', 'star', 'buzz', 'viral', 'influenceur', 'influenceuse', 'youtubeur', 'tiktokeur'],
        preciseSubjects: [],
      },
      {
        id: 'telerealite',
        label: 'T\u00e9l\u00e9r\u00e9alit\u00e9',
        keywords: ['t\u00e9l\u00e9r\u00e9alit\u00e9', 'telerealite', 'reality', 'les marseillais', 'koh lanta', 'secret story', 'star academy'],
        preciseSubjects: [],
      },
      {
        id: 'anime_manga',
        label: 'Anime & manga',
        keywords: ['anime', 'manga', 'otaku', 'shonen', 'one piece', 'naruto', 'dragon ball', 'cosplay', 'japanimation', 'webtoon'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'sport',
    label: 'Sport',
    domainId: 'culture_divertissement',
    subjects: [
      {
        id: 'football',
        label: 'Football',
        keywords: ['football', 'ligue 1', 'champions league', 'psg', 'coupe du monde', 'mbappe', 'mbapp\u00e9', 'ballon d\'or', 'mercato', 'premier league', 'liga', 'serie a', 'bundesliga'],
        preciseSubjects: [],
      },
      {
        id: 'sports_combat',
        label: 'Sports de combat & MMA',
        keywords: ['mma', 'ufc', 'boxe', 'kickboxing', 'judo', 'karat\u00e9', 'karate', 'combat', 'octogone', 'ko'],
        preciseSubjects: [],
      },
      {
        id: 'jo_competition',
        label: 'JO & comp\u00e9titions internationales',
        keywords: ['jeux olympiques', 'olympique', 'paralympique', 'champion du monde', 'm\u00e9daille d\'or', 'medaille d\'or', 'coupe du monde', 'championnat du monde', 'paris 2024'],
        preciseSubjects: [],
      },
      {
        id: 'fitness',
        label: 'Fitness & musculation',
        keywords: ['musculation', 'fitness', 'crossfit', 'running', 'marathon', 'gym', 's\u00e8che', 'seche', 'prise de masse', 'protein', 'coach sportif'],
        preciseSubjects: [],
      },
      {
        id: 'autres_sports',
        label: 'Autres sports',
        keywords: ['tennis', 'rugby', 'basket', 'nba', 'cyclisme', 'tour de france', 'f1', 'formule 1', 'natation', 'athl\u00e9tisme', 'golf', 'ski'],
        preciseSubjects: [],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Lifestyle & Bien-être
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'deco_interieur',
        label: 'D\u00e9co & int\u00e9rieur',
        keywords: ['décoration', 'decoration', 'déco intérieur', 'deco interieur', 'am\u00e9nagement', 'amenagement', 'ikea', 'cocooning', 'design intérieur', 'design interieur'],
        preciseSubjects: [],
      },
      {
        id: 'food',
        label: 'Food & cuisine',
        keywords: ['recette', 'cuisine', 'food', 'restaurant', 'gastronomie', 'chef', 'brunch', 'foodporn', 'vegan', 'v\u00e9g\u00e9tarien', 'vegetarien', 'bio'],
        preciseSubjects: [
          {
            id: 'veganisme_imperatif',
            statement: 'Le v\u00e9ganisme est un imp\u00e9ratif \u00e9thique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['mobilisation', 'denonciation'], typicalActors: ['associations animales', 'L214'] },
              { label: 'contre', typicalNarratives: ['derision', 'ordre'], typicalActors: ['agriculteurs', 'traditionalistes'] },
            ],
          },
        ],
      },
      {
        id: 'voyage',
        label: 'Voyage',
        keywords: ['voyage', 'travel', 'destination', 'vacances', 'road trip', 'backpack', 'nomade', 'a\u00e9roport', 'aeroport', 'h\u00f4tel', 'airbnb'],
        preciseSubjects: [],
      },
      {
        id: 'mode',
        label: 'Mode & luxe',
        keywords: ['mode', 'fashion', 'ootd', 'outfit', 'luxe', 'haute couture', 'tendance', 'vintage', 'streetwear', 'fast fashion', 'shein'],
        preciseSubjects: [
          {
            id: 'fast_fashion_interdire',
            statement: 'La fast fashion devrait \u00eatre interdite ou lourdement tax\u00e9e',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['\u00e9cologistes', 'cr\u00e9ateurs locaux'] },
              { label: 'contre', typicalNarratives: ['empowerment', 'injustice'], typicalActors: ['consommateurs', 'marques low cost'] },
            ],
          },
        ],
      },
      {
        id: 'organisation_productivite',
        label: 'Organisation & productivit\u00e9',
        keywords: ['organisation', 'productivit\u00e9', 'productivite', 'routine', 'morning routine', 'planning', 'bullet journal', 'notion', 'to-do', 'time management'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'beaute',
    label: 'Beaut\u00e9',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'skincare',
        label: 'Skincare',
        keywords: ['skincare', 'soin', 'cr\u00e8me', 'creme', 's\u00e9rum', 'serum', 'nettoyant', 'routine soin', 'acn\u00e9', 'acne', 'peau', 'hydratant', 'spf'],
        preciseSubjects: [],
      },
      {
        id: 'maquillage',
        label: 'Maquillage',
        keywords: ['maquillage', 'makeup', 'mascara', 'rouge \u00e0 l\u00e8vres', 'foundation', 'fond de teint', 'tuto', 'tutorial', 'contouring'],
        preciseSubjects: [],
      },
      {
        id: 'coiffure',
        label: 'Coiffure',
        keywords: ['coiffure', 'cheveux', 'hair', 'coloration', 'coupe', 'lissage', 'boucles', 'natural hair'],
        preciseSubjects: [],
      },
    ],
  },
  {
    id: 'developpement_personnel',
    label: 'D\u00e9veloppement personnel',
    domainId: 'lifestyle_bienetre',
    subjects: [
      {
        id: 'meditation_mindfulness',
        label: 'M\u00e9ditation & pleine conscience',
        keywords: ['m\u00e9ditation', 'meditation', 'pleine conscience', 'mindfulness', 'respiration', 'yoga', 'zen', 'calme', 'stress', 'relaxation'],
        preciseSubjects: [],
      },
      {
        id: 'motivation',
        label: 'Motivation & citations',
        keywords: ['motivation', 'confiance en soi', 'affirmation', 'r\u00e9silience', 'resilience', 'citation', 'quote', 'inspirant', 'growth', 'croissance personnelle'],
        preciseSubjects: [],
      },
      {
        id: 'spiritualite_new_age',
        label: 'Spiritualit\u00e9 & new age',
        keywords: ['spiritualit\u00e9', 'spiritualite', 'loi d\'attraction', 'manifestation', 'chakra', '\u00e9nergie', 'energie', 'astrologie', 'tarot', 'cristal', 'pleine lune'],
        preciseSubjects: [],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Écologie & Environnement
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'ecologie',
    label: '\u00c9cologie',
    domainId: 'ecologie_environnement',
    subjects: [
      {
        id: 'rechauffement_climatique',
        label: 'R\u00e9chauffement climatique',
        keywords: ['r\u00e9chauffement', 'rechauffement', 'climat', 'climatique', 'co2', 'carbone', 'giec', 'cop', 'accord de paris', '+1.5', '+2\u00b0', 'bilan carbone'],
        preciseSubjects: [
          {
            id: 'decroissance_necessaire',
            statement: 'La d\u00e9croissance est n\u00e9cessaire pour sauver le climat',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'mobilisation'], typicalActors: ['\u00e9cologistes radicaux', 'd\u00e9croissants'] },
              { label: 'contre', typicalNarratives: ['aspiration', 'ordre'], typicalActors: ['lib\u00e9raux', 'tech optimistes', 'croissance verte'] },
            ],
          },
        ],
      },
      {
        id: 'transition_energetique',
        label: 'Transition \u00e9nerg\u00e9tique',
        keywords: ['renouvelable', '\u00e9olienne', 'eolienne', 'solaire', 'nucl\u00e9aire', 'nucleaire', 'hydrog\u00e8ne', 'hydrogene', 'transition \u00e9nerg\u00e9tique', 'sobri\u00e9t\u00e9', 'sobriete'],
        preciseSubjects: [
          {
            id: 'nucleaire_indispensable',
            statement: 'Le nucl\u00e9aire est indispensable \u00e0 la transition \u00e9nerg\u00e9tique',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'aspiration'], typicalActors: ['Jancovici', 'pro-nucl\u00e9aire', 'Renaissance'] },
              { label: 'contre', typicalNarratives: ['menace', 'denonciation'], typicalActors: ['Greenpeace', 'EELV', 'anti-nucl\u00e9aire'] },
            ],
          },
        ],
      },
      {
        id: 'pollution',
        label: 'Pollution',
        keywords: ['pollution', 'plastique', 'pesticide', 'pfas', 'polluant', 'qualit\u00e9 de l\'air', 'qualite de lair', 'particules fines', 'microplastique'],
        preciseSubjects: [],
      },
      {
        id: 'biodiversite',
        label: 'Biodiversit\u00e9',
        keywords: ['biodiversit\u00e9', 'biodiversite', 'extinction', 'esp\u00e8ce menac\u00e9e', 'espece menacee', 'd\u00e9forestation', 'deforestation', 'oc\u00e9an', 'ocean', 'corail', 'faune', 'flore'],
        preciseSubjects: [],
      },
      {
        id: 'agriculture',
        label: 'Agriculture & alimentation durable',
        keywords: ['agriculture', 'bio', 'pesticide', 'ogm', 'permaculture', 'circuit court', 'local', 'paysan', 'fnsea', 'conf\u00e9d\u00e9ration paysanne', 'glyphosate'],
        preciseSubjects: [
          {
            id: 'interdire_glyphosate',
            statement: 'Le glyphosate doit \u00eatre totalement interdit',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'urgence'], typicalActors: ['\u00e9cologistes', 'consommateurs'] },
              { label: 'contre', typicalNarratives: ['ordre', 'menace'], typicalActors: ['FNSEA', 'industrie agrochimique'] },
            ],
          },
        ],
      },
      {
        id: 'militants_ecolo',
        label: 'Militants \u00e9colo & d\u00e9sob\u00e9issance',
        keywords: ['extinction rebellion', 'xr', 'derni\u00e8re r\u00e9novation', 'derniere renovation', 'blocage', 'd\u00e9sob\u00e9issance civile', 'desobeissance civile', '\u00e9co-terrorisme', 'eco-terrorisme', 'activiste climat'],
        preciseSubjects: [
          {
            id: 'desobeissance_civile_climat',
            statement: 'Les actions de d\u00e9sob\u00e9issance civile pour le climat sont l\u00e9gitimes',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['urgence', 'mobilisation'], typicalActors: ['XR', 'Derni\u00e8re R\u00e9novation', 'jeunes pour le climat'] },
              { label: 'contre', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['droite', 'Darmanin', 'automobilistes'] },
            ],
          },
        ],
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOMAINE : Religion & Spiritualité
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    id: 'religion',
    label: 'Religion',
    domainId: 'religion_spiritualite',
    subjects: [
      {
        id: 'laicite',
        label: 'La\u00efcit\u00e9',
        keywords: ['la\u00efcit\u00e9', 'laicite', 'loi 1905', 's\u00e9paration \u00e9glise \u00e9tat', 'separation eglise etat', 'neutralit\u00e9', 'signes religieux'],
        preciseSubjects: [
          {
            id: 'voile_espace_public',
            statement: 'Le voile doit \u00eatre interdit dans l\'espace public',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre', 'denonciation'], typicalActors: ['la\u00efques stricts', 'droite', 'RN'] },
              { label: 'contre', typicalNarratives: ['injustice', 'empowerment'], typicalActors: ['associations musulmanes', 'gauche', 'f\u00e9ministes intersectionnelles'] },
            ],
          },
          {
            id: 'abaya_ecole',
            statement: 'L\'interdiction de l\'abaya \u00e0 l\'\u00e9cole est justifi\u00e9e',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['ordre'], typicalActors: ['gouvernement', 'la\u00efques'] },
              { label: 'contre', typicalNarratives: ['injustice', 'denonciation'], typicalActors: ['associations', 'LFI'] },
            ],
          },
        ],
      },
      {
        id: 'islam_france',
        label: 'Islam en France',
        keywords: ['islam', 'musulman', 'mosqu\u00e9e', 'mosquee', 'ramadan', 'halal', 'imam', 'islamisme', 'islamophobie', 'radicalisation', 's\u00e9paratisme'],
        preciseSubjects: [
          {
            id: 'islamophobie_france',
            statement: 'L\'islamophobie est un probl\u00e8me r\u00e9el en France',
            knownPositions: [
              { label: 'pour', typicalNarratives: ['denonciation', 'injustice'], typicalActors: ['associations musulmanes', 'gauche', 'CCIF'] },
              { label: 'contre', typicalNarratives: ['denonciation', 'ordre'], typicalActors: ['la\u00efques', 'droite', 'universalistes'] },
            ],
          },
        ],
      },
      {
        id: 'christianisme',
        label: 'Christianisme',
        keywords: ['chr\u00e9tien', 'chretien', 'catholique', '\u00e9glise', 'eglise', 'pape', 'messe', 'pri\u00e8re', 'priere', 'no\u00ebl', 'noel', 'p\u00e2ques', 'paques', 'vatican', '\u00e9vang\u00e9lique'],
        preciseSubjects: [],
      },
      {
        id: 'antisemitisme',
        label: 'Antis\u00e9mitisme',
        keywords: ['antisémitisme', 'antisemitisme', 'juif', 'juda\u00efsme', 'judaisme', 'synagogue', 'shoah', 'holocauste', 'crif', 'kippa'],
        preciseSubjects: [],
      },
    ],
  },
];

// ─── Index & Lookup Helpers ─────────────────────────────────

const _themeById = new Map<string, Theme>();
const _domainById = new Map<string, Domain>();
const _subjectById = new Map<string, { subject: Subject; theme: Theme }>();
const _preciseSubjectById = new Map<string, { ps: PreciseSubject; subject: Subject; theme: Theme }>();
const _domainByThemeId = new Map<string, Domain>();

function _buildIndexes() {
  if (_themeById.size > 0) return; // already built
  for (const d of DOMAINS) {
    _domainById.set(d.id, d);
    for (const tId of d.themeIds) _domainByThemeId.set(tId, d);
  }
  for (const t of THEMES) {
    _themeById.set(t.id, t);
    for (const s of t.subjects) {
      _subjectById.set(s.id, { subject: s, theme: t });
      for (const ps of s.preciseSubjects) {
        _preciseSubjectById.set(ps.id, { ps, subject: s, theme: t });
      }
    }
  }
}

export function getThemeById(id: string): Theme | undefined {
  _buildIndexes();
  return _themeById.get(id);
}

export function getDomainForTheme(themeId: string): Domain | undefined {
  _buildIndexes();
  return _domainByThemeId.get(themeId);
}

export function getSubjectById(id: string): { subject: Subject; theme: Theme } | undefined {
  _buildIndexes();
  return _subjectById.get(id);
}

export function getPreciseSubjectById(id: string): { ps: PreciseSubject; subject: Subject; theme: Theme } | undefined {
  _buildIndexes();
  return _preciseSubjectById.get(id);
}

export function getAllPreciseSubjects(): PreciseSubject[] {
  _buildIndexes();
  return Array.from(_preciseSubjectById.values()).map(v => v.ps);
}

export function getPreciseSubjectsForTheme(themeId: string): PreciseSubject[] {
  const theme = getThemeById(themeId);
  if (!theme) return [];
  return theme.subjects.flatMap(s => s.preciseSubjects);
}

// ─── Matching helpers ───────────────────────────────────────

/**
 * Cache de regex word-boundary par keyword.
 * Utilise \b pour les mots courts (<= 4 chars) afin d'éviter les faux positifs.
 * Pour les mots longs, includes() suffit (risque de sous-chaîne minimal).
 */
const _kwRegexCache = new Map<string, RegExp>();

function _matchKeyword(kw: string, text: string): boolean {
  // Mots longs (>= 5 chars) : includes suffit, performances meilleures
  if (kw.length >= 5) return text.includes(kw);

  // Mots courts : word boundary obligatoire
  let re = _kwRegexCache.get(kw);
  if (!re) {
    // Escape regex special chars
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \b ne fonctionne pas bien avec les accents → on utilise (?:^|[\s.,;:!?'"()\-/]) et idem après
    re = new RegExp(`(?:^|[\\s.,;:!?'"()\\-/])${escaped}(?:$|[\\s.,;:!?'"()\\-/])`, 'i');
    _kwRegexCache.set(kw, re);
  }
  return re.test(text);
}

// ─── Classification multi-niveaux ───────────────────────────

export interface MultiLevelMatch {
  domain: { id: string; label: string };
  theme: { id: string; label: string };
  subject: { id: string; label: string } | null;
  matchCount: number;
  matchedKeywords: string[];
}

/**
 * Classifie un texte à travers les 3 premiers niveaux (domaine → thème → sujet).
 * Le niveau 4 (sujet précis) est déterminé par le LLM.
 * Utilise word boundaries pour les keywords courts afin d'éviter les faux positifs.
 */
export function classifyMultiLevel(text: string): MultiLevelMatch[] {
  _buildIndexes();
  const lower = text.toLowerCase();
  const results: MultiLevelMatch[] = [];

  for (const theme of THEMES) {
    for (const subject of theme.subjects) {
      const matched = subject.keywords.filter(kw => _matchKeyword(kw, lower));
      if (matched.length > 0) {
        const domain = _domainByThemeId.get(theme.id)!;
        results.push({
          domain: { id: domain.id, label: domain.label },
          theme: { id: theme.id, label: theme.label },
          subject: { id: subject.id, label: subject.label },
          matchCount: matched.length,
          matchedKeywords: matched,
        });
      }
    }
  }

  return results.sort((a, b) => b.matchCount - a.matchCount);
}

/** Exported for use in topics-keywords.ts */
export { _matchKeyword as matchKeyword };

/**
 * Déduit les domaines uniques à partir d'une liste de thèmes.
 */
export function getDomainsFromThemes(themeIds: string[]): string[] {
  _buildIndexes();
  const domainSet = new Set<string>();
  for (const tId of themeIds) {
    const d = _domainByThemeId.get(tId);
    if (d) domainSet.add(d.id);
  }
  return Array.from(domainSet);
}

// ─── Stats ──────────────────────────────────────────────────

export function getTaxonomyStats() {
  _buildIndexes();
  const subjectCount = _subjectById.size;
  const preciseSubjectCount = _preciseSubjectById.size;
  return {
    domains: DOMAINS.length,
    themes: THEMES.length,
    subjects: subjectCount,
    preciseSubjects: preciseSubjectCount,
  };
}
