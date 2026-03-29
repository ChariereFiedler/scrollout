import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getStats, type DbStats } from '../services/db-bridge.js';
import { palette } from '../styles/theme.js';

// ── Constants ───────────────────────────────────────────────

const TOTAL_SLIDES = 11;

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
    culture_divertissement: 'Divertissement',
    lifestyle_bienetre: 'Lifestyle',
    politique_societe: 'Politique',
    information_savoirs: 'Infos',
    ecologie_environnement: 'Ecologie',
    economie_travail: 'Economie',
    sport: 'Sport',
    technologie: 'Tech',
  };
  return map[d] || d;
}

function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}

/** Determine user profile archetype based on feed composition */
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

// ── Mascotte SVG ────────────────────────────────────────────

const MASCOTTE_SVG = `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="90" fill="#F5C6C0"/>
  <ellipse cx="75" cy="90" rx="35" ry="45" fill="#E8A89E"/>
  <ellipse cx="145" cy="110" rx="28" ry="36" fill="#E8A89E"/>
  <!-- Big face -->
  <path d="M55 85 Q60 78, 68 82" stroke="#333" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="M78 85 Q83 78, 91 82" stroke="#333" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="M62 98 Q72 94, 82 98" stroke="#333" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <!-- Small face -->
  <circle cx="135" cy="105" r="3.5" fill="#333"/>
  <circle cx="155" cy="105" r="3.5" fill="#333"/>
  <path d="M133 118 Q145 125, 157 118" stroke="#333" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`;

// ── Component ───────────────────────────────────────────────

@customElement('screen-wrapped')
export class ScreenWrapped extends LitElement {
  static styles = css`
    @import url('https://fonts.googleapis.com/css2?family=Averia+Sans+Libre:wght@300;400;700&family=Jaldi:wght@400;700&display=swap');

    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

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
      overflow: hidden;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .slide-scroll {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    /* ── Typography ── */
    .font-averia { font-family: 'Averia Sans Libre', serif; font-weight: 700; }
    .font-jaldi { font-family: 'Jaldi', sans-serif; font-weight: 700; }

    .big-number {
      font-family: 'Averia Sans Libre', serif;
      font-weight: 700;
      font-size: 120px;
      line-height: 1;
      letter-spacing: -2px;
    }

    .big-title {
      font-family: 'Jaldi', sans-serif;
      font-weight: 700;
      font-size: 48px;
      line-height: 1;
      text-align: center;
      padding: 0 20px;
    }

    .big-label {
      font-family: 'Averia Sans Libre', serif;
      font-weight: 700;
      font-size: 44px;
      line-height: 1.1;
    }

    .sub-text {
      font-family: 'Jaldi', sans-serif;
      font-weight: 700;
      font-size: 22px;
      text-align: center;
      letter-spacing: -0.4px;
    }

    .body-text {
      font-family: 'Jaldi', sans-serif;
      font-weight: 700;
      font-size: 16px;
      line-height: 1.1;
      text-align: center;
    }

    /* ── Slide backgrounds ── */
    .bg-beige { background: #eeebdf; color: #1e1e1e; }
    .bg-orange { background: #ff6701; color: #eeebdf; }
    .bg-green { background: #8ee88e; color: #1e1e1e; }
    .bg-violet { background: #9948d3; color: #eeebdf; }
    .bg-blue { background: #9ddfff; color: #1e1e1e; }
    .bg-purple { background: #8c43e9; color: #eeebdf; }
    .bg-split-top { background: #8c43e9; }
    .bg-split-bottom { background: #f5f44c; }

    /* ── Decorative elements ── */
    .bubble-circle {
      position: absolute;
      border-radius: 50%;
      opacity: 0.5;
    }

    .arrow-shape {
      position: absolute;
      width: 0; height: 0;
    }

    .pill {
      position: absolute;
      border-radius: 40px;
      background: rgba(255, 103, 1, 0.2);
    }

    .dot-circle {
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── Navigation ── */
    .nav-dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      padding: 12px 0 max(env(safe-area-inset-bottom, 8px), 8px);
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
    }

    .nav-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(0,0,0,0.15);
      transition: all 0.3s;
    }
    .nav-dot.active {
      width: 24px;
      border-radius: 4px;
      background: rgba(0,0,0,0.5);
    }
    .light-dots .nav-dot { background: rgba(255,255,255,0.3); }
    .light-dots .nav-dot.active { background: rgba(255,255,255,0.8); }

    /* ── Close button ── */
    .close-btn {
      position: absolute;
      top: max(env(safe-area-inset-top, 12px), 12px);
      right: 14px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(0,0,0,0.08);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }
    .close-btn svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2.5; }
    .close-btn:active { opacity: 0.5; }
    .close-light { background: rgba(255,255,255,0.15); color: #eeebdf; }

    /* ── Recap card row ── */
    .recap-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 20px;
      margin: 0 12px 8px;
    }
    .recap-val {
      font-family: 'Averia Sans Libre', serif;
      font-weight: 700;
      font-size: 32px;
      min-width: 70px;
    }
    .recap-label {
      font-family: 'Jaldi', sans-serif;
      font-weight: 700;
      font-size: 16px;
      line-height: 1.2;
    }
    .recap-desc {
      font-family: 'Jaldi', sans-serif;
      font-size: 13px;
      opacity: 0.7;
    }

    /* ── CTA buttons ── */
    .cta-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      color: black;
      border: none;
      border-radius: 30px;
      padding: 16px 30px;
      font-family: 'Averia Sans Libre', serif;
      font-weight: 700;
      font-size: 36px;
      cursor: pointer;
      margin: 16px auto;
      -webkit-tap-highlight-color: transparent;
    }
    .cta-btn:active { opacity: 0.8; }

    /* ── Choice cards (slide 11) ── */
    .choice-row {
      display: flex;
      gap: 12px;
      padding: 0 12px;
    }
    .choice-card {
      flex: 1;
      background: white;
      border-radius: 40px;
      padding: 24px 16px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      min-height: 240px;
    }
    .choice-icon {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .choice-label {
      font-family: 'Jaldi', sans-serif;
      font-weight: 700;
      font-size: 16px;
      color: black;
      text-align: center;
      line-height: 1.2;
    }

    /* ── Mascotte ── */
    .mascotte {
      width: 180px;
      height: 180px;
      margin: 0 auto;
    }
    .mascotte-small {
      width: 120px;
      height: 120px;
      margin: 0 auto;
    }
    .mascotte svg { width: 100%; height: 100%; }

    /* ── Star border (slide 09) ── */
    .star-border {
      position: relative;
      width: 280px;
      height: 280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .star-border::before {
      content: '';
      position: absolute;
      inset: -20px;
      background:
        radial-gradient(circle at 50% 0%, #ff0000 6px, transparent 6px),
        radial-gradient(circle at 100% 50%, #ff0000 6px, transparent 6px),
        radial-gradient(circle at 50% 100%, #ff0000 6px, transparent 6px),
        radial-gradient(circle at 0% 50%, #ff0000 6px, transparent 6px);
      border-radius: 50%;
      border: 3px solid transparent;
      background-size: 20px 20px;
    }
    .star-ring {
      position: absolute;
      inset: -15px;
      border: 3px wavy #ff0000;
      border-radius: 50%;
    }
    .star-circle {
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: #f5c6c0;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Wavy border SVG ── */
    .wavy-ring {
      position: absolute;
      inset: -25px;
    }
    .wavy-ring svg { width: 100%; height: 100%; }

    /* ── Topic tags (slide 06) ── */
    .topic-tag {
      font-family: 'Averia Sans Libre', serif;
      font-weight: 400;
      font-size: 20px;
      position: absolute;
      white-space: nowrap;
    }
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
    const total = this.stats!.topDomains.reduce((a, x) => a + x.count, 0);
    return { ...d, pct: pct(d.count, total) };
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

  /** % of posts with strong emotions (anger, fear, disgust, contempt) */
  private get emotionIntensityPct(): number {
    const emo = this.stats?.topEmotions;
    if (!emo || emo.length === 0) return 0;
    const total = emo.reduce((a, e) => a + e.count, 0);
    const strong = emo
      .filter(e => ['anger', 'fear', 'disgust', 'contempt', 'sadness', 'surprise'].includes(e.emotion))
      .reduce((a, e) => a + e.count, 0);
    return pct(strong, total);
  }

  /** Bubble/confirmation score: top 2 domains concentration */
  private get confirmationScore(): number {
    const domains = this.stats?.topDomains || [];
    const total = domains.reduce((a, d) => a + d.count, 0);
    const top2 = domains.slice(0, 2).reduce((a, d) => a + d.count, 0);
    return pct(top2, total);
  }

  /** How many posts out of 10 reinforce existing views */
  private get reinforcementRatio(): number {
    return Math.min(10, Math.round(this.confirmationScore / 10));
  }

  /** Skip rate */
  private get skipRate(): number {
    const attn = this.stats?.attention || {};
    const skipped = attn['skipped'] || 0;
    return pct(skipped, this.totalPosts);
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
    const profile = getUserProfile(s);
    const text = [
      `Mon Scrollout Wrapped 2026`,
      `Profil : ${profile.name}`,
      `${this.topDomain.pct}% de ${domainLabel(this.topDomain.domain)}`,
      `${this.confirmationScore}% de contenus dans le même sens`,
      `${this.skipRate}% de contenus zappés`,
    ].join('\n');

    if (navigator.share) {
      try { await navigator.share({ title: 'Mon Scrollout Wrapped', text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); } catch {}
    }
  }

  render() {
    if (this.loading) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#eeebdf;font-family:'Averia Sans Libre',serif;font-size:24px;color:#1e1e1e;">Chargement...</div>`;
    }
    const s = this.stats;
    if (!s) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#eeebdf;font-family:'Averia Sans Libre',serif;font-size:20px;color:#1e1e1e;text-align:center;padding:40px;">Pas de données disponibles</div>`;
    }

    return html`
      <div class="slides"
        style="transform: translateX(-${this.currentSlide * (100 / TOTAL_SLIDES)}%)"
        @touchstart=${this.onTouchStart}
        @touchmove=${this.onTouchMove}
        @touchend=${this.onTouchEnd}
      >
        ${this.slide01(s)}
        ${this.slide02(s)}
        ${this.slide03(s)}
        ${this.slide04(s)}
        ${this.slide05(s)}
        ${this.slide06(s)}
        ${this.slide07(s)}
        ${this.slide08(s)}
        ${this.slide09(s)}
        ${this.slide10(s)}
        ${this.slide11(s)}
      </div>
    `;
  }

  private closeBtn(light = false) {
    return html`<button class="close-btn ${light ? 'close-light' : ''}" @click=${this.close}>
      <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;
  }

  private dots(slide: number, light = false) {
    return html`
      <div class="nav-dots ${light ? 'light-dots' : ''}">
        ${Array.from({ length: TOTAL_SLIDES }, (_, i) =>
          html`<div class="nav-dot ${i === slide ? 'active' : ''}" @click=${() => this.go(i)}></div>`
        )}
      </div>
    `;
  }

  // ── Slide 01: Tu t'informes moins que tu ne le penses ─────
  private slide01(s: DbStats) {
    const top = this.topDomain;
    const domains = s.topDomains || [];
    const total = domains.reduce((a, d) => a + d.count, 0);
    const secondaries = domains.slice(1, 3)
      .map(d => `${domainLabel(d.domain).toLowerCase()} ${pct(d.count, total)}%`)
      .join(' ');

    return html`
      <div class="slide bg-beige">
        ${this.closeBtn()}
        <!-- Decorative bubbles -->
        <div class="bubble-circle" style="width:300px;height:300px;background:#d8b4fe;left:10%;top:8%;opacity:0.4;"></div>
        <div class="bubble-circle" style="width:100px;height:100px;background:#d8b4fe;right:15%;top:42%;opacity:0.35;"></div>
        <div class="bubble-circle" style="width:60px;height:60px;background:#d8b4fe;right:30%;top:52%;opacity:0.3;"></div>
        <div class="bubble-circle" style="width:25px;height:25px;background:#d8b4fe;right:38%;top:60%;opacity:0.25;"></div>

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px 60px;">
          <p class="big-title" style="position:absolute;top:18%;left:50%;transform:translateX(-50%);width:85%;">Tu t'informes moins que tu ne le penses</p>

          <div style="margin-top:auto;text-align:center;">
            <p class="sub-text">Tu es exposé majoritairement à</p>
            <p class="big-number" style="margin:0;">${top.pct}%</p>
            <p class="big-label" style="text-align:center;">de ${domainLabel(top.domain).toLowerCase()}</p>
            <p class="font-jaldi" style="font-size:18px;margin-top:12px;opacity:0.6;">${secondaries}</p>
          </div>
        </div>
        ${this.dots(0)}
      </div>
    `;
  }

  // ── Slide 02: Tu es rarement confronté à une contradiction ─
  private slide02(_s: DbStats) {
    const score = this.confirmationScore;

    return html`
      <div class="slide bg-orange">
        ${this.closeBtn(true)}
        <!-- Decorative arrows (CSS triangles) -->
        <div style="position:absolute;right:-40px;top:40%;width:200px;height:160px;">
          <div style="width:0;height:0;border-top:80px solid transparent;border-bottom:80px solid transparent;border-left:160px solid rgba(255,150,50,0.6);"></div>
        </div>
        <div style="position:absolute;left:-60px;top:5%;width:150px;height:100px;transform:rotate(180deg);">
          <div style="width:0;height:0;border-top:50px solid transparent;border-bottom:50px solid transparent;border-left:120px solid rgba(255,150,50,0.5);"></div>
        </div>
        <div style="position:absolute;left:-40px;bottom:15%;width:120px;height:80px;transform:rotate(180deg);">
          <div style="width:0;height:0;border-top:40px solid transparent;border-bottom:40px solid transparent;border-left:100px solid rgba(255,150,50,0.4);"></div>
        </div>

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:60px 20px 60px;">
          <div style="text-align:center;">
            <p class="big-number" style="font-size:120px;">${score}%</p>
            <p class="big-label" style="font-size:40px;text-align:center;">des contenus</p>
            <p class="sub-text" style="font-size:26px;margin-top:4px;">vont dans le même sens</p>
          </div>

          <div style="margin-top:auto;">
            <p class="big-title" style="font-size:44px;line-height:1.1;">Tu es rarement confronté à une contradiction</p>
          </div>
        </div>
        ${this.dots(1, true)}
      </div>
    `;
  }

  // ── Slide 03: X contenus sur 10 ───────────────────────────
  private slide03(_s: DbStats) {
    const ratio = this.reinforcementRatio;

    // Generate circle grid
    const circles: Array<{ x: number; y: number; color: string; opacity: number }> = [];
    const cols = 6;
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const isHighlight = idx === Math.floor(rows * cols * 0.75); // one gold circle
        circles.push({
          x: c * 68,
          y: r * 68,
          color: isHighlight ? '#d4a76a' : '#6dcc6d',
          opacity: 0.3 + (r / rows) * 0.5,
        });
      }
    }

    return html`
      <div class="slide bg-green">
        ${this.closeBtn()}

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:20px 20px 60px;">
          <div>
            <p class="font-averia" style="font-size:200px;line-height:0.85;color:#1e1e1e;margin-top:10px;">${ratio}</p>
            <div style="margin-top:-10px;">
              <p class="big-label" style="font-size:44px;">contenus</p>
              <p class="big-label" style="font-size:44px;">sur 10</p>
            </div>
          </div>

          <p class="font-jaldi" style="font-size:20px;margin-top:40px;">renforcent ce que tu penses déjà</p>

          <!-- Circle pattern -->
          <div style="position:absolute;bottom:0;left:0;right:0;height:45%;overflow:hidden;">
            ${circles.map(c => html`
              <div class="dot-circle" style="position:absolute;width:62px;height:62px;left:${c.x}px;bottom:${c.y - 20}px;background:${c.color};opacity:${c.opacity};"></div>
            `)}
          </div>
        </div>
        ${this.dots(2)}
      </div>
    `;
  }

  // ── Slide 04: XX% jouent sur des émotions fortes ──────────
  private slide04(_s: DbStats) {
    const emoPct = this.emotionIntensityPct || 78;

    return html`
      <div class="slide bg-violet">
        ${this.closeBtn(true)}

        <!-- Concentric heart shapes via SVG -->
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <svg viewBox="0 0 400 500" style="width:140%;height:140%;opacity:0.3;" xmlns="http://www.w3.org/2000/svg">
            ${[180, 140, 100, 60].map(s => html`
              <path d="M200,${450 - s * 1.2}
                C200,${450 - s * 1.2} ${200 + s},${200 - s * 0.5} ${200 + s},${200 - s * 0.1}
                C${200 + s},${200 + s * 0.3} 200,${250 + s * 0.4} 200,${250 + s * 0.4}
                C200,${250 + s * 0.4} ${200 - s},${200 + s * 0.3} ${200 - s},${200 - s * 0.1}
                C${200 - s},${200 - s * 0.5} 200,${450 - s * 1.2} 200,${450 - s * 1.2}Z"
                fill="none" stroke="#b060e0" stroke-width="3"/>
            `)}
          </svg>
        </div>

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;padding:20px 20px 60px;">
          <div style="text-align:center;">
            <p class="big-number" style="font-size:120px;color:#eeebdf;">${emoPct}%</p>
            <p class="big-label" style="font-size:40px;text-align:center;color:#eeebdf;">des contenus</p>
            <p class="sub-text" style="color:#eeebdf;font-size:24px;margin-top:4px;">jouent sur des émotions fortes</p>
          </div>
        </div>
        ${this.dots(3, true)}
      </div>
    `;
  }

  // ── Slide 05: Ces sujets sont populaires sur Instagram ────
  private slide05(s: DbStats) {
    // Topics that exist but are weak/absent in user's feed
    const domains = s.topDomains || [];
    const present = new Set(domains.map(d => d.domain));
    const allDomains = Object.keys(DOMAIN_COLORS);
    const missing = allDomains.filter(d => !present.has(d));
    const weak = domains.filter(d => d.count <= 3).map(d => domainLabel(d.domain));
    const absentTopics = [...weak, ...missing.map(d => domainLabel(d))].slice(0, 6);

    // Blob positions
    const blobs = [
      { x: '10%', y: '8%', size: 120, color: '#c4a7f5' },
      { x: '75%', y: '2%', size: 100, color: '#c4a7f5' },
      { x: '-10%', y: '30%', size: 160, color: '#c4a7f5' },
      { x: '65%', y: '55%', size: 140, color: '#c4a7f5' },
      { x: '-8%', y: '60%', size: 130, color: '#c4a7f5' },
    ];

    return html`
      <div class="slide bg-blue">
        ${this.closeBtn()}
        <!-- Purple blobs -->
        ${blobs.map(b => html`
          <div class="bubble-circle" style="width:${b.size}px;height:${b.size}px;left:${b.x};top:${b.y};background:${b.color};opacity:0.4;"></div>
        `)}

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px 20px 60px;">
          <div style="text-align:center;margin-top:20%;">
            <p class="font-averia" style="font-size:44px;line-height:1;">Ces sujets</p>
            <p class="font-averia" style="font-size:44px;line-height:1;">sont populaires</p>
            <p class="font-averia" style="font-size:44px;line-height:1;">sur Instagram</p>
          </div>

          <!-- Show absent/weak topic cards -->
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:24px;">
            ${absentTopics.map(t => html`
              <div style="background:white;border:3px solid #9ddfff;border-radius:12px;padding:8px 14px;font-family:'Jaldi',sans-serif;font-weight:700;font-size:14px;">${t}</div>
            `)}
          </div>

          <div style="margin-top:auto;">
            <p class="font-jaldi" style="font-size:22px;text-align:center;line-height:1.2;">Mais ils n'apparaissent pas<br>dans ton feed</p>
          </div>
        </div>
        ${this.dots(4)}
      </div>
    `;
  }

  // ── Slide 06: Ce que tu vois / Ce qui t'accroche ──────────
  private slide06(s: DbStats) {
    const topics = s.topTopics || [];
    const dwellTopics = s.dwellByTopic || [];

    // "Seen" = top topics by count
    const seen = topics.slice(0, 7).map(t => t.topic);
    // "Engaged" = top topics by dwell time
    const engaged = dwellTopics
      .sort((a, b) => b.avgDwellMs - a.avgDwellMs)
      .slice(0, 7)
      .map(t => t.topic);

    // Tag positions (scattered)
    const tagPositions = [
      { x: '15%', y: '8%' }, { x: '55%', y: '12%' }, { x: '65%', y: '6%' },
      { x: '5%', y: '16%' }, { x: '35%', y: '20%' }, { x: '60%', y: '22%' },
      { x: '10%', y: '30%' },
    ];

    return html`
      <div class="slide" style="background:#8c43e9;">
        ${this.closeBtn(true)}

        <!-- Organic blob shapes -->
        <div style="position:absolute;left:-60px;top:-40px;width:250px;height:300px;background:#7030c0;border-radius:40% 60% 70% 30%;opacity:0.5;transform:rotate(-15deg);"></div>
        <div style="position:absolute;right:-80px;top:20%;width:200px;height:250px;background:#7030c0;border-radius:60% 40% 30% 70%;opacity:0.4;"></div>
        <div style="position:absolute;left:-40px;bottom:15%;width:280px;height:200px;background:#d4c820;border-radius:50% 50% 30% 70%;opacity:0.3;"></div>

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%;">
          <!-- Top half: purple = Ce que tu vois -->
          <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;">
            ${seen.map((t, i) => {
              const pos = tagPositions[i] || { x: `${20 + i * 10}%`, y: `${10 + i * 5}%` };
              return html`<span class="topic-tag" style="left:${pos.x};top:${pos.y};color:#f5f44c;">${t}</span>`;
            })}
            <p class="font-averia" style="font-size:38px;color:#f5f44c;text-align:center;z-index:2;">Ce que tu vois</p>
          </div>

          <!-- Bottom half: yellow = Ce qui t'accroche -->
          <div style="flex:1;position:relative;background:#f5f44c;display:flex;align-items:center;justify-content:center;">
            ${engaged.map((t, i) => {
              const pos = tagPositions[i] || { x: `${20 + i * 10}%`, y: `${10 + i * 5}%` };
              return html`<span class="topic-tag" style="left:${pos.x};top:${pos.y};color:#a34abb;">${t}</span>`;
            })}
            <p class="font-averia" style="font-size:38px;color:#a34abb;text-align:center;z-index:2;">Ce qui t'accroche</p>
          </div>
        </div>
        ${this.dots(5, true)}
      </div>
    `;
  }

  // ── Slide 07: Tu vois... Mais tu ne regardes pas toujours ──
  private slide07(_s: DbStats) {
    const skip = this.skipRate;

    // Generate pill pattern
    const pills: Array<{ x: number; col: number; h: number }> = [];
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 5; row++) {
        pills.push({
          x: 12 + col * 100,
          col,
          h: 160 + (col % 2 === 0 ? row * 10 : -row * 5),
        });
      }
    }

    return html`
      <div class="slide bg-purple">
        ${this.closeBtn(true)}

        <!-- Pill pattern -->
        <div style="position:absolute;inset:0;overflow:hidden;">
          ${pills.map((p, i) => html`
            <div class="pill" style="left:${p.x}px;top:${-40 + i * 190 - (p.col * 50)}px;width:79px;height:${p.h}px;"></div>
          `)}
        </div>

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:40px 20px 60px;">
          <div style="margin-top:15%;">
            <p class="font-jaldi" style="font-size:44px;line-height:1;text-align:center;color:white;">Tu vois...</p>
            <p class="font-jaldi" style="font-size:44px;line-height:1;text-align:center;color:white;margin-top:8px;">Mais tu ne regardes pas toujours</p>
          </div>

          <div style="margin-top:auto;text-align:center;">
            <p class="big-number" style="color:#eeebdf;">${skip}%</p>
            <p class="big-label" style="font-size:40px;text-align:center;color:#eeebdf;">des contenus</p>
            <p class="sub-text" style="color:#eeebdf;font-size:24px;margin-top:4px;">passent sans être regardés</p>
          </div>
        </div>
        ${this.dots(6, true)}
      </div>
    `;
  }

  // ── Slide 08: Tu passes moins de temps sur les sponsorisés ─
  private slide08(s: DbStats) {
    const sponsored = s.sponsoredStats;
    const sponsoredAvg = sponsored?.sponsored?.avgDwellMs || 0;
    const organicAvg = sponsored?.organic?.avgDwellMs || 0;
    const ratio = organicAvg > 0 ? Math.round((1 - sponsoredAvg / organicAvg) * 100) : 0;

    // Circle grid (6x8), bottom circles are more orange
    const gridCols = 6;
    const gridRows = 9;
    const circleSize = 62;

    return html`
      <div class="slide bg-green">
        ${this.closeBtn()}

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:20px 20px 60px;">
          <p class="font-jaldi" style="font-size:30px;text-align:center;line-height:1.1;margin-top:20px;padding:0 10px;">Tu passes moins de temps sur les contenus sponsorisés</p>

          ${ratio > 0 ? html`
            <p class="font-jaldi" style="font-size:18px;text-align:center;margin-top:12px;opacity:0.7;">${ratio}% de temps en moins vs l'organique</p>
          ` : nothing}

          <!-- Circle grid -->
          <div style="position:absolute;bottom:0;left:0;right:0;height:60%;overflow:hidden;">
            ${Array.from({ length: gridRows * gridCols }, (_, i) => {
              const row = Math.floor(i / gridCols);
              const col = i % gridCols;
              // Color progression: green → yellow-green → orange
              const progress = row / gridRows;
              const colors = ['#8ee88e33', '#8ee88e55', '#a0d87088', '#b8c850aa', '#d0b030cc', '#e89830dd', '#ff6701'];
              const colorIdx = Math.min(colors.length - 1, Math.floor(progress * colors.length));
              return html`
                <div class="dot-circle" style="
                  position:absolute;
                  width:${circleSize}px;height:${circleSize}px;
                  left:${col * (circleSize + 5)}px;
                  bottom:${(gridRows - 1 - row) * (circleSize + 5)}px;
                  background:${colors[colorIdx]};
                "></div>
              `;
            })}
          </div>
        </div>
        ${this.dots(7)}
      </div>
    `;
  }

  // ── Slide 09: Vous êtes — profil utilisateur ──────────────
  private slide09(s: DbStats) {
    const profile = getUserProfile(s);

    return html`
      <div class="slide bg-beige">
        ${this.closeBtn()}

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;height:100%;padding:40px 20px 60px;">
          <p class="font-averia" style="font-size:40px;margin-top:30px;">Vous êtes</p>

          <!-- Mascotte with wavy ring -->
          <div style="position:relative;margin:30px 0;">
            <!-- Wavy red rings -->
            <svg viewBox="0 0 320 320" style="position:absolute;inset:-20px;width:calc(100% + 40px);height:calc(100% + 40px);" xmlns="http://www.w3.org/2000/svg">
              ${[130, 110, 90].map(r => html`
                <circle cx="160" cy="160" r="${r}" fill="none" stroke="#ff0000" stroke-width="2.5"
                  stroke-dasharray="8 6" transform="rotate(${r * 3}, 160, 160)"/>
              `)}
            </svg>
            <!-- Profile circle -->
            <div style="width:220px;height:220px;border-radius:50%;background:#f5c6c0;overflow:hidden;display:flex;align-items:center;justify-content:center;">
              <div .innerHTML=${MASCOTTE_SVG} style="width:200px;height:200px;"></div>
            </div>
          </div>

          <div style="text-align:center;margin-top:auto;">
            <p class="font-averia" style="font-size:40px;">${profile.name}</p>
            <p class="font-jaldi" style="font-size:15px;margin-top:8px;line-height:1.2;padding:0 20px;">${profile.description}</p>
          </div>
        </div>
        ${this.dots(8)}
      </div>
    `;
  }

  // ── Slide 10: Recap ───────────────────────────────────────
  private slide10(s: DbStats) {
    const top = this.topDomain;
    const domains = s.topDomains || [];
    const total = domains.reduce((a, d) => a + d.count, 0);

    const recapItems = [
      { pct: `${top.pct}%`, label: domainLabel(top.domain), desc: 'Domaine dominant', bg: 'rgba(245,244,76,0.15)' },
      { pct: `${this.confirmationScore}%`, label: 'Bulle de filtre', desc: 'Confirmation des opinions', bg: 'rgba(140,67,233,0.2)' },
      { pct: `${this.emotionIntensityPct || 0}%`, label: 'Émotions fortes', desc: 'Contenus émotionnels intenses', bg: 'rgba(255,103,1,0.2)' },
      { pct: `${this.skipRate}%`, label: 'Contenus zappés', desc: 'Scrollés sans regarder', bg: 'rgba(245,244,76,0.1)' },
      { pct: `${this.politicalPct}%`, label: 'Politique', desc: 'Contenus politiquement marqués', bg: 'rgba(245,244,76,0.1)' },
      { pct: `${Math.round(this.avgPolarization * 100)}%`, label: 'Polarisation', desc: 'Intensité de polarisation', bg: 'rgba(245,244,76,0.1)' },
    ];

    // Add domain breakdown
    const domainItems = domains.slice(1, 4).map(d => ({
      pct: `${pct(d.count, total)}%`,
      label: domainLabel(d.domain),
      desc: `${d.count} contenus`,
      bg: 'rgba(245,244,76,0.1)',
    }));

    const allItems = [...recapItems, ...domainItems].slice(0, 7);

    return html`
      <div class="slide bg-beige">
        ${this.closeBtn()}

        <div class="slide-scroll">
          <div style="padding:40px 0 80px;">
            <p class="font-averia" style="font-size:40px;text-align:center;margin-bottom:16px;">Recap</p>

            <!-- Small mascotte -->
            <div style="width:120px;height:120px;border-radius:50%;background:#f5c6c0;overflow:hidden;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
              <div .innerHTML=${MASCOTTE_SVG} style="width:110px;height:110px;"></div>
            </div>

            ${allItems.map(item => html`
              <div class="recap-card" style="background:${item.bg};">
                <div class="recap-val">${item.pct}</div>
                <div>
                  <div class="recap-label">${item.label}</div>
                  <div class="recap-desc">${item.desc}</div>
                </div>
              </div>
            `)}

            <button class="cta-btn" @click=${() => this.go(10)}>Continuer</button>
          </div>
        </div>
        ${this.dots(9)}
      </div>
    `;
  }

  // ── Slide 11: On continue ? ───────────────────────────────
  private slide11(_s: DbStats) {
    return html`
      <div class="slide bg-purple">
        ${this.closeBtn(true)}

        <!-- Background circles -->
        <div style="position:absolute;inset:0;overflow:hidden;">
          <div class="bubble-circle" style="width:350px;height:350px;background:#c060e0;left:-150px;bottom:-50px;opacity:0.3;"></div>
          <div class="bubble-circle" style="width:150px;height:150px;background:#c060e0;right:0;bottom:60%;opacity:0.25;"></div>
          ${Array.from({ length: 20 }, (_, i) => {
            const col = i % 5;
            const row = Math.floor(i / 5);
            return html`<div class="dot-circle" style="position:absolute;width:60px;height:60px;background:rgba(200,150,255,0.15);left:${col * 68}px;bottom:${row * 68}px;"></div>`;
          })}
        </div>

        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;height:100%;padding:40px 20px 60px;">
          <p class="font-averia" style="font-size:40px;color:#9ee8d9;margin-top:40px;">On continue ?</p>

          <div class="choice-row" style="margin-top:40px;">
            <div class="choice-card">
              <div class="choice-icon" style="background:#f0e0e0;">
                <!-- Star/sun icon -->
                <svg viewBox="0 0 60 60" width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="30" cy="30" r="22" fill="#e0c0b0" stroke="#d4a090" stroke-width="1"/>
                  ${Array.from({ length: 20 }, (_, i) => {
                    const a = (i / 20) * Math.PI * 2;
                    const x1 = 30 + Math.cos(a) * 22;
                    const y1 = 30 + Math.sin(a) * 22;
                    const x2 = 30 + Math.cos(a) * 28;
                    const y2 = 30 + Math.sin(a) * 28;
                    return html`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d4a090" stroke-width="1.5"/>`;
                  })}
                </svg>
              </div>
              <div class="choice-label">Élargit ton feed</div>
            </div>

            <div class="choice-card">
              <div class="choice-icon" style="background:#e0e8ff;">
                <!-- Magnifying glass -->
                <svg viewBox="0 0 60 60" width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="26" cy="26" r="16" fill="none" stroke="#6080ff" stroke-width="3"/>
                  <line x1="38" y1="38" x2="50" y2="50" stroke="#6080ff" stroke-width="3" stroke-linecap="round"/>
                  <circle cx="42" cy="14" r="4" fill="#6080ff" opacity="0.5"/>
                  <circle cx="48" cy="20" r="2.5" fill="#6080ff" opacity="0.4"/>
                </svg>
              </div>
              <div class="choice-label">Creuse ce qui t'intéresse</div>
            </div>
          </div>

          <div style="margin-top:auto;">
            <button class="cta-btn" @click=${this.close}>Terminer</button>
            <button style="background:none;border:none;color:rgba(255,255,255,0.6);font-family:'Jaldi',sans-serif;font-size:16px;cursor:pointer;padding:8px 16px;display:block;margin:0 auto;" @click=${this.shareWrapped}>
              Partager mon Wrapped
            </button>
          </div>
        </div>
        ${this.dots(10, true)}
      </div>
    `;
  }
}
