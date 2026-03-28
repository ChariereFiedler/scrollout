/**
 * Mots-clés par thème — dérivés de la taxonomie 5 niveaux.
 * Ce fichier maintient la rétrocompatibilité avec l'API existante (classifyTopics, normalizeTopicId, etc.)
 * tout en s'appuyant sur la structure hiérarchique de taxonomy.ts.
 *
 * Les keywords de chaque thème sont l'union des keywords de tous ses sujets.
 */

import { THEMES, classifyMultiLevel, getDomainForTheme, matchKeyword } from './taxonomy';
import type { MultiLevelMatch } from './taxonomy';

export interface TopicDefinition {
  id: string;
  label: string;
  keywords: string[];
}

/**
 * Construit la liste TOPICS à partir de la taxonomie hiérarchique.
 * Chaque thème agrège les keywords de tous ses sujets.
 */
export const TOPICS: TopicDefinition[] = THEMES.map(theme => ({
  id: theme.id,
  label: theme.label,
  keywords: Array.from(new Set(theme.subjects.flatMap(s => s.keywords))),
}));

/**
 * Map d'aliases → id canonique pour normaliser les topics retournés par le LLM.
 * Inclut : id canonique, label (sans accents et avec), variantes courantes.
 */
const TOPIC_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const t of TOPICS) {
    // id canonique
    map[t.id] = t.id;
    // label normalisé (lowercase)
    map[t.label.toLowerCase()] = t.id;
    // label sans accents
    const noAccent = t.label.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    map[noAccent] = t.id;
  }
  // Aliases manuels pour variantes LLM fréquentes
  map['beauté'] = 'beaute';
  map['santé'] = 'sante';
  map['économie'] = 'economie';
  map['écologie'] = 'ecologie';
  map['éducation'] = 'education';
  map['sécurité'] = 'securite';
  map['géopolitique'] = 'geopolitique';
  map['société'] = 'societe';
  map['identité'] = 'identite';
  map['féminisme'] = 'feminisme';
  map['masculinité'] = 'masculinite';
  map['développement personnel'] = 'developpement_personnel';
  map['dev perso'] = 'developpement_personnel';
  map['jeux'] = 'divertissement';
  map['gaming'] = 'divertissement';
  map['jeux vidéo'] = 'divertissement';
  map['jeux video'] = 'divertissement';
  map['food'] = 'lifestyle';
  map['cuisine'] = 'lifestyle';
  map['voyage'] = 'lifestyle';
  map['déco'] = 'lifestyle';
  map['musique'] = 'culture';
  map['cinéma'] = 'culture';
  map['cinema'] = 'culture';
  map['art'] = 'culture';
  map['nature'] = 'ecologie';
  map['animaux'] = 'lifestyle';
  map['immobilier'] = 'business';
  map['crypto'] = 'business';
  map['mode'] = 'beaute';
  map['fashion'] = 'beaute';
  return map;
})();

/**
 * Normalise un topic ID retourné par le LLM vers l'ID canonique de la taxonomie.
 * Retourne l'ID canonique ou null si inconnu.
 */
export function normalizeTopicId(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  if (TOPIC_ALIASES[lower]) return TOPIC_ALIASES[lower];
  // Essai sans accents
  const noAccent = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (TOPIC_ALIASES[noAccent]) return TOPIC_ALIASES[noAccent];
  return null;
}

/**
 * Normalise un tableau de topics : canonise les IDs, déduplique, filtre les inconnus.
 */
export function normalizeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of topics) {
    const normalized = normalizeTopicId(t);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

/**
 * Classifie un texte en thèmes (multi-label).
 * Retourne les thèmes triés par nombre de matches décroissant.
 * Rétrocompatible avec l'ancienne API.
 */
export function classifyTopics(text: string): { id: string; label: string; matchCount: number }[] {
  const lower = text.toLowerCase();
  const results: { id: string; label: string; matchCount: number }[] = [];

  for (const topic of TOPICS) {
    const matchCount = topic.keywords.filter(kw => matchKeyword(kw, lower)).length;
    if (matchCount > 0) {
      results.push({ id: topic.id, label: topic.label, matchCount });
    }
  }

  return results.sort((a, b) => b.matchCount - a.matchCount);
}

/**
 * Classification enrichie : retourne thèmes + sujets + domaines.
 * Wrapper autour de classifyMultiLevel pour usage dans le pipeline.
 */
export function classifyTopicsEnriched(text: string): {
  themes: { id: string; label: string; matchCount: number }[];
  subjects: { id: string; label: string; themeId: string; matchCount: number }[];
  domains: { id: string; label: string }[];
  _multilevel: MultiLevelMatch[];
} {
  const multilevel = classifyMultiLevel(text);

  // Agréger par thème
  const themeMap = new Map<string, { id: string; label: string; matchCount: number }>();
  const subjectMap = new Map<string, { id: string; label: string; themeId: string; matchCount: number }>();
  const domainSet = new Map<string, { id: string; label: string }>();

  for (const m of multilevel) {
    // Thèmes
    const existing = themeMap.get(m.theme.id);
    if (existing) {
      existing.matchCount += m.matchCount;
    } else {
      themeMap.set(m.theme.id, { ...m.theme, matchCount: m.matchCount });
    }

    // Sujets
    if (m.subject) {
      const sExisting = subjectMap.get(m.subject.id);
      if (sExisting) {
        sExisting.matchCount += m.matchCount;
      } else {
        subjectMap.set(m.subject.id, { ...m.subject, themeId: m.theme.id, matchCount: m.matchCount });
      }
    }

    // Domaines
    if (!domainSet.has(m.domain.id)) {
      domainSet.set(m.domain.id, m.domain);
    }
  }

  return {
    themes: Array.from(themeMap.values()).sort((a, b) => b.matchCount - a.matchCount),
    subjects: Array.from(subjectMap.values()).sort((a, b) => b.matchCount - a.matchCount),
    domains: Array.from(domainSet.values()),
    _multilevel: multilevel,
  };
}
