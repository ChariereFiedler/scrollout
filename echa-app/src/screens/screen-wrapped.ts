import { LitElement, html, css, unsafeCSS, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, state } from 'lit/decorators.js';
import { getStats, type DbStats } from '../services/db-bridge.js';
import { palette } from '../styles/theme.js';

// ── Constants ───────────────────────────────────────────────

const TOTAL_SLIDES = 19;

/** Figma frame = 402×874 — helpers to convert px → % */
const W = 402;
const H = 874;
const x = (px: number) => `${(px / W) * 100}%`;
const y = (px: number) => `${(px / H) * 100}%`;
const vw = (figmaPx: number) => `${(figmaPx / W) * 100}vw`;

function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}

function domainLabel(d: string): string {
  const map: Record<string, string> = {
    culture_divertissement: 'divertissement',
    lifestyle_bienetre: 'lifestyle',
    politique_societe: 'politique',
    information_savoirs: 'infos',
    ecologie_environnement: 'écologie',
    economie_travail: 'économie',
    sport: 'sport',
    technologie: 'tech',
  };
  return map[d] || d;
}

function formatDwell(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min >= 60) return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  return `${min}min`;
}

function formatDwellShort(ms: number): string {
  if (ms < 1000) return '< 1s';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  return formatDwell(ms);
}

function mediaTypeLabel(t: string): string {
  const map: Record<string, string> = {
    reel: 'Reels',
    image: 'Photos',
    carousel: 'Carrousels',
    video: 'Vidéos',
    story_video: 'Stories',
    story: 'Stories',
  };
  return map[t] || t.charAt(0).toUpperCase() + t.slice(1);
}

// ── User profile archetype ──────────────────────────────────

function getUserProfile(s: DbStats): { name: string; description: string } {
  const top = s.topDomains?.[0];
  if (!top) return { name: 'L\'explorateur', description: 'Ton feed est trop récent pour te cerner.' };
  const topDomain = top.domain;
  const total = s.topDomains.reduce((a, d) => a + d.count, 0);
  const topPct = pct(top.count, total);
  const polPct = (() => {
    const pol = s.political;
    if (!pol) return 0;
    const t = Object.values(pol).reduce((a, b) => a + b, 0);
    return pct((pol[2] || 0) + (pol[3] || 0) + (pol[4] || 0), t);
  })();
  if (polPct > 40) return { name: 'Le militant', description: 'L\'algorithme t\'enferme dans un flux de contenus politiques engagés.' };
  if (topDomain.includes('information') || topDomain.includes('politique'))
    return { name: 'L\'informé', description: 'L\'algorithme te maintient dans un flux continu d\'actualité.' };
  if (topDomain.includes('divertissement') && topPct > 50)
    return { name: 'Le zappeur', description: 'Ton feed est dominé par le divertissement court.' };
  if (topDomain.includes('lifestyle'))
    return { name: 'L\'inspiré', description: 'Ton feed tourne autour du lifestyle et du bien-être.' };
  if (topDomain.includes('sport'))
    return { name: 'Le supporter', description: 'Le sport domine ta consommation Instagram.' };
  if (topPct < 30)
    return { name: 'L\'éclectique', description: 'Ton feed est varié, aucun domaine ne domine vraiment.' };
  return { name: 'L\'absorbé', description: 'L\'algorithme te nourrit selon un schéma bien rodé.' };
}

// ── Narrative & Emotion metadata ────────────────────────────

const NARRATIVE_META: Record<string, { color: string; icon: string; label: string }> = {
  apocalyptic:    { color: palette.rouge,      icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', label: 'Apocalyptique' },
  hero_journey:   { color: palette.bleuIndigo,  icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', label: 'Héroïque' },
  oppression:     { color: '#9B59B6',           icon: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>', label: 'Oppression' },
  meritocracy:    { color: palette.jaune,       icon: '<path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 1012 0V2z"/>', label: 'Méritocratie' },
  us_vs_them:     { color: palette.orange,      icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>', label: 'Nous vs Eux' },
  victim:         { color: '#3498DB',           icon: '<path d="M12 22a7 7 0 007-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 007 7z"/>', label: 'Victimaire' },
  resistance:     { color: '#E74C3C',           icon: '<path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>', label: 'Résistance' },
  progress:       { color: palette.vertMenthe,  icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', label: 'Progrès' },
  nostalgia:      { color: '#D4A76A',           icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', label: 'Nostalgie' },
  fear_mongering: { color: '#8E44AD',           icon: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', label: 'Alarmisme' },
  empowerment:    { color: palette.orange,      icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', label: 'Empowerment' },
  conspiracy:     { color: '#2C3E50',           icon: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', label: 'Complotisme' },
};

const EMOTION_META: Record<string, { color: string; label: string }> = {
  anger:    { color: palette.rouge, label: 'Colère' },
  fear:     { color: '#9B59B6', label: 'Peur' },
  joy:      { color: palette.jaune, label: 'Joie' },
  hope:     { color: palette.vertMenthe, label: 'Espoir' },
  disgust:  { color: '#2ECC71', label: 'Dégoût' },
  sadness:  { color: '#3498DB', label: 'Tristesse' },
  surprise: { color: palette.orange, label: 'Surprise' },
  contempt: { color: '#95A5A6', label: 'Mépris' },
  neutral:  { color: '#78909C', label: 'Neutre' },
  curiosity:    { color: '#E67E22', label: 'Curiosité' },
  curiosite:    { color: '#E67E22', label: 'Curiosité' },
  anticipation: { color: '#2980B9', label: 'Anticipation' },
  admiration:   { color: '#E91E63', label: 'Admiration' },
  trust:        { color: '#27AE60', label: 'Confiance' },
  confiance:    { color: '#27AE60', label: 'Confiance' },
  amusement:    { color: '#F39C12', label: 'Amusement' },
  excitement:   { color: '#FF6B00', label: 'Excitation' },
  neutre:       { color: '#78909C', label: 'Neutre' },
};

// ── SVG icon helper ─────────────────────────────────────────

const svgIcon = (path: string, size = 24, color = 'currentColor') =>
  html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${unsafeSVG(path)}</svg>`;

// ── Component ───────────────────────────────────────────────

@customElement('screen-wrapped')
export class ScreenWrapped extends LitElement {
  static styles = css`
    @import url('https://fonts.googleapis.com/css2?family=Averia+Sans+Libre:wght@300;400;700&family=Jaldi:wght@400;700&display=swap');

    :host { display: block; width: 100%; height: 100%; overflow: hidden; -webkit-font-smoothing: antialiased; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

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
      position: relative;
      overflow: hidden;
    }

    .slide-scroll {
      width: 100%; height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    /* ── Shared typography (Figma faithful, vw-based) ── */
    .f-averia { font-family: 'Averia Sans Libre', serif; font-weight: 700; }
    .f-jaldi  { font-family: 'Jaldi', sans-serif; font-weight: 700; }

    .abs { position: absolute; }
    .cx  { left: 50%; transform: translateX(-50%); }

    /* ── Nav dots ── */
    .dots {
      position: absolute; bottom: 0; left: 0; right: 0;
      display: flex; justify-content: center; gap: 6px;
      padding: 10px 0 max(env(safe-area-inset-bottom, 8px), 8px);
      z-index: 5;
    }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(0,0,0,0.18); transition: all 0.3s; cursor: pointer;
    }
    .dot.on { width: 22px; border-radius: 4px; background: rgba(0,0,0,0.55); }
    .dots.light .dot { background: rgba(255,255,255,0.25); }
    .dots.light .dot.on { background: rgba(255,255,255,0.8); }

    /* ── Close button ── */
    .x-btn {
      position: absolute; top: 12px; right: 14px;
      width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.08);
      border: none; display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 10; -webkit-tap-highlight-color: transparent;
    }
    .x-btn svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2.5; }
    .x-btn:active { opacity: 0.5; }
    .x-light { background: rgba(255,255,255,0.15); color: #eeebdf; }

    /* ── CTA button ── */
    .cta {
      display: block; margin: 0 auto; background: white; color: black;
      border: none; border-radius: 30px; padding: 16px 30px;
      font-family: 'Averia Sans Libre', serif; font-weight: 700; font-size: ${unsafeCSS(vw(36))};
      cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    .cta:active { opacity: 0.8; }

    /* ── Asset images ── */
    .asset {
      position: absolute;
      pointer-events: none;
    }

    /* ── Pill shapes (slide 07) ── */
    .pill {
      position: absolute; border-radius: 40px;
      background: rgba(255,103,1,0.2);
      width: ${unsafeCSS(x(79))}; height: ${unsafeCSS(y(182))};
    }

    /* ── Recap card ── */
    .recap-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 16px; border-radius: 20px; margin: 0 12px 8px;
    }
    .recap-pct {
      font-family: 'Averia Sans Libre', serif; font-weight: 700;
      font-size: ${unsafeCSS(vw(36))}; min-width: 80px;
    }
    .recap-lbl { font-family: 'Jaldi', sans-serif; font-weight: 700; font-size: ${unsafeCSS(vw(18))}; line-height: 1.2; }
    .recap-desc { font-family: 'Jaldi', sans-serif; font-size: ${unsafeCSS(vw(14))}; opacity: 0.65; }

    /* ── Choice cards (slide 11/15) ── */
    .choice-row { display: flex; gap: 12px; padding: 0 13px; }
    .choice-card {
      flex: 1; background: white; border-radius: 40px;
      padding: 30px 16px 20px; display: flex; flex-direction: column;
      align-items: center; gap: 14px;
    }
    .choice-lbl { font-family: 'Jaldi', sans-serif; font-weight: 700; font-size: ${unsafeCSS(vw(18))}; color: black; text-align: center; line-height: 1.2; }

    /* ── Narrative chip (data slide) ── */
    .narr-chip {
      display: flex; align-items: center; gap: 16px;
      border-radius: 20px; padding: 20px; margin-bottom: 18px;
    }
    .narr-icon {
      width: 56px; height: 56px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .narr-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.15); margin-top: 6px; }
    .narr-fill { height: 100%; border-radius: 4px; }

    /* ── Compass (data slide) ── */
    .compass-box {
      position: relative; width: 90%; aspect-ratio: 1; margin: 0 auto;
      border-radius: 24px; overflow: hidden;
      background: rgba(255,255,255,0.12);
    }
    .compass-axis { position: absolute; background: rgba(255,255,255,0.15); }
    .compass-axis.h { width: 100%; height: 1px; top: 50%; }
    .compass-axis.v { height: 100%; width: 1px; left: 50%; }
    .compass-qlabel {
      position: absolute; font-family: 'Jaldi', sans-serif; font-weight: 700;
      font-size: ${unsafeCSS(vw(13))}; color: rgba(255,255,255,0.5); text-align: center;
      width: 45%; padding: 10px;
    }
    .compass-dot {
      position: absolute; border-radius: 50%; transform: translate(-50%, -50%);
      background: #eeebdf; box-shadow: 0 0 24px rgba(238,235,223,0.6);
    }

    /* ── Animation keyframes ── */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.7); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes floatY1 {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes floatY2 {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes floatY3 {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-14px); }
    }
    @keyframes heartBeat {
      0%, 100% { transform: rotate(4.53deg) scale(1); }
      50% { transform: rotate(4.53deg) scale(1.05); }
    }
    @keyframes compassBounce {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
      60% { transform: translate(-50%, -50%) scale(1.2); }
      80% { transform: translate(-50%, -50%) scale(0.95); }
      100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes barGrow {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
    @keyframes bubbleIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes pulseGlow {
      0%, 100% { filter: drop-shadow(0 0 6px var(--glow, rgba(255,255,255,0.3))); }
      50% { filter: drop-shadow(0 0 22px var(--glow, rgba(255,255,255,0.5))); }
    }
    @keyframes starWobble {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(3deg); }
      75% { transform: rotate(-3deg); }
    }

    /* ── Animation utilities ── */
    .anim { opacity: 0; transform: translateY(24px); }
    .slide.active .anim {
      animation: fadeInUp 0.55s ease-out forwards;
      animation-delay: var(--d, 0ms);
    }
    .anim-scale { opacity: 0; transform: scale(0.7); }
    .slide.active .anim-scale {
      animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      animation-delay: var(--d, 0ms);
    }
    .slide.active .float-1 { animation: floatY1 4s ease-in-out infinite; }
    .slide.active .float-2 { animation: floatY2 5.5s ease-in-out 0.3s infinite; }
    .slide.active .float-3 { animation: floatY3 3.8s ease-in-out 0.8s infinite; }
    .slide.active .float-4 { animation: floatY1 6s ease-in-out 1.2s infinite; }
    .slide.active .heart-beat {
      animation: heartBeat 1.8s ease-in-out var(--d, 0s) infinite;
    }
    .compass-bounce { opacity: 0; transform: translate(-50%, -50%) scale(0); }
    .slide.active .compass-bounce {
      animation: compassBounce 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
    }
    .bar-grow { transform: scaleX(0); transform-origin: left; }
    .slide.active .bar-grow {
      animation: barGrow 0.8s ease-out forwards;
      animation-delay: var(--d, 0.3s);
    }
    .bubble-in { opacity: 0; }
    .slide.active .bubble-in {
      animation: bubbleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      animation-delay: var(--d, 0ms);
    }
    .slide.active .star-wobble {
      animation: starWobble 6s ease-in-out infinite;
    }
    .slide.active .pulse-glow {
      animation: pulseGlow 2.5s ease-in-out infinite;
    }
    .confetti-canvas {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 20;
    }
  `;

  @state() currentSlide = 0;
  @state() private stats: DbStats | null = null;
  @state() private loading = true;

  private touchStartX = 0;
  private touchDelta = 0;

  connectedCallback() { super.connectedCallback(); this.loadData(); }

  private async loadData() {
    try { this.stats = await getStats(); } catch (e) { console.warn('[Wrapped] stats error:', e); }
    this.loading = false;
  }

  // ── Computed data ─────────────────────────────────────────

  private get totalEnriched() { return this.stats?.totalEnriched || 0; }
  private get totalPosts() { return this.stats?.totalPosts || 0; }

  private get topDomain() {
    const d = this.stats?.topDomains?.[0];
    if (!d) return { domain: 'N/A', count: 0, pct: 0 };
    const total = this.stats!.topDomains.reduce((a, x) => a + x.count, 0);
    return { ...d, pct: pct(d.count, total) };
  }

  private get confirmationScore() {
    const domains = this.stats?.topDomains || [];
    const total = domains.reduce((a, d) => a + d.count, 0);
    return pct(domains.slice(0, 2).reduce((a, d) => a + d.count, 0), total);
  }

  private get reinforcementRatio() { return Math.min(10, Math.round(this.confirmationScore / 10)); }

  private get emotionIntensityPct() {
    const emo = this.stats?.topEmotions;
    if (!emo?.length) return 0;
    const total = emo.reduce((a, e) => a + e.count, 0);
    const strong = emo.filter(e => ['anger', 'fear', 'disgust', 'contempt', 'sadness', 'surprise'].includes(e.emotion))
      .reduce((a, e) => a + e.count, 0);
    return pct(strong, total);
  }

  private get skipRate() {
    return pct(this.stats?.attention?.['skipped'] || 0, this.totalPosts);
  }

  private get politicalPct() {
    const pol = this.stats?.political;
    if (!pol) return 0;
    const total = Object.values(pol).reduce((a, b) => a + b, 0);
    return pct((pol[2] || 0) + (pol[3] || 0) + (pol[4] || 0), total);
  }

  private get avgPolarization() { return this.stats?.avgPolarization ?? 0; }

  // ── Navigation ────────────────────────────────────────────

  go(slide: number) { this.currentSlide = Math.max(0, Math.min(TOTAL_SLIDES - 1, slide)); }

  private onTouchStart(e: TouchEvent) { this.touchStartX = e.touches[0].clientX; this.touchDelta = 0; }
  private onTouchMove(e: TouchEvent) { this.touchDelta = e.touches[0].clientX - this.touchStartX; }
  private onTouchEnd() {
    if (Math.abs(this.touchDelta) > 60) {
      this.go(this.currentSlide + (this.touchDelta < 0 ? 1 : -1));
    }
    this.touchDelta = 0;
  }

  close() { this.dispatchEvent(new CustomEvent('close-wrapped', { bubbles: true, composed: true })); }

  // ── Animation engine ─────────────────────────────────────

  protected updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has('currentSlide') ||
        (changedProperties.has('loading') && !this.loading)) {
      requestAnimationFrame(() => this._animateSlide());
    }
  }

  private _animateSlide() {
    const slides = this.shadowRoot?.querySelectorAll('.slide');
    if (!slides?.length) return;

    // Toggle .active — force reflow to restart CSS animations
    slides.forEach(s => s.classList.remove('active'));
    const active = slides[this.currentSlide];
    if (!active) return;
    void (active as HTMLElement).offsetWidth;
    active.classList.add('active');

    // Count-up on [data-countup] elements
    active.querySelectorAll<HTMLElement>('[data-countup]').forEach(el => {
      const target = parseFloat(el.dataset.countup || '0');
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const duration = 900;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        el.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = `${prefix}0${suffix}`;
      requestAnimationFrame(tick);
    });

    // Confetti on profile slide (index 15 = s09)
    if (this.currentSlide === 15) {
      setTimeout(() => this._spawnConfetti(active), 500);
    }
  }

  private _spawnConfetti(container: Element) {
    if (container.querySelector('.confetti-canvas')) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    container.appendChild(canvas);
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const colors = ['#ff6701', '#9948d3', '#8ee88e', '#f5f44c', '#9ddfff', '#eeebdf'];
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * rect.width,
      y: -10 - Math.random() * rect.height * 0.3,
      vx: (Math.random() - 0.5) * 4,
      vy: 1.5 + Math.random() * 3,
      w: 4 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.15,
    }));

    let frame = 0;
    const draw = () => {
      if (frame++ > 200) { canvas.remove(); return; }
      ctx.clearRect(0, 0, rect.width, rect.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.99;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - frame / 200);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  private async shareWrapped() {
    const s = this.stats;
    if (!s) return;
    const profile = getUserProfile(s);
    const text = [
      `Mon Scrollout Wrapped 2026`,
      `Profil : ${profile.name}`,
      `${this.topDomain.pct}% de ${domainLabel(this.topDomain.domain)}`,
      `${this.confirmationScore}% de contenus dans le même sens`,
      `${this.skipRate}% de contenus zappés`,
    ].join('\n');
    if (navigator.share) { try { await navigator.share({ title: 'Mon Scrollout Wrapped', text }); } catch {} }
    else { try { await navigator.clipboard.writeText(text); } catch {} }
  }

  // ── Shared UI fragments ───────────────────────────────────

  private xBtn(light = false) {
    return html`<button class="x-btn ${light ? 'x-light' : ''}" @click=${this.close}>
      <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;
  }

  private navDots(idx: number, light = false) {
    return html`<div class="dots ${light ? 'light' : ''}">
      ${Array.from({ length: TOTAL_SLIDES }, (_, i) =>
        html`<div class="dot ${i === idx ? 'on' : ''}" @click=${() => this.go(i)}></div>`)}
    </div>`;
  }

  // ── Render ────────────────────────────────────────────────

  render() {
    if (this.loading) return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#eeebdf;font-family:'Averia Sans Libre',serif;font-size:24px;">Chargement...</div>`;
    const s = this.stats;
    if (!s) return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#eeebdf;font-family:'Averia Sans Libre',serif;font-size:20px;text-align:center;padding:40px;">Pas de données</div>`;

    return html`
      <div class="slides"
        style="transform:translateX(-${this.currentSlide * (100 / TOTAL_SLIDES)}%)"
        @touchstart=${this.onTouchStart} @touchmove=${this.onTouchMove} @touchend=${this.onTouchEnd}>
        ${this.s01(s)} ${this.s02(s)} ${this.s03(s)} ${this.s04(s)}
        ${this.s05(s)} ${this.s06(s)} ${this.s07(s)} ${this.s08(s)}
        ${this.sNarratives(s)} ${this.sEmotions(s)} ${this.sCompass(s)}
        ${this.sAccounts(s)} ${this.sMediaTypes(s)} ${this.sSignals(s)} ${this.sAttentionPol(s)}
        ${this.s09(s)} ${this.sRecords(s)} ${this.s10(s)} ${this.s11(s)}
      </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 01 — "Tu t'informes moins que tu ne le penses"
  //  bg: #eeebdf — 4 cercles lilas décroissants en diagonale
  // ════════════════════════════════════════════════════════════
  private s01(s: DbStats) {
    const top = this.topDomain;
    const domains = s.topDomains || [];
    const total = domains.reduce((a, d) => a + d.count, 0);
    const secs = domains.slice(1, 3).map(d => `${domainLabel(d.domain)} ${pct(d.count, total)}%`).join('  ');

    return html`
    <div class="slide" style="background:#eeebdf;color:#1e1e1e;">
      ${this.xBtn()}
      <!-- 4 lilac bubbles from Figma assets -->
      <img class="asset float-1" src="assets/wrapped/s01-bubble-1.svg" style="left:${x(48)};top:${y(69)};width:${x(298)};height:auto;" alt=""/>
      <img class="asset float-2" src="assets/wrapped/s01-bubble-2.svg" style="left:${x(257)};top:${y(346)};width:${x(98)};height:auto;" alt=""/>
      <img class="asset float-3" src="assets/wrapped/s01-bubble-3.svg" style="left:${x(209)};top:${y(444)};width:${x(60)};height:auto;" alt=""/>
      <img class="asset float-4" src="assets/wrapped/s01-bubble-4.svg" style="left:${x(184)};top:${y(515)};width:${x(25)};height:auto;" alt=""/>

      <!-- Content in flex layout to avoid overlap -->
      <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:space-between;height:100%;padding:${y(80)} 20px ${y(60)};">
        <!-- Title -->
        <p class="f-jaldi anim" style="font-size:${vw(52)};line-height:0.92;text-align:center;width:80%;">
          Tu t'informes moins que tu ne le penses</p>

        <!-- Stats block -->
        <div style="text-align:center;">
          <p class="f-jaldi anim" style="font-size:${vw(22)};letter-spacing:-0.4px;--d:150ms;">
            Tu es exposé majoritairement à</p>
          <p class="f-averia anim-scale" style="font-size:${vw(132)};line-height:0.85;letter-spacing:-2px;margin-top:-4px;--d:300ms;">
            <span data-countup="${top.pct}" data-suffix="%"></span></p>
          <p class="f-averia anim" style="font-size:${vw(47)};line-height:1.1;--d:450ms;">
            de ${domainLabel(top.domain)}</p>
          <p class="f-jaldi" style="font-size:${vw(21)};letter-spacing:-0.4px;margin-top:8px;opacity:0.6;">
            ${secs}</p>
        </div>
      </div>

      ${this.navDots(0)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 02 — "Tu es rarement confronté à une contradiction"
  //  bg: #ff6701 — 3 chevron/arrow shapes
  // ════════════════════════════════════════════════════════════
  private s02(_s: DbStats) {
    const score = this.confirmationScore;

    return html`
    <div class="slide" style="background:#ff6701;color:#eeebdf;">
      ${this.xBtn(true)}

      <!-- Arrow assets from Figma -->
      <img class="asset" src="assets/wrapped/s02-arrow-center.svg" style="left:${x(-42)};top:${y(308)};width:${x(464)};height:auto;" alt=""/>
      <img class="asset" src="assets/wrapped/s02-arrow-top.svg" style="left:${x(-71)};top:${y(25)};width:${x(292)};height:auto;transform:rotate(180deg);" alt=""/>
      <img class="asset" src="assets/wrapped/s02-arrow-bottom.svg" style="left:${x(-71)};top:${y(638)};width:${x(190)};height:auto;transform:rotate(180deg);" alt=""/>

      <!-- "78%" at top -->
      <p class="abs cx f-averia anim-scale" style="top:${y(64)};font-size:${vw(132)};text-align:center;line-height:0.9;letter-spacing:-2px;">
        <span data-countup="${score}" data-suffix="%"></span></p>
      <p class="abs f-averia" style="top:${y(185)};left:${x(75)};font-size:${vw(44)};letter-spacing:-0.8px;">
        des contenus</p>
      <p class="abs f-averia" style="top:${y(235)};left:${x(56)};font-size:${vw(28)};letter-spacing:-0.5px;">
        vont dans le même sens</p>

      <!-- Bottom phrase -->
      <p class="abs cx f-jaldi anim" style="bottom:${y(110)};font-size:${vw(52)};line-height:0.92;text-align:center;width:85%;--d:300ms;">
        Tu es rarement confronté à une contradiction</p>


      ${this.navDots(1, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 03 — "X contenus sur 10"
  //  bg: #8ee88e — big number + circle grid bottom
  // ════════════════════════════════════════════════════════════
  private s03(_s: DbStats) {
    const ratio = this.reinforcementRatio;
    // Circle grid: 6 cols × 6 rows, greens + 1 gold
    const gridCircles = Array.from({ length: 48 }, (_, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      const isGold = i === 35; // one standout
      const opacity = 0.25 + (row / 8) * 0.6;
      return html`<div style="position:absolute;width:62px;height:62px;border-radius:50%;
        background:${isGold ? '#d4a76a' : `rgba(100,190,100,${opacity})`};
        left:${col * 68 - 4}px;bottom:${row * 68}px;"></div>`;
    });

    return html`
    <div class="slide" style="background:#8ee88e;color:#1e1e1e;">
      ${this.xBtn()}

      <!-- Big "9" asset from Figma -->
      <img class="asset" src="assets/wrapped/s03-nine.svg" style="left:${x(20)};top:${y(19)};width:${x(204)};height:auto;" alt=""/>

      <!-- "contenus sur 10" -->
      <p class="abs f-averia" style="left:${x(22)};top:${y(318)};font-size:${vw(47)};line-height:1;">contenus</p>
      <p class="abs f-averia" style="left:${x(22)};top:${y(365)};font-size:${vw(47)};line-height:1;">sur 10</p>

      <!-- Sub-text -->
      <p class="abs f-jaldi" style="left:${x(22)};top:${y(550)};font-size:${vw(22)};letter-spacing:-0.4px;">
        renforcent ce que tu penses déjà</p>

      <!-- Circle grid -->
      <div style="position:absolute;bottom:0;left:0;right:0;height:45%;overflow:hidden;">
        ${gridCircles}
      </div>

      ${this.navDots(2)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 04 — "XX% jouent sur des émotions fortes"
  //  bg: #9948d3 — 4 concentric hearts SVG
  // ════════════════════════════════════════════════════════════
  private s04(_s: DbStats) {
    const emoPct = this.emotionIntensityPct || 78;

    return html`
    <div class="slide" style="background:#9948d3;color:#eeebdf;">
      ${this.xBtn(true)}

      <!-- 4 concentric hearts from Figma assets, rotated 4.53deg -->
      <img class="asset heart-beat" src="assets/wrapped/s04-heart-4.svg" style="left:${x(-393)};top:${y(-166)};width:${x(1102)};height:auto;transform:rotate(4.53deg);--d:0s;" alt=""/>
      <img class="asset heart-beat" src="assets/wrapped/s04-heart-3.svg" style="left:${x(-213)};top:${y(18)};width:${x(766)};height:auto;transform:rotate(4.53deg);--d:0.3s;" alt=""/>
      <img class="asset heart-beat" src="assets/wrapped/s04-heart-2.svg" style="left:${x(-81)};top:${y(152)};width:${x(522)};height:auto;transform:rotate(4.53deg);--d:0.6s;" alt=""/>
      <img class="asset heart-beat" src="assets/wrapped/s04-heart-1.svg" style="left:${x(7)};top:${y(250)};width:${x(360)};height:auto;transform:rotate(4.53deg);--d:0.9s;" alt=""/>

      <!-- Stats bottom -->
      <p class="abs cx f-averia anim-scale" style="top:${y(380)};font-size:${vw(132)};text-align:center;line-height:0.9;letter-spacing:-2px;">
        <span data-countup="${emoPct}" data-suffix="%"></span></p>
      <p class="abs f-averia" style="top:${y(500)};left:${x(85)};font-size:${vw(44)};letter-spacing:-0.8px;">
        des contenus</p>
      <p class="abs f-averia" style="top:${y(550)};left:${x(15)};font-size:${vw(28)};letter-spacing:-0.5px;">
        jouent sur des émotions fortes</p>

      ${this.navDots(3, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 05 — "Ces sujets sont populaires sur Instagram"
  //  bg: #9ddfff — purple blobs + photo cards
  // ════════════════════════════════════════════════════════════
  private s05(s: DbStats) {
    const domains = s.topDomains || [];
    const present = new Set(domains.map(d => d.domain));
    const allDomains = ['culture_divertissement', 'lifestyle_bienetre', 'politique_societe', 'information_savoirs', 'ecologie_environnement', 'economie_travail', 'sport', 'technologie'];
    const missing = allDomains.filter(d => !present.has(d));
    const weak = domains.filter(d => d.count <= 3).map(d => domainLabel(d.domain));
    const absentTopics = [...weak, ...missing.map(d => domainLabel(d))].slice(0, 7);

    return html`
    <div class="slide" style="background:#9ddfff;color:#1e1e1e;">
      ${this.xBtn()}

      <!-- Purple blob assets from Figma -->
      <img class="asset float-1" src="assets/wrapped/s05-blob-2.svg" style="left:${x(66)};top:${y(95)};width:${x(73)};height:auto;" alt=""/>
      <img class="asset float-3" src="assets/wrapped/s05-blob-3.svg" style="left:${x(-60)};top:${y(207)};width:${x(121)};height:auto;" alt=""/>
      <img class="asset float-2" src="assets/wrapped/s05-blob-5.svg" style="left:${x(320)};top:${y(16)};width:${x(109)};height:auto;" alt=""/>
      <img class="asset float-4" src="assets/wrapped/s05-blob-4.svg" style="left:${x(-59)};top:${y(494)};width:${x(174)};height:auto;" alt=""/>
      <img class="asset float-1" src="assets/wrapped/s05-blob-1.svg" style="left:${x(255)};top:${y(464)};width:${x(51)};height:auto;" alt=""/>
      <img class="asset float-3" src="assets/wrapped/s05-blob-6.svg" style="left:${x(243)};top:${y(210)};width:${x(74)};height:auto;" alt=""/>

      <!-- Photo cards with images -->
      ${[
        { l: '224', t: '152', w: 41, h: 52, img: 's05-photo-1.png' },
        { l: '45', t: '234', w: 50, h: 64, img: 's05-photo-2.png' },
        { l: '294', t: '192', w: 58, h: 74, img: 's05-photo-3.png' },
        { l: '285', t: '391', w: 76, h: 97, img: 's05-photo-4.png' },
        { l: '147', t: '474', w: 66, h: 84, img: 's05-photo-5.png' },
        { l: '88', t: '133', w: 56, h: 71, img: 's05-photo-6.png' },
        { l: '62', t: '404', w: 47, h: 60, img: 's05-photo-7.png' },
      ].map(c => html`
        <div class="abs" style="left:${x(parseInt(c.l))};top:${y(parseInt(c.t))};width:${c.w}px;height:${c.h}px;
          background:white;border:2px solid #4fa8d8;border-radius:8px;overflow:hidden;">
          <img src="assets/wrapped/${c.img}" alt="" style="width:100%;height:100%;object-fit:cover;"/>
        </div>
      `)}

      <!-- Title (centered) -->
      <div class="abs cx f-averia" style="top:${y(250)};font-size:${vw(49)};text-align:center;width:86%;line-height:0.88;">
        <p>Ces sujets</p><p>sont populaires</p><p>sur Instagram</p>
      </div>

      <!-- Absent topics as tags -->
      ${absentTopics.length > 0 ? html`
        <div class="abs" style="bottom:${y(200)};left:0;right:0;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:0 16px;">
          ${absentTopics.map(t => html`
            <span style="background:white;border:2px solid #9ddfff;border-radius:10px;padding:4px 10px;
              font-family:'Jaldi',sans-serif;font-weight:700;font-size:${vw(14)};">${t}</span>`)}
        </div>
      ` : nothing}

      <!-- Bottom text -->
      <p class="abs cx f-jaldi" style="bottom:${y(100)};font-size:${vw(25)};text-align:center;width:94%;line-height:1.1;">
        Mais ils n'apparaissent pas dans ton feed</p>

      ${this.navDots(4)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 06 — "Ce que tu vois / Ce qui t'accroche"
  //  Split: top #8c43e9, bottom #f5f44c
  // ════════════════════════════════════════════════════════════
  private s06(s: DbStats) {
    const topTopicsData = (s.topTopics || []).slice(0, 7);
    const dwellTopicsData = (s.dwellByTopic || [])
      .sort((a, b) => b.avgDwellMs - a.avgDwellMs)
      .slice(0, 7);

    // Scatter positions for tags
    const pos = [
      { l: '8%', t: '12%' }, { l: '55%', t: '8%' }, { l: '62%', t: '18%' },
      { l: '3%', t: '25%' }, { l: '32%', t: '30%' }, { l: '58%', t: '32%' },
      { l: '12%', t: '38%' },
    ];

    return html`
    <div class="slide" style="background:#8c43e9;">
      ${this.xBtn(true)}

      <!-- Organic blob assets from Figma -->
      <img class="asset" src="assets/wrapped/s06-blob-1.svg" style="left:${x(-60)};top:${y(-167)};width:${x(390)};height:auto;transform:rotate(90.56deg);" alt=""/>
      <img class="asset" src="assets/wrapped/s06-blob-2.svg" style="left:${x(-152)};top:${y(576)};width:${x(516)};height:auto;" alt=""/>
      <img class="asset" src="assets/wrapped/s06-blob-3.svg" style="left:${x(242)};top:${y(-31)};width:${x(457)};height:auto;transform:rotate(-90deg);" alt=""/>

      <!-- Top half: purple -->
      <div style="position:absolute;top:0;left:0;right:0;height:50%;overflow:hidden;">
        ${topTopicsData.map((t, i) => {
          const p = pos[i] || { l: '20%', t: '20%' };
          return html`<span class="abs f-averia" style="left:${p.l};top:${p.t};font-size:${vw(22)};color:#f5f44c;white-space:nowrap;">
            ${t.topic} <span style="font-size:${vw(14)};opacity:0.8;">(${t.count})</span></span>`;
        })}
        <p class="abs cx f-averia" style="top:45%;font-size:${vw(42)};color:#f5f44c;text-align:center;">Ce que tu vois</p>
      </div>

      <!-- Bottom half: yellow -->
      <div style="position:absolute;bottom:0;left:0;right:0;height:50%;background:#f5f44c;overflow:hidden;">
        ${dwellTopicsData.map((t, i) => {
          const p = pos[i] || { l: '20%', t: '20%' };
          return html`<span class="abs f-averia" style="left:${p.l};top:${p.t};font-size:${vw(22)};color:#a34abb;white-space:nowrap;">
            ${t.topic} <span style="font-size:${vw(14)};opacity:0.8;">(${formatDwellShort(t.avgDwellMs)})</span></span>`;
        })}
        <p class="abs cx f-averia" style="top:45%;font-size:${vw(42)};color:#a34abb;text-align:center;">Ce qui t'accroche</p>
      </div>

      ${this.navDots(5, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 07 — "Tu vois... Mais tu ne regardes pas toujours"
  //  bg: #8c43e9 — pill grid
  // ════════════════════════════════════════════════════════════
  private s07(_s: DbStats) {
    const skip = this.skipRate;
    // 4 columns of pills, staggered like Figma
    const pillOffsets = [
      { left: 12, tops: [-65, 135, 335, 535, 735] },
      { left: 112, tops: [-14, 186, 386, 586, 786] },
      { left: 212, tops: [-115, 85, 285, 485, 685] },
      { left: 312, tops: [-4, 196, 396, 596, 796] },
    ];

    return html`
    <div class="slide" style="background:#8c43e9;color:#eeebdf;">
      ${this.xBtn(true)}

      <!-- Pill pattern -->
      ${pillOffsets.flatMap(col =>
        col.tops.map(t => html`<div class="pill" style="left:${x(col.left)};top:${y(t)};"></div>`)
      )}

      <!-- "Tu vois..." -->
      <div class="abs cx f-jaldi" style="top:${y(142)};font-size:${vw(49)};text-align:center;width:86%;line-height:0.88;">
        <p>Tu vois...</p>
        <p>Mais tu ne regardes pas toujours</p>
      </div>

      <!-- Big stat -->
      <p class="abs cx f-averia anim-scale" style="top:${y(494)};font-size:${vw(132)};text-align:center;line-height:0.9;letter-spacing:-2px;">
        <span data-countup="${skip}" data-suffix="%"></span></p>
      <p class="abs f-averia" style="top:${y(615)};left:${x(76)};font-size:${vw(44)};letter-spacing:-0.8px;">
        des contenus</p>
      <p class="abs cx f-averia" style="top:${y(672)};font-size:${vw(28)};text-align:center;width:80%;line-height:1;letter-spacing:-0.5px;">
        passent sans être regardés</p>

      ${this.navDots(6, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 08 — "Tu passes moins de temps sur les sponsorisés"
  //  bg: #8ee88e — circle grid with color gradient + stats
  // ════════════════════════════════════════════════════════════
  private s08(s: DbStats) {
    const cols = 6;
    const rows = 8;
    const size = 67;
    const colors = ['#8ee88e44', '#8ee88e77', '#a8d870aa', '#c0c850bb', '#d0a838cc', '#e08820dd', '#f06010ee', '#ff6701'];

    const sponsored = s.sponsoredStats?.sponsored || { count: 0, avgDwellMs: 0 };
    const organic = s.sponsoredStats?.organic || { count: 0, avgDwellMs: 0 };
    const dwellDiff = organic.avgDwellMs > 0 ? Math.round(((organic.avgDwellMs - sponsored.avgDwellMs) / sponsored.avgDwellMs) * 100) : 0;
    const timeRatioPct = sponsored.avgDwellMs > 0 ? Math.round((sponsored.avgDwellMs / organic.avgDwellMs) * 100) : 0;

    return html`
    <div class="slide" style="background:#8ee88e;color:#1e1e1e;">
      ${this.xBtn()}

      <!-- Title -->
      <p class="abs cx f-jaldi" style="top:${y(56)};font-size:${vw(34)};text-align:center;width:86%;line-height:0.94;">
        Tu passes moins de temps sur les contenus sponsorisés</p>

      <!-- Stats boxes (top of slide) -->
      ${sponsored.count > 0 ? html`
        <div style="position:absolute;top:${y(160)};left:${x(20)};right:${x(20)};display:flex;gap:12px;z-index:1;">
          <div style="flex:1;background:rgba(0,0,0,0.1);border-radius:20px;padding:20px;text-align:center;">
            <div class="f-jaldi" style="font-size:${vw(14)};color:#666;margin-bottom:8px;">Pubs vues</div>
            <div class="f-averia" style="font-size:${vw(40)};line-height:0.9;">${sponsored.count}</div>
          </div>
          <div style="flex:1;background:rgba(0,0,0,0.1);border-radius:20px;padding:20px;text-align:center;">
            <div class="f-jaldi" style="font-size:${vw(14)};color:#666;margin-bottom:8px;">Temps moyen</div>
            <div class="f-averia" style="font-size:${vw(40)};line-height:0.9;">${formatDwellShort(sponsored.avgDwellMs)}</div>
          </div>
        </div>

        <div style="position:absolute;top:${y(260)};left:${x(20)};right:${x(20)};background:rgba(0,0,0,0.12);border-radius:20px;padding:16px 14px;text-align:center;z-index:1;">
          <p class="f-jaldi" style="font-size:${vw(16)};line-height:1.2;">
            ${dwellDiff}% moins de temps qu'en organique<br/>
            <span style="font-size:${vw(13)};opacity:0.7;">${formatDwellShort(organic.avgDwellMs)} vs ${formatDwellShort(sponsored.avgDwellMs)}</span>
          </p>
        </div>
      ` : nothing}

      <!-- Circle grid bottom -->
      <div style="position:absolute;bottom:0;left:0;right:0;height:${sponsored.count > 0 ? '50%' : '65%'};overflow:hidden;">
        ${Array.from({ length: rows * cols }, (_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const c = colors[Math.min(colors.length - 1, row)];
          return html`<div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;
            background:${c};left:${col * (size + 1)}px;top:${row * (size + 1)}px;"></div>`;
        })}
      </div>

      ${this.navDots(7)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  DATA SLIDE — Narratives (inserted after slide 08)
  //  bg: #1e1e1e (dark) — narrative chips
  // ════════════════════════════════════════════════════════════
  private sNarratives(s: DbStats) {
    const allNarratives = s.topNarratives || [];
    const narratives = allNarratives.filter(n => NARRATIVE_META[n.narrative]);
    const maxCount = narratives[0]?.count || 1;

    return html`
    <div class="slide" style="background:#1e1e1e;color:#eeebdf;">
      ${this.xBtn(true)}

      <div style="padding:${y(60)} 20px ${y(80)};display:flex;flex-direction:column;">
        <div style="flex-shrink:0;">
          <p class="f-averia" style="font-size:${vw(48)};line-height:0.95;margin-bottom:12px;">
            Les histoires que ton feed te raconte</p>
          <p class="f-jaldi" style="font-size:${vw(18)};color:#888;margin-bottom:28px;">
            Chaque contenu porte un cadre narratif.</p>
        </div>

        <div style="flex:1;overflow-y:auto;display:flex;align-items:center;justify-content:center;">
          ${narratives.length === 0 ? html`
            <p class="f-averia" style="font-size:${vw(28)};text-align:center;line-height:1.3;color:#eeebdf;">Ton feed ne suit aucun récit dominant. C'est plutôt rare !</p>
          ` : html`<div style="width:100%;">
            ${narratives.slice(0, 3).map(n => {
            const meta = NARRATIVE_META[n.narrative] || { color: palette.bleuIndigo, icon: '', label: n.narrative.replace(/_/g, ' ') };
            const w = Math.round((n.count / maxCount) * 100);
            return html`
              <div class="narr-chip" style="background:${meta.color}22;">
                <div class="narr-icon" style="background:${meta.color};color:white;">${svgIcon(meta.icon, 28, 'white')}</div>
                <div style="flex:1;min-width:0;">
                  <div class="f-averia" style="font-size:${vw(22)};color:${meta.color};font-weight:700;">${meta.label}</div>
                  <div class="f-jaldi" style="font-size:${vw(16)};color:${meta.color}88;margin-bottom:8px;">${n.count} posts</div>
                  <div class="narr-bar"><div class="narr-fill bar-grow" style="width:${w}%;background:${meta.color};"></div></div>
                </div>
              </div>`;
            })}
          </div>`}
        </div>
      </div>

      ${this.navDots(8, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  DATA SLIDE — Emotions
  //  bg: #ff6701 — emotion bubbles proportional
  // ════════════════════════════════════════════════════════════
  private sEmotions(s: DbStats) {
    const emotions = s.topEmotions || [];
    const maxCount = emotions[0]?.count || 1;

    // Scatter positions for up to 6 emotion bubbles
    const positions = [
      { cx: 50, cy: 35, maxSize: 200 },
      { cx: 18, cy: 58, maxSize: 150 },
      { cx: 78, cy: 58, maxSize: 140 },
      { cx: 38, cy: 75, maxSize: 120 },
      { cx: 70, cy: 82, maxSize: 100 },
      { cx: 22, cy: 85, maxSize: 90 },
    ];

    return html`
    <div class="slide" style="background:#ff6701;color:#eeebdf;">
      ${this.xBtn(true)}

      <p class="abs cx f-averia" style="top:${y(60)};font-size:${vw(48)};text-align:center;width:90%;line-height:0.95;">
        Ce que ton feed te fait ressentir</p>

      ${emotions.length === 0 ? html`
        <p class="abs cx f-jaldi" style="top:50%;font-size:${vw(22)};text-align:center;color:rgba(255,255,255,0.6);">
          Pas encore de données émotionnelles.</p>
      ` : emotions.slice(0, 6).map((e, i) => {
        const meta = EMOTION_META[e.emotion] || { color: '#ccc', label: e.emotion };
        const pos = positions[i];
        const ratio = e.count / maxCount;
        const size = Math.max(80, ratio * pos.maxSize);
        return html`
          <div class="abs bubble-in" style="left:${pos.cx}%;top:${pos.cy}%;transform:translate(-50%,-50%);
            width:${size}px;height:${size}px;border-radius:50%;background:${meta.color};
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            box-shadow:0 4px 20px ${meta.color}66;padding:8px;--d:${i * 120}ms;">
            <span class="f-averia" style="font-size:${Math.max(14, size / 4.5)}px;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.3);font-weight:700;text-align:center;line-height:1.1;">${meta.label}</span>
            <span class="f-averia" style="font-size:${Math.max(12, size / 5.5)}px;color:rgba(255,255,255,0.9);margin-top:2px;font-weight:700;">${e.count}</span>
          </div>`;
      })}

      ${this.navDots(9, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  DATA SLIDE — Political Compass
  //  bg: #9948d3 — axes + dot
  // ════════════════════════════════════════════════════════════
  private sCompass(s: DbStats) {
    const axes = s.axes || { economic: 0, societal: 0, authority: 0, system: 0 };
    const cx = 50 + (axes.economic * 40);
    const cy = 50 - (axes.societal * 40);

    const quadrant = axes.economic >= 0
      ? (axes.societal >= 0 ? 'Libéral-Marché' : 'Conservateur-Marché')
      : (axes.societal >= 0 ? 'Libéral-Social' : 'Conservateur-Social');

    return html`
    <div class="slide" style="background:#9948d3;color:#eeebdf;">
      ${this.xBtn(true)}

      <div style="padding:${y(60)} 20px 0;display:flex;flex-direction:column;height:100%;">
        <div style="flex-shrink:0;margin-bottom:20px;">
          <p class="f-averia" style="font-size:${vw(48)};line-height:0.95;text-align:center;margin-bottom:12px;">
            Où se situe ton feed ?</p>
          <p class="f-jaldi" style="font-size:${vw(18)};text-align:center;color:rgba(255,255,255,0.6);">
            Position moyenne sur les axes économique et sociétal</p>
        </div>

        <div style="flex:1;display:flex;align-items:center;justify-content:center;">
          <div class="compass-box">
            <div class="compass-axis h"></div>
            <div class="compass-axis v"></div>
            <div class="compass-qlabel" style="top:6px;left:0;">Libéral Social</div>
            <div class="compass-qlabel" style="top:6px;right:0;">Libéral Marché</div>
            <div class="compass-qlabel" style="bottom:6px;left:0;">Conserv. Social</div>
            <div class="compass-qlabel" style="bottom:6px;right:0;">Conserv. Marché</div>
            <div class="compass-dot compass-bounce" style="left:${cx}%;top:${cy}%;width:24px;height:24px;"></div>
            <div class="abs" style="left:${cx}%;top:${cy}%;width:40px;height:40px;border-radius:50%;
              border:2px solid rgba(238,235,223,0.3);transform:translate(-50%,-50%);"></div>
          </div>
        </div>

        <div style="padding:20px;text-align:center;margin-top:auto;">
          <p class="f-averia" style="font-size:${vw(36)};margin-bottom:12px;font-weight:700;">${quadrant}</p>
          <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
            <span class="f-jaldi" style="font-size:${vw(18)};color:rgba(255,255,255,0.8);">
              Éco: ${axes.economic >= 0 ? '+' : ''}${axes.economic.toFixed(2)}</span>
            <span class="f-jaldi" style="font-size:${vw(18)};color:rgba(255,255,255,0.8);">
              Soc: ${axes.societal >= 0 ? '+' : ''}${axes.societal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      ${this.navDots(10, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  NEW DATA SLIDE — Accounts "Qui influence ton feed ?"
  //  bg: #1e1e1e (dark) — top users + polarizing accounts
  // ════════════════════════════════════════════════════════════
  private sAccounts(s: DbStats) {
    const topUsers = (s.topUsers || []).slice(0, 3);
    const polarizing = (s.polarizingAccounts || []).slice(0, 1);

    return html`
    <div class="slide" style="background:#1e1e1e;color:#eeebdf;">
      ${this.xBtn(true)}

      <div class="slide-scroll">
        <div style="padding:${y(60)} 20px ${y(80)};">
          <p class="f-averia" style="font-size:${vw(48)};line-height:0.95;margin-bottom:12px;">
            Qui influence ton feed ?</p>
          <p class="f-jaldi" style="font-size:${vw(18)};color:#888;margin-bottom:28px;">
            Les comptes les plus vus</p>

          ${topUsers.map((u, i) => html`
            <div style="background:#2a2a2a;border-radius:20px;padding:20px;margin-bottom:16px;display:flex;align-items:center;gap:16px;">
              <div style="width:40px;height:40px;border-radius:50%;background:${['#9ddfff','#ff6701','#8ee88e'][i]};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <span class="f-averia" style="font-size:${vw(20)};color:#1e1e1e;font-weight:700;">#${i + 1}</span>
              </div>
              <div style="flex:1;">
                <div class="f-averia" style="font-size:${vw(24)};font-weight:700;margin-bottom:4px;">@${u.username}</div>
                <div class="f-jaldi" style="font-size:${vw(16)};color:#888;">${u.count} posts • ${formatDwellShort(u.totalDwellMs)}</div>
              </div>
            </div>
          `)}

          ${polarizing.length > 0 ? html`
            <div style="margin-top:32px;">
              <p class="f-averia" style="font-size:${vw(28)};font-weight:700;margin-bottom:16px;">
                Le plus polarisant</p>

              ${polarizing.map(p => {
                const barWidth = Math.round(p.avgPolarization * 100);
                return html`
                  <div style="background:rgba(255,107,1,0.15);border-radius:20px;padding:24px;border-left:4px solid #ff6701;">
                    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px;">
                      <div class="f-averia" style="font-size:${vw(22)};font-weight:700;color:#eeebdf;">@${p.username}</div>
                      <div class="f-averia" style="font-size:${vw(48)};font-weight:700;color:#ff6701;">${Math.round(p.avgPolarization * 100)}%</div>
                    </div>
                    <div style="width:100%;height:10px;background:rgba(0,0,0,0.2);border-radius:5px;overflow:hidden;">
                      <div style="height:100%;width:${barWidth}%;background:#ff6701;"></div>
                    </div>
                  </div>
                `;
              })}
            </div>
          ` : nothing}
        </div>
      </div>

      ${this.navDots(11, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  NEW DATA SLIDE — Media Types "Reels, photos ou carrousels ?"
  //  bg: #9ddfff (blue) — media type cards + dwell comparison
  // ════════════════════════════════════════════════════════════
  private sMediaTypes(s: DbStats) {
    const types = s.mediaTypes || [];
    if (types.length === 0) {
      return html`
      <div class="slide" style="background:#9ddfff;color:#1e1e1e;">
        ${this.xBtn()}
        <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:40px;">
          <p class="f-jaldi" style="font-size:${vw(22)};text-align:center;">
            Pas encore de données sur les formats.</p>
        </div>
        ${this.navDots(12)}
      </div>`;
    }

    const total = types.reduce((a, t) => a + t.count, 0);
    const avgsByType = types.map(t => ({ ...t, avgDwell: Math.round(t.totalDwellMs / t.count) }));
    const maxAvgDwell = Math.max(...avgsByType.map(t => t.avgDwell));
    const topType = avgsByType.reduce((a, b) => a.avgDwell > b.avgDwell ? a : b);
    const topTypeIndex = types.findIndex(t => t.type === topType.type);
    const secondType = avgsByType.find((_, i) => i !== topTypeIndex);
    const comparison = secondType ? Math.round(((topType.avgDwell - secondType.avgDwell) / secondType.avgDwell) * 100) : 0;

    const mediaTypeTints: Record<string, string> = {
      'reel': 'rgba(140,67,233,0.1)',
      'image': 'rgba(142,232,142,0.1)',
      'carousel': 'rgba(255,103,1,0.1)',
      'video': 'rgba(0,0,0,0.05)',
      'story_video': 'rgba(0,0,0,0.05)',
      'story': 'rgba(0,0,0,0.05)',
    };

    return html`
    <div class="slide" style="background:#9ddfff;color:#1e1e1e;">
      ${this.xBtn()}

      <div class="slide-scroll">
        <div style="padding:${y(60)} 20px ${y(80)};">
          <p class="f-averia" style="font-size:${vw(48)};line-height:0.95;margin-bottom:12px;">
            Reels, photos ou carrousels ?</p>
          <p class="f-jaldi" style="font-size:${vw(18)};color:#555;margin-bottom:28px;">
            Temps moyen par format</p>

          <div style="display:flex;flex-direction:column;gap:16px;">
            ${types.slice(0, 3).map(t => {
              const avgDwell = Math.round(t.totalDwellMs / t.count);
              const typeLabel = mediaTypeLabel(t.type);
              const colors = ['#8c43e9', '#ff6701', '#8ee88e'];
              const tint = mediaTypeTints[t.type] || mediaTypeTints['video'];
              return html`
                <div style="background:${tint};border-radius:20px;padding:24px;text-align:center;border:2px solid ${colors[types.indexOf(t)] || '#8c43e9'}44;">
                  <div class="f-averia" style="font-size:${vw(36)};font-weight:700;margin-bottom:8px;color:#1e1e1e;">${formatDwellShort(avgDwell)}</div>
                  <div class="f-jaldi" style="font-size:${vw(18)};color:#333;">${typeLabel}</div>
                </div>
              `;
            })}
          </div>

          ${comparison !== 0 ? html`
            <div style="background:rgba(255,107,1,0.2);border-radius:20px;padding:20px;margin-top:28px;border-left:4px solid #ff6701;text-align:center;">
              <p class="f-averia" style="font-size:${vw(24)};font-weight:700;color:#1e1e1e;">
                Les ${mediaTypeLabel(topType.type)}<br/>te retiennent<br/><span style="font-size:${vw(40)};color:#ff6701;">${comparison}% plus longtemps</span></p>
            </div>
          ` : nothing}
        </div>
      </div>

      ${this.navDots(12)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  NEW DATA SLIDE — Signals "Les signaux cachés"
  //  bg: #ff6701 (orange) — persuasion signals breakdown
  // ════════════════════════════════════════════════════════════
  private sSignals(s: DbStats) {
    const signals = s.signals || { activism: 0, conflict: 0, moralAbsolute: 0, enemyDesignation: 0, ingroupOutgroup: 0, total: 0 };
    const signalLabels: Record<string, string> = {
      activism: 'Activisme',
      conflict: 'Conflit',
      moralAbsolute: 'Morale absolue',
      enemyDesignation: 'Désignation d\'ennemi',
      ingroupOutgroup: 'Nous vs Eux',
    };

    const signalList = [
      { key: 'activism', count: signals.activism },
      { key: 'conflict', count: signals.conflict },
      { key: 'moralAbsolute', count: signals.moralAbsolute },
      { key: 'enemyDesignation', count: signals.enemyDesignation },
      { key: 'ingroupOutgroup', count: signals.ingroupOutgroup },
    ].filter(s => s.count > 0);

    const realTotal = signalList.reduce((a, s) => a + s.count, 0);
    const maxSignalCount = signalList.length > 0 ? Math.max(...signalList.map(s => s.count)) : 1;

    return html`
    <div class="slide" style="background:#ff6701;color:#eeebdf;">
      ${this.xBtn(true)}

      <div class="slide-scroll">
        <div style="padding:${y(60)} 20px ${y(80)};">
          <div style="text-align:center;margin-bottom:32px;">
            <p class="f-averia anim-scale" style="font-size:${vw(80)};line-height:0.9;margin-bottom:8px;">
              <span data-countup="${realTotal}"></span></p>
            <p class="f-averia" style="font-size:${vw(28)};line-height:0.95;">Les signaux cachés</p>
            <p class="f-jaldi" style="font-size:${vw(16)};color:rgba(255,255,255,0.7);margin-top:8px;">
              ${realTotal === 0 ? 'Aucun signal détecté' : 'Tactiques de persuasion détectées'}</p>
          </div>

          ${signalList.length > 0 ? signalList.slice(0, 3).map(sig => {
            const barWidth = (sig.count / maxSignalCount) * 100;
            return html`
              <div style="margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <div class="f-averia" style="font-size:${vw(20)};font-weight:700;">${signalLabels[sig.key]}</div>
                  <div class="f-averia" style="font-size:${vw(32)};font-weight:700;color:#1e1e1e;">${sig.count}</div>
                </div>
                <div style="width:100%;height:10px;background:rgba(0,0,0,0.2);border-radius:5px;overflow:hidden;">
                  <div class="bar-grow" style="height:100%;width:${barWidth}%;background:#1e1e1e;"></div>
                </div>
              </div>
            `;
          }) : html`
            <div style="text-align:center;padding:20px;">
              <p class="f-jaldi" style="font-size:${vw(18)};color:rgba(255,255,255,0.6);">
                Aucun signal détecté sur ce feed</p>
            </div>
          `}
        </div>
      </div>

      ${this.navDots(13, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  NEW DATA SLIDE — Attention vs Political "Ton attention politique"
  //  bg: #9948d3 (violet) — attention levels political breakdown
  // ════════════════════════════════════════════════════════════
  private sAttentionPol(s: DbStats) {
    const attentionMap = s.attentionPolitical || {};
    const levels = ['skipped', 'glanced', 'viewed', 'engaged'];
    const levelLabels: Record<string, string> = {
      skipped: 'Scrollés',
      glanced: 'Aperçus',
      viewed: 'Consultés',
      engaged: 'Engagés',
    };
    const levelColors: Record<string, string> = {
      skipped: '#95A5A6',
      glanced: '#f5f44c',
      viewed: '#9ddfff',
      engaged: '#8ee88e',
    };

    const data = levels.map(level => ({
      level,
      label: levelLabels[level],
      color: levelColors[level],
      stats: attentionMap[level] || { avgPolitical: 0, avgPolarization: 0, count: 0 },
    }));

    const maxPolitical = Math.max(0.2, ...data.map(d => d.stats.avgPolitical)); // Relative scale with floor
    const engagedData = data.find(d => d.level === 'engaged');
    const skippedData = data.find(d => d.level === 'skipped');
    const comparison = engagedData && skippedData && skippedData.stats.avgPolitical > 0
      ? Math.round(((engagedData.stats.avgPolitical - skippedData.stats.avgPolitical) / skippedData.stats.avgPolitical) * 100)
      : 0;

    return html`
    <div class="slide" style="background:#9948d3;color:#eeebdf;">
      ${this.xBtn(true)}

      <div class="slide-scroll">
        <div style="padding:${y(60)} 20px ${y(80)};">
          <p class="f-averia" style="font-size:${vw(48)};line-height:0.95;margin-bottom:12px;">
            Ton attention politique</p>
          <p class="f-jaldi" style="font-size:${vw(18)};color:rgba(255,255,255,0.6);margin-bottom:28px;">
            Comment tu interagis selon le contexte</p>

          ${data.map(d => {
            const rawBarWidth = (d.stats.avgPolitical / maxPolitical) * 100;
            const barWidth = Math.max(5, rawBarWidth);
            return html`
              <div style="margin-bottom:24px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                  <div class="f-averia" style="font-size:${vw(20)};font-weight:700;">${d.label}</div>
                  <div class="f-averia" style="font-size:${vw(32)};color:${d.color};font-weight:700;">
                    ${d.stats.avgPolitical.toFixed(2)}</div>
                </div>
                <div style="width:100%;height:10px;background:rgba(255,255,255,0.15);border-radius:5px;overflow:hidden;">
                  <div class="bar-grow" style="height:100%;width:${barWidth}%;background:${d.color};"></div>
                </div>
                <div class="f-jaldi" style="font-size:${vw(14)};color:rgba(255,255,255,0.6);margin-top:6px;">
                  ${d.stats.count} contenus</div>
              </div>
            `;
          })}

          ${comparison !== 0 ? html`
            <div style="background:rgba(238,235,223,0.15);border-radius:20px;padding:24px;margin-top:28px;border-left:4px solid #eeebdf;text-align:center;">
              <p class="f-averia" style="font-size:${vw(24)};font-weight:700;color:#eeebdf;line-height:1.3;">
                Quand tu t'arrêtes vraiment<br/><span style="font-size:${vw(40)};">${comparison}%</span><br/>plus politique</p>
            </div>
          ` : nothing}
        </div>
      </div>

      ${this.navDots(14, true)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 09 — "Vous êtes : [profil]"
  //  bg: #eeebdf — wavy red rings + mascotte
  // ════════════════════════════════════════════════════════════
  private s09(s: DbStats) {
    const profile = getUserProfile(s);

    return html`
    <div class="slide" style="background:#eeebdf;color:#1e1e1e;">
      ${this.xBtn()}

      <div style="display:flex;flex-direction:column;align-items:center;height:100%;padding:0 20px;">
        <p class="f-averia anim" style="font-size:${vw(44)};margin-top:${y(77)};margin-bottom:0;">Vous êtes</p>

        <!-- Mascotte + stars + circle from Figma assets -->
        <div style="position:relative;width:${x(293)};aspect-ratio:293/309;margin-top:4px;display:flex;align-items:center;justify-content:center;">
          <!-- Outer wavy star -->
          <img class="asset star-wobble" src="assets/wrapped/s09-star-outer.svg" style="position:absolute;inset:0;width:100%;height:100%;" alt=""/>
          <!-- Inner star -->
          <img class="asset" src="assets/wrapped/s09-star-inner.svg" style="position:absolute;inset:0;width:100%;height:100%;" alt=""/>
          <!-- Pink circle background -->
          <img class="asset" src="assets/wrapped/s09-circle-pink.svg" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${x(274)};height:${x(274)};" alt=""/>
          <!-- Mascotte SVG -->
          <img class="asset" src="assets/wrapped/s09-mascotte.svg" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:80%;height:80%;" alt=""/>
        </div>

        <div style="margin-top:auto;margin-bottom:${y(100)};text-align:center;">
          <p class="f-averia anim-scale" style="font-size:${vw(44)};--d:400ms;">${profile.name}</p>
          <p class="f-jaldi" style="font-size:${vw(16)};margin-top:8px;line-height:1.2;padding:0 20px;">
            ${profile.description}</p>
        </div>
      </div>

      ${this.navDots(15)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  DATA SLIDE — Records (fun scroll stats)
  //  bg: #8ee88e
  // ════════════════════════════════════════════════════════════
  private sRecords(s: DbStats) {
    const scrollMeters = s.totalPosts * 0.15;
    const distanceText = scrollMeters >= 1000 ? `${(scrollMeters / 1000).toFixed(1)} km` : `${Math.round(scrollMeters)} m`;
    const totalMin = Math.round((s.totalDwellMs || 0) / 60000);
    const timeText = totalMin >= 60 ? formatDwell(s.totalDwellMs) : `${totalMin} min`;
    const postsPerSession = s.totalSessions > 0 ? Math.round(s.totalPosts / s.totalSessions) : s.totalPosts;

    const distanceMetaphor = scrollMeters < 50 ? 'une piscine olympique'
      : scrollMeters < 100 ? 'un terrain de foot'
      : scrollMeters < 324 ? 'bientôt la Tour Eiffel'
      : scrollMeters < 1000 ? 'la Tour Eiffel, dépassée.'
      : 'plus loin qu\'un jogging';

    return html`
    <div class="slide" style="background:#8ee88e;color:#1e1e1e;">
      ${this.xBtn()}

      <div style="display:flex;flex-direction:column;height:100%;padding:${y(60)} 20px ${y(80)};">
        <p class="f-averia" style="font-size:${vw(48)};line-height:0.95;text-align:center;margin-bottom:20px;">Tes records</p>

        <!-- Big distance stat -->
        <div style="background:#1e1e1e;border-radius:24px;padding:32px;margin-bottom:24px;color:#eeebdf;text-align:center;">
          <p class="f-averia" style="font-size:${vw(100)};line-height:0.9;margin-bottom:8px;">${distanceText}</p>
          <p class="f-averia" style="font-size:${vw(20)};color:#aaa;">scrollés</p>
          <p class="f-jaldi" style="font-size:${vw(18)};color:rgba(255,255,255,0.6);margin-top:8px;">→ ${distanceMetaphor}</p>
        </div>

        <div style="display:flex;gap:12px;">
          <div style="flex:1;background:rgba(0,0,0,0.08);border-radius:20px;padding:20px;text-align:center;">
            <p class="f-averia" style="font-size:${vw(56)};font-weight:700;line-height:0.95;">${s.totalPosts}</p>
            <p class="f-jaldi" style="font-size:${vw(16)};margin-top:6px;">contenus</p>
          </div>
          <div style="flex:1;background:rgba(0,0,0,0.08);border-radius:20px;padding:20px;text-align:center;">
            <p class="f-averia" style="font-size:${vw(56)};font-weight:700;line-height:0.95;">${postsPerSession}</p>
            <p class="f-jaldi" style="font-size:${vw(16)};margin-top:6px;">par session</p>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:12px;">
          <div style="flex:1;background:rgba(0,0,0,0.08);border-radius:20px;padding:20px;text-align:center;">
            <p class="f-averia" style="font-size:${vw(48)};font-weight:700;line-height:0.95;">${timeText}</p>
            <p class="f-jaldi" style="font-size:${vw(14)};margin-top:6px;">en scroll</p>
          </div>
          <div style="flex:1;background:rgba(0,0,0,0.08);border-radius:20px;padding:20px;text-align:center;">
            <p class="f-averia" style="font-size:${vw(48)};font-weight:700;line-height:0.95;">${s.totalSessions}</p>
            <p class="f-jaldi" style="font-size:${vw(14)};margin-top:6px;">sessions</p>
          </div>
        </div>

        <div style="margin-top:auto;"></div>
      </div>

      ${this.navDots(16)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 10 — Recap
  //  bg: #eeebdf — mascotte + 7 colored rows + CTA
  // ════════════════════════════════════════════════════════════
  private s10(s: DbStats) {
    const top = this.topDomain;
    const domains = s.topDomains || [];
    const total = domains.reduce((a, d) => a + d.count, 0);
    const topUser = s.topUsers?.[0];
    const topMediaType = s.mediaTypes ? s.mediaTypes.reduce((a, b) => a.count > b.count ? a : b) : null;

    const rows: Array<{ pct: string; label: string; desc: string; bg: string }> = [
      { pct: `${top.pct}%`, label: domainLabel(top.domain), desc: 'Domaine dominant', bg: 'rgba(245,244,76,0.15)' },
      { pct: `${this.confirmationScore}%`, label: 'Bulle de filtre', desc: 'Confirmation des opinions', bg: 'rgba(140,67,233,0.2)' },
      { pct: `${this.emotionIntensityPct || 0}%`, label: 'Émotions fortes', desc: 'Contenus émotionnels intenses', bg: 'rgba(255,103,1,0.2)' },
      { pct: `${this.skipRate}%`, label: 'Contenus zappés', desc: 'Scrollés sans regarder', bg: 'rgba(245,244,76,0.1)' },
      { pct: `${this.politicalPct}%`, label: 'Politique', desc: 'Contenus politiquement marqués', bg: 'rgba(245,244,76,0.1)' },
      { pct: `${Math.round(this.avgPolarization * 100)}%`, label: 'Polarisation', desc: 'Intensité moyenne', bg: 'rgba(245,244,76,0.1)' },
      ...(topUser ? [{ pct: `${topUser.count}`, label: `@${topUser.username}`, desc: 'Compte dominant', bg: 'rgba(142,232,142,0.15)' }] : []),
    ].filter(r => r.pct !== '0%' && r.pct !== '0').slice(0, 7);

    return html`
    <div class="slide" style="background:#eeebdf;color:#1e1e1e;">
      ${this.xBtn()}
      <div class="slide-scroll">
        <div style="padding:${y(40)} 0 80px;">
          <p class="f-averia" style="font-size:${vw(44)};text-align:center;">Recap</p>

          <!-- Small mascotte with circle from Figma assets -->
          <div style="position:relative;width:${x(193)};aspect-ratio:193/203;margin:16px auto;display:flex;align-items:center;justify-content:center;">
            <img class="asset" src="assets/wrapped/s10-circle-pink.svg" style="position:absolute;inset:0;width:100%;height:100%;" alt=""/>
            <img class="asset" src="assets/wrapped/s10-mascotte.svg" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:85%;height:85%;" alt=""/>
          </div>

          ${rows.map((r, i) => html`
            <div class="recap-row anim" style="background:${r.bg};--d:${200 + i * 100}ms;">
              <div class="recap-pct">${r.pct}</div>
              <div>
                <div class="recap-lbl">${r.label}</div>
                <div class="recap-desc">${r.desc}</div>
              </div>
            </div>`)}

          <button class="cta" style="margin-top:20px;" @click=${() => this.go(18)}>Continuer</button>
        </div>
      </div>
      ${this.navDots(17)}
    </div>`;
  }

  // ════════════════════════════════════════════════════════════
  //  SLIDE 11 — "On continue ?"
  //  bg: #8c43e9 — 2 choice cards + CTA
  // ════════════════════════════════════════════════════════════
  private s11(_s: DbStats) {
    return html`
    <div class="slide" style="background:#8c43e9;color:#eeebdf;">
      ${this.xBtn(true)}

      <!-- Background circles -->
      <div class="abs" style="width:350px;height:350px;border-radius:50%;background:rgba(200,100,240,0.15);left:-40%;bottom:-5%;"></div>
      <div class="abs" style="width:150px;height:150px;border-radius:50%;background:rgba(200,100,240,0.12);right:0;top:60%;"></div>
      ${Array.from({ length: 15 }, (_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        return html`<div class="abs" style="width:60px;height:60px;border-radius:50%;background:rgba(200,150,255,0.1);
          left:${col * 68 + 20}px;bottom:${row * 68 + 10}px;"></div>`;
      })}

      <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;height:100%;padding:0 0 ${y(60)};">
        <p class="f-averia" style="font-size:${vw(44)};color:#9ee8d9;margin-top:${y(102)};">On continue ?</p>

        <div class="choice-row" style="margin-top:${y(50)};">
          <div class="choice-card anim-scale" style="--d:200ms;">
            <div style="width:90px;height:90px;display:flex;align-items:center;justify-content:center;">
              <img class="asset" src="assets/wrapped/s11-star.svg" style="width:${x(110)};height:${x(110)};" alt=""/>
            </div>
            <div class="choice-lbl">Élargit ton feed</div>
          </div>
          <div class="choice-card anim-scale" style="--d:400ms;">
            <div style="width:90px;height:90px;display:flex;align-items:center;justify-content:center;">
              <img class="asset" src="assets/wrapped/s11-loupe.svg" style="width:${x(127)};height:${x(127)};" alt=""/>
            </div>
            <div class="choice-lbl">Creuse ce qui t'intéresse</div>
          </div>
        </div>

        <div style="margin-top:auto;">
          <button class="cta" @click=${this.close}>Terminer</button>
          <button style="background:none;border:none;color:rgba(255,255,255,0.5);font-family:'Jaldi',sans-serif;
            font-size:${vw(16)};cursor:pointer;padding:8px 16px;display:block;margin:8px auto 0;"
            @click=${this.shareWrapped}>Partager mon Wrapped</button>
        </div>
      </div>

      ${this.navDots(18, true)}
    </div>`;
  }
}
