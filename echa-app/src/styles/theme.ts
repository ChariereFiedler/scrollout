import { css } from 'lit';

/**
 * Scrollout Design System — aligned with scrollout-site brand identity.
 * 9-color palette, Outfit/Inter/JetBrains Mono fonts, dark theme.
 */
export const theme = css`
  @import url('https://fonts.googleapis.com/css2?family=Averia+Sans+Libre:wght@400;700&family=JetBrains+Mono:wght@400;500&display=swap');

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
    --jaune: #FFFF66;
    --vert-menthe: #90EE90;
    --bleu-indigo: #5B3FE8;
    --orange: #FF6B00;
    --rose: #DA70D6;
    --violet: #8B22CC;
    --rouge: #FF0000;
    --bleu-ciel: #B0E0FF;
    --vert-eau: #90DDAA;

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
    --font-heading: 'Averia Sans Libre', sans-serif;
    --font-body: 'Averia Sans Libre', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;

    font-family: var(--font-body);
  }
`;

/** Political score color scale (0–4) */
export const polColors = ['#555', '#90EE90', '#FFFF66', '#FF6B00', '#FF0000'];
export const polLabels = ['Apolitique', 'Social', 'Indirect', 'Explicite', 'Militant'];

/** Attention level colors */
export const attentionColors: Record<string, string> = {
  engaged: '#90EE90',
  viewed: '#5B3FE8',
  glanced: '#FFFF66',
  skipped: '#555',
};

/** Domain colors for content diet visualization */
export const domainColors: Record<string, string> = {
  'actualité': '#FF6B00',
  'politique': '#FF0000',
  'divertissement': '#DA70D6',
  'lifestyle': '#90DDAA',
  'culture': '#8B22CC',
  'société': '#5B3FE8',
  'sport': '#FFFF66',
  'technologie': '#B0E0FF',
  'business': '#90EE90',
};

/** Scrollout color dots (brand identity) — legacy, kept for loading animations */
export const scrolloutDots = ['#FFFF66', '#90EE90', '#5B3FE8', '#FF6B00', '#DA70D6', '#8B22CC', '#FF0000', '#B0E0FF', '#90DDAA'];

/** Brand mark rendered as inline SVG string for .innerHTML bindings */
export function scrolloutIconSvg(size = 28): string {
  const r = size / 8;
  const dots = [
    { x: size * 0.18, y: size * 0.18, c: '#FFFF66' },
    { x: size * 0.5, y: size * 0.14, c: '#90EE90' },
    { x: size * 0.82, y: size * 0.18, c: '#5B3FE8' },
    { x: size * 0.18, y: size * 0.5, c: '#FF6B00' },
    { x: size * 0.5, y: size * 0.5, c: '#DA70D6' },
    { x: size * 0.82, y: size * 0.5, c: '#8B22CC' },
    { x: size * 0.18, y: size * 0.82, c: '#FF0000' },
    { x: size * 0.5, y: size * 0.86, c: '#B0E0FF' },
    { x: size * 0.82, y: size * 0.82, c: '#90DDAA' },
  ];

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" aria-hidden="true">
      ${dots.map(dot => `<circle cx="${dot.x}" cy="${dot.y}" r="${r}" fill="${dot.c}"></circle>`).join('')}
    </svg>
  `;
}
