/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db-bridge before importing the component
vi.mock('../services/db-bridge.js', () => ({
  getStats: vi.fn().mockResolvedValue({
    totalPosts: 280,
    totalEnriched: 155,
    totalSessions: 18,
    totalDwellMs: 3726348,
    attention: { skipped: 99, glanced: 70, viewed: 57, engaged: 54 },
    political: { 0: 132, 1: 2, 2: 14, 3: 5, 4: 2 },
    avgPolarization: 0.05,
    avgConfidence: 0.68,
    topDomains: [
      { domain: 'culture_divertissement', count: 92 },
      { domain: 'lifestyle_bienetre', count: 22 },
      { domain: 'politique_societe', count: 14 },
      { domain: 'information_savoirs', count: 14 },
      { domain: 'ecologie_environnement', count: 4 },
      { domain: 'economie_travail', count: 1 },
    ],
    topTopics: [
      { topic: 'divertissement', count: 64 },
      { topic: 'culture', count: 51 },
      { topic: 'humour', count: 23 },
    ],
    topUsers: [
      { username: 'operadelyon', count: 11, totalDwellMs: 50000 },
    ],
    topCategories: [],
    signals: { activism: 0, conflict: 2, moralAbsolute: 1, enemyDesignation: 0, ingroupOutgroup: 0, total: 3 },
    sponsoredStats: { sponsored: { count: 71, avgDwellMs: 3000, avgPolitical: 0.2 } },
    axes: { economic: 0.29, societal: -0.14, authority: 0, system: 0 },
  }),
}));

describe('screen-wrapped', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should be defined as a custom element', async () => {
    await import('../screens/screen-wrapped.js');
    expect(customElements.get('screen-wrapped')).toBeDefined();
  });

  it('should create element and load data', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);

    // Wait for async loadData
    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    expect(el.shadowRoot).toBeTruthy();
    const slides = el.shadowRoot!.querySelectorAll('.slide');
    expect(slides.length).toBe(6);
  });

  it('should navigate between slides via go()', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);

    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    expect(el.currentSlide).toBe(0);

    el.go(1);
    expect(el.currentSlide).toBe(1);

    el.go(-1);
    expect(el.currentSlide).toBe(0);

    el.go(10);
    expect(el.currentSlide).toBe(5);
  });

  it('should dispatch close-wrapped event', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);

    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    let closed = false;
    el.addEventListener('close-wrapped', () => { closed = true; });
    el.close();
    expect(closed).toBe(true);
  });

  it('should display real data from stats', async () => {
    await import('../screens/screen-wrapped.js');
    const el = document.createElement('screen-wrapped') as any;
    document.body.appendChild(el);

    await new Promise(r => setTimeout(r, 100));
    if (el.updateComplete) await el.updateComplete;

    const text = el.shadowRoot!.textContent || '';
    expect(text).toContain('280');
    expect(text).toContain('Culture & Divertissement');
  });
});
