import { LitElement, html, css, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, state } from 'lit/decorators.js';
import { getStats, type DbStats, resolveEntities, type ResolvedEntity } from '../services/db-bridge.js';
import { resolveEntityLocal, ENTITY_DICTIONARY } from '../services/ontology.js';
import { palette } from '../styles/theme.js';

// ── Constants ───────────────────────────────────────────────

const TOTAL_SLIDES = 9;

const DOMAIN_COLORS: Record<string, string> = {
  culture_divertissement: palette.violet,
  lifestyle_bienetre: palette.vertEau,
  politique_societe: palette.rouge,
  information_savoirs: palette.bleuCiel,
  ecologie_environnement: palette.vertMenthe,
  economie_travail: palette.jaune,
  sport: palette.orange,
  technologie: palette.bleuIndigo,
};

function domainLabel(d: string): string {
  const map: Record<string, string> = {
    culture_divertissement: 'Culture & Divertissement',
    lifestyle_bienetre: 'Lifestyle & Bien-etre',
    politique_societe: 'Politique & Societe',
    information_savoirs: 'Information & Savoirs',
    ecologie_environnement: 'Ecologie & Environnement',
    economie_travail: 'Economie & Travail',
  };
  return map[d] || d;
}

// ── Emotion → color + icon mapping ──────────────────────────

const EMOTION_META: Record<string, { color: string; icon: string }> = {
  anger:    { color: palette.rouge, icon: '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.5-2.5 1.5-3.5z"/>' },
  fear:     { color: '#9B59B6', icon: '<circle cx="12" cy="12" r="10"/><path d="M8 15h8"/><path d="M9 9h.01"/><path d="M15 9h.01"/>' }, // emotion-specific color
  joy:      { color: palette.jaune, icon: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>' },
  hope:     { color: palette.vertMenthe, icon: '<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 00-8 0"/>' },
  disgust:  { color: '#2ECC71', icon: '<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><path d="M7.5 8l2.5 1 2.5-1"/><path d="M16.5 8l-2.5 1-2.5-1"/>' }, // emotion-specific color
  sadness:  { color: '#3498DB', icon: '<path d="M12 22a7 7 0 007-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 007 7z"/>' }, // emotion-specific color
  surprise: { color: palette.orange, icon: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/><path d="M9 9h.01"/><path d="M15 9h.01"/>' },
  contempt: { color: '#95A5A6', icon: '<circle cx="12" cy="12" r="10"/><path d="M8 15c1 1 3.5 1 5-1"/><path d="M9 9h.01"/><path d="M15 9h.01"/>' }, // emotion-specific color
  neutral:  { color: '#BDC3C7', icon: '<circle cx="12" cy="12" r="10"/><path d="M8 15h8"/><path d="M9 9h.01"/><path d="M15 9h.01"/>' }, // emotion-specific color
};

// ── Narrative → icon mapping ────────────────────────────────

const NARRATIVE_META: Record<string, { color: string; icon: string; label: string }> = {
  apocalyptic:       { color: palette.rouge, icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', label: 'Apocalyptique' },
  hero_journey:      { color: palette.bleuIndigo, icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', label: 'Heroique' },
  oppression:        { color: '#9B59B6', icon: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>', label: 'Oppression' }, // narrative-specific color
  meritocracy:       { color: palette.jaune, icon: '<path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 1012 0V2z"/>', label: 'Meritocratie' },
  us_vs_them:        { color: palette.orange, icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>', label: 'Nous vs Eux' },
  victim:            { color: '#3498DB', icon: '<path d="M12 22a7 7 0 007-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 007 7z"/>', label: 'Victimaire' }, // narrative-specific color
  resistance:        { color: '#E74C3C', icon: '<path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>', label: 'Resistance' }, // narrative-specific color
  progress:          { color: palette.vertMenthe, icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', label: 'Progres' },
  nostalgia:         { color: '#D4A76A', icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', label: 'Nostalgie' }, // narrative-specific color
  fear_mongering:    { color: '#8E44AD', icon: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', label: 'Alarmisme' }, // narrative-specific color
  empowerment:       { color: palette.orange, icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', label: 'Empowerment' },
  conspiracy:        { color: '#2C3E50', icon: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', label: 'Complotisme' }, // narrative-specific color
};

// ── Lucide SVG helper ───────────────────────────────────────

const icon = (path: string, size = 20) => html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;">${unsafeSVG(path)}</svg>`;

const ICONS = {
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  alertTriangle: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  barChart: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  bookOpen: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 1012 0V2z"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.4 2.4 0 010-3.4l2.6-2.6a2.4 2.4 0 013.4 0z"/><path d="M14.5 12.5l2-2"/><path d="M11.5 9.5l2-2"/><path d="M8.5 6.5l2-2"/><path d="M17.5 15.5l2-2"/>',
  gauge: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M12 6v6l4 2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.5-2.5 1.5-3.5z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>',
  brain: '<path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44A2.5 2.5 0 015 17.5a2.5 2.5 0 01.49-4.78A2.5 2.5 0 014 10.5a2.5 2.5 0 013.92-2.06A2.5 2.5 0 019.5 2z"/><path d="M14.5 2A2.5 2.5 0 0012 4.5v15a2.5 2.5 0 004.96.44A2.5 2.5 0 0019 17.5a2.5 2.5 0 01-.49-4.78A2.5 2.5 0 0020 10.5a2.5 2.5 0 00-3.92-2.06A2.5 2.5 0 0014.5 2z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.936A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.962 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .962L15.5 14.063a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
};

function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}

function formatDwell(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min >= 60) return `${Math.floor(min / 60)}h${min % 60}m`;
  return `${min}min`;
}

// ── Component ───────────────────────────────────────────────

@customElement('screen-wrapped')
export class ScreenWrapped extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: var(--font-body);
      -webkit-font-smoothing: antialiased;
    }

    .slides {
      display: flex;
      width: ${TOTAL_SLIDES * 100}%;
      height: 100%;
      transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
      touch-action: pan-y;
    }

    .slide {
      width: calc(100% / ${TOTAL_SLIDES});
      height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      flex-direction: column;
      padding: 32px 20px calc(env(safe-area-inset-bottom, 16px) + 24px);
      box-sizing: border-box;
    }

    /* ── Slide backgrounds ── */
    .slide-1 { background: linear-gradient(180deg, #fafafa 0%, #f0f0f5 100%); }
    .slide-2 { background: linear-gradient(180deg, #f8f8fc 0%, #eef0f8 100%); }
    .slide-3 { background: linear-gradient(180deg, #fdf9f2 0%, #f4efe5 100%); }
    .slide-4 { background: linear-gradient(180deg, #1a1a1a 0%, #111 100%); color: var(--text); }
    .slide-5 { background: linear-gradient(180deg, #0f0f1a 0%, #1a1025 100%); color: var(--text); }
    .slide-6 { background: linear-gradient(180deg, #f5f7f2 0%, #ecefe6 100%); }
    .slide-7 { background: linear-gradient(180deg, #0f0f1a 0%, #1a1025 100%); color: var(--text); }
    .slide-8 { background: linear-gradient(180deg, #f8f4ec 0%, #eee7db 100%); }
    .slide-9 { background: linear-gradient(180deg, #111 0%, #1a1025 100%); color: var(--text); }

    /* ── Typography ── */
    .eyebrow {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--text-soft);
      margin-bottom: 12px;
    }
    .dark-slide .eyebrow { color: #88aacc; }

    .title {
      font-family: var(--font-mono);
      font-weight: 900;
      font-size: 28px;
      line-height: 1;
      color: var(--surface-dark);
      margin-bottom: 12px;
    }
    .dark-slide .title { color: var(--text); }

    .body-text {
      font-size: 13px;
      line-height: 1.4;
      color: var(--text-faint);
      margin-bottom: 14px;
    }
    .dark-slide .body-text { color: var(--text-dim); }

    /* ── Hero stat ── */
    .hero {
      background: var(--surface-dark);
      border-radius: 24px;
      padding: 24px;
      margin-bottom: 16px;
    }
    .hero-big {
      font-family: var(--font-mono);
      font-weight: 900;
      font-size: 96px;
      line-height: 0.88;
      color: var(--text);
    }
    .hero-sub {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-dim);
      margin-top: 10px;
      line-height: 1.2;
    }

    /* ── Stat cards row ── */
    .cards-row {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat-card {
      flex: 1;
      border-radius: 20px;
      padding: 16px;
    }
    .stat-card .val {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 22px;
      line-height: 1;
    }
    .stat-card .lbl {
      font-size: 12px;
      font-weight: 600;
      margin-top: 4px;
      line-height: 1.2;
    }

    /* ── Bubble map ── */
    .bubble-map {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1.1;
      background: radial-gradient(circle at 40% 35%, #fff 0%, #f0f0f5 100%);
      border-radius: 24px;
      border: 1px solid #e0e0e8;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .bubble {
      position: absolute;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 8px;
      box-sizing: border-box;
      transition: transform 0.3s;
    }
    .bubble .b-label {
      font-weight: 700;
      line-height: 1.1;
      color: var(--white);
      text-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .bubble .b-count {
      font-family: var(--font-mono);
      font-size: 10px;
      color: rgba(255,255,255,0.8);
    }
    .bubble.ghost {
      border: 1.5px dashed var(--border-soft);
      background: rgba(255,255,255,0.6) !important;
    }
    .bubble.ghost .b-label { color: var(--text-soft); text-shadow: none; font-weight: 600; }
    .bubble.ghost .b-count { color: var(--text-dim); }

    /* ── Info cards ── */
    .info-card {
      border-radius: 20px;
      padding: 18px;
      margin-bottom: 12px;
    }
    .info-card.dark { background: var(--surface-dark); color: var(--text); }
    .info-card.accent { background: var(--bleu-indigo); color: var(--white); }
    .info-card.orange { background: var(--orange); color: var(--white); }
    .info-card.yellow { background: var(--jaune); color: var(--surface-dark); }
    .info-card.red { background: var(--rouge); color: var(--white); }
    .info-card.mint { background: var(--vert-menthe); color: var(--surface-dark); }
    .info-card.surface { background: #f0ece3; color: #333; }
    .info-card .card-eyebrow {
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      opacity: 0.7;
      margin-bottom: 6px;
    }
    .info-card .card-text {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
    }
    .info-card .card-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .info-card .card-row svg { margin-top: 1px; }

    /* ── Metric blocks ── */
    .metric-block {
      border-radius: 24px;
      padding: 20px;
      margin-bottom: 12px;
    }
    .metric-block .m-val {
      font-family: var(--font-mono);
      font-weight: 900;
      font-size: 48px;
      line-height: 1;
    }
    .metric-block .m-desc {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.2;
      margin-top: 6px;
    }

    /* ── Domain bars ── */
    .domain-bars { margin-bottom: 16px; }
    .bar-row {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
      gap: 8px;
    }
    .bar-label {
      width: 110px;
      font-size: 11px;
      font-weight: 600;
      text-align: right;
      color: var(--text-faint);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bar-track {
      flex: 1;
      height: 10px;
      background: #e4e4ec;
      border-radius: 5px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .bar-val {
      width: 36px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 500;
      color: var(--text-muted);
    }

    /* ── Narrative/Emotion chips ── */
    .chip-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }
    .chip {
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: 16px;
      padding: 14px 16px;
    }
    .chip-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .chip-label {
      font-weight: 700;
      font-size: 15px;
      line-height: 1.2;
    }
    .chip-count {
      font-family: var(--font-mono);
      font-size: 11px;
      opacity: 0.7;
    }
    .chip-bar {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      background: rgba(255,255,255,0.15);
      margin-top: 4px;
    }
    .chip-bar-fill {
      height: 100%;
      border-radius: 2px;
    }

    /* ── Compass ── */
    .compass-container {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      border-radius: 24px;
      background: var(--surface3);
      overflow: hidden;
      margin-bottom: 16px;
    }
    .compass-axis {
      position: absolute;
      background: rgba(255,255,255,0.08);
    }
    .compass-axis.h { width: 100%; height: 1px; top: 50%; }
    .compass-axis.v { height: 100%; width: 1px; left: 50%; }
    .compass-label {
      position: absolute;
      font-family: var(--font-mono);
      font-size: 9px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.4);
    }
    .compass-dot {
      position: absolute;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 20px var(--dot-color);
    }
    .compass-quadrant {
      position: absolute;
      width: 50%;
      height: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.15);
      text-align: center;
      padding: 12px;
    }

    /* ── Footer nav ── */
    .spacer { flex: 1; }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 0 8px;
    }
    .dots {
      display: flex;
      gap: 5px;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--border-soft);
      transition: all 0.3s;
    }
    .dot.active {
      background: var(--bleu-indigo);
      width: 18px;
      border-radius: 4px;
    }
    .dark-slide .dot { background: #444; }
    .dark-slide .dot.active { background: var(--bleu-indigo); }

    .btn-next {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--surface-dark);
      color: var(--text);
      border: none;
      border-radius: 999px;
      padding: 10px 18px;
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      -webkit-tap-highlight-color: transparent;
    }
    .btn-next:active { opacity: 0.7; }
    .dark-slide .btn-next { background: var(--text); color: var(--surface-dark); }
    .btn-next.finish { background: var(--bleu-indigo); color: var(--white); }

    .btn-back {
      background: none;
      border: none;
      color: var(--text-soft);
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
      padding: 8px;
      -webkit-tap-highlight-color: transparent;
    }
    .dark-slide .btn-back { color: #666; }

    /* ── Close button ── */
    .close-btn {
      position: absolute;
      top: max(env(safe-area-inset-top, 12px), 12px);
      right: 14px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(0,0,0,0.1);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }
    .close-btn svg { width: 20px; height: 20px; stroke: var(--text-faint); stroke-width: 2.5; }
    .close-btn:active { opacity: 0.5; }
    .dark-slide .close-btn { background: rgba(255,255,255,0.15); }
    .dark-slide .close-btn svg { stroke: var(--text-dim); }

    /* ── Share button ── */
    .share-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 16px;
      border-radius: 16px;
      border: none;
      background: linear-gradient(135deg, var(--bleu-indigo) 0%, var(--violet) 100%);
      color: var(--white);
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 12px;
      -webkit-tap-highlight-color: transparent;
    }
    .share-btn:active { opacity: 0.8; }
  `;

  @state() currentSlide = 0;
  @state() private stats: DbStats | null = null;
  @state() private loading = true;

  private touchStartX = 0;
  private touchDelta = 0;

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  private async loadData() {
    try {
      this.stats = await getStats();
    } catch (e) {
      console.warn('[Wrapped] Failed to load stats:', e);
    }
    this.loading = false;
  }

  private get totalEnriched(): number { return this.stats?.totalEnriched || 0; }
  private get totalPosts(): number { return this.stats?.totalPosts || 0; }

  private get topDomain(): { domain: string; count: number; pct: number } {
    const d = this.stats?.topDomains?.[0];
    if (!d) return { domain: 'N/A', count: 0, pct: 0 };
    return { ...d, pct: pct(d.count, this.totalEnriched) };
  }

  private get politicalPct(): number {
    const pol = this.stats?.political;
    if (!pol) return 0;
    const total = Object.values(pol).reduce((a, b) => a + b, 0);
    const political = (pol[2] || 0) + (pol[3] || 0) + (pol[4] || 0);
    return pct(political, total);
  }

  private get avgPolarization(): number {
    return this.stats?.avgPolarization ?? 0;
  }

  go(slide: number) {
    this.currentSlide = Math.max(0, Math.min(TOTAL_SLIDES - 1, slide));
  }

  private onTouchStart(e: TouchEvent) {
    this.touchStartX = e.touches[0].clientX;
    this.touchDelta = 0;
  }

  private onTouchMove(e: TouchEvent) {
    this.touchDelta = e.touches[0].clientX - this.touchStartX;
  }

  private onTouchEnd() {
    if (Math.abs(this.touchDelta) > 60) {
      if (this.touchDelta < 0) this.go(this.currentSlide + 1);
      else this.go(this.currentSlide - 1);
    }
    this.touchDelta = 0;
  }

  close() {
    this.dispatchEvent(new CustomEvent('close-wrapped', { bubbles: true, composed: true }));
  }

  private async shareWrapped() {
    const s = this.stats;
    if (!s) return;
    const text = [
      `Scrollout Wrapped 2026`,
      `${s.totalPosts} posts analyses, ${s.totalEnriched} enrichis`,
      `Top: ${domainLabel(this.topDomain.domain)} (${this.topDomain.pct}%)`,
      `Polarisation: ${Math.round(this.avgPolarization * 100)}%`,
      `${formatDwell(s.totalDwellMs)} de scroll`,
    ].join('\n');

    if (navigator.share) {
      try { await navigator.share({ title: 'Mon Scrollout Wrapped', text }); } catch {}
    } else {
      // Fallback: copy to clipboard
      try { await navigator.clipboard.writeText(text); } catch {}
    }
  }

  render() {
    if (this.loading) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#fafafa;color:var(--text-soft);font-size:13px;">Chargement...</div>`;
    }
    const s = this.stats;
    if (!s) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#fafafa;color:var(--text-soft);font-size:13px;">Pas de donnees disponibles</div>`;
    }

    return html`
      <div class="slides"
        style="transform: translateX(-${this.currentSlide * (100 / TOTAL_SLIDES)}%)"
        @touchstart=${this.onTouchStart}
        @touchmove=${this.onTouchMove}
        @touchend=${this.onTouchEnd}
      >
        ${this.renderSlide1(s)}
        ${this.renderSlide2(s)}
        ${this.renderSlide3(s)}
        ${this.renderSlide4Narratives(s)}
        ${this.renderSlide5Emotions(s)}
        ${this.renderSlide6Compass(s)}
        ${this.renderSlide7Ego(s)}
        ${this.renderSlide8Records(s)}
        ${this.renderSlide9Exit(s)}
      </div>
    `;
  }

  private closeBtn() {
    return html`<button class="close-btn" @click=${this.close}>
      <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;
  }

  private renderFooter(slide: number) {
    const last = TOTAL_SLIDES - 1;
    return html`
      <div class="spacer"></div>
      <div class="footer">
        ${slide > 0
          ? html`<button class="btn-back" @click=${() => this.go(slide - 1)}>${'\u2190'} Retour</button>`
          : html`<span></span>`
        }
        <div class="dots">
          ${Array.from({ length: TOTAL_SLIDES }, (_, i) => html`<div class="dot ${i === slide ? 'active' : ''}"></div>`)}
        </div>
        ${slide < last
          ? html`<button class="btn-next" @click=${() => this.go(slide + 1)}>Suivant <span>${'\u2192'}</span></button>`
          : html`<button class="btn-next finish" @click=${this.close}>Fermer</button>`
        }
      </div>
    `;
  }

  // ── Slide 1: Summary ──────────────────────────────────────
  private renderSlide1(s: DbStats) {
    const top = this.topDomain;
    const polPct = this.politicalPct;
    const polarPct = Math.round(this.avgPolarization * 100);

    return html`
      <div class="slide slide-1">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.target, 14)} Scrollout Wrapped / 2026</div>
        <div class="title">Ton feed avait un centre de gravite.</div>
        <div class="body-text">${this.totalPosts} posts, ${this.totalEnriched} enrichis. Ton attention gravitait autour de ${domainLabel(top.domain).toLowerCase()}.</div>

        <div class="hero">
          <div class="hero-big">${top.pct}%</div>
          <div class="hero-sub">de ton feed dans un seul domaine : ${domainLabel(top.domain)}</div>
        </div>

        <div class="cards-row">
          <div class="stat-card" style="background:var(--bleu-indigo);color:var(--white);">
            <div class="val">${polPct}%</div>
            <div class="lbl">${icon(ICONS.shield, 14)} politique</div>
          </div>
          <div class="stat-card" style="background:var(--orange);color:var(--white);">
            <div class="val">${polarPct}%</div>
            <div class="lbl">${icon(ICONS.zap, 14)} polarisation</div>
          </div>
        </div>

        ${this.renderFooter(0)}
      </div>
    `;
  }

  // ── Slide 2: Bubble Map ───────────────────────────────────
  private renderSlide2(s: DbStats) {
    const domains = s.topDomains || [];
    const maxCount = domains[0]?.count || 1;
    const total = domains.reduce((acc, d) => acc + d.count, 0);
    const positions = [
      { x: 20, y: 15, s: 1 }, { x: 55, y: 10, s: 0.7 },
      { x: 10, y: 55, s: 0.65 }, { x: 55, y: 50, s: 0.55 },
      { x: 30, y: 72, s: 0.5 }, { x: 62, y: 72, s: 0.45 },
    ];

    return html`
      <div class="slide slide-2">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.map, 14)} 02 / Ta bulle</div>
        <div class="title">Ta bulle, mise a plat.</div>
        <div class="body-text">Dense = recurrent. Pale = angle mort.</div>

        <div class="bubble-map">
          ${domains.map((d, i) => {
            const pos = positions[i] || { x: 40 + Math.random() * 20, y: 40 + Math.random() * 20, s: 0.3 };
            const ratio = d.count / maxCount;
            const size = Math.max(60, ratio * 140);
            const color = DOMAIN_COLORS[d.domain] || '#999';
            const isSmall = ratio < 0.15;

            return html`
              <div class="bubble ${isSmall ? 'ghost' : ''}"
                style="left:${pos.x}%;top:${pos.y}%;width:${size}px;height:${size}px;background:${isSmall ? 'transparent' : color};box-shadow:${isSmall ? 'none' : `0 8px 24px ${color}44`};font-size:${Math.max(10, size / 8)}px;">
                <span class="b-label">${domainLabel(d.domain).split(' ')[0]}</span>
                <span class="b-count">${d.count} · ${pct(d.count, total)}%</span>
              </div>
            `;
          })}
        </div>
        ${this.renderFooter(1)}
      </div>
    `;
  }

  // ── Slide 3: Bias ─────────────────────────────────────────
  private renderSlide3(s: DbStats) {
    const domains = s.topDomains || [];
    const total = domains.reduce((acc, d) => acc + d.count, 0);
    const topPct = total ? Math.round((domains[0]?.count || 0) / total * 100) : 0;
    const topics = s.topTopics || [];

    return html`
      <div class="slide slide-3">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.alertTriangle, 14)} 03 / Tes biais</div>
        <div class="title">Surexposition selective, pas extremisme.</div>

        <div class="info-card" style="background:var(--surface-dark);color:var(--text);">
          <div class="card-row">${icon(ICONS.eye, 18)}<div>
            <div class="card-eyebrow">Renforcement</div>
            <div class="card-text">${topPct}% concentre dans un seul cadre.</div>
          </div></div>
        </div>

        <div class="info-card" style="background:var(--bleu-indigo);color:var(--white);">
          <div class="card-row">${icon(ICONS.shield, 18)}<div>
            <div class="card-text">Le politique reste peripherique.</div>
          </div></div>
        </div>

        <div class="info-card surface">
          <div class="card-eyebrow">${icon(ICONS.barChart, 12)} Vecteurs de biais</div>
          <div class="card-text">
            ${topics.slice(0, 3).map((t, i) => html`<div style="margin-top:4px;">${i + 1}. ${t.topic}</div>`)}
          </div>
        </div>

        <div class="domain-bars">
          ${domains.slice(0, 6).map(d => {
            const w = total ? Math.round(d.count / total * 100) : 0;
            const color = DOMAIN_COLORS[d.domain] || '#999';
            return html`
              <div class="bar-row">
                <div class="bar-label">${domainLabel(d.domain)}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>
                <div class="bar-val">${w}%</div>
              </div>
            `;
          })}
        </div>
        ${this.renderFooter(2)}
      </div>
    `;
  }

  // ── Slide 4: Narratives ───────────────────────────────────
  private renderSlide4Narratives(s: DbStats) {
    const narratives = s.topNarratives || [];
    const maxCount = narratives[0]?.count || 1;

    return html`
      <div class="slide slide-4 dark-slide">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.bookOpen, 14)} 04 / Recits dominants</div>
        <div class="title">Les histoires que ton feed te raconte.</div>
        <div class="body-text">Chaque contenu porte un cadre narratif. Voici ceux qui reviennent.</div>

        <div class="chip-grid">
          ${narratives.length === 0 ? html`
            <div class="info-card" style="background:var(--surface3);color:#888;">
              <div class="card-row">${icon(ICONS.sparkles, 18)}<div>
                <div class="card-text">Pas encore assez de donnees narratives.</div>
              </div></div>
            </div>
          ` : narratives.slice(0, 5).map(n => {
            const meta = NARRATIVE_META[n.narrative] || { color: palette.bleuIndigo, icon: ICONS.bookOpen, label: n.narrative.replace(/_/g, ' ') };
            const w = Math.round((n.count / maxCount) * 100);
            return html`
              <div class="chip" style="background:${meta.color}22;">
                <div class="chip-icon" style="background:${meta.color};color:var(--white);">
                  ${icon(meta.icon, 20)}
                </div>
                <div style="flex:1;min-width:0;">
                  <div class="chip-label" style="color:${meta.color};">${meta.label}</div>
                  <div class="chip-count" style="color:${meta.color}AA;">${n.count} posts</div>
                  <div class="chip-bar"><div class="chip-bar-fill" style="width:${w}%;background:${meta.color};"></div></div>
                </div>
              </div>
            `;
          })}
        </div>

        ${narratives.length > 0 ? html`
          <div class="info-card" style="background:var(--surface3);color:var(--text);">
            <div class="card-row">${icon(ICONS.brain, 18)}<div>
              <div class="card-text">Ton cadre dominant : ${NARRATIVE_META[narratives[0]?.narrative]?.label || narratives[0]?.narrative}</div>
            </div></div>
          </div>
        ` : nothing}

        ${this.renderFooter(3)}
      </div>
    `;
  }

  // ── Slide 5: Emotions ─────────────────────────────────────
  private renderSlide5Emotions(s: DbStats) {
    const emotions = s.topEmotions || [];
    const maxCount = emotions[0]?.count || 1;

    return html`
      <div class="slide slide-5 dark-slide">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.heart, 14)} 05 / Emotions</div>
        <div class="title">Ce que ton feed te fait ressentir.</div>
        <div class="body-text">L'emotion dominante de chaque post, aggregee.</div>

        <div class="chip-grid">
          ${emotions.length === 0 ? html`
            <div class="info-card" style="background:var(--surface3);color:#888;">
              <div class="card-row">${icon(ICONS.sparkles, 18)}<div>
                <div class="card-text">Pas encore de donnees emotionnelles.</div>
              </div></div>
            </div>
          ` : emotions.slice(0, 6).map(e => {
            const meta = EMOTION_META[e.emotion] || { color: '#BDC3C7', icon: EMOTION_META.neutral.icon };
            const w = Math.round((e.count / maxCount) * 100);
            return html`
              <div class="chip" style="background:${meta.color}18;">
                <div class="chip-icon" style="background:${meta.color};color:var(--white);">
                  ${icon(meta.icon, 20)}
                </div>
                <div style="flex:1;min-width:0;">
                  <div class="chip-label" style="color:${meta.color};">${e.emotion}</div>
                  <div class="chip-count" style="color:${meta.color}AA;">${e.count} posts · ${pct(e.count, this.totalEnriched)}%</div>
                  <div class="chip-bar"><div class="chip-bar-fill" style="width:${w}%;background:${meta.color};"></div></div>
                </div>
              </div>
            `;
          })}
        </div>

        ${emotions.length >= 2 ? html`
          <div class="cards-row">
            <div class="stat-card" style="background:${EMOTION_META[emotions[0]?.emotion]?.color || palette.bleuIndigo};color:var(--white);">
              <div class="val">#1</div>
              <div class="lbl">${emotions[0].emotion}</div>
            </div>
            <div class="stat-card" style="background:${EMOTION_META[emotions[1]?.emotion]?.color || palette.orange};color:var(--white);">
              <div class="val">#2</div>
              <div class="lbl">${emotions[1].emotion}</div>
            </div>
          </div>
        ` : nothing}

        ${this.renderFooter(4)}
      </div>
    `;
  }

  // ── Slide 6: Political Compass ────────────────────────────
  private renderSlide6Compass(s: DbStats) {
    const axes = s.axes || { economic: 0, societal: 0, authority: 0, system: 0 };
    // Map axes (-1..+1) → position (5%..95%)
    const cx = 50 + (axes.economic * 40);
    const cy = 50 - (axes.societal * 40); // inverted Y
    const dotSize = 18;

    // Determine quadrant label
    const quadrant = axes.economic >= 0
      ? (axes.societal >= 0 ? 'Liberal-Marche' : 'Conservateur-Marche')
      : (axes.societal >= 0 ? 'Liberal-Social' : 'Conservateur-Social');

    // Find closest political actor via ontology
    const closestActors = ENTITY_DICTIONARY
      .filter(e => e.type === 'Organization' && e.edges?.some(ed => ed.relation === 'belongsTo' && ed.target === 'politique'))
      .slice(0, 4);

    return html`
      <div class="slide slide-6">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.compass, 14)} 06 / Boussole politique</div>
        <div class="title">Ou se situe ton feed ?</div>
        <div class="body-text">Position moyenne selon les axes economique et societal.</div>

        <div class="compass-container">
          <!-- Axes -->
          <div class="compass-axis h"></div>
          <div class="compass-axis v"></div>

          <!-- Quadrant labels -->
          <div class="compass-quadrant" style="top:0;left:0;">Liberal Social</div>
          <div class="compass-quadrant" style="top:0;right:0;">Liberal Marche</div>
          <div class="compass-quadrant" style="bottom:0;left:0;">Conservateur Social</div>
          <div class="compass-quadrant" style="bottom:0;right:0;">Conservateur Marche</div>

          <!-- Axis labels -->
          <div class="compass-label" style="top:4px;left:50%;transform:translateX(-50%);">${icon(ICONS.sparkles, 10)} Progressiste</div>
          <div class="compass-label" style="bottom:4px;left:50%;transform:translateX(-50%);">Conservateur</div>
          <div class="compass-label" style="left:4px;top:50%;transform:translateY(-50%) rotate(-90deg);transform-origin:left center;">Etatiste</div>
          <div class="compass-label" style="right:4px;top:50%;transform:translateY(-50%) rotate(90deg);transform-origin:right center;">Marche</div>

          <!-- User dot -->
          <div class="compass-dot" style="
            left:${cx}%;
            top:${cy}%;
            width:${dotSize}px;
            height:${dotSize}px;
            background:var(--bleu-indigo);
            --dot-color:rgba(107,107,255,0.5);
          "></div>
          <!-- Glow ring -->
          <div class="compass-dot" style="
            left:${cx}%;
            top:${cy}%;
            width:${dotSize + 14}px;
            height:${dotSize + 14}px;
            background:transparent;
            border:2px solid rgba(107,107,255,0.3);
            --dot-color:transparent;
          "></div>
        </div>

        <div class="info-card" style="background:#f0f0f0;color:#333;">
          <div class="card-row">${icon(ICONS.compass, 18)}<div>
            <div class="card-eyebrow">Position dominante</div>
            <div class="card-text">${quadrant}</div>
          </div></div>
        </div>

        <div class="cards-row">
          <div class="stat-card" style="background:var(--surface-dark);color:var(--text);">
            <div class="val" style="color:var(--bleu-indigo);">${axes.economic >= 0 ? '+' : ''}${axes.economic.toFixed(2)}</div>
            <div class="lbl">Axe economique</div>
          </div>
          <div class="stat-card" style="background:var(--surface-dark);color:var(--text);">
            <div class="val" style="color:var(--orange);">${axes.societal >= 0 ? '+' : ''}${axes.societal.toFixed(2)}</div>
            <div class="lbl">Axe societal</div>
          </div>
        </div>

        ${this.renderFooter(5)}
      </div>
    `;
  }

  // ── Slide 7: Ego Metrics ──────────────────────────────────
  private renderSlide7Ego(s: DbStats) {
    const domains = s.topDomains || [];
    const total = domains.reduce((acc, d) => acc + d.count, 0);
    const top2 = domains.slice(0, 2).reduce((acc, d) => acc + d.count, 0);
    const bubbleScore = pct(top2, total);
    const attn = s.attention || {};
    const engaged = attn['engaged'] || 0;
    const skipped = attn['skipped'] || 0;
    const skipRate = pct(skipped, this.totalPosts);
    const signals = s.signals;
    const totalSignals = signals?.total || 0;

    return html`
      <div class="slide slide-7 dark-slide">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.barChart, 14)} 07 / Ego metrics</div>
        <div class="title">Les chiffres qui piquent.</div>

        <div class="cards-row">
          <div class="metric-block" style="background:var(--surface3);color:var(--text);flex:1;">
            <div class="m-val" style="color:var(--bleu-indigo);">${bubbleScore}%</div>
            <div class="m-desc" style="color:var(--text-dim);">${icon(ICONS.target, 14)} Bubble Score</div>
          </div>
          <div class="metric-block" style="background:var(--jaune);color:var(--surface-dark);flex:1;">
            <div class="m-val">${engaged}</div>
            <div class="m-desc">${icon(ICONS.eye, 14)} engages (> 5s)</div>
          </div>
        </div>

        <div class="metric-block" style="background:var(--bleu-indigo);color:var(--white);">
          <div class="m-desc">${icon(ICONS.zap, 16)} ${skipRate}% skip rate — ${skipped} posts zappes</div>
        </div>

        ${totalSignals > 0 ? html`
          <div class="metric-block" style="background:var(--rouge);color:var(--white);">
            <div class="m-val">${totalSignals}</div>
            <div class="m-desc">${icon(ICONS.alertTriangle, 16)} signaux de polarisation</div>
          </div>
        ` : nothing}

        <div class="metric-block" style="background:var(--border-light);color:var(--border-soft);">
          <div class="m-desc">${icon(ICONS.clock, 14)} ${s.totalSessions} sessions, ${formatDwell(s.totalDwellMs)} de scroll total</div>
        </div>

        ${this.renderFooter(6)}
      </div>
    `;
  }

  // ── Slide 8: Records ──────────────────────────────────────
  private renderSlide8Records(s: DbStats) {
    const scrollMeters = s.totalPosts * 0.15;
    const scrollKm = scrollMeters / 1000;
    const dwellHours = (s.totalDwellMs || 1) / 3600000;
    const scrollSpeed = scrollMeters / dwellHours;
    const totalMin = Math.round((s.totalDwellMs || 0) / 60000);
    const postsPerSession = s.totalSessions > 0 ? Math.round(s.totalPosts / s.totalSessions) : s.totalPosts;
    const distanceText = scrollKm >= 1 ? `${scrollKm.toFixed(1)} km` : `${Math.round(scrollMeters)} m`;
    const distanceMetaphor = scrollMeters < 50 ? 'une piscine olympique du pouce'
      : scrollMeters < 100 ? 'un terrain de foot, parcouru au pouce'
      : scrollMeters < 324 ? `encore ${Math.round(324 - scrollMeters)}m avant la Tour Eiffel`
      : scrollMeters < 1000 ? 'tu as depasse la Tour Eiffel. En scrollant.'
      : `plus loin qu'un jogging matinal`;
    const speedAnimal = scrollSpeed < 53
      ? { name: 'escargot', speed: '53 m/h', verdict: 'Il te bat.' }
      : scrollSpeed < 270 ? { name: 'tortue de mer', speed: '270 m/h', verdict: 'Tu te rapproches.' }
      : scrollSpeed < 1000 ? { name: 'canard', speed: '1 km/h', verdict: 'Presque.' }
      : scrollSpeed < 5000 ? { name: 'hirondelle', speed: '5 km/h', verdict: 'Depasse.' }
      : { name: 'guepard', speed: '120 km/h', verdict: 'Ton pouce est une legende.' };
    const timeEquiv = totalMin < 5 ? 'un espresso' : totalMin < 15 ? 'un podcast' : totalMin < 30 ? 'une sieste' : totalMin < 60 ? 'un episode' : totalMin < 120 ? 'un film' : `${Math.round(totalMin / 60)} films`;

    return html`
      <div class="slide slide-8">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.trophy, 14)} 08 / Tes records</div>
        <div class="title">Tu scrolles. L'algo compte.</div>

        <div class="hero" style="background:linear-gradient(135deg, var(--bleu-indigo) 0%, var(--violet) 100%);">
          <div style="display:flex;align-items:center;gap:12px;">
            ${icon(ICONS.ruler, 28)}
            <div class="hero-big" style="font-size:64px;">${distanceText}</div>
          </div>
          <div class="hero-sub" style="color:rgba(255,255,255,0.8);">scrolles — ${distanceMetaphor}</div>
        </div>

        <div class="cards-row">
          <div class="metric-block" style="background:var(--surface-dark);color:var(--text);flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              ${icon(ICONS.gauge, 20)}
              <div class="m-val" style="color:var(--jaune);font-size:36px;">${Math.round(scrollSpeed)}</div>
            </div>
            <div class="m-desc" style="color:var(--text-dim);">m/h de scroll</div>
            <div class="m-desc" style="color:var(--jaune);margin-top:4px;">vs ${speedAnimal.name}. ${speedAnimal.verdict}</div>
          </div>
        </div>

        <div class="cards-row">
          <div class="stat-card" style="background:var(--orange);color:var(--white);flex:1;">
            <div style="display:flex;align-items:center;gap:6px;">${icon(ICONS.flame, 16)}<div class="val">${s.totalPosts}</div></div>
            <div class="lbl">contenus</div>
          </div>
          <div class="stat-card" style="background:var(--vert-menthe);color:var(--surface-dark);flex:1;">
            <div style="display:flex;align-items:center;gap:6px;">${icon(ICONS.zap, 16)}<div class="val">${postsPerSession}</div></div>
            <div class="lbl">posts / session</div>
          </div>
        </div>

        <div class="info-card" style="background:var(--surface-dark);color:var(--text);">
          <div class="card-row">${icon(ICONS.clock, 16)}<div class="card-text">${totalMin > 0 ? `${totalMin} min` : '<1 min'} = ${timeEquiv}</div></div>
        </div>

        ${this.renderFooter(7)}
      </div>
    `;
  }

  // ── Slide 9: Exit + Share ─────────────────────────────────
  private renderSlide9Exit(s: DbStats) {
    const domains = s.topDomains || [];
    const present = new Set(domains.map(d => d.domain));
    const allDomains = Object.keys(DOMAIN_COLORS);
    const missing = allDomains.filter(d => !present.has(d));
    const weak = domains.filter(d => d.count <= 3).map(d => domainLabel(d.domain));

    return html`
      <div class="slide slide-9 dark-slide">
        ${this.closeBtn()}
        <div class="eyebrow">${icon(ICONS.shuffle, 14)} 09 / Sortie de bulle</div>
        <div class="title">Sortir = ajouter des mondes.</div>
        <div class="body-text">3 contenus absents + 3 comptes hors-cluster, 14 jours.</div>

        <div class="info-card" style="background:var(--surface3);color:var(--text);">
          <div class="card-row">${icon(ICONS.bookOpen, 18)}<div>
            <div class="card-text">1. Format long factuel — casse le drama court.</div>
          </div></div>
        </div>

        <div class="info-card" style="background:var(--bleu-indigo);color:var(--white);">
          <div class="card-row">${icon(ICONS.users, 18)}<div>
            <div class="card-text">2. Comptes hors-cluster — cadres narratifs incompatibles.</div>
          </div></div>
        </div>

        <div class="info-card" style="background:var(--jaune);color:var(--surface-dark);">
          <div class="card-row">${icon(ICONS.eye, 18)}<div>
            <div class="card-text">3. Sources anti-confirmation.</div>
          </div></div>
        </div>

        ${weak.length > 0 || missing.length > 0 ? html`
          <div class="info-card" style="background:#1a1a2e;color:var(--border-soft);">
            <div class="card-eyebrow">${icon(ICONS.map, 12)} Zones sous-exposees</div>
            <div class="card-text" style="margin-top:6px;">
              ${weak.map(w => html`<span style="display:inline-block;background:var(--border-light);border-radius:999px;padding:3px 10px;font-size:12px;margin:2px 3px;">${w}</span>`)}
              ${missing.map(m => html`<span style="display:inline-block;border:1.5px dashed #444;border-radius:999px;padding:3px 10px;font-size:12px;margin:2px 3px;color:#666;">${domainLabel(m)}</span>`)}
            </div>
          </div>
        ` : nothing}

        <button class="share-btn" @click=${this.shareWrapped}>
          ${icon(ICONS.share, 20)} Partager mon Wrapped
        </button>

        ${this.renderFooter(8)}
      </div>
    `;
  }
}
