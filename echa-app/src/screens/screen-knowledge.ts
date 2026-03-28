import { LitElement, html, css, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots } from '../styles/theme.js';
import { getGraphStats, backfillGraph, type GraphStats } from '../services/graph-ingest-mobile.js';

const ico = (path: string, size = 18, color = 'currentColor') => html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;flex-shrink:0;">${unsafeSVG(path)}</svg>`;

// ── Entity type config ─────────────────────────────────────────

const TYPE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  Theme:          { color: '#6B6BFF', icon: '<circle cx="12" cy="12" r="5" stroke-width="1.5"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3" stroke-width="1"/>', label: 'Themes' },
  Subject:        { color: '#88CCFF', icon: '<path d="M4 6h16M4 12h10M4 18h14"/>', label: 'Sujets' },
  PreciseSubject: { color: '#8B44E8', icon: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>', label: 'Sujets precis' },
  Person:         { color: '#FF7B33', icon: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>', label: 'Personnes' },
  Organization:   { color: '#E88BE8', icon: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-8l-2 4h12l-2-4z"/>', label: 'Organisations' },
  Institution:    { color: '#FFE94A', icon: '<path d="M3 21h18M3 7l9-4 9 4M5 7v14M19 7v14M9 21v-4a2 2 0 014 0v4M3 11h18"/>', label: 'Institutions' },
  Country:        { color: '#88EEBB', icon: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>', label: 'Pays' },
  Narrative:      { color: '#FF2222', icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>', label: 'Narratifs' },
  Emotion:        { color: '#6BE88B', icon: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>', label: 'Emotions' },
  Audience:       { color: '#b0b0b0', icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>', label: 'Audiences' },
};

const RELATION_LABELS: Record<string, string> = {
  isAbout: 'Concerne',
  mentions: 'Mentionne',
  takesPosition: 'Prend position',
  uses: 'Utilise',
  evokes: 'Evoque',
  targets: 'Cible',
};

@customElement('screen-knowledge')
export class ScreenKnowledge extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 40px; }

      .page-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 20px;
      }
      .page-title {
        font-family: var(--font-heading); font-size: 22px; font-weight: 700;
      }
      .page-subtitle {
        font-size: 11px; color: var(--text-muted); margin-top: 2px;
      }
      .refresh-btn {
        background: var(--surface3); border: 1px solid var(--border);
        color: var(--text-dim); padding: 6px 14px; border-radius: var(--radius-pill);
        font-size: 10px; font-family: var(--font-mono); text-transform: uppercase;
        letter-spacing: 0.03em; cursor: pointer;
      }
      .refresh-btn:active { opacity: 0.7; }

      /* ── Stats banner ── */
      .stats-banner {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
        margin-bottom: 16px;
      }
      .stat-card {
        background: var(--surface2); border-radius: var(--radius-sm);
        padding: 14px 12px; text-align: center;
      }
      .stat-value {
        font-family: var(--font-heading); font-size: 24px; font-weight: 900;
        background: linear-gradient(135deg, var(--bleu-indigo), var(--violet));
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .stat-label {
        font-family: var(--font-mono); font-size: 9px; text-transform: uppercase;
        color: var(--text-muted); letter-spacing: 0.05em; margin-top: 4px;
      }

      /* ── Section ── */
      .section {
        background: var(--surface2); border-radius: var(--radius);
        padding: 16px; margin-bottom: 14px;
      }
      .section-label {
        font-family: var(--font-mono); font-size: 10px; text-transform: uppercase;
        letter-spacing: 0.04em; color: var(--text-dim);
        margin-bottom: 12px; padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
        display: flex; align-items: center; gap: 8px;
      }

      /* ── Entity list ── */
      .entity-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--border);
      }
      .entity-row:last-child { border-bottom: none; }
      .entity-badge {
        width: 28px; height: 28px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .entity-badge svg { width: 16px; height: 16px; }
      .entity-info { flex: 1; min-width: 0; }
      .entity-name {
        font-size: 13px; font-weight: 500; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .entity-type {
        font-family: var(--font-mono); font-size: 9px;
        text-transform: uppercase; letter-spacing: 0.04em;
      }
      .entity-count {
        font-family: var(--font-mono); font-size: 12px; font-weight: 600;
        color: var(--text-dim); flex-shrink: 0;
      }
      .entity-bar {
        height: 3px; border-radius: 2px; margin-top: 3px;
        transition: width 0.3s ease;
      }

      /* ── Type distribution ── */
      .type-grid {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
      }
      .type-chip {
        display: flex; align-items: center; gap: 6px;
        background: var(--surface3); border-radius: var(--radius-sm);
        padding: 10px; min-width: 0;
      }
      .type-dot {
        width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
      }
      .type-count {
        font-family: var(--font-heading); font-size: 16px; font-weight: 700;
        color: var(--text);
      }
      .type-label {
        font-size: 9px; color: var(--text-dim); font-family: var(--font-mono);
        text-transform: uppercase; letter-spacing: 0.03em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }

      /* ── Co-occurrence ── */
      .cooc-row {
        display: flex; align-items: center; gap: 8px;
        padding: 7px 0;
        border-bottom: 1px solid var(--border);
      }
      .cooc-row:last-child { border-bottom: none; }
      .cooc-link {
        display: flex; align-items: center; gap: 6px;
        flex: 1; min-width: 0; font-size: 12px;
      }
      .cooc-entity {
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        max-width: 38%; font-weight: 500;
      }
      .cooc-arrow {
        color: var(--text-muted); font-size: 10px; flex-shrink: 0;
      }
      .cooc-count {
        font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);
        flex-shrink: 0; background: var(--surface3); padding: 2px 8px;
        border-radius: var(--radius-pill);
      }

      /* ── Relation distribution ── */
      .rel-bar-row {
        display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
      }
      .rel-label {
        font-family: var(--font-mono); font-size: 10px; color: var(--text-dim);
        width: 90px; text-align: right; flex-shrink: 0;
      }
      .rel-bar-track {
        flex: 1; height: 8px; background: var(--surface3); border-radius: 4px;
        overflow: hidden;
      }
      .rel-bar-fill {
        height: 100%; border-radius: 4px;
        transition: width 0.3s ease;
      }
      .rel-count {
        font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);
        width: 32px; flex-shrink: 0;
      }

      /* ── Entity group cards ── */
      .group-card {
        background: var(--surface3); border-radius: var(--radius-sm);
        padding: 12px; margin-bottom: 10px;
      }
      .group-header {
        display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      }
      .group-title {
        font-family: var(--font-heading); font-size: 14px; font-weight: 700;
      }
      .group-members {
        display: flex; flex-wrap: wrap; gap: 6px;
      }
      .member-tag {
        font-size: 11px; padding: 4px 10px; border-radius: var(--radius-pill);
        background: rgba(255,255,255,0.06); color: var(--text);
        border: 1px solid var(--border);
        display: flex; align-items: center; gap: 4px;
      }
      .member-count {
        font-family: var(--font-mono); font-size: 9px; color: var(--text-muted);
      }

      /* ── Empty state ── */
      .empty {
        text-align: center; padding: 40px 20px; color: var(--text-dim);
      }
      .empty-icon { margin-bottom: 12px; opacity: 0.4; }
      .empty h3 {
        font-family: var(--font-heading); font-size: 16px; font-weight: 700;
        color: var(--text); margin: 0 0 6px;
      }
      .empty p { font-size: 12px; margin: 0; line-height: 1.5; }

      /* ── Loading ── */
      .loading {
        text-align: center; padding: 60px 20px;
      }
      .loading .dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 12px; }
      .loading .dots span {
        width: 8px; height: 8px; border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
      }
      .loading .dots span:nth-child(2) { animation-delay: .15s; }
      .loading .dots span:nth-child(3) { animation-delay: .3s; }
      .loading .dots span:nth-child(4) { animation-delay: .45s; }
      .loading .dots span:nth-child(5) { animation-delay: .6s; }
      @keyframes pulse {
        0%,100% { opacity: .3; transform: scale(.8); }
        50% { opacity: 1; transform: scale(1.2); }
      }
    `,
  ];

  @state() private stats: GraphStats | null = null;
  @state() private loading = true;

  connectedCallback() {
    super.connectedCallback();
    this.loadStats();
  }

  private async loadStats() {
    this.loading = true;
    // Auto-backfill existing enriched posts that aren't in the graph yet
    await backfillGraph();
    this.stats = await getGraphStats();
    this.loading = false;
  }

  // ── Render helpers ─────────────────────────────────────────

  private renderLoading() {
    return html`
      <div class="loading">
        <div class="dots">${scrolloutDots.slice(0, 5).map(c => html`<span style="background:${c}"></span>`)}</div>
        <div style="font-size:12px;color:var(--text-dim)">Chargement du graphe...</div>
      </div>
    `;
  }

  private renderEmpty() {
    return html`
      <div class="empty">
        <div class="empty-icon">
          ${ico('<circle cx="12" cy="12" r="5" stroke-width="1.5"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3" stroke-width="1"/><circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="5.5" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="5.5" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none"/>', 48, 'var(--text-muted)')}
        </div>
        <h3>Graphe vide</h3>
        <p>Les entites apparaitront ici au fil de l'enrichissement de vos posts.</p>
      </div>
    `;
  }

  private renderStatsBanner(s: GraphStats) {
    return html`
      <div class="stats-banner">
        <div class="stat-card">
          <div class="stat-value">${s.totalEntities}</div>
          <div class="stat-label">Entites</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${s.totalObservations}</div>
          <div class="stat-label">Observations</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${s.postsInGraph}</div>
          <div class="stat-label">Posts lies</div>
        </div>
      </div>
    `;
  }

  private renderTypeDistribution(s: GraphStats) {
    if (!s.entityTypes?.length) return nothing;
    return html`
      <div class="section">
        <div class="section-label">
          ${ico('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0110 10"/>', 14, 'var(--bleu-indigo)')}
          Repartition par type
        </div>
        <div class="type-grid">
          ${s.entityTypes.map(t => {
            const cfg = TYPE_CONFIG[t.type] || { color: '#555', label: t.type };
            return html`
              <div class="type-chip">
                <div class="type-dot" style="background:${cfg.color}"></div>
                <div>
                  <div class="type-count">${t.count}</div>
                  <div class="type-label">${cfg.label}</div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderTopEntities(s: GraphStats) {
    if (!s.topEntities?.length) return nothing;
    const maxMentions = s.topEntities[0]?.mentions || 1;
    return html`
      <div class="section">
        <div class="section-label">
          ${ico('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>', 14, 'var(--jaune)')}
          Top entites
        </div>
        ${s.topEntities.slice(0, 12).map(e => {
          const cfg = TYPE_CONFIG[e.type] || { color: '#555', icon: '<circle cx="12" cy="12" r="3"/>', label: e.type };
          const pct = Math.round((e.mentions / maxMentions) * 100);
          return html`
            <div class="entity-row">
              <div class="entity-badge" style="background:${cfg.color}20">
                <svg viewBox="0 0 24 24" fill="none" stroke="${cfg.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${unsafeSVG(cfg.icon)}</svg>
              </div>
              <div class="entity-info">
                <div class="entity-name">${e.name}</div>
                <div class="entity-type" style="color:${cfg.color}">${cfg.label}</div>
                <div class="entity-bar" style="width:${pct}%;background:${cfg.color}"></div>
              </div>
              <div class="entity-count">${e.mentions}x</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderCoOccurrences(s: GraphStats) {
    if (!s.coOccurrences?.length) return nothing;
    return html`
      <div class="section">
        <div class="section-label">
          ${ico('<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m10 0h3a2 2 0 002-2v-3"/>', 14, 'var(--vert-menthe)')}
          Co-occurrences
        </div>
        ${s.coOccurrences.slice(0, 10).map(c => {
          const cfg1 = TYPE_CONFIG[c.type1] || { color: '#555' };
          const cfg2 = TYPE_CONFIG[c.type2] || { color: '#555' };
          return html`
            <div class="cooc-row">
              <div class="cooc-link">
                <span class="cooc-entity" style="color:${cfg1.color}">${c.entity1}</span>
                <span class="cooc-arrow">&harr;</span>
                <span class="cooc-entity" style="color:${cfg2.color}">${c.entity2}</span>
              </div>
              <span class="cooc-count">${c.count}x</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderRelationDistribution(s: GraphStats) {
    if (!s.relationTypes?.length) return nothing;
    const maxRel = s.relationTypes[0]?.count || 1;
    const relColors = ['var(--bleu-indigo)', 'var(--orange)', 'var(--violet)', 'var(--vert-menthe)', 'var(--rose)', 'var(--jaune)'];
    return html`
      <div class="section">
        <div class="section-label">
          ${ico('<path d="M5 12h14M12 5l7 7-7 7"/>', 14, 'var(--orange)')}
          Types de relations
        </div>
        ${s.relationTypes.map((r, i) => {
          const pct = Math.round((r.count / maxRel) * 100);
          const label = RELATION_LABELS[r.relation] || r.relation;
          return html`
            <div class="rel-bar-row">
              <div class="rel-label">${label}</div>
              <div class="rel-bar-track">
                <div class="rel-bar-fill" style="width:${pct}%;background:${relColors[i % relColors.length]}"></div>
              </div>
              <div class="rel-count">${r.count}</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderEntityGroups(s: GraphStats) {
    if (!s.entityGroups?.length) return nothing;
    // Only show groups with actual interesting entities (not Theme/Audience)
    const interestingGroups = s.entityGroups.filter(g =>
      !['Audience', 'Emotion'].includes(g.type) && g.members.length > 0,
    );
    if (interestingGroups.length === 0) return nothing;

    return html`
      <div class="section">
        <div class="section-label">
          ${ico('<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>', 14, 'var(--rose)')}
          Entites par categorie
        </div>
        ${interestingGroups.map(g => {
          const cfg = TYPE_CONFIG[g.type] || { color: '#555', icon: '<circle cx="12" cy="12" r="3"/>', label: g.type };
          return html`
            <div class="group-card">
              <div class="group-header">
                <div class="entity-badge" style="background:${cfg.color}20">
                  <svg viewBox="0 0 24 24" fill="none" stroke="${cfg.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">${unsafeSVG(cfg.icon)}</svg>
                </div>
                <div class="group-title" style="color:${cfg.color}">${cfg.label}</div>
              </div>
              <div class="group-members">
                ${g.members.map(m => html`
                  <span class="member-tag" style="border-color:${cfg.color}30">
                    ${m.name}
                    <span class="member-count">${m.mentions}x</span>
                  </span>
                `)}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderStanceDistribution(s: GraphStats) {
    if (!s.stanceDistribution?.length) return nothing;
    const total = s.stanceDistribution.reduce((a, b) => a + b.count, 0);
    const stanceColors: Record<string, string> = {
      pour: 'var(--vert-menthe)',
      contre: 'var(--rouge)',
      neutre: 'var(--text-muted)',
      ambigu: 'var(--jaune)',
    };
    return html`
      <div class="section">
        <div class="section-label">
          ${ico('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>', 14, 'var(--violet)')}
          Positions sur les sujets
        </div>
        <div style="display:flex;gap:4px;height:24px;border-radius:12px;overflow:hidden;margin-bottom:10px">
          ${s.stanceDistribution.map(st => {
            const pct = Math.round((st.count / total) * 100);
            const color = stanceColors[st.stance] || 'var(--text-muted)';
            return pct > 0 ? html`<div style="width:${pct}%;background:${color};min-width:2px" title="${st.stance}: ${st.count}"></div>` : nothing;
          })}
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
          ${s.stanceDistribution.map(st => {
            const color = stanceColors[st.stance] || 'var(--text-muted)';
            const pct = Math.round((st.count / total) * 100);
            return html`
              <div style="display:flex;align-items:center;gap:4px;font-size:11px">
                <div style="width:8px;height:8px;border-radius:50%;background:${color}"></div>
                <span style="color:var(--text-dim);text-transform:capitalize">${st.stance}</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">${pct}%</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  // ── Main render ────────────────────────────────────────────

  render() {
    if (this.loading) return this.renderLoading();
    if (!this.stats || this.stats.totalEntities === 0) return html`
      <div class="page-header">
        <div>
          <div class="page-title">Graphe de connaissances</div>
          <div class="page-subtitle">Ontologie de votre consommation Instagram</div>
        </div>
      </div>
      ${this.renderEmpty()}
    `;

    const s = this.stats;
    return html`
      <div class="page-header">
        <div>
          <div class="page-title">Graphe de connaissances</div>
          <div class="page-subtitle">Ontologie de votre consommation Instagram</div>
        </div>
        <button class="refresh-btn" @click=${() => this.loadStats()}>Actualiser</button>
      </div>

      ${this.renderStatsBanner(s)}
      ${this.renderTypeDistribution(s)}
      ${this.renderTopEntities(s)}
      ${this.renderCoOccurrences(s)}
      ${this.renderRelationDistribution(s)}
      ${this.renderStanceDistribution(s)}
      ${this.renderEntityGroups(s)}
    `;
  }
}
