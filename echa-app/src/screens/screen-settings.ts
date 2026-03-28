import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';

@customElement('screen-settings')
export class ScreenSettings extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; padding: 16px; }
      h2 { font-size: 16px; letter-spacing: 1px; margin-bottom: 20px; }

      .field { margin-bottom: 16px; }
      .field label { display: block; font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px; }
      .field input {
        width: 100%;
        background: var(--surface2);
        border: 1px solid var(--border);
        color: var(--text);
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        font-family: inherit;
        font-size: 14px;
      }
      .field input:focus { outline: none; border-color: var(--accent); }

      .hint { font-size: 11px; color: var(--text-dim); margin-top: 4px; line-height: 1.4; }

      .btn {
        background: var(--accent);
        color: #fff;
        border: none;
        padding: 10px 20px;
        border-radius: var(--radius);
        font-size: 14px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        width: 100%;
        margin-top: 8px;
      }
      .btn:active { opacity: 0.8; }

      .status { margin-top: 12px; padding: 10px; border-radius: var(--radius-sm); font-size: 12px; text-align: center; }
      .status-ok { background: #1a3a2a; color: var(--green); }
      .status-err { background: #3a1a1a; color: var(--red); }
      .status-pending { background: var(--surface2); color: var(--text-dim); }

      .current { margin-top: 20px; padding: 12px; background: var(--surface2); border-radius: var(--radius); font-size: 12px; }
      .current .label { color: var(--text-dim); font-size: 10px; text-transform: uppercase; margin-bottom: 4px; }
      .current .val { color: var(--accent); word-break: break-all; }
    `,
  ];

  @state() private apiUrl = localStorage.getItem('echa-api-url') || 'http://localhost:3000';
  @state() private status: 'idle' | 'testing' | 'ok' | 'error' = 'idle';
  @state() private statusMsg = '';

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
      this.statusMsg = `Connecté — ${data.totalPosts ?? 0} posts, ${data.totalSessions ?? 0} sessions`;
    } catch (e: any) {
      this.status = 'error';
      this.statusMsg = e.message || 'Connexion impossible';
    }
  }

  render() {
    return html`
      <h2>Configuration</h2>

      <div class="field">
        <label>URL du serveur ECHA</label>
        <input
          type="url"
          .value=${this.apiUrl}
          @input=${(e: Event) => { this.apiUrl = (e.target as HTMLInputElement).value; }}
          placeholder="http://192.168.x.x:3000"
        />
        <div class="hint">
          Adresse IP du PC où tourne le visualizer (<code>npm run visualizer</code>).
          Le device doit être sur le même réseau WiFi.
        </div>
      </div>

      <button class="btn" @click=${this.testAndSave}>Tester & Sauvegarder</button>

      ${this.status !== 'idle' ? html`
        <div class="status ${this.status === 'ok' ? 'status-ok' : this.status === 'error' ? 'status-err' : 'status-pending'}">
          ${this.statusMsg}
        </div>
      ` : ''}

      <div class="current">
        <div class="label">URL active</div>
        <div class="val">${localStorage.getItem('echa-api-url') || 'http://localhost:3000 (défaut)'}</div>
      </div>
    `;
  }
}
