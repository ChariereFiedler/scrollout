import { LitElement, html, css } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, state } from 'lit/decorators.js';
import { getCognitiveThemes, getStats, type CognitiveThemeRow, type DbStats } from '../services/db-bridge.js';

/** Domain → color mapping (Scrollout palette) */
const DOMAIN_COLORS: Record<string, string> = {
  culture_divertissement: '#8B44E8',
  lifestyle_bienetre: '#88EEBB',
  politique_societe: '#FF2222',
  information_savoirs: '#88CCFF',
  ecologie_environnement: '#6BE88B',
  economie_travail: '#FFE94A',
  sport: '#FF7B33',
  technologie: '#6B6BFF',
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

/** Inline Lucide-style SVG icons (24x24, stroke) */
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
};

function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}

function formatDwell(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min >= 60) return `${Math.floor(min / 60)}h${min % 60}m`;
  return `${min}min`;
}

interface WrappedIntroTopic {
  id: string;
  label: string;
  pct: number;
  dwellMs: number;
}

const EDITORIAL_TOPIC_LABELS: Record<string, string> = {
  actualite: 'infos',
  information: 'infos',
  informations: 'infos',
  politique: 'opinions',
  debat_public: 'opinions',
  idees: 'opinions',
  culture: 'culture',
  divertissement: 'divertissement',
  humour: 'divertissement',
  lifestyle: 'lifestyle',
  beaute: 'beaute',
  sport: 'sport',
  economie: 'business',
  business: 'business',
  technologie: 'tech',
  gaming: 'gaming',
  jeux_video: 'gaming',
  education: 'education',
  identite: 'societe',
  securite: 'societe',
  sante: 'sante',
  ecologie: 'ecologie',
};

function normalizeTopicKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function editorialTopicLabel(value: string): string {
  const normalized = normalizeTopicKey(value);
  return EDITORIAL_TOPIC_LABELS[normalized] || value.toLowerCase();
}

function withFrenchPartitive(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^[aeiouyh]/i.test(trimmed) ? `d'${trimmed}` : `de ${trimmed}`;
}

type WrappedTeaser = {
  id: string;
  rawLabel: string;
  label: string;
  dwellMs: number;
  pct: number;
};

@customElement('screen-wrapped')
export class ScreenWrapped extends LitElement {
  static styles = css`
    @font-face {
      font-family: 'Averia Sans Libre';
      src: url('/fonts/AveriaSansLibre-Regular.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'Averia Sans Libre';
      src: url('/fonts/AveriaSansLibre-Bold.ttf') format('truetype');
      font-weight: 700 900;
      font-style: normal;
      font-display: swap;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: 'Averia Sans Libre', 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .slides {
      display: flex;
      width: 800%;
      height: 100%;
      transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
      touch-action: pan-y;
    }

    .slide {
      width: calc(100% / 8);
      height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      flex-direction: column;
      padding: 32px 20px calc(env(safe-area-inset-bottom, 16px) + 24px);
      box-sizing: border-box;
    }

    .slide-0 {
      position: relative;
      background:
        radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.35), transparent 14%),
        linear-gradient(180deg, #f3efe0 0%, #ede8d7 100%);
      color: #151112;
    }

    /* ── Light backgrounds per slide ── */
    .slide-1 { background: linear-gradient(180deg, #fafafa 0%, #f0f0f5 100%); }
    .slide-2 { background: linear-gradient(180deg, #f8f8fc 0%, #eef0f8 100%); }
    .slide-3 { background: linear-gradient(180deg, #fdf9f2 0%, #f4efe5 100%); }
    .slide-4 { background: linear-gradient(180deg, #1a1a1a 0%, #111 100%); color: #f0f0f0; }
    .slide-5 { background: linear-gradient(180deg, #f5f7f2 0%, #ecefe6 100%); }
    .slide-6 { background: linear-gradient(180deg, #0f0f1a 0%, #1a1025 100%); color: #f0f0f0; }
    .slide-7 { background: linear-gradient(180deg, #f8f4ec 0%, #eee7db 100%); }

    /* ── Typography ── */
    .eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 12px;
    }
    .slide-4 .eyebrow { color: #88aacc; }

    .title {
      font-family: 'Outfit', sans-serif;
      font-weight: 900;
      font-size: 28px;
      line-height: 1;
      color: #111;
      margin-bottom: 12px;
    }
    .slide-4 .title { color: #f0f0f0; }

    .slide-0 .bubble-copy,
    .slide-0 .intro-label,
    .slide-0 .intro-subject,
    .slide-0 .intro-secondary,
    .slide-0 .intro-fallback {
      color: #151112;
    }

    .slide-0 .bubble-stage {
      position: relative;
      width: 100%;
      min-height: 430px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 24px 0 10px;
    }

    .slide-0 .bubble-stack {
      position: relative;
      width: min(100%, 340px);
      height: 420px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .slide-0 .big-bubble,
    .slide-0 .tail-bubble,
    .slide-0 .tail-bubble::after {
      position: absolute;
      border-radius: 50%;
    }

    .slide-0 .big-bubble {
      width: 276px;
      height: 276px;
      background: #e6b0ea;
      top: 10px;
      left: 50%;
      transform: translateX(-50%) scale(0.98);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
      animation: bubblePop 800ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
    }

    .slide-0 .big-bubble::before,
    .slide-0 .tail-bubble::before {
      content: '';
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.22);
      filter: blur(0.5px);
    }

    .slide-0 .big-bubble::before {
      width: 42px;
      height: 64px;
      right: 24px;
      top: 24px;
      transform: rotate(26deg);
    }

    .slide-0 .bubble-copy {
      position: absolute;
      inset: 34px 24px 34px 24px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      text-align: left;
      flex-direction: column;
      font-family: 'Averia Sans Libre', 'Outfit', sans-serif;
      font-weight: 900;
      font-size: 32px;
      line-height: 0.9;
      letter-spacing: -0.04em;
    }

    .slide-0 .bubble-copy span {
      display: block;
    }

    .slide-0 .tail-bubble {
      background: #e6b0ea;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
      animation: bubbleFloat 5s ease-in-out infinite;
    }

    .slide-0 .tail-bubble::before {
      width: 18%;
      height: 28%;
      right: 16%;
      top: 12%;
      transform: rotate(24deg);
    }

    .slide-0 .tail-bubble::after {
      inset: 0;
      content: '';
      background: transparent;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }

    .slide-0 .tail-1 {
      width: 92px;
      height: 92px;
      left: 205px;
      top: 256px;
      animation-delay: 180ms;
    }

    .slide-0 .tail-2 {
      width: 58px;
      height: 58px;
      left: 164px;
      top: 350px;
      animation-delay: 340ms;
    }

    .slide-0 .tail-3 {
      width: 28px;
      height: 28px;
      left: 140px;
      top: 414px;
      animation-delay: 500ms;
    }

    .slide-0 .intro-panel {
      margin-top: auto;
      padding-top: 8px;
      text-align: center;
    }

    .slide-0 .intro-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .slide-0 .intro-stats {
      display: grid;
      gap: 6px;
      justify-items: center;
    }

    .slide-0 .intro-topline {
      font-family: 'Averia Sans Libre', 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 900;
      line-height: 1;
      margin-bottom: 4px;
    }

    .slide-0 .intro-main {
      display: grid;
      justify-items: center;
      gap: 2px;
    }

    .slide-0 .intro-pct {
      font-family: 'Outfit', sans-serif;
      font-size: 90px;
      line-height: 0.9;
      font-weight: 900;
      letter-spacing: -0.07em;
    }

    .slide-0 .intro-subject {
      font-family: 'Averia Sans Libre', 'Outfit', sans-serif;
      font-size: 30px;
      line-height: 0.95;
      font-weight: 900;
      letter-spacing: -0.03em;
    }

    .slide-0 .intro-secondary {
      font-family: 'Averia Sans Libre', 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.02em;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .slide-0 .intro-secondary span {
      white-space: nowrap;
    }

    .slide-0 .intro-fallback {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      opacity: 0.72;
    }

    .body-text {
      font-size: 13px;
      line-height: 1.4;
      color: #555;
      margin-bottom: 14px;
    }
    .slide-4 .body-text { color: #aaa; }

    /* ── Hero stat ── */
    .hero {
      background: #111;
      border-radius: 24px;
      padding: 24px;
      margin-bottom: 16px;
    }
    .hero-big {
      font-family: 'Outfit', sans-serif;
      font-weight: 900;
      font-size: 96px;
      line-height: 0.88;
      color: #f0f0f0;
    }
    .hero-sub {
      font-size: 16px;
      font-weight: 600;
      color: #bbb;
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
      font-family: 'Outfit', sans-serif;
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
      color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .bubble .b-count {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: rgba(255,255,255,0.8);
    }
    .bubble.ghost {
      border: 1.5px dashed #ccc;
      background: rgba(255,255,255,0.6) !important;
    }
    .bubble.ghost .b-label { color: #999; text-shadow: none; font-weight: 600; }
    .bubble.ghost .b-count { color: #aaa; }

    /* ── Info cards (bias, contradictions) ── */
    .info-card {
      border-radius: 20px;
      padding: 18px;
      margin-bottom: 12px;
    }
    .info-card.dark { background: #111; color: #f0f0f0; }
    .info-card.accent { background: #6B6BFF; color: #fff; }
    .info-card.orange { background: #FF7B33; color: #fff; }
    .info-card.yellow { background: #FFE94A; color: #111; }
    .info-card.red { background: #FF2222; color: #fff; }
    .info-card.mint { background: #6BE88B; color: #111; }
    .info-card.surface { background: #f0ece3; color: #333; }
    .info-card .card-eyebrow {
      font-family: 'JetBrains Mono', monospace;
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

    /* ── Metric blocks (slide 5) ── */
    .metric-block {
      border-radius: 24px;
      padding: 20px;
      margin-bottom: 12px;
    }
    .metric-block .m-val {
      font-family: 'Outfit', sans-serif;
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

    /* ── Action cards (slide 6) ── */
    .action-card {
      border-radius: 20px;
      padding: 18px;
      margin-bottom: 10px;
    }
    .action-card .a-text {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
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
      color: #555;
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
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      color: #777;
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
      gap: 6px;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ccc;
      transition: all 0.3s;
    }
    .dot.active {
      background: #6B6BFF;
      width: 20px;
      border-radius: 4px;
    }
    .slide-4 .dot { background: #444; }
    .slide-4 .dot.active { background: #6B6BFF; }
    .slide-6 .dot { background: #444; }
    .slide-6 .dot.active { background: #6B6BFF; }
    .slide-6 .eyebrow { color: #88aacc; }
    .slide-6 .title { color: #f0f0f0; }
    .slide-6 .body-text { color: #aaa; }

    .btn-next {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #111;
      color: #f0f0f0;
      border: none;
      border-radius: 999px;
      padding: 10px 18px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      -webkit-tap-highlight-color: transparent;
    }
    .btn-next:active { opacity: 0.7; }
    .slide-4 .btn-next { background: #f0f0f0; color: #111; }
    .slide-6 .btn-next { background: #f0f0f0; color: #111; }
    .slide-6 .btn-back { color: #666; }
    .slide-6 .close-btn { background: rgba(255,255,255,0.15); }
    .slide-6 .close-btn svg { stroke: #aaa; }
    .btn-next.finish { background: #6B6BFF; color: #fff; }

    .btn-back {
      background: none;
      border: none;
      color: #999;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      cursor: pointer;
      padding: 8px;
      -webkit-tap-highlight-color: transparent;
    }
    .slide-4 .btn-back { color: #666; }

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
    .close-btn svg { width: 20px; height: 20px; stroke: #555; stroke-width: 2.5; }
    .close-btn:active { opacity: 0.5; }
    .slide-4 .close-btn { background: rgba(255,255,255,0.15); }
    .slide-4 .close-btn svg { stroke: #aaa; }

    @keyframes bubblePop {
      0% {
        opacity: 0;
        transform: translateX(-50%) scale(0.72);
      }
      65% {
        opacity: 1;
        transform: translateX(-50%) scale(1.04);
      }
      100% {
        opacity: 1;
        transform: translateX(-50%) scale(1);
      }
    }

    @keyframes bubbleFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
  `;

  @state() private currentSlide = 0;
  @state() private stats: DbStats | null = null;
  @state() private wrappedThemes: WrappedTeaser[] = [];
  @state() private loading = true;

  private touchStartX = 0;
  private touchDelta = 0;

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  private async loadData() {
    try {
      const stats = await getStats();
      this.stats = stats;
      try {
        const cognitive = await getCognitiveThemes();
        this.wrappedThemes = this.buildIntroThemes(cognitive.themes, stats);
      } catch (themeError) {
        console.warn('[Wrapped] Failed to load cognitive themes:', themeError);
        this.wrappedThemes = this.buildIntroThemes([], stats);
      }
    } catch (e) {
      console.warn('[Wrapped] Failed to load stats:', e);
    }
    this.loading = false;
  }

  private buildIntroThemes(themes: CognitiveThemeRow[], stats: DbStats): WrappedTeaser[] {
    const mainTopics = themes
      .filter(theme => theme.source === 'mainTopics')
      .sort((a, b) => b.totalDwellTimeMs - a.totalDwellTimeMs)
      .slice(0, 3);

    if (mainTopics.length > 0) {
      const total = mainTopics.reduce((sum, theme) => sum + theme.totalDwellTimeMs, 0) || 1;
      return mainTopics.map((theme, index) => ({
        id: theme.themeId || `${theme.themeLabel}-${index}`,
        rawLabel: theme.themeLabel,
        label: editorialTopicLabel(theme.themeLabel),
        dwellMs: theme.totalDwellTimeMs,
        pct: Math.round((theme.totalDwellTimeMs / total) * 100),
      }));
    }

    const fallback = (stats.topTopics || [])
      .slice(0, 3)
      .map((topic, index) => ({
        id: `${topic.topic}-${index}`,
        rawLabel: topic.topic,
        label: editorialTopicLabel(topic.topic),
        dwellMs: topic.count,
        pct: 0,
      }));

    const total = fallback.reduce((sum, theme) => sum + theme.dwellMs, 0) || 1;
    return fallback.map(theme => ({
      ...theme,
      pct: Math.round((theme.dwellMs / total) * 100),
    }));
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

  private go(slide: number) {
    this.currentSlide = Math.max(0, Math.min(7, slide));
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

  private close() {
    this.dispatchEvent(new CustomEvent('close-wrapped', { bubbles: true, composed: true }));
  }

  render() {
    if (this.loading) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#fafafa;color:#999;font-size:13px;">Chargement...</div>`;
    }

    const s = this.stats;
    if (!s) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#fafafa;color:#999;font-size:13px;">Pas de donnees disponibles</div>`;
    }

    return html`
      <div class="slides"
        style="transform: translateX(-${this.currentSlide * (100 / 8)}%)"
        @touchstart=${this.onTouchStart}
        @touchmove=${this.onTouchMove}
        @touchend=${this.onTouchEnd}
      >
        ${this.renderIntroSlide()}
        ${this.renderSlide1(s)}
        ${this.renderSlide2(s)}
        ${this.renderSlide3(s)}
        ${this.renderSlide4(s)}
        ${this.renderSlide5(s)}
        ${this.renderSlide6Records(s)}
        ${this.renderSlide7(s)}
      </div>
    `;
  }

  private renderFooter(slide: number, isDark = false) {
    return html`
      <div class="spacer"></div>
      <div class="footer">
        ${slide > 0
          ? html`<button class="btn-back" @click=${() => this.go(slide - 1)}>← Retour</button>`
          : html`<span></span>`
        }
        <div class="dots">
          ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => html`<div class="dot ${i === slide ? 'active' : ''}"></div>`)}
        </div>
        ${slide < 7
          ? html`<button class="btn-next" @click=${() => this.go(slide + 1)}>Suivant <span>→</span></button>`
          : html`<button class="btn-next finish" @click=${this.close}>Fermer</button>`
        }
      </div>
    `;
  }

  // ── Slide 0: Wrapped opener ───────────────────────────────
  private renderIntroSlide() {
    const themes = this.wrappedThemes;
    const top1 = themes[0] || null;
    const top2 = themes[1] || null;
    const top3 = themes[2] || null;
    const hasData = Boolean(top1);

    const topLabel = top1 ? withFrenchPartitive(top1.label) : 'de contenus';

    return html`
      <div class="slide slide-0">
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="bubble-stage">
          <div class="bubble-stack" aria-hidden="true">
            <div class="big-bubble">
              <div class="bubble-copy">
                <span>Tu</span>
                <span>t’informes</span>
                <span>moins que</span>
                <span>tu ne le</span>
                <span>penses.</span>
              </div>
            </div>
            <div class="tail-bubble tail-1"></div>
            <div class="tail-bubble tail-2"></div>
            <div class="tail-bubble tail-3"></div>
          </div>
        </div>

        <div class="intro-panel">
          <div class="intro-label">Tu es exposé majoritairement à :</div>
          <div class="intro-stats">
            <div class="intro-main">
              <div class="intro-pct">${top1 ? `${top1.pct}%` : '--%'}</div>
              <div class="intro-subject">${top1 ? topLabel : 'de contenus'}</div>
            </div>
            <div class="intro-secondary">
              ${top2 ? html`<span>${top2.label} ${top2.pct}%</span>` : ''}
              ${top3 ? html`<span>${top3.label} ${top3.pct}%</span>` : ''}
            </div>
            ${!hasData ? html`<div class="intro-fallback">Les sujets apparaîtront après quelques posts analysés.</div>` : ''}
          </div>
        </div>

        ${this.renderFooter(0)}
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
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">${icon(ICONS.target, 14)} Scrollout Wrapped / 2026</div>
        <div class="title">Ton feed n'etait pas neutre. Il avait un centre de gravite.</div>
        <div class="body-text">${this.totalPosts} posts, ${this.totalEnriched} enrichis. Ton attention gravitait autour de ${domainLabel(top.domain).toLowerCase()}.</div>

        <div class="hero">
          <div class="hero-big">${top.pct}%</div>
          <div class="hero-sub">de ton feed dans un seul domaine : ${domainLabel(top.domain)}</div>
        </div>

        <div class="cards-row">
          <div class="stat-card" style="background:#6B6BFF;color:#fff;">
            <div class="val">${polPct}%</div>
            <div class="lbl">posts politiques</div>
          </div>
          <div class="stat-card" style="background:#FF7B33;color:#fff;">
            <div class="val">${polarPct}%</div>
            <div class="lbl">polarisation moy.</div>
          </div>
        </div>

        ${this.renderFooter(1)}
      </div>
    `;
  }

  // ── Slide 2: Bubble Map ───────────────────────────────────
  private renderSlide2(s: DbStats) {
    const domains = s.topDomains || [];
    const maxCount = domains[0]?.count || 1;
    const total = domains.reduce((acc, d) => acc + d.count, 0);

    // Position bubbles in a cluster layout
    const positions = [
      { x: 20, y: 15, s: 1 },      // biggest, center-left
      { x: 55, y: 10, s: 0.7 },     // top-right
      { x: 10, y: 55, s: 0.65 },    // left-center
      { x: 55, y: 50, s: 0.55 },    // right-center
      { x: 30, y: 72, s: 0.5 },     // bottom-left
      { x: 62, y: 72, s: 0.45 },    // bottom-right
    ];

    return html`
      <div class="slide slide-2">
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">${icon(ICONS.map, 14)} 02 / La carte de ta bulle</div>
        <div class="title">Voici a quoi ressemble ta bulle mise a plat.</div>
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
                style="
                  left: ${pos.x}%;
                  top: ${pos.y}%;
                  width: ${size}px;
                  height: ${size}px;
                  background: ${isSmall ? 'transparent' : color};
                  box-shadow: ${isSmall ? 'none' : `0 8px 24px ${color}44`};
                  font-size: ${Math.max(10, size / 8)}px;
                ">
                <span class="b-label">${domainLabel(d.domain).split(' ')[0]}</span>
                <span class="b-count">${d.count} · ${pct(d.count, total)}%</span>
              </div>
            `;
          })}
        </div>

        ${this.renderFooter(2)}
      </div>
    `;
  }

  // ── Slide 3: Bias ─────────────────────────────────────────
  private renderSlide3(s: DbStats) {
    const domains = s.topDomains || [];
    const total = domains.reduce((acc, d) => acc + d.count, 0);
    const topPct = total ? Math.round((domains[0]?.count || 0) / total * 100) : 0;

    // Detect bias vectors from data
    const topics = s.topTopics || [];
    const topTopicNames = topics.slice(0, 3).map(t => t.topic);

    return html`
      <div class="slide slide-3">
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">${icon(ICONS.alertTriangle, 14)} 03 / Tes biais</div>
        <div class="title">Le biais ici ressemble moins a de l'extremisme qu'a une surexposition selective.</div>

        <div class="info-card dark">
          <div class="card-eyebrow">Biais de renforcement</div>
          <div class="card-text">Le feed valide le meme cadre (${topPct}% concentre).</div>
        </div>

        <div class="info-card accent">
          <div class="card-text">Le politique reste peripherique, pas central.</div>
        </div>

        <div class="info-card surface">
          <div class="card-eyebrow">Tes 3 vecteurs de biais les plus forts</div>
          <div class="card-text">
            1. ${topTopicNames[0] || 'Divertissement'} d'abord<br>
            2. ${topTopicNames[1] || 'Culture'} en echo<br>
            3. Faible exposition aux domaines minoritaires
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
                <div class="bar-val">${d.count} (${w}%)</div>
              </div>
            `;
          })}
        </div>

        ${this.renderFooter(3)}
      </div>
    `;
  }

  // ── Slide 4: Contradictions (dark) ────────────────────────
  private renderSlide4(s: DbStats) {
    const diversity = s.topDomains?.length || 0;
    const sponsored = s.sponsoredStats;

    return html`
      <div class="slide slide-4">
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">${icon(ICONS.zap, 14)} 04 / Contradictions</div>
        <div class="title">Ton feed n'est pas juste biaise. Il est coherent contre toi.</div>

        <div class="info-card" style="background:#222;color:#f0f0f0;">
          <div class="card-text">Perspective Gap : tu vois surtout une version locale du monde.</div>
        </div>

        <div class="info-card" style="background:#FF7B33;color:#fff;">
          <div class="card-text">L'algo te sert ce qui te garde, pas ce qui t'ouvre.</div>
        </div>

        <div class="info-card accent">
          <div class="card-text">${formatDwell(s.totalDwellMs)} de scroll, le temps long part sur l'emotionnel.</div>
        </div>

        ${sponsored?.sponsored ? html`
          <div class="info-card" style="background:#333;color:#ccc;">
            <div class="card-eyebrow">Sponsored vs Organic</div>
            <div class="card-text">${sponsored.sponsored.count} posts sponsorises, ${Math.round(sponsored.sponsored.avgDwellMs / 1000)}s de dwell moyen.</div>
          </div>
        ` : ''}

        ${this.renderFooter(4, true)}
      </div>
    `;
  }

  // ── Slide 5: Ego Metrics ──────────────────────────────────
  private renderSlide5(s: DbStats) {
    // Bubble score = % top domain + second domain
    const domains = s.topDomains || [];
    const total = domains.reduce((acc, d) => acc + d.count, 0);
    const top2 = domains.slice(0, 2).reduce((acc, d) => acc + d.count, 0);
    const bubbleScore = pct(top2, total);

    // Attention stats
    const attn = s.attention || {};
    const engaged = attn['engaged'] || 0;
    const skipped = attn['skipped'] || 0;
    const skipRate = pct(skipped, this.totalPosts);

    // Signals
    const signals = s.signals;
    const totalSignals = signals?.total || 0;

    return html`
      <div class="slide slide-5">
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">${icon(ICONS.barChart, 14)} 05 / Ego metrics</div>
        <div class="title">Les chiffres qui piquent (et qui se partagent).</div>

        <div class="cards-row">
          <div class="metric-block" style="background:#111;color:#f0f0f0;flex:1;">
            <div class="m-val" style="color:#6B6BFF;">${bubbleScore}%</div>
            <div class="m-desc" style="color:#aaa;">Bubble Score</div>
          </div>
          <div class="metric-block" style="background:#FFE94A;color:#111;flex:1;">
            <div class="m-val">${engaged}</div>
            <div class="m-desc">posts ou tu es reste engage (> 5s).</div>
          </div>
        </div>

        <div class="metric-block" style="background:#6B6BFF;color:#fff;">
          <div class="m-desc" style="color:#fff;">${skipRate}% skip rate, ${skipped} posts zappes.</div>
        </div>

        ${totalSignals > 0 ? html`
          <div class="metric-block" style="background:#FF2222;color:#fff;">
            <div class="m-val">${totalSignals}</div>
            <div class="m-desc" style="color:rgba(255,255,255,0.9);">signaux de polarisation detectes.</div>
          </div>
        ` : ''}

        <div class="metric-block" style="background:#f0f0f0;color:#333;">
          <div class="m-desc"><strong>${s.totalSessions} sessions</strong> analysees, <strong>${formatDwell(s.totalDwellMs)}</strong> de scroll total.</div>
        </div>

        ${this.renderFooter(5)}
      </div>
    `;
  }

  // ── Slide 6: Records de Scroll ─────────────────────────────
  private renderSlide6Records(s: DbStats) {
    const scrollMeters = s.totalPosts * 0.15;
    const scrollKm = scrollMeters / 1000;
    const dwellHours = (s.totalDwellMs || 1) / 3600000;
    const scrollSpeed = scrollMeters / dwellHours;
    const totalMin = Math.round((s.totalDwellMs || 0) / 60000);
    const postsPerSession = s.totalSessions > 0 ? Math.round(s.totalPosts / s.totalSessions) : s.totalPosts;

    const distanceText = scrollKm >= 1 ? `${scrollKm.toFixed(1)} km` : `${Math.round(scrollMeters)} m`;

    const distanceMetaphor = scrollMeters < 50
      ? 'une piscine olympique du pouce'
      : scrollMeters < 100
      ? 'un terrain de foot, parcouru au pouce'
      : scrollMeters < 324
      ? `encore ${Math.round(324 - scrollMeters)}m avant la Tour Eiffel`
      : scrollMeters < 1000
      ? 'tu as depasse la Tour Eiffel. En scrollant.'
      : `plus loin qu'un jogging matinal`;

    const speedAnimal = scrollSpeed < 53
      ? { name: 'escargot', speed: '53 m/h', verdict: 'Il te bat.' }
      : scrollSpeed < 270
      ? { name: 'tortue de mer', speed: '270 m/h', verdict: 'Tu te rapproches.' }
      : scrollSpeed < 1000
      ? { name: 'canard', speed: '1 km/h', verdict: 'Presque.' }
      : scrollSpeed < 5000
      ? { name: 'hirondelle', speed: '5 km/h', verdict: 'Depasse.' }
      : { name: 'guepard', speed: '120 km/h', verdict: 'Ton pouce est une legende.' };

    const timeEquiv = totalMin < 5 ? 'un espresso'
      : totalMin < 15 ? 'un episode de podcast'
      : totalMin < 30 ? 'une sieste royale'
      : totalMin < 60 ? 'un episode de serie'
      : totalMin < 120 ? 'un film complet'
      : `${Math.round(totalMin / 60)} films`;

    return html`
      <div class="slide slide-6">
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">${icon(ICONS.trophy, 14)} 06 / Tes records</div>
        <div class="title">Tu scrolles. L'algorithme compte.</div>
        <div class="body-text">Tes stats de pouce traduites en chiffres reels.</div>

        <!-- Distance hero -->
        <div class="hero" style="background:linear-gradient(135deg, #6B6BFF 0%, #8B44E8 100%);">
          <div style="display:flex;align-items:center;gap:12px;">
            ${icon(ICONS.ruler, 28)}
            <div class="hero-big" style="font-size:64px;">${distanceText}</div>
          </div>
          <div class="hero-sub" style="color:rgba(255,255,255,0.8);">scrolles — ${distanceMetaphor}</div>
        </div>

        <!-- Speed vs animal -->
        <div class="cards-row">
          <div class="metric-block" style="background:#111;color:#f0f0f0;flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              ${icon(ICONS.gauge, 20)}
              <div class="m-val" style="color:#FFE94A;font-size:36px;">${Math.round(scrollSpeed)}</div>
            </div>
            <div class="m-desc" style="color:#aaa;">m/h — vitesse de scroll</div>
            <div class="m-desc" style="color:#FFE94A;margin-top:4px;">vs ${speedAnimal.name} (${speedAnimal.speed}). ${speedAnimal.verdict}</div>
          </div>
        </div>

        <div class="cards-row">
          <div class="stat-card" style="background:#FF7B33;color:#fff;flex:1;">
            <div style="display:flex;align-items:center;gap:6px;">
              ${icon(ICONS.flame, 16)}
              <div class="val">${s.totalPosts}</div>
            </div>
            <div class="lbl">contenus engloutis</div>
          </div>
          <div class="stat-card" style="background:#6BE88B;color:#111;flex:1;">
            <div style="display:flex;align-items:center;gap:6px;">
              ${icon(ICONS.zap, 16)}
              <div class="val">${postsPerSession}</div>
            </div>
            <div class="lbl">posts / session</div>
          </div>
        </div>

        <div class="info-card" style="background:#222;color:#f0f0f0;">
          <div class="card-row">
            ${icon(ICONS.clock, 16)}
            <div class="card-text">${totalMin > 0 ? `${totalMin} min` : '<1 min'} de scroll cumule — l'equivalent de ${timeEquiv}.</div>
          </div>
        </div>

        ${this.renderFooter(6, true)}
      </div>
    `;
  }

  // ── Slide 7: Escape Routes ────────────────────────────────
  private renderSlide7(s: DbStats) {
    // Find missing/weak domains
    const domains = s.topDomains || [];
    const present = new Set(domains.map(d => d.domain));
    const allDomains = Object.keys(DOMAIN_COLORS);
    const missing = allDomains.filter(d => !present.has(d));
    const weak = domains.filter(d => d.count <= 3).map(d => domainLabel(d.domain));

    return html`
      <div class="slide slide-7">
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">${icon(ICONS.shuffle, 14)} 07 / Sorties de bulle</div>
        <div class="title">Sortir de bulle = ajouter des mondes, pas juste des opposants.</div>
        <div class="body-text">3 contenus absents + 3 comptes hors-cluster, pendant 14 jours.</div>

        <div class="action-card" style="background:#111;color:#f0f0f0;">
          <div class="a-text">1. Format long factuel. Casse la boucle du drama court.</div>
        </div>

        <div class="action-card" style="background:#6B6BFF;color:#fff;">
          <div class="a-text">2. Comptes hors-cluster. Expose des cadres narratifs incompatibles.</div>
        </div>

        <div class="action-card" style="background:#FFE94A;color:#111;">
          <div class="a-text">3. Sources anti-confirmation. Contredis tes automatismes.</div>
        </div>

        ${weak.length > 0 || missing.length > 0 ? html`
          <div class="info-card surface">
            <div class="card-eyebrow">Zones sous-exposees</div>
            <div class="card-text">
              ${weak.map(w => html`<span style="display:inline-block;background:#e4e4ec;border-radius:999px;padding:3px 10px;font-size:12px;margin:2px 3px;">${w}</span>`)}
              ${missing.map(m => html`<span style="display:inline-block;border:1.5px dashed #ccc;border-radius:999px;padding:3px 10px;font-size:12px;margin:2px 3px;color:#999;">${domainLabel(m)}</span>`)}
            </div>
          </div>
        ` : ''}

        ${this.renderFooter(7)}
      </div>
    `;
  }
}
