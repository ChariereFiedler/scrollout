import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots, domainColors, palette } from '../styles/theme.js';
import '../components/scrollout-logo.js';
import { openInstagram } from '../services/native-bridge.js';
import { getStats, type DbStats } from '../services/db-bridge.js';

/** Safe label extractor */
function safeLabel(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') {
    if (val.startsWith('{') || val.startsWith('[')) {
      try { return safeLabel(JSON.parse(val)); } catch { /* not JSON */ }
    }
    return val;
  }
  if (Array.isArray(val)) return val.map(safeLabel).filter(Boolean).join(', ');
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    return String(o.label || o.name || o.id || o.topic || o.domain || o.narrative || o.tone || o.emotion || '');
  }
  return String(val);
}

@customElement('screen-home')
export class ScreenHome extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 20px 16px 32px; }

      /* ── Header ── */
      .header {
        text-align: center;
        margin-bottom: 24px;
      }
      .logo-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .logo {
        font-family: var(--font-heading);
        font-size: 36px;
        font-weight: 900;
        letter-spacing: -0.5px;
      }
      .dots-row {
        display: flex;
        gap: 4px;
        justify-content: center;
      }
      .dots-row span {
        width: 14px;
        height: 14px;
        border-radius: 50%;
      }

      /* ── Back button ── */
      .back-btn {
        position: absolute;
        top: 20px; left: 16px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 10px;
        width: 36px; height: 36px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: var(--text);
        -webkit-tap-highlight-color: transparent;
        z-index: 1;
      }
      .back-btn:active { background: var(--surface3); }

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
        color: var(--white);
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

      /* ── Wrapped banner (orange CTA) ── */
      .wrapped-banner {
        background: var(--orange);
        border: 4px solid rgba(255, 107, 0, 0.25);
        border-radius: 20px;
        padding: 18px 20px;
        margin-bottom: 28px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: transform 0.15s;
        position: relative;
        overflow: hidden;
      }
      .wrapped-banner:active { transform: scale(0.98); }
      .wb-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
        z-index: 1;
      }
      .wb-title {
        font-family: var(--font-heading);
        font-weight: 900;
        font-size: 20px;
        color: var(--white);
      }
      .wb-sub {
        font-size: 13px;
        color: rgba(255,255,255,0.85);
      }
      .wb-bubbles {
        position: relative;
        width: 80px;
        height: 70px;
        flex-shrink: 0;
      }
      .wb-bubbles .b1 {
        position: absolute;
        width: 60px; height: 60px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        right: 0; top: 5px;
      }
      .wb-bubbles .b2 {
        position: absolute;
        width: 28px; height: 28px;
        border-radius: 50%;
        background: rgba(255,255,255,0.15);
        left: 0; top: 0;
      }
      .wb-bubbles .b3 {
        position: absolute;
        width: 14px; height: 14px;
        border-radius: 50%;
        background: rgba(255,255,255,0.12);
        right: 0; top: 0;
      }

      /* ── Stats row (3 rounded pills) ── */
      .stats-row {
        display: flex;
        gap: 12px;
        margin-bottom: 28px;
        justify-content: center;
      }
      .stat-pill {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .stat-circle {
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: var(--surface2);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .stat-val {
        font-family: var(--font-heading);
        font-size: 30px;
        font-weight: 700;
        line-height: 1;
      }
      .stat-label {
        font-family: var(--font-heading);
        font-size: 13px;
        font-weight: 700;
        color: var(--text-dim);
        text-align: center;
        max-width: 80px;
        line-height: 1.2;
      }

      /* ── Section titles ── */
      .section-title {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 900;
        margin-bottom: 14px;
        color: var(--text);
      }

      /* ── Tabs (Exposition / ...) ── */
      .tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
      }
      .tab {
        flex: 1;
        padding: 10px 16px;
        border-radius: var(--radius-pill);
        text-align: center;
        font-family: var(--font-heading);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        border: none;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.15s, color 0.15s;
      }
      .tab.active {
        background: var(--surface3);
        color: var(--text);
      }
      .tab:not(.active) {
        background: transparent;
        color: var(--text-muted);
      }

      /* ── Domain cards ── */
      .domain-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 28px;
      }
      .domain-card {
        background: var(--surface2);
        border-radius: 20px;
        padding: 16px 20px;
        overflow: hidden;
      }
      .domain-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .domain-name {
        font-family: var(--font-heading);
        font-size: 20px;
        font-weight: 700;
        line-height: 1.3;
      }
      .domain-exposure {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      .domain-count {
        font-family: var(--font-heading);
        font-size: 13px;
        font-weight: 700;
        color: var(--text-muted);
        flex-shrink: 0;
      }
      .domain-actions {
        display: flex;
        gap: 8px;
        margin-top: 16px;
      }
      .domain-btn {
        flex: 1;
        background: var(--bleu-indigo);
        border: 3px solid rgba(91, 63, 232, 0.25);
        color: var(--white);
        padding: 10px 16px;
        border-radius: var(--radius-pill);
        font-family: var(--font-heading);
        font-size: 14px;
        font-weight: 700;
        text-align: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        border: none;
      }
      .domain-btn:active { transform: scale(0.97); }

      /* ── Sujets majeurs (bubble chart) ── */
      .bubbles-section {
        margin-bottom: 28px;
      }
      .bubbles-subtitle {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 16px;
      }
      .bubbles-chart {
        position: relative;
        width: 100%;
        height: 300px;
      }
      .bubble {
        position: absolute;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-heading);
        font-weight: 700;
        text-align: center;
        line-height: 1.2;
        padding: 12px;
        word-break: break-word;
      }

      /* ── Transparence CTA ── */
      .transparence-cta {
        background: var(--surface2);
        border: 1px solid var(--border);
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
      .transparence-cta:active { transform: scale(0.98); }
      .tc-left {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .tc-title {
        font-family: var(--font-heading);
        font-weight: 900;
        font-size: 16px;
        color: var(--text);
      }
      .tc-sub {
        font-size: 11px;
        color: var(--text-dim);
      }
      .tc-arrow {
        font-size: 20px;
        color: var(--text-muted);
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
    `,
  ];

  @state() private launching = false;
  @state() private stats: DbStats | null = null;
  @state() private activeTab: 'exposure' | 'posts' = 'exposure';
  @state() private expandedDomain: string | null = null;

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

  private openTransparence() {
    this.dispatchEvent(new CustomEvent('open-transparence', { bubbles: true, composed: true }));
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
        <div class="logo-wrap">
          <span class="logo">Scrollout</span>
          <div class="dots-row">
            ${scrolloutDots.map(c => html`<span style="background:${c}"></span>`)}
          </div>
        </div>
      </div>

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

  private renderProfile(s: DbStats) {
    const totalMinutes = Math.round((s.totalDwellMs || 0) / 60000);
    const domains = s.topDomainsReal?.length ? s.topDomainsReal : s.topDomains;
    const topTopics = s.topTopics || [];
    const distinctTopics = new Set([
      ...(domains || []).map(d => safeLabel(d.domain)),
      ...topTopics.map(t => safeLabel(t.topic)),
    ]);

    return html`
      <!-- Voir ma bulle banner -->
      <div class="wrapped-banner" @click=${this.openWrapped}>
        <div class="wb-left">
          <div class="wb-title">Voir ma bulle</div>
          <div class="wb-sub">Retrouve ton insta wrapped</div>
        </div>
        <div class="wb-bubbles">
          <div class="b1"></div>
          <div class="b2"></div>
          <div class="b3"></div>
        </div>
      </div>

      <!-- Stats row: 3 pills -->
      <div class="stats-row">
        <div class="stat-pill">
          <div class="stat-circle">
            <span class="stat-val">${totalMinutes > 0 ? String(totalMinutes).padStart(2, '0') : '00'}</span>
          </div>
          <span class="stat-label">min</span>
        </div>
        <div class="stat-pill">
          <div class="stat-circle">
            <span class="stat-val">${String(s.totalEnriched || s.totalPosts).padStart(2, '0')}</span>
          </div>
          <span class="stat-label">posts analyses</span>
        </div>
        <div class="stat-pill">
          <div class="stat-circle">
            <span class="stat-val">${String(distinctTopics.size).padStart(2, '0')}</span>
          </div>
          <span class="stat-label">sujets actifs</span>
        </div>
      </div>

      <!-- Mes sujets -->
      ${this.renderMesSujets(s, domains || [])}

      <!-- Sujets majeurs -->
      ${this.renderSujetsMajeurs(topTopics)}

      <!-- Transparence CTA -->
      <div class="transparence-cta" @click=${this.openTransparence}>
        <div class="tc-left">
          <div class="tc-title">Transparence</div>
          <div class="tc-sub">Decouvre ce que l'algorithme sait de toi</div>
        </div>
        <span class="tc-arrow">&rarr;</span>
      </div>

      <!-- Continue capture -->
      <div class="cta">
        <button class="btn-cta" @click=${this.launch}>Continuer la capture</button>
      </div>
    `;
  }

  // ── Mes sujets ──────────────────────────────────────────────

  private renderMesSujets(s: DbStats, domains: Array<{ domain: string; count: number }>) {
    if (!domains.length) return nothing;

    const dwellByTopic = s.dwellByTopic || [];
    const dwellMap = new Map(dwellByTopic.map(d => [safeLabel(d.topic).toLowerCase(), d]));

    return html`
      <div class="section-title">Mes sujets</div>
      <div class="tabs">
        <button class="tab ${this.activeTab === 'exposure' ? 'active' : ''}"
                @click=${() => { this.activeTab = 'exposure'; }}>Exposition</button>
        <button class="tab ${this.activeTab === 'posts' ? 'active' : ''}"
                @click=${() => { this.activeTab = 'posts'; }}>Posts</button>
      </div>
      <div class="domain-list">
        ${domains.slice(0, 6).map(d => {
          const label = safeLabel(d.domain);
          const displayName = label.replace(/_/g, ' ');
          const dwellInfo = dwellMap.get(label.toLowerCase());
          const totalMin = dwellInfo ? Math.round(dwellInfo.totalDwellMs / 60000) : 0;
          const isExpanded = this.expandedDomain === label;
          const color = domainColors[displayName.toLowerCase()] || scrolloutDots[domains.indexOf(d) % scrolloutDots.length];

          return html`
            <div class="domain-card" @click=${() => { this.expandedDomain = isExpanded ? null : label; }}
                 style="border-left: 3px solid ${color}">
              <div class="domain-header">
                <div>
                  <div class="domain-name">${displayName}</div>
                  <div class="domain-exposure">
                    ${this.activeTab === 'exposure'
                      ? `${String(totalMin).padStart(2, '0')} min d'exposition`
                      : `${d.count} posts vus`}
                  </div>
                </div>
                <div class="domain-count">${d.count} posts</div>
              </div>
              ${isExpanded ? html`
                <div class="domain-actions">
                  <button class="domain-btn" @click=${(e: Event) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent('search-domain', { detail: { domain: label }, bubbles: true, composed: true })); }}>Recherche</button>
                  <button class="domain-btn" @click=${(e: Event) => { e.stopPropagation(); this.dispatchEvent(new CustomEvent('collect-domain', { detail: { domain: label }, bubbles: true, composed: true })); }}>Collection</button>
                </div>
              ` : ''}
            </div>
          `;
        })}
      </div>
    `;
  }

  // ── Sujets majeurs (bubble chart) ───────────────────────────

  private renderSujetsMajeurs(topics: Array<{ topic: string; count: number }>) {
    if (!topics.length) return nothing;

    const top3 = topics.slice(0, 3);
    const maxCount = Math.max(...top3.map(t => t.count));

    // Bubble layout: sizes proportional to count, positioned to overlap nicely
    const bubbleColors = [palette.violet, palette.vertMenthe, palette.bleuCiel];
    const bubbleTextColors = ['#fff', '#000', '#000'];

    // Pre-calculated positions similar to Figma layout
    const layouts = [
      { left: '8%', top: '0%', size: 62 },    // largest, top-left area
      { left: '45%', top: '35%', size: 52 },   // medium, right-center
      { left: '2%', top: '50%', size: 47 },    // smallest, bottom-left
    ];

    return html`
      <div class="bubbles-section">
        <div class="section-title">Sujets majeurs</div>
        <div class="bubbles-subtitle">Ces sujets ressortent le plus dans ton feed</div>
        <div class="bubbles-chart">
          ${top3.map((t, i) => {
            const ratio = maxCount > 0 ? t.count / maxCount : 0.5;
            const baseSize = layouts[i]?.size || 50;
            const size = Math.max(baseSize * Math.max(ratio, 0.6), 100);
            const label = safeLabel(t.topic).replace(/_/g, ' ');
            const fontSize = size > 160 ? 24 : size > 120 ? 18 : 14;

            return html`
              <div class="bubble" style="
                left: ${layouts[i]?.left || '20%'};
                top: ${layouts[i]?.top || '20%'};
                width: ${size}px;
                height: ${size}px;
                background: ${bubbleColors[i]};
                color: ${bubbleTextColors[i]};
                font-size: ${fontSize}px;
              ">${label}</div>
            `;
          })}
        </div>
      </div>
    `;
  }
}
