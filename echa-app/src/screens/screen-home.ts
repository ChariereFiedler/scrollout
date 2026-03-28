import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme } from '../styles/theme.js';
import { openInstagram, onTrackerData } from '../services/native-bridge.js';

declare global {
  interface Window {
    EchaPlugin?: any;
    Capacitor?: any;
  }
}

@customElement('screen-home')
export class ScreenHome extends LitElement {
  static styles = [
    theme,
    css`
      :host { display: block; }

      .start {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 70vh;
        gap: 20px;
        padding: 20px;
      }
      .start h1 { font-size: 36px; letter-spacing: 6px; font-weight: 800; }
      .start p { color: var(--text-dim); font-size: 14px; text-align: center; }

      .btn {
        background: var(--accent);
        color: #fff;
        border: none;
        padding: 14px 32px;
        border-radius: var(--radius);
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        margin-top: 12px;
      }
      .btn:active { opacity: 0.8; }

      .info {
        color: var(--text-muted);
        font-size: 11px;
        text-align: center;
        line-height: 1.5;
        max-width: 280px;
      }
    `,
  ];

  @state() private launching = false;

  private async launch() {
    this.launching = true;
    try {
      await openInstagram();
      this.dispatchEvent(new CustomEvent('instagram-opened', { bubbles: true, composed: true }));
    } catch (e) {
      console.warn('[ECHA] Launch failed:', e);
    } finally {
      this.launching = false;
    }
  }

  render() {
    return html`
      <div class="start">
        <h1>ECHA</h1>
        <p>Instagram Content Intelligence</p>
        <button class="btn" @click=${this.launch} ?disabled=${this.launching}>
          ${this.launching ? 'Lancement...' : 'Ouvrir Instagram'}
        </button>
        <div class="info">
          Ouvrez Instagram pour commencer la capture.
          Naviguez entre les onglets pour consulter les analyses en temps réel.
        </div>
      </div>
    `;
  }
}
