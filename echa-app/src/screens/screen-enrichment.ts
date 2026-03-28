import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, polLabels } from '../styles/theme.js';
import { getStats, type DbStats } from '../services/db-bridge.js';

@customElement('screen-enrichment')
export class ScreenEnrichment extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 24px; }

      h2 { font-size: 16px; letter-spacing: 1px; margin-bottom: 16px; }

      .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 20px; }
      .stat-card { background: var(--surface2); border-radius: var(--radius); padding: 12px; text-align: center; }
      .stat-card .value { font-size: 22px; font-weight: 700; }
      .stat-card .label { font-size: 10px; color: var(--text-dim); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
      .v-accent { color: var(--accent); }
      .v-green { color: var(--green); }
      .v-yellow { color: var(--yellow); }
      .v-red { color: var(--red); }
      .v-purple { color: var(--purple); }

      .section { background: var(--surface2); border-radius: var(--radius); padding: 14px; margin-bottom: 12px; }
      .section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim); margin-bottom: 10px; }

      .bar-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
      .bar-label { width: 100px; font-size: 11px; color: var(--text); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bar-track { flex: 1; height: 16px; background: var(--bg); border-radius: 3px; overflow: hidden; }
      .bar-fill { height: 100%; border-radius: 3px; transition: width 0.4s; min-width: 2px; }
      .bar-count { width: 30px; font-size: 11px; color: var(--text-dim); text-align: right; }

      .polar-legend { display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); margin-top: 4px; padding: 0 106px 0 0; }

      .axis-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
      .axis-label { width: 70px; font-size: 10px; text-align: right; color: var(--text); }
      .axis-neg { width: 60px; font-size: 9px; text-align: right; color: var(--text-muted); }
      .axis-pos { width: 65px; font-size: 9px; color: var(--text-muted); }
      .axis-track { flex: 1; height: 14px; background: var(--bg); border-radius: 3px; position: relative; overflow: hidden; }
      .axis-center { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--border); }
      .axis-fill { position: absolute; height: 100%; border-radius: 3px; }
      .axis-val { width: 36px; font-size: 10px; text-align: right; }

      .loading { text-align: center; padding: 40px; color: var(--text-dim); }
      .error { text-align: center; padding: 20px; color: var(--red); font-size: 12px; }

      .refresh-btn { background: var(--surface3); border: 1px solid var(--border); color: var(--text-dim); padding: 6px 14px; border-radius: var(--radius-sm); font-size: 11px; font-family: inherit; cursor: pointer; float: right; }
      .refresh-btn:active { opacity: 0.7; }
    `,
  ];

  @state() private stats: DbStats | null = null;
  @state() private loading = true;
  @state() private error = '';

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.error = '';
    try {
      this.stats = await getStats();
    } catch (e: any) {
      this.error = e.message || 'Erreur DB';
    } finally {
      this.loading = false;
    }
  }

  private barHtml(label: string, count: number, max: number, color: string) {
    const pct = max > 0 ? Math.round(count / max * 100) : 0;
    return html`
      <div class="bar-row">
        <span class="bar-label">${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="bar-count">${count}</span>
      </div>
    `;
  }

  private axisHtml(label: string, value: number, negLabel: string, posLabel: string) {
    const absPct = Math.abs(value) * 50;
    const left = value < 0 ? (50 - absPct) : 50;
    const color = Math.abs(value) < 0.1 ? 'var(--text-muted)' : value < 0 ? 'var(--accent)' : 'var(--orange)';
    const display = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
    return html`
      <div class="axis-row">
        <span class="axis-label">${label}</span>
        <span class="axis-neg">${negLabel}</span>
        <div class="axis-track">
          <div class="axis-center"></div>
          <div class="axis-fill" style="left:${left}%;width:${absPct}%;background:${color}"></div>
        </div>
        <span class="axis-pos">${posLabel}</span>
        <span class="axis-val" style="color:${color}">${display}</span>
      </div>
    `;
  }

  render() {
    if (this.loading) return html`<div class="loading">Chargement...</div>`;
    if (this.error) return html`
      <div class="error">${this.error}</div>
      <div style="text-align:center;margin-top:12px"><button class="refresh-btn" @click=${this.loadData}>Réessayer</button></div>
    `;

    const s = this.stats!;
    const a = s.axes;

    // Political distribution
    const polEntries = Object.entries(s.political).map(([score, count]) => ({ score: parseInt(score), count: count as number }));
    const maxPol = Math.max(...polEntries.map(e => e.count), 1);

    // Top categories
    const maxCat = s.topCategories.length > 0 ? s.topCategories[0].count : 1;

    // Top users
    const maxUser = s.topUsers.length > 0 ? s.topUsers[0].count : 1;

    // Enrichment rate
    const enrichRate = s.totalPosts > 0 ? Math.round(s.totalEnriched / s.totalPosts * 100) : 0;

    return html`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2>Enrichment</h2>
        <button class="refresh-btn" @click=${this.loadData}>Refresh</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="value v-accent">${s.totalPosts}</div><div class="label">Posts</div></div>
        <div class="stat-card"><div class="value v-green">${s.totalEnriched}</div><div class="label">Enrichis</div></div>
        <div class="stat-card"><div class="value v-green">${enrichRate}%</div><div class="label">Taux</div></div>
        <div class="stat-card"><div class="value v-yellow">${s.avgPolarization ?? 0}</div><div class="label">Polar. moy</div></div>
        <div class="stat-card"><div class="value v-accent">${s.avgConfidence ?? 0}</div><div class="label">Confiance</div></div>
        <div class="stat-card"><div class="value v-purple">${s.totalSessions}</div><div class="label">Sessions</div></div>
      </div>

      <!-- Distribution politique -->
      <div class="section">
        <h3>Distribution politique (0-4)</h3>
        ${polEntries.map(e => this.barHtml(polLabels[e.score] || `Score ${e.score}`, e.count, maxPol, polColors[e.score] || 'var(--text-dim)'))}
      </div>

      <!-- Top catégories médias -->
      ${s.topCategories.length > 0 ? html`
        <div class="section">
          <h3>Catégories médias</h3>
          ${s.topCategories.slice(0, 10).map(c => this.barHtml(c.category, c.count, maxCat, 'var(--accent)'))}
        </div>
      ` : ''}

      <!-- Attention -->
      ${Object.keys(s.attention).length > 0 ? html`
        <div class="section">
          <h3>Niveaux d'attention</h3>
          ${Object.entries(s.attention).map(([level, count]) => {
            const color = level === 'engaged' ? 'var(--green)' : level === 'viewed' ? 'var(--accent)' : level === 'glanced' ? 'var(--yellow)' : 'var(--text-muted)';
            return this.barHtml(level, count as number, Math.max(...Object.values(s.attention) as number[], 1), color);
          })}
        </div>
      ` : ''}

      <!-- Top users -->
      ${s.topUsers.length > 0 ? html`
        <div class="section">
          <h3>Top comptes (${s.topUsers.length})</h3>
          ${s.topUsers.slice(0, 10).map(u => this.barHtml(`@${u.username}`, u.count, maxUser, 'var(--purple)'))}
        </div>
      ` : ''}

      <!-- Axes politiques -->
      ${a ? html`
        <div class="section">
          <h3>Axes politiques (moyenne)</h3>
          ${this.axisHtml('Économique', a.economic, 'gauche', 'droite')}
          ${this.axisHtml('Sociétal', a.societal, 'progress.', 'conserv.')}
          ${this.axisHtml('Autorité', a.authority, 'libertaire', 'autorit.')}
          ${this.axisHtml('Système', a.system, 'anti-syst.', 'institut.')}
        </div>
      ` : ''}
    `;
  }
}
