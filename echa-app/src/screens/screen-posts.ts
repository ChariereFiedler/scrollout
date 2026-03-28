import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, polLabels } from '../styles/theme.js';
import { getEnrichedPosts, safeParse, type EnrichedPost } from '../services/api.js';

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

  @state() private posts: EnrichedPost[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private selectedPost: EnrichedPost | null = null;
  @state() private polMin = 0;
  @state() private polMax = 4;
  @state() private reviewOnly = false;

  connectedCallback() {
    super.connectedCallback();
    this.loadPosts();
  }

  private async loadPosts() {
    this.loading = true;
    this.error = '';
    try {
      this.posts = await getEnrichedPosts({
        political_min: this.polMin,
        political_max: this.polMax,
        review: this.reviewOnly,
        limit: 100,
      });
    } catch (e: any) {
      this.error = e.message || 'Connexion impossible';
    } finally {
      this.loading = false;
    }
  }

  private openDetail(p: EnrichedPost) {
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

    const topics = [...safeParse(p.mainTopics), ...safeParse(p.secondaryTopics)];
    const persons = safeParse(p.persons).filter(x => x && !x.startsWith('aucun'));
    const orgs = safeParse(p.organizations).filter(x => x && !x.startsWith('aucun'));
    const institutions = safeParse(p.institutions).filter(x => x && !x.startsWith('aucun'));
    const countries = safeParse(p.countries);
    const polIssues = safeParse(p.politicalIssueTags);
    const polActors = safeParse(p.politicalActors).filter(x => x && !x.startsWith('aucun'));

    return html`
      <div class="modal-bg" @click=${(e: Event) => { if ((e.target as HTMLElement).classList.contains('modal-bg')) this.closeDetail(); }}>
        <div class="modal">
          <div class="modal-handle"></div>
          <h3>@${p.post?.username || '?'}</h3>

          <div class="detail-section"><div class="dl">Résumé</div><div class="dv">${p.semanticSummary || '—'}</div></div>
          ${p.normalizedText ? html`<div class="detail-section"><div class="dl">Texte normalisé</div><div class="dv" style="max-height:100px;overflow-y:auto;background:var(--surface3);padding:8px;border-radius:6px;font-size:11px">${p.normalizedText}</div></div>` : ''}

          <div class="detail-grid">
            <div>
              <div class="detail-section"><div class="dl">Thèmes</div><div class="dv">${topics.length ? topics.map(t => html`<span class="tag tag-topic">${t}</span> `) : '—'}</div></div>
              <div class="detail-section"><div class="dl">Domaine</div><div class="dv">${p.contentDomain || '—'}</div></div>
              <div class="detail-section"><div class="dl">Audience</div><div class="dv">${p.audienceTarget || '—'}</div></div>
              <div class="detail-section"><div class="dl">Tonalité</div><div class="dv">${p.tone || '—'}</div></div>
              <div class="detail-section"><div class="dl">Émotion</div><div class="dv">${p.primaryEmotion || '—'} (${p.emotionIntensity})</div></div>
            </div>
            <div>
              <div class="detail-section"><div class="dl">Personnes</div><div class="dv">${persons.join(', ') || '—'}</div></div>
              <div class="detail-section"><div class="dl">Organisations</div><div class="dv">${orgs.join(', ') || '—'}</div></div>
              <div class="detail-section"><div class="dl">Institutions</div><div class="dv">${institutions.join(', ') || '—'}</div></div>
              <div class="detail-section"><div class="dl">Pays</div><div class="dv">${countries.join(', ') || '—'}</div></div>
            </div>
          </div>

          <div class="detail-section">
            <div class="dl">Scoring politique</div>
            <div class="dv">
              <span class="pc-pol" style="background:${polColors[p.politicalExplicitnessScore]}">${p.politicalExplicitnessScore}</span>
              ${polLabels[p.politicalExplicitnessScore]}
              ${polIssues.length ? html` — ${polIssues.join(', ')}` : ''}
            </div>
          </div>

          <div class="detail-section">
            <div class="dl">Polarisation: ${p.polarizationScore.toFixed(2)}</div>
            <div class="signals">
              <span class="signal ${p.ingroupOutgroupSignal ? 'signal-on' : 'signal-off'}">in/outgroup</span>
              <span class="signal ${p.conflictSignal ? 'signal-on' : 'signal-off'}">conflit</span>
              <span class="signal ${p.moralAbsoluteSignal ? 'signal-on' : 'signal-off'}">moral absolu</span>
              <span class="signal ${p.enemyDesignationSignal ? 'signal-on' : 'signal-off'}">ennemi</span>
              <span class="signal ${p.activismSignal ? 'signal-on' : 'signal-off'}">activisme</span>
            </div>
          </div>

          ${(p.axisEconomic !== 0 || p.axisSocietal !== 0 || p.axisAuthority !== 0 || p.axisSystem !== 0) ? html`
            <div class="detail-section">
              <div class="dl">Axes politiques${p.dominantAxis ? ` (dom: ${p.dominantAxis})` : ''}</div>
              ${this.renderAxisBar('Éco', p.axisEconomic, 'G', 'D')}
              ${this.renderAxisBar('Social', p.axisSocietal, 'Prog', 'Cons')}
              ${this.renderAxisBar('Auth', p.axisAuthority, 'Lib', 'Auth')}
              ${this.renderAxisBar('Syst', p.axisSystem, 'Anti', 'Inst')}
            </div>
          ` : ''}

          <div class="detail-grid">
            <div class="detail-section"><div class="dl">Narratif</div><div class="dv">${p.narrativeFrame ? html`<span class="tag tag-narrative">${p.narrativeFrame}</span>` : '—'}</div></div>
            <div class="detail-section"><div class="dl">Appel action</div><div class="dv">${p.callToActionType || '—'}</div></div>
          </div>

          <div class="detail-grid">
            <div class="detail-section"><div class="dl">Confiance</div><div class="dv">${Math.round(p.confidenceScore * 100)}%</div></div>
            <div class="detail-section"><div class="dl">Provider</div><div class="dv">${p.provider || '?'} / ${p.model || '?'}</div></div>
          </div>

          ${p.reviewFlag ? html`<div class="detail-section"><div class="dl">Review</div><div class="dv" style="color:var(--yellow)">${p.reviewReason}</div></div>` : ''}

          ${polActors.length ? html`<div class="detail-section"><div class="dl">Acteurs politiques</div><div class="dv">${polActors.join(', ')}</div></div>` : ''}
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <h2>Posts enrichis</h2>

      <div class="filters">
        <div class="filter-group">
          <label>Pol min</label>
          <select @change=${(e: Event) => { this.polMin = +(e.target as HTMLSelectElement).value; }}>
            ${[0,1,2,3,4].map(v => html`<option value=${v} ?selected=${v === this.polMin}>${v}</option>`)}
          </select>
        </div>
        <div class="filter-group">
          <label>Pol max</label>
          <select @change=${(e: Event) => { this.polMax = +(e.target as HTMLSelectElement).value; }}>
            ${[0,1,2,3,4].map(v => html`<option value=${v} ?selected=${v === this.polMax}>${v}</option>`)}
          </select>
        </div>
        <div class="filter-group">
          <label><input type="checkbox" @change=${(e: Event) => { this.reviewOnly = (e.target as HTMLInputElement).checked; }}> Review</label>
        </div>
        <button class="btn-filter" @click=${this.loadPosts}>Filtrer</button>
      </div>

      ${this.loading ? html`<div class="loading">Chargement...</div>` :
        this.error ? html`<div class="error">${this.error}</div>` :
        this.posts.length === 0 ? html`<div class="empty">Aucun post trouvé</div>` :
        html`
          <div class="post-list">
            ${this.posts.map(p => {
              const topics = safeParse(p.mainTopics);
              const polarPct = Math.round(p.polarizationScore * 100);
              const polarColor = polarPct > 60 ? 'var(--red)' : polarPct > 30 ? 'var(--yellow)' : 'var(--green)';
              return html`
                <div class="post-card" @click=${() => this.openDetail(p)}>
                  <div class="pc-header">
                    <span class="pc-user">@${p.post?.username || '?'}</span>
                    <span class="pc-pol" style="background:${polColors[p.politicalExplicitnessScore]}">${p.politicalExplicitnessScore}</span>
                  </div>
                  ${p.semanticSummary ? html`<div class="pc-summary">${p.semanticSummary}</div>` : ''}
                  <div class="pc-tags">
                    ${topics.map(t => html`<span class="tag tag-topic">${t}</span>`)}
                    ${p.narrativeFrame ? html`<span class="tag tag-narrative">${p.narrativeFrame}</span>` : ''}
                    ${p.reviewFlag ? html`<span class="badge-review">REVIEW</span>` : ''}
                  </div>
                  <div class="pc-scores">
                    <span>Polar: <span class="score-bar-inline"><span class="score-fill-inline" style="width:${polarPct}%;background:${polarColor}"></span></span> ${p.polarizationScore.toFixed(2)}</span>
                    <span>Conf: ${Math.round(p.confidenceScore * 100)}%</span>
                  </div>
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
