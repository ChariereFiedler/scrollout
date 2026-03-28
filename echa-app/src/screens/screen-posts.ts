import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, polLabels } from '../styles/theme.js';
import { getSessions, getPosts, safeParse, type PostEntry, type SessionSummary } from '../services/db-bridge.js';

@customElement('screen-posts')
export class ScreenPosts extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 24px; }

      h2 { font-size: 16px; letter-spacing: 1px; margin-bottom: 12px; }

      .filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
      .filter-group { display: flex; align-items: center; gap: 4px; }
      .filter-group label { font-size: 10px; color: var(--text-dim); }
      select, input[type="checkbox"] { background: var(--surface3); border: 1px solid var(--border); color: var(--text); padding: 4px 6px; border-radius: 4px; font-family: inherit; font-size: 11px; }
      .btn-filter { background: var(--accent); color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; font-family: inherit; cursor: pointer; }
      .btn-filter:active { opacity: 0.8; }

      .post-list { display: flex; flex-direction: column; gap: 8px; }

      .post-card { background: var(--surface2); border-radius: var(--radius); padding: 12px; cursor: pointer; transition: background 0.15s; }
      .post-card:active { background: var(--surface3); }

      .pc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .pc-user { color: var(--accent); font-weight: 700; font-size: 13px; }
      .pc-pol { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; color: #fff; }
      .pc-summary { font-size: 12px; color: var(--text); line-height: 1.4; margin-bottom: 6px; }
      .pc-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; }
      .tag { display: inline-block; padding: 2px 6px; border-radius: 8px; font-size: 9px; font-weight: 600; }
      .tag-topic { background: #1a2a4a; color: var(--accent); }
      .tag-narrative { background: #2d1a3a; color: var(--purple); }
      .pc-scores { display: flex; gap: 12px; font-size: 10px; color: var(--text-dim); }
      .score-bar-inline { display: inline-block; width: 40px; height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; vertical-align: middle; }
      .score-fill-inline { height: 100%; border-radius: 3px; }

      .badge-review { background: #4a3a1a; color: var(--yellow); padding: 1px 5px; border-radius: 6px; font-size: 9px; font-weight: 700; }

      /* Detail modal */
      .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: flex-end; justify-content: center; }
      .modal { background: var(--surface); border-radius: 16px 16px 0 0; width: 100%; max-width: 500px; max-height: 85vh; overflow-y: auto; padding: 20px 16px; padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }
      .modal-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 16px; }
      .modal h3 { font-size: 15px; margin-bottom: 12px; }
      .detail-section { margin-bottom: 14px; }
      .detail-section .dl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim); margin-bottom: 3px; }
      .detail-section .dv { font-size: 12px; color: var(--text); word-break: break-word; line-height: 1.4; }
      .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .signals { display: flex; gap: 6px; flex-wrap: wrap; }
      .signal { padding: 2px 7px; border-radius: 6px; font-size: 9px; font-weight: 600; }
      .signal-on { background: #3a1a1a; color: var(--red); }
      .signal-off { background: var(--surface3); color: var(--text-muted); }
      .axis-row { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
      .axis-label { width: 60px; font-size: 10px; text-align: right; }
      .axis-track { flex: 1; height: 10px; background: var(--bg); border-radius: 3px; position: relative; overflow: hidden; }
      .axis-center { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--border); }
      .axis-fill { position: absolute; height: 100%; border-radius: 3px; }
      .axis-val { width: 32px; font-size: 9px; text-align: right; }

      .loading { text-align: center; padding: 40px; color: var(--text-dim); }
      .error { text-align: center; padding: 20px; color: var(--red); font-size: 12px; }
      .empty { text-align: center; padding: 30px; color: var(--text-dim); font-size: 12px; }
    `,
  ];

  @state() private posts: PostEntry[] = [];
  @state() private sessions: SessionSummary[] = [];
  @state() private selectedSession = '';
  @state() private loading = true;
  @state() private error = '';
  @state() private selectedPost: PostEntry | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadSessions();
  }

  private async loadSessions() {
    try {
      this.sessions = await getSessions();
      if (this.sessions.length > 0) {
        this.selectedSession = this.sessions[0].id;
        await this.loadPosts();
      } else {
        this.loading = false;
      }
    } catch (e: any) {
      this.error = e.message || 'Erreur DB';
      this.loading = false;
    }
  }

  private async loadPosts() {
    this.loading = true;
    this.error = '';
    try {
      this.posts = await getPosts(this.selectedSession, 0, 100);
    } catch (e: any) {
      this.error = e.message || 'Erreur DB';
    } finally {
      this.loading = false;
    }
  }

  private openDetail(p: PostEntry) {
    this.selectedPost = p;
  }

  private closeDetail() {
    this.selectedPost = null;
  }

  private renderAxisBar(label: string, value: number, neg: string, pos: string) {
    const absPct = Math.abs(value) * 50;
    const left = value < 0 ? (50 - absPct) : 50;
    const color = Math.abs(value) < 0.1 ? 'var(--text-muted)' : value < 0 ? 'var(--accent)' : 'var(--orange)';
    const display = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
    return html`
      <div class="axis-row">
        <span class="axis-label">${label}</span>
        <div class="axis-track">
          <div class="axis-center"></div>
          <div class="axis-fill" style="left:${left}%;width:${absPct}%;background:${color}"></div>
        </div>
        <span class="axis-val" style="color:${color}">${display}</span>
      </div>
    `;
  }

  private renderDetail() {
    const p = this.selectedPost;
    if (!p) return nothing;

    const e = p.enrichment;
    const topics = e ? safeParse(e.mainTopics) : [];

    return html`
      <div class="modal-bg" @click=${(ev: Event) => { if ((ev.target as HTMLElement).classList.contains('modal-bg')) this.closeDetail(); }}>
        <div class="modal">
          <div class="modal-handle"></div>
          <h3>@${p.username || '?'}</h3>

          <div class="detail-section"><div class="dl">Caption</div><div class="dv">${p.caption || '—'}</div></div>

          <div class="detail-grid">
            <div class="detail-section"><div class="dl">Type</div><div class="dv">${p.mediaType}</div></div>
            <div class="detail-section"><div class="dl">Attention</div><div class="dv">${p.attentionLevel} (${(p.dwellTimeMs / 1000).toFixed(1)}s)</div></div>
          </div>

          ${e ? html`
            <div class="detail-section">
              <div class="dl">Thèmes</div>
              <div class="dv">${topics.length ? topics.map(t => html`<span class="tag tag-topic">${t}</span> `) : '—'}</div>
            </div>

            <div class="detail-section">
              <div class="dl">Score politique</div>
              <div class="dv">
                <span class="pc-pol" style="background:${polColors[e.politicalScore]}">${e.politicalScore}</span>
                ${polLabels[e.politicalScore] || ''}
              </div>
            </div>

            <div class="detail-grid">
              <div class="detail-section"><div class="dl">Polarisation</div><div class="dv">${e.polarizationScore.toFixed(2)}</div></div>
              <div class="detail-section"><div class="dl">Confiance</div><div class="dv">${Math.round(e.confidenceScore * 100)}%</div></div>
            </div>

            ${(e.axisEconomic !== 0 || e.axisSocietal !== 0 || e.axisAuthority !== 0 || e.axisSystem !== 0) ? html`
              <div class="detail-section">
                <div class="dl">Axes politiques${e.dominantAxis ? ` (dom: ${e.dominantAxis})` : ''}</div>
                ${this.renderAxisBar('Éco', e.axisEconomic, 'G', 'D')}
                ${this.renderAxisBar('Social', e.axisSocietal, 'Prog', 'Cons')}
                ${this.renderAxisBar('Auth', e.axisAuthority, 'Lib', 'Auth')}
                ${this.renderAxisBar('Syst', e.axisSystem, 'Anti', 'Inst')}
              </div>
            ` : ''}

            <div class="detail-grid">
              <div class="detail-section"><div class="dl">Catégorie</div><div class="dv">${e.mediaCategory || '—'}</div></div>
              <div class="detail-section"><div class="dl">Qualité</div><div class="dv">${e.mediaQuality || '—'}</div></div>
            </div>
          ` : html`<div style="color:var(--text-dim);font-size:12px;padding:12px">Pas encore enrichi</div>`}
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <h2>Posts capturés</h2>

      <div class="filters">
        <div class="filter-group">
          <label>Session</label>
          <select @change=${(e: Event) => { this.selectedSession = (e.target as HTMLSelectElement).value; this.loadPosts(); }}>
            ${this.sessions.map(s => {
              const date = new Date(s.capturedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
              return html`<option value=${s.id} ?selected=${s.id === this.selectedSession}>${date} (${s.postCount} posts)</option>`;
            })}
          </select>
        </div>
        <button class="btn-filter" @click=${this.loadPosts}>Refresh</button>
      </div>

      ${this.loading ? html`<div class="loading">Chargement...</div>` :
        this.error ? html`<div class="error">${this.error}</div>` :
        this.posts.length === 0 ? html`<div class="empty">Aucun post dans cette session</div>` :
        html`
          <div class="post-list">
            ${this.posts.map(p => {
              const e = p.enrichment;
              const topics = e ? safeParse(e.mainTopics) : [];
              const polScore = e?.politicalScore ?? 0;
              const polarPct = e ? Math.round(e.polarizationScore * 100) : 0;
              const polarColor = polarPct > 60 ? 'var(--red)' : polarPct > 30 ? 'var(--yellow)' : 'var(--green)';
              return html`
                <div class="post-card" @click=${() => this.openDetail(p)}>
                  <div class="pc-header">
                    <span class="pc-user">@${p.username || '?'}</span>
                    <span class="pc-pol" style="background:${polColors[polScore]}">${polScore}</span>
                  </div>
                  <div class="pc-summary">${p.caption ? p.caption.substring(0, 120) : p.mediaType} — ${(p.dwellTimeMs / 1000).toFixed(1)}s ${p.attentionLevel}</div>
                  <div class="pc-tags">
                    ${topics.map(t => html`<span class="tag tag-topic">${t}</span>`)}
                    ${p.isSponsored ? html`<span class="tag" style="background:#4a3a1a;color:var(--yellow)">AD</span>` : ''}
                    ${p.isSuggested ? html`<span class="tag" style="background:#1a3a4a;color:var(--accent)">SUG</span>` : ''}
                  </div>
                  ${e ? html`
                    <div class="pc-scores">
                      <span>Polar: <span class="score-bar-inline"><span class="score-fill-inline" style="width:${polarPct}%;background:${polarColor}"></span></span> ${e.polarizationScore.toFixed(2)}</span>
                      <span>Conf: ${Math.round(e.confidenceScore * 100)}%</span>
                    </div>
                  ` : ''}
                </div>
              `;
            })}
          </div>
        `
      }

      ${this.renderDetail()}
    `;
  }
}
