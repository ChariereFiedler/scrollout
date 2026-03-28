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

  it('inclut ocrText avec marqueur [OCR]', () => {
    const result = normalizePostText({
      caption: 'Mon reel',
      imageDesc: '',
      allText: '',
      hashtags: [],
      ocrText: 'SOLDES -50% sur tout le magasin',
    });
    expect(result.normalizedText).toContain('[OCR]');
    expect(result.normalizedText).toContain('SOLDES -50%');
  });

  it('inclut subtitles avec marqueur [SUBTITLES]', () => {
    const result = normalizePostText({
      caption: 'Interview',
      imageDesc: '',
      allText: '',
      hashtags: [],
      subtitles: 'Bonjour je suis ici pour vous parler de la situation',
    });
    expect(result.normalizedText).toContain('[SUBTITLES]');
    expect(result.normalizedText).toContain('Bonjour je suis ici');
  });

  it('inclut audioTranscription avec marqueur [AUDIO_TRANSCRIPT]', () => {
    const result = normalizePostText({
      caption: 'Podcast',
      imageDesc: '',
      allText: '',
      hashtags: [],
      audioTranscription: 'Aujourd\'hui on va parler de la réforme des retraites',
    });
    expect(result.normalizedText).toContain('[AUDIO_TRANSCRIPT]');
    expect(result.normalizedText).toContain('réforme des retraites');
  });

  it('ignore les sources vidéo vides', () => {
    const result = normalizePostText({
      caption: 'Test',
      imageDesc: '',
      allText: '',
      hashtags: [],
      ocrText: '',
      subtitles: '   ',
      audioTranscription: undefined,
    });
    expect(result.normalizedText).not.toContain('[OCR]');
    expect(result.normalizedText).not.toContain('[SUBTITLES]');
    expect(result.normalizedText).not.toContain('[AUDIO_TRANSCRIPT]');
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
