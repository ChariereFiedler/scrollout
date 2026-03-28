import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { getSessions, type SessionSummary } from '../services/db-bridge.js';
import {
  COGNITIVE_METRICS,
  loadCognitiveBubbleData,
  type CognitiveBubbleDataset,
  type CognitiveMetricKey,
  type VisualizationMode,
} from '../services/cognitive-bubble.js';
import type { CognitionControlsChangeDetail } from '../components/cognition-controls.js';
import '../components/cognition-controls.js';
import '../components/cognition-bubble-view.js';
import '../components/cognition-bar-view.js';
import '../components/cognition-radar-view.js';
import '../components/cognition-theme-detail.js';

@customElement('screen-cognition')
export class ScreenCognition extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
        padding: 16px;
        padding-bottom: 24px;
      }

      .hero {
        position: relative;
        overflow: hidden;
        margin-bottom: 14px;
        padding: 18px;
        border-radius: 20px;
        background: radial-gradient(circle at top right, rgba(193, 53, 132, 0.22), transparent 36%),
                    radial-gradient(circle at top left, rgba(56, 151, 240, 0.18), transparent 34%),
                    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.08));
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .hero-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .back-btn {
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 11px;
        font-weight: 700;
        font-family: inherit;
        white-space: nowrap;
      }

      .eyebrow {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--text-dim);
        margin-bottom: 8px;
      }

      h2 {
        font-size: 20px;
        line-height: 1.1;
        margin-bottom: 8px;
      }

      .lead {
        color: var(--text-dim);
        font-size: 12px;
        line-height: 1.5;
        max-width: 40ch;
      }

      .meta-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.07);
        color: var(--text);
        font-size: 11px;
        font-weight: 700;
      }

      .badge-label {
        color: var(--text-dim);
      }

      .grid {
        display: grid;
        gap: 14px;
      }

      .viewport {
        min-height: 280px;
        border-radius: 20px;
        padding: 18px;
        border: 1px dashed rgba(56, 151, 240, 0.25);
        background:
          radial-gradient(circle at 20% 15%, rgba(56, 151, 240, 0.10), transparent 18%),
          radial-gradient(circle at 85% 30%, rgba(193, 53, 132, 0.12), transparent 20%),
          linear-gradient(180deg, rgba(20, 20, 20, 0.92), rgba(10, 10, 10, 0.98));
      }

      .viewport-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
      }

      .viewport-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--text-dim);
      }

      .viewport-note {
        font-size: 11px;
        color: var(--text-muted);
      }

      .placeholder {
        display: grid;
        place-items: center;
        text-align: center;
        min-height: 220px;
        color: var(--text-dim);
        padding: 10px;
      }

      .placeholder strong {
        display: block;
        color: var(--text);
        font-size: 16px;
        margin-bottom: 8px;
      }

      .placeholder p {
        font-size: 12px;
        line-height: 1.55;
        max-width: 34ch;
      }

      .theme-list {
        display: grid;
        gap: 8px;
      }

      .theme-card {
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px;
      }

      .theme-card-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        margin-bottom: 8px;
      }

      .theme-name {
        font-size: 13px;
        font-weight: 800;
      }

      .theme-count {
        font-size: 11px;
        color: var(--text-dim);
      }

      .theme-bar {
        height: 8px;
        border-radius: 999px;
        background: var(--bg);
        overflow: hidden;
      }

      .theme-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--accent), var(--purple));
      }

      .theme-stats {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 10px;
        color: var(--text-muted);
      }

      .state {
        margin-top: 14px;
        padding: 14px;
        border-radius: 14px;
        background: var(--surface2);
        border: 1px solid var(--border);
      }

      .state .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--text-dim);
        margin-bottom: 6px;
      }

      .state .value {
        font-size: 13px;
        line-height: 1.5;
        color: var(--text);
      }

      .error {
        padding: 14px;
        border-radius: 14px;
        background: rgba(237, 73, 86, 0.10);
        border: 1px solid rgba(237, 73, 86, 0.20);
        color: var(--red);
        font-size: 12px;
        line-height: 1.5;
      }

      .loading {
        padding: 30px 14px;
        text-align: center;
        color: var(--text-dim);
      }

      @media (min-width: 700px) {
        .grid {
          grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
          align-items: start;
        }
      }
    `,
  ];

  @state() private sessions: SessionSummary[] = [];
  @state() private bubbleData: CognitiveBubbleDataset | null = null;
  @state() private loading = true;
  @state() private error = '';
  @state() private selectedSessionId = '';
  @state() private mode: VisualizationMode = 'bubble';
  @state() private primaryMetric: CognitiveMetricKey = 'durationTotalMs';
  @state() private secondaryMetric: CognitiveMetricKey = 'engagement';
  @state() private chromaPower = 65;
  @state() private selectedThemeId = '';

  connectedCallback() {
    super.connectedCallback();
    void this.initialize();
  }

  private getPreferredSessionId(sessions: SessionSummary[]): string {
    const sorted = [...sessions].sort((a, b) => {
      if (b.postCount !== a.postCount) return b.postCount - a.postCount;
      return b.capturedAt - a.capturedAt;
    });
    return sorted.find(session => session.postCount > 0)?.id ?? sessions[0]?.id ?? '';
  }

  private async initialize() {
    this.loading = true;
    this.error = '';
    try {
      this.sessions = await getSessions();
      this.selectedSessionId = this.getPreferredSessionId(this.sessions);
      await this.loadDataset();
    } catch (e: any) {
      this.error = e?.message || 'Erreur de chargement';
    } finally {
      this.loading = false;
    }
  }

  private async loadDataset() {
    this.bubbleData = await loadCognitiveBubbleData({
      sessionId: this.selectedSessionId || undefined,
    });

    if ((this.bubbleData.totalPosts === 0 || this.bubbleData.totalThemes === 0) && this.sessions.length > 1) {
      const fallbackSessionId = this.getPreferredSessionId(
        this.sessions.filter(session => session.id !== this.selectedSessionId),
      );
      if (fallbackSessionId) {
        const fallbackData = await loadCognitiveBubbleData({ sessionId: fallbackSessionId });
        if (fallbackData.totalPosts > 0 || fallbackData.totalThemes > 0) {
          this.selectedSessionId = fallbackSessionId;
          this.bubbleData = fallbackData;
        }
      }
    }

    const themes = this.bubbleData.themes ?? [];
    if (themes.length === 0) {
      this.selectedThemeId = '';
      return;
    }

    const selectedThemeExists = themes.some(theme => theme.themeId === this.selectedThemeId);
    if (!selectedThemeExists) {
      this.selectedThemeId = themes[0]?.themeId ?? '';
    }
  }

  private onControlsChange = async (event: CustomEvent<CognitionControlsChangeDetail>) => {
    const { sessionId, mode, primaryMetric, secondaryMetric, chromaPower } = event.detail;

    if (sessionId !== undefined && sessionId !== this.selectedSessionId) {
      this.selectedSessionId = sessionId;
      this.loading = true;
      try {
        await this.loadDataset();
      } catch (e: any) {
        this.error = e?.message || 'Erreur de chargement';
      } finally {
        this.loading = false;
      }
    }

    if (mode !== undefined) this.mode = mode;
    if (primaryMetric !== undefined) this.primaryMetric = primaryMetric;
    if (secondaryMetric !== undefined) this.secondaryMetric = secondaryMetric;
    if (chromaPower !== undefined) this.chromaPower = chromaPower;
  };

  private onThemeSelected = (event: CustomEvent<{ themeId: string }>) => {
    this.selectedThemeId = event.detail.themeId;
  };

  private refresh = async () => {
    this.loading = true;
    this.error = '';
    try {
      await this.loadDataset();
    } catch (e: any) {
      this.error = e?.message || 'Erreur de chargement';
    } finally {
      this.loading = false;
    }
  };

  private goHome = () => {
    this.dispatchEvent(new CustomEvent('go-home', { bubbles: true, composed: true }));
  };

  private get selectedTheme() {
    return this.bubbleData?.themes.find(theme => theme.themeId === this.selectedThemeId) ?? null;
  }

  private renderThemePreview() {
    const themes = this.bubbleData?.themes ?? [];
    const topThemes = themes.slice(0, 5);
    const max = topThemes.length > 0 ? Math.max(...topThemes.map(theme => theme.postCount), 1) : 1;

    if (themes.length === 0) {
      return html`
        <div class="placeholder">
          <div>
            <strong>Aucune thématique disponible</strong>
            <p>Essayez une autre session ou capturez davantage de posts pour peupler cette vue.</p>
          </div>
        </div>
      `;
    }

    return html`
      <div class="theme-list">
        ${topThemes.map(theme => html`
          <div class="theme-card">
            <div class="theme-card-head">
              <div class="theme-name">${theme.themeLabel}</div>
              <div class="theme-count">${theme.postCount} posts</div>
            </div>
            <div class="theme-bar">
              <div class="theme-fill" style="width:${Math.round((theme.postCount / max) * 100)}%"></div>
            </div>
            <div class="theme-stats">
              <span>${Math.round(theme.totalDwellTimeMs / 1000)}s</span>
              <span>engagement ${Math.round(theme.engagementScore)}</span>
              <span>pol ${theme.politicalScoreAverage.toFixed(1)}</span>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  render() {
    const session = this.bubbleData?.session ?? null;
    const themeCount = this.bubbleData?.totalThemes ?? 0;
    const totalPosts = this.bubbleData?.totalPosts ?? 0;
    const availablePosts = this.bubbleData?.totalAvailablePosts ?? 0;
    const primaryLabel = COGNITIVE_METRICS.find(metric => metric.key === this.primaryMetric)?.label ?? this.primaryMetric;
    const secondaryLabel = COGNITIVE_METRICS.find(metric => metric.key === this.secondaryMetric)?.label ?? this.secondaryMetric;

    return html`
      <div class="hero">
        <div class="hero-top">
          <div>
            <div class="eyebrow">Cognition</div>
            <h2>Visualiser la bulle cognitive</h2>
          </div>
          <button class="back-btn" @click=${this.goHome}>Retour accueil</button>
        </div>
        <div class="lead">
          Shell de navigation pour explorer les thèmes capturés à travers plusieurs projections: bulles, barres et radar.
        </div>
        <div class="meta-row">
          <span class="badge">${session ? html`<span><span class="badge-label">Session</span> ${new Date(session.capturedAt).toLocaleDateString('fr-FR')}</span>` : 'Session auto'}</span>
          <span class="badge"><span><span class="badge-label">Thèmes</span> ${themeCount}</span></span>
          <span class="badge"><span><span class="badge-label">Posts</span> ${totalPosts}${this.bubbleData?.isPartial ? ` / ${availablePosts}` : ''}</span></span>
          <span class="badge"><span><span class="badge-label">Mode</span> ${this.mode}</span></span>
        </div>
      </div>

      ${this.error ? html`<div class="error">${this.error}</div>` : nothing}

      <cognition-controls
        .sessions=${this.sessions}
        .selectedSessionId=${this.selectedSessionId}
        .mode=${this.mode}
        .primaryMetric=${this.primaryMetric}
        .secondaryMetric=${this.secondaryMetric}
        .chromaPower=${this.chromaPower}
        .loading=${this.loading}
        @cognition-change=${this.onControlsChange}
        @cognition-refresh=${this.refresh}
      ></cognition-controls>

      ${this.loading ? html`<div class="loading">Chargement des métriques cognitives...</div>` : html`
        <div class="grid" style="margin-top:14px">
      <section class="viewport">
            <div class="viewport-head">
              <div class="viewport-title">Zone de rendu</div>
              <div class="viewport-note">${primaryLabel} vs ${secondaryLabel} · puissance ${this.chromaPower}/100</div>
            </div>
            ${this.mode === 'bubble'
              ? html`
                  <cognition-bubble-view
                    .themes=${this.bubbleData?.themes ?? []}
                    .primaryMetric=${this.primaryMetric}
                    .secondaryMetric=${this.secondaryMetric}
                    .chromaPower=${this.chromaPower}
                    @theme-selected=${this.onThemeSelected}
                  ></cognition-bubble-view>
                `
              : this.mode === 'bar'
                ? html`
                    <cognition-bar-view
                      .themes=${this.bubbleData?.themes ?? []}
                      .primaryMetric=${this.primaryMetric}
                      .secondaryMetric=${this.secondaryMetric}
                      .chromaPower=${this.chromaPower}
                      @theme-selected=${this.onThemeSelected}
                    ></cognition-bar-view>
                  `
              : html`
                  <cognition-radar-view
                    .themes=${this.bubbleData?.themes ?? []}
                    .subtitle=${`Profil global de la session ${session ? new Date(session.capturedAt).toLocaleDateString('fr-FR') : 'sélectionnée'}`}
                  ></cognition-radar-view>
                `}
          </section>

          <aside>
            <div class="state">
              <div class="label">État courant</div>
              <div class="value">
                Mode <strong>${this.mode}</strong>, dimension primaire <strong>${primaryLabel}</strong>, dimension secondaire <strong>${secondaryLabel}</strong>, puissance chromatique <strong>${this.chromaPower}</strong>/100.
              </div>
            </div>

            <div class="state" style="margin-top:12px">
              <div class="label">Aperçu des thèmes</div>
              ${this.renderThemePreview()}
            </div>

            <div class="state" style="margin-top:12px">
              <div class="label">Détail du thème</div>
              <cognition-theme-detail .themeData=${this.selectedTheme}></cognition-theme-detail>
            </div>
          </aside>
        </div>
      `}
    `;
  }
}
