import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getStats, type DbStats } from '../services/db-bridge.js';

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

function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}

function formatDwell(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min >= 60) return `${Math.floor(min / 60)}h${min % 60}m`;
  return `${min}min`;
}

@customElement('screen-wrapped')
export class ScreenWrapped extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .slides {
      display: flex;
      width: 600%;
      height: 100%;
      transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
      touch-action: pan-y;
    }

    .slide {
      width: calc(100% / 6);
      height: 100%;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      flex-direction: column;
      padding: 32px 22px env(safe-area-inset-bottom, 24px);
      box-sizing: border-box;
    }

    /* ── Light backgrounds per slide ── */
    .slide-1 { background: linear-gradient(180deg, #fafafa 0%, #f0f0f5 100%); }
    .slide-2 { background: linear-gradient(180deg, #f8f8fc 0%, #eef0f8 100%); }
    .slide-3 { background: linear-gradient(180deg, #fdf9f2 0%, #f4efe5 100%); }
    .slide-4 { background: linear-gradient(180deg, #1a1a1a 0%, #111 100%); color: #f0f0f0; }
    .slide-5 { background: linear-gradient(180deg, #f5f7f2 0%, #ecefe6 100%); }
    .slide-6 { background: linear-gradient(180deg, #f8f4ec 0%, #eee7db 100%); }

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
      font-size: 36px;
      line-height: 0.96;
      color: #111;
      margin-bottom: 16px;
    }
    .slide-4 .title { color: #f0f0f0; }

    .body-text {
      font-size: 15px;
      line-height: 1.45;
      color: #555;
      margin-bottom: 20px;
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
      font-size: 16px;
      font-weight: 700;
      line-height: 1.15;
    }

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
      font-size: 16px;
      font-weight: 700;
      line-height: 1.15;
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
      padding-top: 12px;
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
      right: 16px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(0,0,0,0.06);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }
    .close-btn svg { width: 16px; height: 16px; stroke: #888; stroke-width: 2; }
    .close-btn:active { opacity: 0.5; }
    .slide-4 .close-btn { background: rgba(255,255,255,0.1); }
    .slide-4 .close-btn svg { stroke: #888; }
  `;

  @state() private currentSlide = 0;
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

  private go(slide: number) {
    this.currentSlide = Math.max(0, Math.min(5, slide));
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
        style="transform: translateX(-${this.currentSlide * (100 / 6)}%)"
        @touchstart=${this.onTouchStart}
        @touchmove=${this.onTouchMove}
        @touchend=${this.onTouchEnd}
      >
        ${this.renderSlide1(s)}
        ${this.renderSlide2(s)}
        ${this.renderSlide3(s)}
        ${this.renderSlide4(s)}
        ${this.renderSlide5(s)}
        ${this.renderSlide6(s)}
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
          ${[0, 1, 2, 3, 4, 5].map(i => html`<div class="dot ${i === slide ? 'active' : ''}"></div>`)}
        </div>
        ${slide < 5
          ? html`<button class="btn-next" @click=${() => this.go(slide + 1)}>Suivant <span>→</span></button>`
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
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">Scrollout Wrapped / 2026</div>
        <div class="title">Ton feed n'etait pas neutre. Il avait un centre de gravite.</div>
        <div class="body-text">Sur ${this.totalPosts} posts observes (${this.totalEnriched} enrichis), ton attention gravitait autour de ${domainLabel(top.domain).toLowerCase()}. La bulle n'etait pas fermee, mais clairement orientee.</div>

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

        ${this.renderFooter(0)}
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
        <div class="eyebrow">02 / La carte de ta bulle</div>
        <div class="title">Voici a quoi ressemble ta bulle mise a plat.</div>
        <div class="body-text">Les formes denses et colorees marquent les sujets ou tu reviens. Les zones pales montrent les angles morts.</div>

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

        ${this.renderFooter(1)}
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
        <div class="eyebrow">03 / Tes biais</div>
        <div class="title">Le biais ici ressemble moins a de l'extremisme qu'a une surexposition selective.</div>

        <div class="info-card dark">
          <div class="card-eyebrow">Biais de renforcement</div>
          <div class="card-text">Le feed valide toujours le meme cadre culturel (${topPct}% concentre) au lieu de le challenger.</div>
        </div>

        <div class="info-card accent">
          <div class="card-text">Le contenu politique apparait, mais plutot en contact peripherique qu'en habitude centrale.</div>
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

        ${this.renderFooter(2)}
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
        <div class="eyebrow">04 / Contradictions</div>
        <div class="title">Ton feed n'est pas juste biaise. Il est coherent contre toi.</div>

        <div class="info-card" style="background:#222;color:#f0f0f0;">
          <div class="card-text">Perspective Gap : ton cluster principal reste loin de ${100 - (diversity * 14)}% des clusters d'opinion. Tu vois surtout une version locale du monde.</div>
        </div>

        <div class="info-card" style="background:#FF7B33;color:#fff;">
          <div class="card-text">Algorithm Dependency : repetition elevee + engagement eleve. L'algo te sert ce qui te garde, pas ce qui t'ouvre.</div>
        </div>

        <div class="info-card accent">
          <div class="card-text">Engagement Bias : ${formatDwell(s.totalDwellMs)} passes au total. Le temps long part sur le contenu emotionnel, pas informatif.</div>
        </div>

        ${sponsored?.sponsored ? html`
          <div class="info-card" style="background:#333;color:#ccc;">
            <div class="card-eyebrow">Sponsored vs Organic</div>
            <div class="card-text">${sponsored.sponsored.count} posts sponsorises detectes — en moyenne ${Math.round(sponsored.sponsored.avgDwellMs / 1000)}s de dwell time.</div>
          </div>
        ` : ''}

        ${this.renderFooter(3, true)}
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
        <div class="eyebrow">05 / Ego metrics</div>
        <div class="title">Les chiffres qui piquent (et qui se partagent).</div>

        <div class="cards-row">
          <div class="metric-block" style="background:#111;color:#f0f0f0;flex:1;">
            <div class="m-val" style="color:#6B6BFF;">${bubbleScore}%</div>
            <div class="m-desc" style="color:#aaa;">Bubble Score — ton feed est compose a ${bubbleScore}% de contenus similaires.</div>
          </div>
          <div class="metric-block" style="background:#FFE94A;color:#111;flex:1;">
            <div class="m-val">${engaged}</div>
            <div class="m-desc">posts ou tu es reste engage (> 5s).</div>
          </div>
        </div>

        <div class="metric-block" style="background:#6B6BFF;color:#fff;">
          <div class="m-desc" style="color:#fff;">${skipRate}% de skip rate — tu as zappe ${skipped} posts sans les regarder. Le feed decide plus vite que toi.</div>
        </div>

        ${totalSignals > 0 ? html`
          <div class="metric-block" style="background:#FF2222;color:#fff;">
            <div class="m-val">${totalSignals}</div>
            <div class="m-desc" style="color:rgba(255,255,255,0.9);">signaux de polarisation detectes (conflit, ennemi designe, absolus moraux).</div>
          </div>
        ` : ''}

        <div class="metric-block" style="background:#f0f0f0;color:#333;">
          <div class="m-desc"><strong>${s.totalSessions} sessions</strong> analysees, <strong>${formatDwell(s.totalDwellMs)}</strong> de scroll total.</div>
        </div>

        ${this.renderFooter(4)}
      </div>
    `;
  }

  // ── Slide 6: Escape Routes ────────────────────────────────
  private renderSlide6(s: DbStats) {
    // Find missing/weak domains
    const domains = s.topDomains || [];
    const present = new Set(domains.map(d => d.domain));
    const allDomains = Object.keys(DOMAIN_COLORS);
    const missing = allDomains.filter(d => !present.has(d));
    const weak = domains.filter(d => d.count <= 3).map(d => domainLabel(d.domain));

    return html`
      <div class="slide slide-6">
        <button class="close-btn" @click=${this.close}>
          <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="eyebrow">06 / Sorties de bulle</div>
        <div class="title">Sortir de bulle = ajouter des mondes, pas juste des opposants.</div>
        <div class="body-text">Plan concret : ajouter 3 types de contenus absents + 3 comptes hors-cluster pendant 14 jours.</div>

        <div class="action-card" style="background:#111;color:#f0f0f0;">
          <div class="a-text">1. Format long factuel — reduit l'Attention Sink du drama court et casse la boucle emotionnelle.</div>
        </div>

        <div class="action-card" style="background:#6B6BFF;color:#fff;">
          <div class="a-text">2. Comptes hors-cluster — ferme le Perspective Gap en exposant des cadres narratifs incompatibles avec ton feed actuel.</div>
        </div>

        <div class="action-card" style="background:#FFE94A;color:#111;">
          <div class="a-text">3. Sources anti-confirmation — cible tes biais (confirmation + disponibilite) avec des contenus qui contredisent tes automatismes.</div>
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

        ${this.renderFooter(5)}
      </div>
    `;
  }
}
