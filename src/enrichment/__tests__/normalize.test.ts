import { describe, it, expect } from 'vitest';
import { normalizePostText, detectLanguage } from '../normalize';

describe('normalizePostText', () => {
  it('fusionne caption et imageDesc sans doublons', () => {
    const result = normalizePostText({
      caption: 'Belle journée au parc',
      imageDesc: 'Photo of a park with trees',
      allText: 'Belle journée au parc',
      hashtags: ['nature', 'parc'],
    });
    // Caption ne doit pas être dupliquée
    const occurrences = result.normalizedText.split('Belle journée au parc').length - 1;
    expect(occurrences).toBe(1);
  });

  it('supprime les URLs', () => {
    const result = normalizePostText({
      caption: 'Regardez https://example.com/test',
      imageDesc: '',
      allText: '',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('https://');
  });

  it('supprime les mentions @', () => {
    const result = normalizePostText({
      caption: 'Merci @john.doe pour ce partage',
      imageDesc: '',
      allText: '',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('@john.doe');
  });

  it('supprime le bruit UI Instagram', () => {
    const result = normalizePostText({
      caption: '',
      imageDesc: '',
      allText: 'Mon texte Home Reels Envoyer un message Rechercher et explorer Profil',
      hashtags: [],
    });
    expect(result.normalizedText).not.toContain('Home Reels');
    expect(result.normalizedText).toContain('Mon texte');
  });

  it('extrait les keyword terms depuis les hashtags', () => {
    const result = normalizePostText({
      caption: 'Test',
      imageDesc: '',
      allText: '',
      hashtags: ['#politique', '#france', '#ab'],
    });
    expect(result.keywordTerms).toContain('politique');
    expect(result.keywordTerms).toContain('france');
    // Trop court (≤2 chars)
    expect(result.keywordTerms).not.toContain('ab');
  });
});

describe('detectLanguage', () => {
  it('détecte le français', () => {
    expect(detectLanguage('Bonjour, cette belle journée est pour nous tous')).toBe('fr');
  });

  it('détecte l\'anglais', () => {
    expect(detectLanguage('This is a beautiful day for everyone')).toBe('en');
  });

  it('retourne unknown sur du texte sans signal', () => {
    expect(detectLanguage('123 456 789')).toBe('unknown');
  });
});
