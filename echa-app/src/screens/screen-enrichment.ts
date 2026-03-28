import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, polColors, polLabels, scrolloutDots } from '../styles/theme.js';
import { getStats, type DbStats } from '../services/db-bridge.js';

@customElement('screen-enrichment')
export class ScreenEnrichment extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 32px; }

      /* ── Header ── */
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      .page-title {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 700;
      }
      .refresh-btn {
        background: var(--surface3);
        border: 1px solid var(--border);
        color: var(--text-dim);
        padding: 6px 14px;
        border-radius: var(--radius-pill);
        font-size: 10px;
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        cursor: pointer;
      }
      .refresh-btn:active { opacity: 0.7; }

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

      /* ── Exposure headline ── */
      .exposure-headline {
        text-align: center;
        padding: 12px 0 8px;
      }
      .exposure-quote {
        font-family: var(--font-heading);
        font-size: 16px;
        font-weight: 700;
        line-height: 1.4;
        margin-bottom: 8px;
      }
      .exposure-sub {
        font-size: 11px;
        color: var(--text-muted);
        font-style: italic;
      }

      /* ── Big metric ── */
      .big-metric {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 14px;
      }
      .big-metric:last-child { margin-bottom: 0; }
      .big-val {
        font-family: var(--font-heading);
        font-size: 40px;
        font-weight: 700;
        line-height: 1;
        flex-shrink: 0;
        min-width: 70px;
        text-align: center;
      }
      .big-info { flex: 1; }
      .big-label {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 2px;
      }
      .big-desc {
        font-size: 11px;
        color: var(--text-dim);
        line-height: 1.5;
      }

      /* ── Gauge bar ── */
      .gauge {
        height: 10px;
        border-radius: 5px;
        background: linear-gradient(to right, var(--vert-menthe), var(--jaune), var(--orange), var(--rouge));
        position: relative;
        margin: 8px 0;
      }
      .gauge-dot {
        position: absolute;
        top: -5px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        border: 3px solid var(--bg);
        box-shadow: var(--shadow-soft);
        transform: translateX(-50%);
        transition: left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .gauge-ends {
        display: flex;
        justify-content: space-between;
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-muted);
        text-transform: uppercase;
      }

      /* ── Compass ── */
      .compass-wrap {
        display: flex;
        gap: 16px;
        align-items: center;
      }
      .compass {
        position: relative;
        width: 160px;
        height: 160px;
        flex-shrink: 0;
        background: var(--surface3);
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
      .compass-line-h, .compass-line-v {
        position: absolute;
        background: var(--border-light);
      }
      .compass-line-h { left: 0; right: 0; top: 50%; height: 1px; }
      .compass-line-v { top: 0; bottom: 0; left: 50%; width: 1px; }
      .compass-dot {
        position: absolute;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--bleu-indigo);
        border: 2px solid rgba(107, 107, 255, 0.3);
        transform: translate(-50%, -50%);
        transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 0 12px rgba(107, 107, 255, 0.4);
      }
      .compass-label {
        position: absolute;
        font-family: var(--font-mono);
        font-size: 8px;
        text-transform: uppercase;
        color: var(--text-muted);
        letter-spacing: 0.03em;
      }
      .cl-t { top: 4px; left: 50%; transform: translateX(-50%); }
      .cl-b { bottom: 4px; left: 50%; transform: translateX(-50%); }
      .cl-l { left: 4px; top: 50%; transform: translateY(-50%); }
      .cl-r { right: 4px; top: 50%; transform: translateY(-50%); }
      .compass-legend { flex: 1; }
      .compass-legend-title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .compass-legend-text {
        font-size: 11px;
        color: var(--text-dim);
        line-height: 1.6;
      }

      /* ── Axis row ── */
      .axis-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
      }
      .axis-name { width: 72px; font-size: 11px; text-align: right; flex-shrink: 0; }
      .axis-track {
        flex: 1; height: 12px;
        background: var(--bg);
        border-radius: 6px;
        position: relative;
        overflow: hidden;
      }
      .axis-center { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--border-light); }
      .axis-fill {
        position: absolute; height: 100%;
        border-radius: 6px;
        transition: all 0.5s;
      }
      .axis-ends {
        display: flex;
        justify-content: space-between;
        font-family: var(--font-mono);
        font-size: 8px;
        color: var(--text-muted);
        text-transform: uppercase;
        width: 100%;
      }

      /* ── Political bars ── */
      .pol-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .pol-label {
        width: 80px;
        font-size: 11px;
        text-align: right;
        flex-shrink: 0;
      }
      .pol-track {
        flex: 1;
        height: 14px;
        background: var(--bg);
        border-radius: 7px;
        overflow: hidden;
      }
      .pol-fill {
        height: 100%;
        border-radius: 7px;
        transition: width 0.5s;
      }
      .pol-count {
        width: 28px;
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-dim);
        text-align: right;
        flex-shrink: 0;
      }

      /* ── Topics ── */
      .topic-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .topic-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 12px;
        border-radius: var(--radius-pill);
        font-size: 12px;
        font-weight: 500;
        background: var(--surface3);
        border: 1px solid var(--border);
      }
      .topic-tag .n {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-dim);
      }

      /* ── Tones ── */
      .tone-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 5px;
      }
      .tone-label { width: 90px; font-size: 11px; text-align: right; flex-shrink: 0; text-transform: capitalize; }
      .tone-bar { flex: 1; height: 12px; background: var(--bg); border-radius: 6px; overflow: hidden; }
      .tone-fill { height: 100%; border-radius: 6px; }
      .tone-n { width: 24px; font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); text-align: right; flex-shrink: 0; }

      /* ── Loading / error ── */
      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 40vh;
        gap: 16px;
        color: var(--text-dim);
        font-size: 13px;
      }
      .ldots { display: flex; gap: 4px; }
      .ldots span {
        width: 6px; height: 6px; border-radius: 50%;
        animation: pulse 1.2s ease-in-out infinite;
      }
      .ldots span:nth-child(2) { animation-delay: 0.15s; }
      .ldots span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      .error { text-align: center; padding: 20px; color: var(--rouge); font-size: 13px; }
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
    try { this.stats = await getStats(); }
    catch (e: any) { this.error = e.message || 'Erreur DB'; }
    finally { this.loading = false; }
  }

  render() {
    if (this.loading) return html`
      <div class="loading">
        <div class="ldots">${scrolloutDots.slice(0, 3).map(c => html`<span style="background:${c}"></span>`)}</div>
        Analyse en cours...
      </div>
    `;
    if (this.error) return html`
      <div class="error">${this.error}</div>
      <div style="text-align:center;margin-top:12px"><button class="refresh-btn" @click=${this.loadData}>Reessayer</button></div>
    `;

    const s = this.stats!;
    const a = s.axes;
    const avgPolar = s.avgPolarization ?? 0;
    const enrichRate = s.totalPosts > 0 ? Math.round(s.totalEnriched / s.totalPosts * 100) : 0;

    // Political distribution
    const polEntries = Object.entries(s.political).map(([score, count]) => ({ score: parseInt(score), count: count as number }));
    const maxPol = Math.max(...polEntries.map(e => e.count), 1);

    // Bubble score (HHI inverse)
    const totalDomains = s.topDomains.reduce((acc, d) => acc + d.count, 0);
    const hhi = totalDomains > 0 ? s.topDomains.reduce((acc, d) => acc + Math.pow(d.count / totalDomains, 2), 0) : 1;
    const bubbleScore = Math.round((1 - hhi) * 100);

    return html`
      <div class="page-header">
        <div class="page-title">Profil d'exposition</div>
        <button class="refresh-btn" @click=${this.loadData}>Refresh</button>
      </div>

      <!-- Headline -->
      <div class="section">
        <div class="exposure-headline">
          <div class="exposure-quote">
            On mesure ce qu'on te montre.<br/>Pas ce que tu penses.
          </div>
          <div class="exposure-sub">
            ${s.totalEnriched} posts analyses sur ${s.totalPosts} captures (${enrichRate}%)
          </div>
        </div>
      </div>

      <!-- 3 big metrics: polarisation, bulle, politique -->
      <div class="section">
        <div class="section-label">Tes indicateurs cles</div>

        <div class="big-metric">
          <div class="big-val" style="color:${avgPolar > 0.4 ? 'var(--rouge)' : avgPolar > 0.2 ? 'var(--jaune)' : 'var(--vert-menthe)'}">${avgPolar.toFixed(2)}</div>
          <div class="big-info">
            <div class="big-label">Polarisation</div>
            <div class="big-desc">
              ${avgPolar < 0.15 ? 'Ton feed est neutre — peu de contenu clivant.'
                : avgPolar < 0.3 ? 'Polarisation faible — quelques contenus utilisent des techniques de clivage.'
                : avgPolar < 0.5 ? 'Polarisation moderee — opposition binaire, designations d\'ennemis presentes.'
                : 'Polarisation forte — langage de conflit et absolus moraux frequents.'}
            </div>
          </div>
        </div>

        <div class="gauge"><div class="gauge-dot" style="left:${Math.round(avgPolar * 100)}%"></div></div>
        <div class="gauge-ends"><span>neutre</span><span>polarise</span></div>

        <div class="big-metric" style="margin-top:18px;">
          <div class="big-val" style="color:${bubbleScore > 60 ? 'var(--vert-menthe)' : bubbleScore > 30 ? 'var(--jaune)' : 'var(--rouge)'}">${bubbleScore}</div>
          <div class="big-info">
            <div class="big-label">Diversite du feed</div>
            <div class="big-desc">
              Indice 0-100. ${bubbleScore > 60 ? 'Ton feed est relativement diversifie.'
                : bubbleScore > 30 ? 'Concentration moderee sur certains sujets.'
                : 'Feed tres concentre — tu es probablement dans une bulle de filtre.'}
            </div>
          </div>
        </div>
      </div>

      <!-- Political compass -->
      ${a ? html`
        <div class="section">
          <div class="section-label">Orientation du feed</div>
          <div class="compass-wrap">
            <div class="compass">
              <div class="compass-line-h"></div>
              <div class="compass-line-v"></div>
              <div class="compass-dot" style="left:${50 + a.economic * 45}%;top:${50 - a.societal * 45}%"></div>
              <span class="compass-label cl-t">Progr.</span>
              <span class="compass-label cl-b">Conserv.</span>
              <span class="compass-label cl-l">Gauche</span>
              <span class="compass-label cl-r">Droite</span>
            </div>
            <div class="compass-legend">
              <div class="compass-legend-title">${this.compassDescription(a)}</div>
              <div class="compass-legend-text">
                Position moyenne du contenu politique de ton feed.
                Ce n'est pas ton opinion — c'est ce que l'algorithme te montre.
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-label">Axes detailles</div>
          ${this.renderAxis('Economique', a.economic, 'Gauche', 'Droite')}
          ${this.renderAxis('Societal', a.societal, 'Progr.', 'Conserv.')}
          ${this.renderAxis('Autorite', a.authority, 'Libert.', 'Autorit.')}
          ${this.renderAxis('Systeme', a.system, 'Anti-syst.', 'Institut.')}
        </div>
      ` : ''}

      <!-- Political distribution -->
      <div class="section">
        <div class="section-label">Score politique des posts</div>
        ${polEntries.map(e => html`
          <div class="pol-row">
            <span class="pol-label">${polLabels[e.score] || `Score ${e.score}`}</span>
            <div class="pol-track">
              <div class="pol-fill" style="width:${Math.round(e.count / maxPol * 100)}%;background:${polColors[e.score]}"></div>
            </div>
            <span class="pol-count">${e.count}</span>
          </div>
        `)}
      </div>

      <!-- Topics -->
      ${s.topTopics.length > 0 ? html`
        <div class="section">
          <div class="section-label">Sujets de ton feed</div>
          <div class="topic-grid">
            ${s.topTopics.slice(0, 12).map((t, i) => {
              const color = scrolloutDots[i % scrolloutDots.length];
              return html`
                <div class="topic-tag" style="border-color:${color}40">
                  <span style="color:${color}">${t.topic}</span>
                  <span class="n">${t.count}</span>
                </div>
              `;
            })}
          </div>
        </div>
      ` : ''}

      <!-- Tones -->
      ${s.topTones && s.topTones.length > 0 ? html`
        <div class="section">
          <div class="section-label">Tonalite du contenu</div>
          ${s.topTones.slice(0, 6).map((t, i) => {
            const max = s.topTones![0].count;
            const color = scrolloutDots[(i + 2) % scrolloutDots.length];
            return html`
              <div class="tone-row">
                <span class="tone-label">${t.tone}</span>
                <div class="tone-bar"><div class="tone-fill" style="width:${Math.round(t.count / max * 100)}%;background:${color}"></div></div>
                <span class="tone-n">${t.count}</span>
              </div>
            `;
          })}
        </div>
      ` : ''}

      <!-- Narratives -->
      ${s.topNarratives && s.topNarratives.length > 0 ? html`
        <div class="section">
          <div class="section-label">Cadres narratifs</div>
          ${s.topNarratives.slice(0, 6).map((n, i) => {
            const max = s.topNarratives![0].count;
            const color = scrolloutDots[(i + 4) % scrolloutDots.length];
            return html`
              <div class="tone-row">
                <span class="tone-label">${n.narrative}</span>
                <div class="tone-bar"><div class="tone-fill" style="width:${Math.round(n.count / max * 100)}%;background:${color}"></div></div>
                <span class="tone-n">${n.count}</span>
              </div>
            `;
          })}
        </div>
      ` : ''}

      <!-- Emotions -->
      ${s.topEmotions && s.topEmotions.length > 0 ? html`
        <div class="section">
          <div class="section-label">Emotions provoquees par ton feed</div>
          ${s.topEmotions.slice(0, 6).map((e, i) => {
            const max = s.topEmotions![0].count;
            const emotionColors: Record<string, string> = {
              'neutre': 'var(--text-muted)', 'joie': 'var(--jaune)', 'colère': 'var(--rouge)', 'colere': 'var(--rouge)',
              'peur': 'var(--violet)', 'tristesse': 'var(--bleu-ciel)', 'dégoût': 'var(--vert-eau)', 'degout': 'var(--vert-eau)',
              'surprise': 'var(--orange)',
            };
            const color = emotionColors[e.emotion.toLowerCase()] || scrolloutDots[i % scrolloutDots.length];
            return html`
              <div class="tone-row">
                <span class="tone-label">${e.emotion}</span>
                <div class="tone-bar"><div class="tone-fill" style="width:${Math.round(e.count / max * 100)}%;background:${color}"></div></div>
                <span class="tone-n">${e.count}</span>
              </div>
            `;
          })}
        </div>
      ` : ''}

      <!-- Dwell par sujet : sur quoi tu passes le plus de temps -->
      ${s.dwellByTopic && s.dwellByTopic.length > 0 ? html`
        <div class="section">
          <div class="section-label">Ou tu passes le plus de temps</div>
          ${s.dwellByTopic.slice(0, 8).map((t, i) => {
            const maxDwell = s.dwellByTopic![0].totalDwellMs;
            const color = scrolloutDots[(i + 1) % scrolloutDots.length];
            const secs = Math.round(t.totalDwellMs / 1000);
            const avgSecs = Math.round(t.avgDwellMs / 1000);
            return html`
              <div class="tone-row">
                <span class="tone-label" style="text-transform:capitalize">${t.topic}</span>
                <div class="tone-bar"><div class="tone-fill" style="width:${Math.round(t.totalDwellMs / maxDwell * 100)}%;background:${color}"></div></div>
                <span class="tone-n" style="width:40px">${secs}s</span>
              </div>
            `;
          })}
          <div style="font-size:10px;color:var(--text-muted);margin-top:8px;font-style:italic;">
            Temps total passe sur chaque sujet. L'algorithme optimise pour maximiser ce temps.
          </div>
        </div>
      ` : ''}

      <!-- Comptes les plus polarisants -->
      ${s.polarizingAccounts && s.polarizingAccounts.length > 0 && s.polarizingAccounts.some(a => a.avgPolarization > 0.05) ? html`
        <div class="section">
          <div class="section-label">Comptes par polarisation</div>
          ${s.polarizingAccounts.filter(a => a.avgPolarization > 0).slice(0, 6).map(a => {
            const color = a.avgPolarization > 0.4 ? 'var(--rouge)' : a.avgPolarization > 0.2 ? 'var(--orange)' : 'var(--jaune)';
            return html`
              <div class="tone-row">
                <span class="tone-label">@${a.username}</span>
                <div class="tone-bar"><div class="tone-fill" style="width:${Math.round(a.avgPolarization * 100)}%;background:${color}"></div></div>
                <span class="tone-n">${a.avgPolarization.toFixed(2)}</span>
              </div>
            `;
          })}
        </div>
      ` : ''}

      <!-- Acteurs politiques détectés -->
      ${s.topActors && s.topActors.length > 0 ? html`
        <div class="section">
          <div class="section-label">Acteurs politiques mentionnes</div>
          <div class="topic-grid">
            ${s.topActors.slice(0, 12).map((a, i) => {
              const color = scrolloutDots[(i + 5) % scrolloutDots.length];
              return html`
                <div class="topic-tag" style="border-color:${color}40">
                  <span style="color:${color}">${a.topic}</span>
                  <span class="n">${a.count}</span>
                </div>
              `;
            })}
          </div>
        </div>
      ` : ''}
    `;
  }

  private renderAxis(label: string, value: number, neg: string, pos: string) {
    const absPct = Math.abs(value) * 50;
    const left = value < 0 ? (50 - absPct) : 50;
    const color = Math.abs(value) < 0.1 ? 'var(--text-muted)' : value < 0 ? 'var(--bleu-indigo)' : 'var(--orange)';
    return html`
      <div class="axis-row">
        <span class="axis-name">${label}</span>
        <div class="axis-track">
          <div class="axis-center"></div>
          <div class="axis-fill" style="left:${left}%;width:${absPct}%;background:${color}"></div>
        </div>
      </div>
      <div style="display:flex;padding-left:78px;margin-bottom:10px;">
        <div class="axis-ends"><span>${neg}</span><span>${pos}</span></div>
      </div>
    `;
  }

  private compassDescription(a: { economic: number; societal: number; authority: number; system: number }): string {
    const parts: string[] = [];
    if (Math.abs(a.economic) > 0.15) parts.push(a.economic < 0 ? 'tendance gauche' : 'tendance droite');
    if (Math.abs(a.societal) > 0.15) parts.push(a.societal > 0 ? 'progressiste' : 'conservateur');
    if (parts.length === 0) return 'Position centree';
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
  }
}
