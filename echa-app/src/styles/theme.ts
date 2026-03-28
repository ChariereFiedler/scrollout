import { css } from 'lit';

/**
 * Scrollout Design System — aligned with scrollout-site brand identity.
 * 9-color palette, Outfit/Inter/JetBrains Mono fonts, dark theme.
 */
export const theme = css`
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  :host {
    /* Backgrounds */
    --bg: #0a0a0a;
    --surface: #141414;
    --surface2: #1a1a1a;
    --surface3: #222;
    --border: #2a2a2a;
    --border-light: #333;

    /* Text */
    --text: #f0f0f0;
    --text-dim: #b0b0b0;
    --text-muted: #777;

    /* Scrollout 9-color palette */
    --jaune: #FFE94A;
    --vert-menthe: #6BE88B;
    --bleu-indigo: #6B6BFF;
    --orange: #FF7B33;
    --rose: #E88BE8;
    --violet: #8B44E8;
    --rouge: #FF2222;
    --bleu-ciel: #88CCFF;
    --vert-eau: #88EEBB;

    /* Semantic aliases */
    --accent: var(--bleu-indigo);
    --green: var(--vert-menthe);
    --yellow: var(--jaune);
    --red: var(--rouge);
    --purple: var(--violet);

    /* Radii */
    --radius: 16px;
    --radius-sm: 10px;
    --radius-pill: 999px;

    /* Shadows (dark-adapted) */
    --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.3);
    --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.2);

    /* Fonts */
    --font-heading: 'Outfit', sans-serif;
    --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;

    font-family: var(--font-body);
  }
`;

/** Political score color scale (0–4) */
export const polColors = ['#555', '#6BE88B', '#FFE94A', '#FF7B33', '#FF2222'];
export const polLabels = ['Apolitique', 'Social', 'Indirect', 'Explicite', 'Militant'];

/** Attention level colors */
export const attentionColors: Record<string, string> = {
  engaged: '#6BE88B',
  viewed: '#6B6BFF',
  glanced: '#FFE94A',
  skipped: '#555',
};

/** Domain colors for content diet visualization */
export const domainColors: Record<string, string> = {
  'actualité': '#FF7B33',
  'politique': '#FF2222',
  'divertissement': '#E88BE8',
  'lifestyle': '#88EEBB',
  'culture': '#8B44E8',
  'société': '#6B6BFF',
  'sport': '#FFE94A',
  'technologie': '#88CCFF',
  'business': '#6BE88B',
};

/** Scrollout color dots (brand identity) */
export const scrolloutDots = ['#FFE94A', '#6BE88B', '#6B6BFF', '#FF7B33', '#E88BE8', '#8B44E8', '#FF2222', '#88CCFF', '#88EEBB'];
