import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, polLabels } from '../styles/theme.js';
import { getEnrichmentStats, getAxesData, type EnrichmentStats, type AxesData } from '../services/api.js';

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

  @state() private stats: EnrichmentStats | null = null;
  @state() private axes: AxesData | null = null;
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
      const [stats, axes] = await Promise.all([getEnrichmentStats(), getAxesData()]);
      this.stats = stats;
      this.axes = axes;
    } catch (e: any) {
      this.error = e.message || 'Connexion impossible';
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
    const a = this.axes;

    const maxPol = Math.max(...s.byPolitical.map(b => b._count), 1);
    const maxTopic = s.topTopics.length > 0 ? s.topTopics[0][1] : 1;
    const maxNar = s.byNarrative.length > 0 ? s.byNarrative[0]._count : 1;
    const totalPolar = Object.values(s.polarBuckets).reduce((a, b) => a + b, 0) || 1;

    const polarLabelsMap: Record<string, string> = { low: '< 0.2 faible', medium: '0.2–0.5 modéré', high: '0.5–0.8 fort', extreme: '> 0.8 extrême' };
    const polarColorsMap: Record<string, string> = { low: 'var(--green)', medium: 'var(--yellow)', high: 'var(--orange)', extreme: 'var(--red)' };

    return html`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2>Enrichment</h2>
        <button class="refresh-btn" @click=${this.loadData}>Refresh</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="value v-accent">${s.totalPosts}</div><div class="label">Posts</div></div>
        <div class="stat-card"><div class="value v-green">${s.totalEnriched}</div><div class="label">Enrichis</div></div>
        <div class="stat-card"><div class="value v-green">${s.enrichmentRate}%</div><div class="label">Taux</div></div>
        <div class="stat-card"><div class="value v-yellow">${s.avgPolarization}</div><div class="label">Polar. moy</div></div>
        <div class="stat-card"><div class="value v-accent">${s.avgConfidence}</div><div class="label">Confiance</div></div>
        <div class="stat-card"><div class="value v-red">${s.reviewFlagged}</div><div class="label">Review</div></div>
      </div>

      <!-- Distribution politique -->
      <div class="section">
        <h3>Distribution politique (0-4)</h3>
        ${s.byPolitical.map(b => this.barHtml(polLabels[b.politicalExplicitnessScore], b._count, maxPol, polColors[b.politicalExplicitnessScore]))}
      </div>

      <!-- Top thèmes -->
      <div class="section">
        <h3>Top thèmes</h3>
        ${s.topTopics.slice(0, 10).map(([topic, count]) => this.barHtml(topic, count, maxTopic, 'var(--accent)'))}
      </div>

      <!-- Narratifs -->
      <div class="section">
        <h3>Narratifs détectés</h3>
        ${s.byNarrative.length > 0
          ? s.byNarrative.slice(0, 8).map(n => this.barHtml(n.narrativeFrame || '(aucun)', n._count, maxNar, 'var(--purple)'))
          : html`<div style="color:var(--text-dim);font-size:12px">Aucun narratif</div>`
        }
      </div>

      <!-- Polarisation -->
      <div class="section">
        <h3>Distribution polarisation</h3>
        ${Object.entries(s.polarBuckets).map(([k, v]) =>
          this.barHtml(polarLabelsMap[k], v as number, totalPolar, polarColorsMap[k])
        )}
      </div>

      <!-- Axes politiques -->
      ${a && a.withSignal > 0 ? html`
        <div class="section">
          <h3>Axes politiques (moy. ${a.withSignal} posts)</h3>
          ${this.axisHtml('Économique', a.averages.economic, 'gauche', 'droite')}
          ${this.axisHtml('Sociétal', a.averages.societal, 'progress.', 'conserv.')}
          ${this.axisHtml('Autorité', a.averages.authority, 'libertaire', 'autorit.')}
          ${this.axisHtml('Système', a.averages.system, 'anti-syst.', 'institut.')}
        </div>
      ` : ''}
    `;
  }
}
