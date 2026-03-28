import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots } from '../styles/theme.js';
import {
  startDaemon,
  stopDaemon,
  getDaemonStatus,
  onStatusChange,
  triggerNow,
  type DaemonStatus,
} from '../services/enrichment-daemon.js';

@customElement('screen-settings')
export class ScreenSettings extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; padding-bottom: 32px; }

      .page-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
      }
      .page-title {
        font-family: var(--font-heading);
        font-size: 22px;
        font-weight: 700;
      }

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

      .field { margin-bottom: 14px; }
      .field label {
        display: block;
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-dim);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-bottom: 6px;
      }
      .field input {
        width: 100%;
        background: var(--surface3);
        border: 1px solid var(--border);
        color: var(--text);
        padding: 12px 14px;
        border-radius: var(--radius-sm);
        font-family: var(--font-body);
        font-size: 14px;
        transition: border-color 0.15s;
      }
      .field input:focus {
        outline: none;
        border-color: var(--bleu-indigo);
      }
      .hint {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 6px;
        line-height: 1.5;
      }

      .btn {
        background: var(--bleu-indigo);
        color: #fff;
        border: none;
        padding: 12px 24px;
        border-radius: var(--radius-pill);
        font-size: 14px;
        font-weight: 600;
        font-family: var(--font-body);
        cursor: pointer;
        width: 100%;
        transition: transform 0.15s;
      }
      .btn:active { transform: scale(0.97); }

      .status {
        margin-top: 12px;
        padding: 12px;
        border-radius: var(--radius-sm);
        font-size: 12px;
        text-align: center;
      }
      .status-ok {
        background: rgba(107, 232, 139, 0.1);
        color: var(--vert-menthe);
        border: 1px solid rgba(107, 232, 139, 0.2);
      }
      .status-err {
        background: rgba(255, 34, 34, 0.1);
        color: var(--rouge);
        border: 1px solid rgba(255, 34, 34, 0.2);
      }
      .status-pending {
        background: var(--surface3);
        color: var(--text-dim);
      }

      .current-url {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
      }
      .current-url .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--vert-menthe);
        flex-shrink: 0;
      }
      .current-url .url {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--bleu-indigo);
        word-break: break-all;
      }

      /* ── About section ── */
      .about {
        text-align: center;
        padding: 20px 16px;
      }
      .about-logo {
        font-family: var(--font-heading);
        font-size: 20px;
        font-weight: 900;
        margin-bottom: 6px;
      }
      .about-logo .o { color: var(--bleu-indigo); }
      .about-dots {
        display: flex;
        justify-content: center;
        gap: 4px;
        margin-bottom: 8px;
      }
      .about-dots span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        opacity: 0.7;
      }
      .about-tagline {
        font-family: var(--font-mono);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .about-version {
        font-size: 11px;
        color: var(--text-muted);
      }
      .about-privacy {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-dim);
        margin-top: 12px;
        line-height: 1.6;
        letter-spacing: 0.02em;
      }
    `,
  ];

  @state() private apiUrl = localStorage.getItem('echa-api-url') || 'http://localhost:3000';
  @state() private status: 'idle' | 'testing' | 'ok' | 'error' = 'idle';
  @state() private statusMsg = '';

  // Enrichment daemon
  @state() private openaiKey = localStorage.getItem('scrollout-openai-key') || '';
  @state() private daemonInterval = parseInt(localStorage.getItem('scrollout-daemon-interval') || '120');
  @state() private daemonStatus: DaemonStatus = getDaemonStatus();
  @state() private rulesOnly = localStorage.getItem('scrollout-rules-only') === 'true';

  private unsubDaemon?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.unsubDaemon = onStatusChange(s => { this.daemonStatus = s; });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubDaemon?.();
  }

  private toggleDaemon() {
    if (this.daemonStatus.running) {
      stopDaemon();
    } else {
      if (!this.rulesOnly && !this.openaiKey) {
        this.statusMsg = 'Clé API OpenAI requise pour le mode LLM';
        this.status = 'error';
        return;
      }
      localStorage.setItem('scrollout-openai-key', this.openaiKey);
      localStorage.setItem('scrollout-daemon-interval', String(this.daemonInterval));
      localStorage.setItem('scrollout-rules-only', String(this.rulesOnly));

      startDaemon({
        intervalSec: this.daemonInterval,
        batchSize: 10,
        threshold: 2,
        apiKey: this.openaiKey,
        rulesOnly: this.rulesOnly,
      });
    }
  }

  private async manualEnrich() {
    if (!this.daemonStatus.running) {
      // Start temporarily for a single trigger
      if (!this.rulesOnly && !this.openaiKey) {
        this.statusMsg = 'Clé API OpenAI requise';
        this.status = 'error';
        return;
      }
      localStorage.setItem('scrollout-openai-key', this.openaiKey);
      startDaemon({
        intervalSec: 999999,
        batchSize: 20,
        threshold: 1,
        apiKey: this.openaiKey,
        rulesOnly: this.rulesOnly,
      });
      return;
    }
    await triggerNow();
  }

  private async testAndSave() {
    const url = this.apiUrl.replace(/\/+$/, '');
    this.status = 'testing';
    this.statusMsg = 'Test de connexion...';

    try {
      const res = await fetch(`${url}/api/stats`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localStorage.setItem('echa-api-url', url);
      this.status = 'ok';
      this.statusMsg = `Connecte — ${data.totalPosts ?? 0} posts, ${data.totalSessions ?? 0} sessions`;
    } catch (e: any) {
      this.status = 'error';
      this.statusMsg = e.message || 'Connexion impossible';
    }
  }

  render() {
    return html`
      <div class="page-header">
        <div class="page-title">Configuration</div>
      </div>

      <div class="section">
        <div class="section-label">Serveur Scrollout</div>
        <div class="field">
          <label>URL du serveur</label>
          <input
            type="url"
            .value=${this.apiUrl}
            @input=${(e: Event) => { this.apiUrl = (e.target as HTMLInputElement).value; }}
            placeholder="http://192.168.x.x:3000"
          />
          <div class="hint">
            Adresse IP du PC ou tourne le visualizer.
            Le device et le PC doivent etre sur le meme reseau WiFi.
          </div>
        </div>

        <button class="btn" @click=${this.testAndSave}>Tester la connexion</button>

        ${this.status !== 'idle' ? html`
          <div class="status ${this.status === 'ok' ? 'status-ok' : this.status === 'error' ? 'status-err' : 'status-pending'}">
            ${this.statusMsg}
          </div>
        ` : ''}

        <div class="current-url">
          <span class="dot" style="background:${this.status === 'ok' ? 'var(--vert-menthe)' : 'var(--text-muted)'}"></span>
          <span class="url">${localStorage.getItem('echa-api-url') || 'http://localhost:3000'}</span>
        </div>
      </div>

      <!-- Enrichissement auto -->
      <div class="section">
        <div class="section-label">Enrichissement automatique</div>

        <div class="field">
          <label>Cle API OpenAI</label>
          <input
            type="password"
            .value=${this.openaiKey}
            @input=${(e: Event) => { this.openaiKey = (e.target as HTMLInputElement).value; }}
            placeholder="sk-..."
          />
          <div class="hint">
            Necessaire pour l'enrichissement LLM (gpt-4o-mini).
            Sans cle, seules les regles locales sont appliquees.
          </div>
        </div>

        <div class="field">
          <label>Intervalle (secondes)</label>
          <input
            type="number"
            .value=${String(this.daemonInterval)}
            @input=${(e: Event) => { this.daemonInterval = parseInt((e.target as HTMLInputElement).value) || 120; }}
            min="30"
            max="3600"
          />
        </div>

        <div class="field" style="display:flex;align-items:center;gap:10px;">
          <input
            type="checkbox"
            id="rulesOnly"
            .checked=${this.rulesOnly}
            @change=${(e: Event) => { this.rulesOnly = (e.target as HTMLInputElement).checked; }}
          />
          <label for="rulesOnly" style="margin:0;cursor:pointer;">Rules only (pas de LLM, gratuit)</label>
        </div>

        <div style="display:flex;gap:8px;">
          <button
            class="btn"
            style="flex:1;background:${this.daemonStatus.running ? 'var(--rouge)' : 'var(--bleu-indigo)'}"
            @click=${this.toggleDaemon}
          >
            ${this.daemonStatus.running ? 'Arreter' : 'Demarrer'} le daemon
          </button>
          <button
            class="btn"
            style="flex:0 0 auto;background:var(--surface3);color:var(--text);"
            @click=${this.manualEnrich}
          >
            Enrichir maintenant
          </button>
        </div>

        ${this.daemonStatus.running || this.daemonStatus.totalProcessed > 0 ? html`
          <div class="status ${this.daemonStatus.running ? 'status-ok' : 'status-pending'}">
            ${this.daemonStatus.running ? 'En cours' : 'Arrete'}
            — ${this.daemonStatus.totalSucceeded} enrichis,
            ${this.daemonStatus.totalFailed} erreurs,
            ${this.daemonStatus.pendingPosts} en attente
            ${this.daemonStatus.lastEnrichAt ? html`<br/>Dernier: ${new Date(this.daemonStatus.lastEnrichAt).toLocaleTimeString()}` : ''}
          </div>
        ` : ''}
      </div>

      <!-- About -->
      <div class="about">
        <div class="about-logo">Scr<span class="o">o</span>llout</div>
        <div class="about-dots">
          ${scrolloutDots.map(c => html`<span style="background:${c}"></span>`)}
        </div>
        <div class="about-tagline">Reprends le controle sur ton feed</div>
        <div class="about-version">v0.1.0-alpha</div>
        <div class="about-privacy">
          Aucune donnee ne quitte ton telephone.<br/>
          Pas de tracking. Pas de cloud. Pas de compte.<br/>
          Fait avec colere et TypeScript.
        </div>
      </div>
    `;
  }
}
