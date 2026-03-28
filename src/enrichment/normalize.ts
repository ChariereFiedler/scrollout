/**
 * Normalisation de texte — Couche 4.
 * Fusionne caption + imageDesc (alt-text) + allText en un texte consolidé.
 * Nettoie les doublons, emojis excessifs, mentions, URLs.
 */

/**
 * Supprime les URLs d'un texte.
 */
function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, '').replace(/www\.\S+/gi, '');
}

/**
 * Supprime les mentions @username.
 */
function stripMentions(text: string): string {
  return text.replace(/@[\w.]+/g, '');
}

/**
 * Réduit les emojis consécutifs (max 2).
 */
function reduceEmojis(text: string): string {
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
  let consecutive = 0;
  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(emojiRegex)) {
    const idx = match.index!;
    const before = text.slice(lastIndex, idx);

    if (before.trim() === '' && consecutive > 0) {
      consecutive++;
    } else {
      consecutive = 1;
    }

    result += before;
    if (consecutive <= 2) {
      result += match[0];
    }
    lastIndex = idx + match[0].length;
  }
  result += text.slice(lastIndex);
  return result;
}

/**
 * Supprime le bruit UI Instagram (boutons, navigation, métadonnées de l'app).
 */
function stripInstagramUI(text: string): string {
  const uiPatterns = [
    /Home\s+Reels\s+Envoyer un message\s+Rechercher et explorer\s+Profil/gi,
    /Plus d'actions pour cette publication/gi,
    /Photo de profil de \S+/gi,
    /\S+ a publié un\(e\) \S+ le \d+ \w+/gi,
    /Suggestions?\s+Suivre/gi,
    /\d+ J'aime,?\s*\d* commentaires?/gi,
    /Voir la traduction/gi,
    /Photo \d+ de \d+ de .+?,/gi,
    /Suggestion Photo de .+?,/gi,
  ];
  let result = text;
  for (const pattern of uiPatterns) {
    result = result.replace(pattern, '');
  }
  return result;
}

/**
 * Normalise les espaces et sauts de ligne.
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Déduplique des segments de texte (évite la répétition caption dans allText).
 */
function deduplicateSegments(segments: string[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // Normaliser pour comparaison (lowercase, sans ponctuation)
    const normalized = trimmed.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

    // Vérifier si ce segment est déjà inclus dans un segment précédent ou vice versa
    let isDuplicate = false;
    for (const existing of seen) {
      if (existing.includes(normalized) || normalized.includes(existing)) {
        isDuplicate = true;
        // Garder le plus long
        if (normalized.length > existing.length) {
          seen.delete(existing);
          seen.add(normalized);
          // Remplacer dans unique
          const idx = unique.findIndex(u =>
            u.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ') === existing
          );
          if (idx !== -1) unique[idx] = trimmed;
        }
        break;
      }
    }

    if (!isDuplicate) {
      seen.add(normalized);
      unique.push(trimmed);
    }
  }

  return unique.join('\n\n');
}

/**
 * Détecte la langue principale d'un texte (heuristique simple).
 * Retourne 'fr', 'en', ou 'unknown'.
 */
export function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  const frWords = ['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'est', 'sont', 'dans', 'pour', 'avec', 'sur', 'pas', 'qui', 'que', 'nous', 'vous', 'cette', 'ces', 'mais', 'aussi', 'comme', 'plus', 'tout', 'bien', 'très', 'ça'];
  const enWords = ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'with', 'for', 'this', 'that', 'from', 'been', 'will', 'would', 'could', 'should', 'their', 'they', 'your', 'about', 'just', 'more', 'very'];

  const words = lower.split(/\s+/);
  let frCount = 0;
  let enCount = 0;

  for (const word of words) {
    if (frWords.includes(word)) frCount++;
    if (enWords.includes(word)) enCount++;
  }

  if (frCount === 0 && enCount === 0) return 'unknown';
  if (frCount > enCount) return 'fr';
  if (enCount > frCount) return 'en';
  return 'fr'; // default français pour un projet FR
}

/**
 * Produit le texte normalisé consolidé à partir des champs d'un post.
 */
export function normalizePostText(input: {
  caption: string;
  imageDesc: string;
  allText: string;
  hashtags: string[];
}): {
  normalizedText: string;
  language: string;
  keywordTerms: string[];
} {
  // 1. Nettoyer chaque source
  const cleanCaption = normalizeWhitespace(reduceEmojis(stripUrls(stripMentions(input.caption))));
  const cleanImageDesc = normalizeWhitespace(input.imageDesc);
  const cleanAllText = normalizeWhitespace(stripInstagramUI(reduceEmojis(stripUrls(stripMentions(input.allText)))));

  // 2. Dédupliquer et fusionner
  const normalizedText = deduplicateSegments([cleanCaption, cleanImageDesc, cleanAllText]);

  // 3. Détecter la langue
  const language = detectLanguage(normalizedText);

  // 4. Extraire les termes-clés (hashtags nettoyés + mots significatifs)
  const keywordTerms = input.hashtags
    .map(h => h.replace(/^#/, '').toLowerCase())
    .filter(h => h.length > 2);

  return { normalizedText, language, keywordTerms };
}
