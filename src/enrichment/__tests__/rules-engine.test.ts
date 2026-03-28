import { describe, it, expect } from 'vitest';
import { applyRules } from '../rules-engine';

describe('applyRules', () => {
  it('score 0 sur un post beauté/lifestyle', () => {
    const result = applyRules({
      normalizedText: 'Nouveau tuto maquillage, routine skincare du matin avec mon sérum préféré',
      hashtags: ['skincare', 'beauty', 'routine'],
      username: 'beautygirl',
    });
    expect(result.politicalExplicitnessScore).toBe(0);
    expect(result.polarizationScore).toBe(0);
    expect(result.mainTopics).toContain('beaute');
  });

  it('score 3+ sur un post mentionnant des acteurs politiques', () => {
    const result = applyRules({
      normalizedText: 'Macron annonce une nouvelle réforme, Mélenchon réagit vivement',
      hashtags: [],
      username: 'infos24h',
    });
    expect(result.politicalExplicitnessScore).toBeGreaterThanOrEqual(3);
    expect(result.politicalActors.length).toBeGreaterThan(0);
  });

  it('score 4 sur un post militant avec hashtags', () => {
    const result = applyRules({
      normalizedText: 'Tous en grève demain, mobilisation générale contre cette réforme',
      hashtags: ['#grevegeneral', '#reformedesretraites', '#onlacherien'],
      username: 'militant_cgt',
    });
    expect(result.politicalExplicitnessScore).toBe(4);
    expect(result.activismSignal).toBe(true);
  });

  it('détecte la polarisation dans un texte indigné', () => {
    const result = applyRules({
      normalizedText: "C'est scandaleux ! Les élites se moquent du peuple, c'est inadmissible",
      hashtags: [],
      username: 'citoyen_enerve',
    });
    expect(result.polarizationScore).toBeGreaterThan(0.2);
    expect(result.ingroupOutgroupSignal).toBe(true);
  });

  it('confiance basse sur texte très court', () => {
    const result = applyRules({
      normalizedText: 'Lol',
      hashtags: [],
      username: 'random',
    });
    expect(result.confidenceScore).toBeLessThan(0.5);
  });

  it('confiance plus haute avec texte long + hashtags', () => {
    const result = applyRules({
      normalizedText: 'Un long texte avec beaucoup de contenu sur la politique française et les réformes du gouvernement et les partis politiques',
      hashtags: ['politique', 'france', 'reforme'],
      username: 'analyste',
    });
    expect(result.confidenceScore).toBeGreaterThan(0.5);
  });
});
