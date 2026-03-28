import { LitElement, html, css, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, scrolloutDots, domainColors, attentionColors, scrolloutIconSvg } from '../styles/theme.js';
import { openInstagram } from '../services/native-bridge.js';
import { getStats, type DbStats } from '../services/db-bridge.js';

/** Inline Lucide-style SVG icon helper */
const ico = (path: string, size = 18, color = 'currentColor') => html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;">${unsafeSVG(path)}</svg>`;

const FUN_ICONS = {
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.4 2.4 0 010-3.4l2.6-2.6a2.4 2.4 0 013.4 0z"/><path d="M14.5 12.5l2-2"/><path d="M11.5 9.5l2-2"/><path d="M8.5 6.5l2-2"/><path d="M17.5 15.5l2-2"/>',
  gauge: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M12 6v6l4 2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.5-2.5 1.5-3.5z"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 1012 0V2z"/>',
  fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6z"/><path d="M2.5 12S1 10 1 8s1.5-3 1.5-3"/><path d="M2.5 12S1 14 1 16s1.5 3 1.5 3"/><circle cx="18.5" cy="10.5" r="0.5" fill="currentColor" stroke="none"/>',
};

// ── Persona detection ───────────────────────────────────────
interface Persona {
  label: string;
  emoji: string;
  desc: string;
  color: string;
}

function detectPersona(s: DbStats): Persona {
  const topDomain = s.topDomainsReal?.[0]?.domain || s.topDomains[0]?.domain || '';
  const topTopic = s.topTopics[0]?.topic || '';
  const polEntries = Object.entries(s.political);
  const totalPol = polEntries.reduce((a, [, c]) => a + (c as number), 0);
  const politicalPosts = polEntries.filter(([sc]) => parseInt(sc) >= 2).reduce((a, [, c]) => a + (c as number), 0);
  const politicalPct = totalPol > 0 ? politicalPosts / totalPol : 0;
  const avgPolar = s.avgPolarization ?? 0;
  const topEmotion = s.topEmotions?.[0]?.emotion || '';
  const engagedPct = s.attention['engaged'] ? (s.attention['engaged'] / Object.values(s.attention).reduce((a, b) => a + b, 0)) : 0;
  const skippedPct = s.attention['skipped'] ? (s.attention['skipped'] / Object.values(s.attention).reduce((a, b) => a + b, 0)) : 0;

  // Persona rules (priority order)
  if (politicalPct > 0.35 && avgPolar > 0.3)
    return { label: 'L\'Engage', emoji: '!!', desc: 'Tu vis ton feed comme un terrain de conviction. L\'algorithme le sait et te nourrit.', color: 'var(--rouge)' };
  if (politicalPct > 0.2)
    return { label: 'Le Vigilant', emoji: '!?', desc: 'Tu gardes un oeil sur l\'actualite politique. L\'algorithme amplifie cette vigilance.', color: 'var(--orange)' };
  if (skippedPct > 0.6)
    return { label: 'Le Zappeur', emoji: '>>', desc: 'Tu scrolles vite, tu cherches le contenu qui merite ton arret. L\'algorithme court apres toi.', color: 'var(--jaune)' };
  if (engagedPct > 0.35)
    return { label: 'L\'Immersif', emoji: '~~', desc: 'Tu prends le temps. Chaque post capte ton regard. L\'algorithme te connait bien.', color: 'var(--vert-menthe)' };
  if (topEmotion === 'amusement' || topEmotion === 'humour' || topDomain.includes('divertissement'))
    return { label: 'Le Spectateur', emoji: '//', desc: 'Ton feed est un theatre. Divertissement, humour, evasion — l\'algorithme te sert du plaisir.', color: 'var(--rose)' };
  if (topDomain.includes('lifestyle') || topTopic.includes('lifestyle'))
    return { label: 'L\'Inspiré', emoji: '##', desc: 'Mode, bien-etre, lifestyle — ton feed est un mood board algorithmique.', color: 'var(--vert-eau)' };
  if (topDomain.includes('information') || topDomain.includes('actualité'))
    return { label: 'L\'Informé', emoji: '<>', desc: 'Tu consommes de l\'info. L\'algorithme te maintient dans un flux continu d\'actualite.', color: 'var(--bleu-ciel)' };
  return { label: 'L\'Explorateur', emoji: '**', desc: 'Ton feed est eclectique. L\'algorithme ne t\'a pas encore enfermé dans une bulle.', color: 'var(--bleu-indigo)' };
}

// ── Emotion icons & labels ──────────────────────────────────
const emotionMeta: Record<string, { icon: string; color: string }> = {
  'indignation': { icon: '!!', color: 'var(--rouge)' },
  'colère': { icon: '!!', color: 'var(--rouge)' },
  'amusement': { icon: ':)', color: 'var(--jaune)' },
  'humour': { icon: ':)', color: 'var(--jaune)' },
  'curiosité': { icon: '?', color: 'var(--bleu-ciel)' },
  'empathie': { icon: '<3', color: 'var(--rose)' },
  'nostalgie': { icon: '~', color: 'var(--violet)' },
  'fierté': { icon: '^', color: 'var(--vert-menthe)' },
  'inquiétude': { icon: '..', color: 'var(--orange)' },
  'admiration': { icon: '*', color: 'var(--bleu-indigo)' },
  'tristesse': { icon: ':(', color: 'var(--text-muted)' },
  'surprise': { icon: '!?', color: 'var(--jaune)' },
  'dégoût': { icon: 'x', color: 'var(--rouge)' },
  'peur': { icon: '!!', color: 'var(--orange)' },
  'joie': { icon: ':D', color: 'var(--vert-menthe)' },
  'neutre': { icon: '--', color: 'var(--text-muted)' },
  'inspiration': { icon: '*', color: 'var(--bleu-indigo)' },
  'motivation': { icon: '>>', color: 'var(--vert-menthe)' },
  'ennui': { icon: '..', color: 'var(--text-muted)' },
};

function getEmotionMeta(emotion: string) {
  const key = emotion.toLowerCase().trim();
  return emotionMeta[key] || { icon: '~', color: 'var(--bleu-ciel)' };
}

// ── Tone labels ─────────────────────────────────────────────
const toneMeta: Record<string, { color: string }> = {
  'informatif': { color: 'var(--bleu-ciel)' },
  'humoristique': { color: 'var(--jaune)' },
  'militant': { color: 'var(--rouge)' },
  'promotionnel': { color: 'var(--orange)' },
  'éducatif': { color: 'var(--bleu-indigo)' },
  'inspirant': { color: 'var(--vert-menthe)' },
  'provocateur': { color: 'var(--rouge)' },
  'émotionnel': { color: 'var(--rose)' },
  'neutre': { color: 'var(--text-muted)' },
  'critique': { color: 'var(--orange)' },
  'sensationnel': { color: 'var(--rouge)' },
  'personnel': { color: 'var(--violet)' },
  'conversationnel': { color: 'var(--vert-eau)' },
};

@customElement('screen-home')
export class ScreenHome extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 20px 16px 32px; }

      /* ── Header ── */
      .header {
        text-align: center;
        margin-bottom: 28px;
      }
      .logo-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .logo-row svg { width: 36px; height: 36px; }
      .logo {
        font-family: var(--font-heading);
        font-size: 28px;
        font-weight: 900;
        letter-spacing: -0.5px;
      }
      .subtitle {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-dim);
      }

      /* ── Empty state ── */
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        gap: 20px;
        text-align: center;
      }
      .empty-hook {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 900;
        line-height: 1.3;
        margin-bottom: 4px;
      }
      .empty-hook .hl { color: var(--orange); }
      .empty-text {
        color: var(--text-dim);
        font-size: 14px;
        line-height: 1.6;
        max-width: 280px;
      }
      .btn-launch {
        background: var(--bleu-indigo);
        color: #fff;
        border: none;
        padding: 14px 36px;
        border-radius: var(--radius-pill);
        font-size: 15px;
        font-weight: 600;
        font-family: var(--font-body);
        cursor: pointer;
        transition: transform 0.15s;
      }
      .btn-launch:active { transform: scale(0.97); }

      /* ── Persona card ── */
      .persona {
        background: var(--surface2);
        border-radius: var(--radius);
        padding: 24px 20px;
        margin-bottom: 16px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .persona::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
      }
      .persona-badge {
        font-family: var(--font-mono);
        font-size: 32px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 8px;
      }
      .persona-label {
        font-family: var(--font-heading);
        font-size: 24px;
        font-weight: 900;
        line-height: 1.2;
        margin-bottom: 6px;
      }
      .persona-desc {
        font-size: 13px;
        color: var(--text-dim);
        line-height: 1.5;
        max-width: 300px;
        margin: 0 auto;
      }
      .persona-meta {
        display: flex;
        justify-content: center;
        gap: 16px;
        margin-top: 14px;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      /* ── Stats row ── */
      .stats-row {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .stat-card {
        flex: 1;
        background: var(--surface2);
        border-radius: var(--radius-sm);
        padding: 14px 8px;
        text-align: center;
      }
      .stat-val {
        font-family: var(--font-heading);
        font-size: 24px;
        font-weight: 700;
        line-height: 1.1;
      }
      .stat-label {
        font-family: var(--font-mono);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-dim);
        margin-top: 4px;
      }

      /* ── Section ── */
      .section {
        background: var(--surface2);
        border-radius: var(--radius);
        padding: 16px;
        margin-bottom: 14px;
      }
      .section-label {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-dim);
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
      }

      /* ── DNA strip ── */
      .dna-strip {
        display: flex;
        height: 36px;
        border-radius: 10px;
        overflow: hidden;
        gap: 2px;
        margin-bottom: 12px;
      }
      .dna-seg {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 700;
        color: rgba(0,0,0,0.7);
        transition: flex 0.4s;
        min-width: 0;
        overflow: hidden;
      }
      .dna-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .dna-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
      }
      .dna-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dna-pct {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
      }

      /* ── Reveal cards ── */
      .reveals {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .reveal {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--border);
      }
      .reveal-icon {
        font-size: 22px;
        line-height: 1;
        flex-shrink: 0;
        width: 28px;
        text-align: center;
        font-family: var(--font-mono);
        font-weight: 700;
      }
      .reveal-body { flex: 1; }
      .reveal-headline {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.3;
        margin-bottom: 3px;
      }
      .reveal-headline strong {
        font-family: var(--font-mono);
        font-weight: 700;
      }
      .reveal-detail {
        font-size: 11px;
        color: var(--text-dim);
        line-height: 1.5;
      }

      /* ── Dwell bar ── */
      .dwell-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 0;
      }
      .dwell-row + .dwell-row { border-top: 1px solid var(--border); }
      .dwell-label {
        font-size: 12px;
        font-weight: 500;
        flex: 1;
        text-transform: capitalize;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dwell-bar-wrap {
        flex: 2;
        height: 8px;
        background: var(--surface3);
        border-radius: 4px;
        overflow: hidden;
      }
      .dwell-bar {
        height: 100%;
        border-radius: 4px;
        transition: width 0.4s;
      }
      .dwell-time {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        min-width: 40px;
        text-align: right;
      }

      /* ── Fun metrics ── */
      .fun-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 12px;
      }
      .fun-card {
        background: var(--surface3);
        border-radius: var(--radius-sm);
        padding: 14px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .fun-card.full { grid-column: 1 / -1; }
      .fun-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .fun-header svg { opacity: 0.7; }
      .fun-val {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 700;
        line-height: 1.1;
      }
      .fun-unit {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-dim);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .fun-meta {
        font-size: 11px;
        color: var(--text-dim);
        line-height: 1.4;
        margin-top: 2px;
      }
      .fun-meta strong { color: var(--text); }

      /* ── Emotion bubbles ── */
      .emotion-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .emotion-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: var(--surface3);
        border-radius: var(--radius-pill);
        border: 1px solid var(--border);
        font-size: 12px;
      }
      .emotion-icon {
        font-family: var(--font-mono);
        font-size: 14px;
        font-weight: 700;
      }
      .emotion-name { text-transform: capitalize; }
      .emotion-cnt {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
      }

      /* ── Narrative pills ── */
      .narrative-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .narrative-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .narrative-bar-wrap {
        flex: 1;
        height: 6px;
        background: var(--surface3);
        border-radius: 3px;
        overflow: hidden;
      }
      .narrative-bar {
        height: 100%;
        border-radius: 3px;
      }
      .narrative-label {
        font-size: 12px;
        text-transform: capitalize;
        min-width: 120px;
      }
      .narrative-cnt {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        min-width: 24px;
        text-align: right;
      }

      /* ── Tone strip ── */
      .tone-strip {
        display: flex;
        height: 24px;
        border-radius: 8px;
        overflow: hidden;
        gap: 2px;
        margin-bottom: 10px;
      }
      .tone-seg {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        font-weight: 600;
        color: rgba(0,0,0,0.8);
        min-width: 0;
        overflow: hidden;
      }
      .tone-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .tone-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        text-transform: capitalize;
      }
      .tone-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      /* ── Subject tags ── */
      .subject-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .subject-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--surface3);
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        padding: 5px 11px;
        font-size: 11px;
        text-transform: capitalize;
      }
      .subject-tag .cnt {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
      }

      /* ── Attention ── */
      .attention-visual {
        display: flex;
        gap: 3px;
        height: 28px;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      .att-seg {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 600;
        color: var(--bg);
        min-width: 0;
        overflow: hidden;
        transition: flex 0.4s;
      }
      .att-row {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 4px;
      }
      .att-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: var(--text-dim);
      }
      .att-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      /* ── Top accounts ── */
      .accounts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .account {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--surface3);
        border: 1px solid var(--border);
        border-radius: var(--radius-pill);
        padding: 5px 10px;
        font-size: 11px;
      }
      .account .at { color: var(--violet); font-weight: 600; }
      .account .cnt { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); }
      .account .time {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-muted);
        margin-left: 2px;
      }

      /* ── CTA ── */
      .cta {
        text-align: center;
        margin-top: 8px;
      }
      .btn-cta {
        background: transparent;
        color: var(--bleu-indigo);
        border: 2px solid var(--bleu-indigo);
        padding: 12px 32px;
        border-radius: var(--radius-pill);
        font-size: 14px;
        font-weight: 600;
        font-family: var(--font-body);
        cursor: pointer;
      }
      .btn-cta:active { transform: scale(0.97); }

      /* ── Wrapped CTA ── */
      .wrapped-banner {
        background: linear-gradient(135deg, #6B6BFF 0%, #8B44E8 100%);
        border-radius: var(--radius);
        padding: 18px 20px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.15s;
      }
      .wrapped-banner:active { transform: scale(0.98); }
      .wrapped-banner .wb-left {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .wrapped-banner .wb-title {
        font-family: var(--font-heading);
        font-weight: 900;
        font-size: 18px;
        color: #fff;
      }
      .wrapped-banner .wb-sub {
        font-size: 11px;
        color: rgba(255,255,255,0.75);
      }
      .wrapped-banner .wb-arrow {
        font-size: 20px;
        color: rgba(255,255,255,0.8);
      }

      /* ── Insight sentence ── */
      .insight {
        font-size: 12px;
        color: var(--text-dim);
        line-height: 1.6;
        padding: 10px 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--border);
        margin-top: 10px;
      }
      .insight strong { color: var(--text); }

      /* ── Media type pills ── */
      .media-types {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .media-pill {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        min-width: 70px;
      }
      .media-pill .val {
        font-family: var(--font-heading);
        font-size: 18px;
        font-weight: 700;
      }
      .media-pill .lbl {
        font-family: var(--font-mono);
        font-size: 9px;
        text-transform: uppercase;
        color: var(--text-dim);
      }
    `,
  ];

  @state() private launching = false;
  @state() private stats: DbStats | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadStats();
  }

  private async loadStats() {
    try { this.stats = await getStats(); } catch { /* */ }
  }

  private openWrapped() {
    this.dispatchEvent(new CustomEvent('open-wrapped', { bubbles: true, composed: true }));
  }

  private async launch() {
    this.launching = true;
    try {
      await openInstagram();
      this.dispatchEvent(new CustomEvent('instagram-opened', { bubbles: true, composed: true }));
    } catch (e) {
      console.warn('[Scrollout] Launch failed:', e);
    } finally {
      this.launching = false;
    }
  }

  render() {
    const s = this.stats;
    const hasData = s && s.totalPosts > 0;

    return html`
      <div class="header">
        <div class="logo-row">
          <span .innerHTML=${scrolloutIconSvg(36)}></span>
          <span class="logo">Scrollout</span>
        </div>
        <div class="subtitle">ton feed, decrypte</div>
      </div>

      ${hasData ? html`
        <div class="wrapped-banner" @click=${this.openWrapped}>
          <div class="wb-left">
            <div class="wb-title">Ton Wrapped est pret</div>
            <div class="wb-sub">Decouvre ce que l'algorithme t'a vraiment montre</div>
          </div>
          <span class="wb-arrow">&rarr;</span>
        </div>
      ` : ''}

      ${!hasData ? html`
        <div class="empty">
          <div class="empty-hook">
            Tu scrolles.<br/>L'algorithme choisit.<br/><span class="hl">Tu ne vois rien.</span>
          </div>
          <div class="empty-text">
            Ouvre Instagram normalement.<br/>
            Scrollout analyse chaque post en arriere-plan — sans rien changer a ton experience.
          </div>
          <button class="btn-launch" @click=${this.launch} ?disabled=${this.launching}>
            ${this.launching ? 'Lancement...' : 'Ouvrir Instagram'}
          </button>
        </div>
      ` : this.renderProfile(s!)}
    `;
  }

  // ── Main profile render ─────────────────────────────────────

  private renderProfile(s: DbStats) {
    const persona = detectPersona(s);
    const totalMinutes = Math.round((s.totalDwellMs || 0) / 60000);
    const totalAttention = Object.values(s.attention).reduce((a, b) => (a as number) + (b as number), 0) as number;

    return html`
      ${this.renderPersona(s, persona, totalMinutes)}
      ${this.renderStats(s, totalMinutes)}
      ${this.renderFunMetrics(s)}
      ${this.renderContentDNA(s)}
      ${this.renderCaptivation(s)}
      ${this.renderEmotionalLandscape(s)}
      ${this.renderNarrativeDiet(s)}
      ${this.renderTonePalette(s)}
      ${this.renderSubjects(s)}
      ${this.renderAttention(s, totalAttention)}
      ${this.renderAlgoAndYou(s)}
      ${this.renderSignals(s)}
      ${this.renderMediaTypes(s)}
      ${this.renderSponsoredVsOrganic(s)}
      ${this.renderTopAccounts(s)}

      <div class="cta">
        <button class="btn-cta" @click=${this.launch}>Continuer la capture</button>
      </div>
    `;
  }

  // ── 1. Persona ──────────────────────────────────────────────

  private renderPersona(s: DbStats, persona: Persona, totalMinutes: number) {
    return html`
      <div class="persona" style="border-top: 3px solid ${persona.color};">
        <div class="persona-badge" style="color:${persona.color}">${persona.emoji}</div>
        <div class="persona-label" style="color:${persona.color}">${persona.label}</div>
        <div class="persona-desc">${persona.desc}</div>
        <div class="persona-meta">
          <span>${s.totalPosts} posts</span>
          <span>${s.totalSessions} session${s.totalSessions > 1 ? 's' : ''}</span>
          <span>${totalMinutes > 0 ? `${totalMinutes}min` : '<1min'} de scroll</span>
        </div>
      </div>
    `;
  }

  // ── 2. Stats row ────────────────────────────────────────────

  private renderStats(s: DbStats, totalMinutes: number) {
    const enrichPct = s.totalPosts > 0 ? Math.round(s.totalEnriched / s.totalPosts * 100) : 0;
    return html`
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-val" style="color:var(--bleu-indigo)">${s.totalPosts}</div>
          <div class="stat-label">Posts vus</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:var(--vert-menthe)">${enrichPct}%</div>
          <div class="stat-label">Analyses</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:var(--orange)">${totalMinutes > 0 ? `${totalMinutes}m` : '<1m'}</div>
          <div class="stat-label">Temps</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:var(--violet)">${(s.avgConfidence ?? 0) > 0 ? `${Math.round((s.avgConfidence ?? 0) * 100)}%` : '--'}</div>
          <div class="stat-label">Confiance</div>
        </div>
      </div>
    `;
  }

  // ── 2b. Fun scroll metrics ───────────────────────────────────

  private renderFunMetrics(s: DbStats) {
    if (s.totalPosts === 0) return nothing;

    // ─ Scroll distance: ~15cm per post (one screen height)
    const scrollMeters = s.totalPosts * 0.15;
    const scrollKm = scrollMeters / 1000;

    // ─ Scroll speed: meters per hour of active dwell
    const dwellHours = (s.totalDwellMs || 1) / 3600000;
    const scrollSpeed = scrollMeters / dwellHours;

    // ─ Average posts per session
    const postsPerSession = s.totalSessions > 0
      ? Math.round(s.totalPosts / s.totalSessions)
      : s.totalPosts;

    // ─ Daily average (estimate: totalDwellMs / sessions, assume ~1 session/day)
    const avgMinPerSession = s.totalSessions > 0
      ? Math.round((s.totalDwellMs || 0) / s.totalSessions / 60000)
      : 0;

    // ─ Distance metaphor
    const distanceText = scrollKm >= 1
      ? `${scrollKm.toFixed(1)} km`
      : `${Math.round(scrollMeters)} m`;

    const distanceMetaphor = scrollMeters < 10
      ? 'A peine la longueur de ton canape.'
      : scrollMeters < 50
      ? 'Tu pourrais traverser une piscine olympique du pouce.'
      : scrollMeters < 100
      ? 'Un terrain de foot, parcourru au pouce.'
      : scrollMeters < 324
      ? `Encore ${Math.round(324 - scrollMeters)}m et tu atteins la Tour Eiffel.`
      : scrollMeters < 500
      ? 'Tu as depasse la Tour Eiffel. En scrollant.'
      : scrollMeters < 1000
      ? 'Bientot 1 km. Ton pouce merite une medaille.'
      : scrollKm < 5
      ? `${scrollKm.toFixed(1)} km — plus loin qu'un jogging matinal.`
      : `${scrollKm.toFixed(1)} km — tu pourrais relier la gare au centre-ville.`;

    // ─ Speed metaphor (m/h)
    const speedMetaphor = scrollSpeed < 50
      ? { text: 'Un escargot te battrait (53 m/h).', color: 'var(--vert-menthe)' }
      : scrollSpeed < 100
      ? { text: 'Vitesse d\'un escargot motive. Respect.', color: 'var(--vert-menthe)' }
      : scrollSpeed < 270
      ? { text: 'Plus rapide qu\'une tortue (270 m/h). Bravo.', color: 'var(--bleu-ciel)' }
      : scrollSpeed < 1000
      ? { text: 'Ton pouce est un sprinter amateur.', color: 'var(--jaune)' }
      : scrollSpeed < 5000
      ? { text: 'Tu scrolles plus vite qu\'une hirondelle !', color: 'var(--orange)' }
      : { text: 'Ton pouce depasse un guepard. Litteralement.', color: 'var(--rouge)' };

    // ─ Time metaphor
    const totalMin = Math.round((s.totalDwellMs || 0) / 60000);
    const timeMetaphor = totalMin < 5
      ? 'Juste le temps d\'un expresso.'
      : totalMin < 15
      ? 'Un episode de podcast, englouti en scroll.'
      : totalMin < 30
      ? 'Tu aurais pu faire une sieste royale.'
      : totalMin < 60
      ? 'Un episode de serie... en posts Instagram.'
      : totalMin < 120
      ? 'Un film complet. En scroll vertical.'
      : `${Math.round(totalMin / 60)}h — un vol Paris-Londres en scroll.`;

    // ─ Content metaphor
    const contentMetaphor = s.totalPosts < 20
      ? 'L\'equivalent d\'un magazine feuillete.'
      : s.totalPosts < 100
      ? 'Un livre de poche, en posts.'
      : s.totalPosts < 300
      ? 'L\'equivalent d\'un roman. En diagonale.'
      : s.totalPosts < 1000
      ? 'Plus de posts que de pages dans Harry Potter 1.'
      : `Plus de posts qu'un dictionnaire n'a de pages.`;

    return html`
      <div class="section">
        <div class="section-label">Tes records de scroll</div>
        <div class="fun-grid">
          <div class="fun-card">
            <div class="fun-header">
              ${ico(FUN_ICONS.ruler, 16, 'var(--bleu-indigo)')}
              <div class="fun-val" style="color:var(--bleu-indigo)">${distanceText}</div>
            </div>
            <div class="fun-unit">scrolles au total</div>
            <div class="fun-meta">${distanceMetaphor}</div>
          </div>
          <div class="fun-card">
            <div class="fun-header">
              ${ico(FUN_ICONS.gauge, 16, speedMetaphor.color)}
              <div class="fun-val" style="color:${speedMetaphor.color}">${Math.round(scrollSpeed)} m/h</div>
            </div>
            <div class="fun-unit">vitesse de scroll</div>
            <div class="fun-meta">${speedMetaphor.text}</div>
          </div>
          <div class="fun-card">
            <div class="fun-header">
              ${ico(FUN_ICONS.flame, 16, 'var(--rose)')}
              <div class="fun-val" style="color:var(--rose)">${s.totalPosts}</div>
            </div>
            <div class="fun-unit">contenus engloutis</div>
            <div class="fun-meta">${contentMetaphor}</div>
          </div>
          <div class="fun-card">
            <div class="fun-header">
              ${ico(FUN_ICONS.zap, 16, 'var(--orange)')}
              <div class="fun-val" style="color:var(--orange)">${postsPerSession}</div>
            </div>
            <div class="fun-unit">posts / session</div>
            <div class="fun-meta">${postsPerSession > 50
              ? 'Tu ne t\'arretes jamais.'
              : postsPerSession > 20
              ? 'Un bon rythme de croisiere.'
              : 'Un scrolleur mesure.'}</div>
          </div>
        </div>
        <div class="fun-grid">
          <div class="fun-card full">
            <div class="fun-header">
              ${ico(FUN_ICONS.clock, 18, 'var(--violet)')}
              <div class="fun-val" style="color:var(--violet)">${totalMin > 0 ? `${totalMin} min` : '<1 min'}</div>
              <div class="fun-unit">de scroll cumule</div>
            </div>
            <div class="fun-meta">${timeMetaphor}</div>
          </div>
        </div>
        ${avgMinPerSession > 0 ? html`
          <div class="insight">
            ${ico(FUN_ICONS.fish, 14, 'var(--bleu-ciel)')}
            En moyenne, tu passes <strong>${avgMinPerSession} min</strong> par session.
            ${avgMinPerSession > 15
              ? html`C'est plus que la duree moyenne d'attention d'un poisson rouge (9s). Enfin... <strong>${Math.round(avgMinPerSession * 60 / 9)}x</strong> plus.`
              : html`Rapide et efficace — ou juste de passage ?`}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── 3. Content DNA strip ────────────────────────────────────

  private renderContentDNA(s: DbStats) {
    const domains = (s.topDomainsReal?.length ? s.topDomainsReal : s.topDomains);
    if (!domains?.length) return nothing;

    const total = domains.reduce((a, d) => a + d.count, 0);
    if (total === 0) return nothing;

    const dnaColors: Record<string, string> = {
      'culture_divertissement': '#E88BE8',
      'lifestyle_bienetre': '#88EEBB',
      'politique_societe': '#FF2222',
      'information_savoirs': '#88CCFF',
      'ecologie_environnement': '#6BE88B',
      'economie_travail': '#FFE94A',
      'sport': '#FF7B33',
      'technologie': '#6B6BFF',
      ...domainColors,
    };

    const items = domains.slice(0, 7).map((d, i) => {
      const key = (d as any).domain || (d as any).topic || '';
      const pct = Math.round(d.count / total * 100);
      const color = dnaColors[key.toLowerCase()] || scrolloutDots[i % scrolloutDots.length];
      return { label: key, pct, color, count: d.count };
    });

    // Generate insight sentence
    const top = items[0];
    const topPct = top?.pct || 0;
    const insightText = topPct > 50
      ? html`Plus de la moitie de ton feed est concentre sur <strong>${top.label}</strong>. L'algorithme te cible.`
      : topPct > 30
      ? html`<strong>${top.label}</strong> domine ton feed a <strong>${topPct}%</strong>. Le reste se partage entre ${items.slice(1, 3).map(i => i.label).join(' et ')}.`
      : html`Ton feed est relativement diversifie. <strong>${items.slice(0, 3).map(i => i.label).join(', ')}</strong> se partagent ton attention.`;

    return html`
      <div class="section">
        <div class="section-label">Ton ADN de contenu</div>
        <div class="dna-strip">
          ${items.map(i => html`
            <div class="dna-seg" style="flex:${i.pct};background:${i.color}">
              ${i.pct > 10 ? `${i.pct}%` : ''}
            </div>
          `)}
        </div>
        <div class="dna-legend">
          ${items.map(i => html`
            <div class="dna-item">
              <span class="dna-dot" style="background:${i.color}"></span>
              <span style="text-transform:capitalize">${i.label.replace(/_/g, ' ')}</span>
              <span class="dna-pct">${i.pct}%</span>
            </div>
          `)}
        </div>
        <div class="insight">${insightText}</div>
      </div>
    `;
  }

  // ── 4. What captivates you (dwell time by topic) ────────────

  private renderCaptivation(s: DbStats) {
    const dwell = s.dwellByTopic;
    if (!dwell?.length) return nothing;

    const maxDwell = dwell[0].totalDwellMs;
    const topItems = dwell.slice(0, 6);

    // Generate insight
    const topTopic = topItems[0];
    const topAvgSec = Math.round(topTopic.avgDwellMs / 1000);
    const globalAvgSec = Math.round((s.totalDwellMs || 1) / Math.max(s.totalPosts, 1) / 1000);

    return html`
      <div class="section">
        <div class="section-label">Ce qui te captive vraiment</div>
        ${topItems.map((item, i) => {
          const totalSec = Math.round(item.totalDwellMs / 1000);
          const pct = maxDwell > 0 ? Math.round(item.totalDwellMs / maxDwell * 100) : 0;
          const color = scrolloutDots[i % scrolloutDots.length];
          return html`
            <div class="dwell-row">
              <div class="dwell-label">${item.topic}</div>
              <div class="dwell-bar-wrap">
                <div class="dwell-bar" style="width:${pct}%;background:${color}"></div>
              </div>
              <div class="dwell-time">${totalSec > 60 ? `${Math.round(totalSec / 60)}m` : `${totalSec}s`}</div>
            </div>
          `;
        })}
        <div class="insight">
          Tu passes en moyenne <strong>${topAvgSec}s</strong> sur le contenu "${topTopic.topic}",
          ${topAvgSec > globalAvgSec
            ? html`soit <strong>${Math.round(topAvgSec / Math.max(globalAvgSec, 1) * 10) / 10}x</strong> plus que ta moyenne globale (${globalAvgSec}s).`
            : html`en ligne avec ta moyenne globale de ${globalAvgSec}s.`
          }
          L'algorithme detecte ce comportement.
        </div>
      </div>
    `;
  }

  // ── 5. Emotional landscape ──────────────────────────────────

  private renderEmotionalLandscape(s: DbStats) {
    const emotions = s.topEmotions;
    if (!emotions?.length) return nothing;

    const total = emotions.reduce((a, e) => a + e.count, 0);
    const topEmo = emotions[0];
    const topPct = total > 0 ? Math.round(topEmo.count / total * 100) : 0;

    return html`
      <div class="section">
        <div class="section-label">Ton paysage emotionnel</div>
        <div class="emotion-grid">
          ${emotions.slice(0, 8).map(e => {
            const meta = getEmotionMeta(e.emotion);
            const pct = total > 0 ? Math.round(e.count / total * 100) : 0;
            return html`
              <div class="emotion-chip" style="border-color:${meta.color}30">
                <span class="emotion-icon" style="color:${meta.color}">${meta.icon}</span>
                <span class="emotion-name">${e.emotion}</span>
                <span class="emotion-cnt">${pct}%</span>
              </div>
            `;
          })}
        </div>
        <div class="insight">
          <strong>${topPct}%</strong> du contenu que tu vois provoque de la <strong>${topEmo.emotion}</strong>.
          ${emotions.length > 1
            ? html`Suivi de ${emotions[1].emotion}${emotions.length > 2 ? ` et ${emotions[2].emotion}` : ''}.`
            : ''}
          Ce cocktail emotionnel n'est pas un hasard — c'est ce que l'algorithme optimise.
        </div>
      </div>
    `;
  }

  // ── 6. Narrative diet ───────────────────────────────────────

  private renderNarrativeDiet(s: DbStats) {
    const narratives = s.topNarratives;
    if (!narratives?.length) return nothing;

    const max = narratives[0].count;
    const narrColors = [
      'var(--bleu-indigo)', 'var(--violet)', 'var(--rose)',
      'var(--orange)', 'var(--jaune)', 'var(--vert-menthe)',
      'var(--bleu-ciel)', 'var(--vert-eau)',
    ];

    return html`
      <div class="section">
        <div class="section-label">Les recits qui te nourrissent</div>
        <div class="narrative-list">
          ${narratives.slice(0, 6).map((n, i) => {
            const pct = max > 0 ? Math.round(n.count / max * 100) : 0;
            return html`
              <div class="narrative-row">
                <div class="narrative-label">${n.narrative}</div>
                <div class="narrative-bar-wrap">
                  <div class="narrative-bar" style="width:${pct}%;background:${narrColors[i % narrColors.length]}"></div>
                </div>
                <div class="narrative-cnt">${n.count}</div>
              </div>
            `;
          })}
        </div>
        <div class="insight">
          Chaque post raconte une histoire avec un angle. Ton feed est domine par des recits de type
          <strong>${narratives[0].narrative}</strong>. Ce cadrage influence ta perception sans que tu le remarques.
        </div>
      </div>
    `;
  }

  // ── 7. Tone palette ─────────────────────────────────────────

  private renderTonePalette(s: DbStats) {
    const tones = s.topTones;
    if (!tones?.length) return nothing;

    const total = tones.reduce((a, t) => a + t.count, 0);
    const items = tones.slice(0, 6).map(t => {
      const key = t.tone.toLowerCase().trim();
      const color = toneMeta[key]?.color || 'var(--bleu-ciel)';
      const pct = total > 0 ? Math.round(t.count / total * 100) : 0;
      return { ...t, color, pct };
    });

    return html`
      <div class="section">
        <div class="section-label">La tonalite de ton feed</div>
        <div class="tone-strip">
          ${items.map(i => html`
            <div class="tone-seg" style="flex:${i.pct};background:${i.color}">
              ${i.pct > 12 ? `${i.pct}%` : ''}
            </div>
          `)}
        </div>
        <div class="tone-legend">
          ${items.map(i => html`
            <div class="tone-item">
              <span class="tone-dot" style="background:${i.color}"></span>
              ${i.tone} <span class="dna-pct">${i.pct}%</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // ── 8. Precise subjects (tag cloud) ─────────────────────────

  private renderSubjects(s: DbStats) {
    const subjects = s.topSubjects;
    const precise = s.topPreciseSubjects;
    if (!subjects?.length && !precise?.length) return nothing;

    const tags = (subjects || []).slice(0, 12);
    const preciseTags = (precise || []).slice(0, 8);

    return html`
      ${tags.length > 0 ? html`
        <div class="section">
          <div class="section-label">Les sujets de ton feed</div>
          <div class="subject-cloud">
            ${tags.map((t, i) => html`
              <span class="subject-tag" style="border-color:${scrolloutDots[i % scrolloutDots.length]}40">
                ${t.topic}
                <span class="cnt">${t.count}</span>
              </span>
            `)}
          </div>
        </div>
      ` : ''}

      ${preciseTags.length > 0 ? html`
        <div class="section">
          <div class="section-label">Jusqu'ou l'algorithme va</div>
          <div class="subject-cloud">
            ${preciseTags.map((t, i) => html`
              <span class="subject-tag" style="border-color:${scrolloutDots[(i + 3) % scrolloutDots.length]}40">
                ${t.topic}
                <span class="cnt">${t.count}</span>
              </span>
            `)}
          </div>
          <div class="insight">
            Ce sont les sujets precis que l'algorithme a identifies comme captant ton attention.
            Plus tu scrolles, plus il affine.
          </div>
        </div>
      ` : ''}
    `;
  }

  // ── 9. Attention distribution ───────────────────────────────

  private renderAttention(s: DbStats, totalAttention: number) {
    if (totalAttention === 0) return nothing;

    const levels = ['engaged', 'viewed', 'glanced', 'skipped'] as const;
    const labels: Record<string, string> = {
      engaged: 'Engage (>5s)', viewed: 'Vu (2-5s)',
      glanced: 'Apercu (<2s)', skipped: 'Ignore (<0.5s)',
    };
    const engagedPct = Math.round(((s.attention['engaged'] || 0) / totalAttention) * 100);
    const skippedPct = Math.round(((s.attention['skipped'] || 0) / totalAttention) * 100);

    return html`
      <div class="section">
        <div class="section-label">Ton style d'attention</div>
        <div class="attention-visual">
          ${levels.map(level => {
            const count = (s.attention[level] as number) || 0;
            const pct = count / totalAttention * 100;
            return pct > 0 ? html`
              <div class="att-seg" style="flex:${pct};background:${attentionColors[level]}">${pct > 12 ? `${Math.round(pct)}%` : ''}</div>
            ` : nothing;
          })}
        </div>
        <div class="att-row">
          ${levels.map(level => {
            const count = (s.attention[level] as number) || 0;
            return count > 0 ? html`
              <div class="att-item">
                <span class="att-dot" style="background:${attentionColors[level]}"></span>
                ${labels[level]} (${count})
              </div>
            ` : nothing;
          })}
        </div>
        <div class="insight">
          ${skippedPct > 50
            ? html`Tu ignores <strong>${skippedPct}%</strong> du contenu que l'algorithme te montre. Il essaie quand meme.`
            : engagedPct > 30
            ? html`Tu t'arretes sur <strong>${engagedPct}%</strong> des posts. Tu es un consommateur attentif — l'algorithme adore ca.`
            : html`Tu alternes entre engagement et scroll rapide. L'algorithme ajuste en continu.`
          }
        </div>
      </div>
    `;
  }

  // ── 10. Algorithm & you (political attention) ───────────────

  private renderAlgoAndYou(s: DbStats) {
    if (!s.attentionPolitical) return nothing;
    const ap = s.attentionPolitical;
    const engaged = ap['engaged'];
    const skipped = ap['skipped'];
    if (!engaged || !skipped) return nothing;

    const engagedPol = engaged.avgPolitical;
    const skippedPol = skipped.avgPolitical;
    const engagedPolar = engaged.avgPolarization;
    const diff = engagedPol - skippedPol;

    return html`
      <div class="section">
        <div class="section-label">L'algorithme et toi</div>
        <div class="reveals">
          <div class="reveal" style="border-color:${diff > 0.3 ? 'var(--rouge)' : diff > 0 ? 'var(--jaune)' : 'var(--vert-menthe)'}">
            <div class="reveal-icon" style="color:${diff > 0.3 ? 'var(--rouge)' : diff > 0 ? 'var(--jaune)' : 'var(--vert-menthe)'}">
              ${diff > 0 ? '+' : ''}${diff.toFixed(1)}
            </div>
            <div class="reveal-body">
              <div class="reveal-headline">
                ${diff > 0.3 ? 'Tu t\'arretes plus sur le contenu politique'
                  : diff > 0 ? 'Legere tendance a regarder le contenu politique'
                  : 'Tu ne t\'arretes pas plus sur le politique'}
              </div>
              <div class="reveal-detail">
                Score moyen des posts engages : ${engagedPol.toFixed(1)}/4.
                Posts ignores : ${skippedPol.toFixed(1)}/4.
                ${diff > 0 ? 'L\'algorithme detecte cet interet et t\'en montre davantage.' : ''}
              </div>
            </div>
          </div>
          ${engagedPolar > 0.2 ? html`
            <div class="reveal" style="border-color:var(--violet)">
              <div class="reveal-icon" style="color:var(--violet)">${engagedPolar.toFixed(2)}</div>
              <div class="reveal-body">
                <div class="reveal-headline">Le contenu qui te capte est polarisant</div>
                <div class="reveal-detail">Les posts sur lesquels tu passes du temps ont une polarisation de ${engagedPolar.toFixed(2)} en moyenne.</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ── 11. Polarization signals ────────────────────────────────

  private renderSignals(s: DbStats) {
    if (!s.signals || s.signals.total === 0) return nothing;
    const sig = s.signals;
    const activeSignals = [
      { name: 'Activisme', count: sig.activism, color: 'var(--rouge)', desc: 'appels a l\'action, mobilisation' },
      { name: 'Conflit', count: sig.conflict, color: 'var(--orange)', desc: 'vocabulaire de guerre, combat, ennemi' },
      { name: 'Absolus moraux', count: sig.moralAbsolute, color: 'var(--violet)', desc: 'fascisme, genocide, monstrueux' },
      { name: 'Designation d\'ennemi', count: sig.enemyDesignation, color: 'var(--rose)', desc: '"dehors", "degagez", exclusion' },
      { name: 'Nous vs Eux', count: sig.ingroupOutgroup, color: 'var(--jaune)', desc: 'elites vs peuple, communautarisme' },
    ].filter(x => x.count > 0);

    if (activeSignals.length === 0) return nothing;
    return html`
      <div class="section">
        <div class="section-label">Signaux de polarisation</div>
        <div class="reveals">
          ${activeSignals.map(x => html`
            <div class="reveal" style="border-color:${x.color}">
              <div class="reveal-icon" style="color:${x.color};font-size:16px;">${x.count}</div>
              <div class="reveal-body">
                <div class="reveal-headline">${x.name}</div>
                <div class="reveal-detail">${x.count} post${x.count > 1 ? 's' : ''} sur ${sig.total} — ${x.desc}</div>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // ── 12. Media types ─────────────────────────────────────────

  private renderMediaTypes(s: DbStats) {
    const types = s.mediaTypes;
    if (!types?.length) return nothing;

    const typeLabels: Record<string, string> = {
      photo: 'Photos', video: 'Videos', carousel: 'Carrousels',
      reel: 'Reels', story: 'Stories', '': 'Autre',
    };
    const typeColors: Record<string, string> = {
      photo: 'var(--bleu-ciel)', video: 'var(--violet)', carousel: 'var(--orange)',
      reel: 'var(--rose)', story: 'var(--jaune)',
    };

    return html`
      <div class="section">
        <div class="section-label">Quel format te capte</div>
        <div class="media-types">
          ${types.slice(0, 5).map(t => html`
            <div class="media-pill">
              <div class="val" style="color:${typeColors[t.type] || 'var(--text)'}">${t.count}</div>
              <div class="lbl">${typeLabels[t.type] || t.type}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // ── 13. Sponsored vs organic ────────────────────────────────

  private renderSponsoredVsOrganic(s: DbStats) {
    const sp = s.sponsoredStats;
    if (!sp?.sponsored) return nothing;
    const spCount = sp.sponsored?.count || 0;
    const orgCount = sp.organic?.count || 0;
    const total = spCount + orgCount;
    if (spCount === 0) return nothing;

    const spPct = total > 0 ? Math.round(spCount / total * 100) : 0;
    const spDwell = sp.sponsored?.avgDwellMs || 0;
    const orgDwell = sp.organic?.avgDwellMs || 0;
    const dwellDiff = Math.round((spDwell - orgDwell) / 1000);

    return html`
      <div class="section">
        <div class="section-label">Contenu sponsorise</div>
        <div class="reveals">
          <div class="reveal" style="border-color:var(--jaune)">
            <div class="reveal-icon" style="color:var(--jaune);font-size:14px;">${spPct}%</div>
            <div class="reveal-body">
              <div class="reveal-headline">${spCount} pub${spCount > 1 ? 's' : ''} dans ton feed</div>
              <div class="reveal-detail">
                Tu passes ${Math.round(spDwell / 1000)}s en moyenne sur une pub,
                vs ${Math.round(orgDwell / 1000)}s sur du contenu organique.
                ${dwellDiff > 0 ? `Les pubs te retiennent ${dwellDiff}s de plus.` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── 14. Top accounts ────────────────────────────────────────

  private renderTopAccounts(s: DbStats) {
    if (!s.topUsers?.length) return nothing;

    return html`
      <div class="section">
        <div class="section-label">Comptes les plus montres</div>
        <div class="accounts">
          ${s.topUsers.slice(0, 10).map(u => {
            const dwellSec = Math.round((u.totalDwellMs || 0) / 1000);
            return html`
              <div class="account">
                <span class="at">@${u.username}</span>
                <span class="cnt">${u.count}</span>
                ${dwellSec > 0 ? html`<span class="time">${dwellSec > 60 ? `${Math.round(dwellSec / 60)}m` : `${dwellSec}s`}</span>` : ''}
              </div>
            `;
          })}
        </div>
        ${s.polarizingAccounts?.length ? html`
          <div class="insight">
            ${s.polarizingAccounts[0].avgPolarization > 0.3
              ? html`Compte le plus polarisant : <strong>@${s.polarizingAccounts[0].username}</strong> (polarisation ${s.polarizingAccounts[0].avgPolarization.toFixed(2)}).`
              : html`Aucun compte particulierement polarisant dans ton feed.`
            }
          </div>
        ` : ''}
      </div>
    `;
  }
}
