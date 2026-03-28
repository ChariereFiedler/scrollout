import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme } from './styles/theme.js';
import { openInstagram, showInstagram, hideInstagram, isInstagramOpen } from './services/native-bridge.js';

type Tab = 'home' | 'instagram' | 'enrichment' | 'posts' | 'settings';

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        height: 100dvh;
        background: var(--bg);
        color: var(--text);
      }

      .screen-area {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding-top: env(safe-area-inset-top, 0px);
      }

      /* When Instagram is visible, the native WebView sits on top —
         show a minimal placeholder so the user knows what's happening */
      .ig-placeholder {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: var(--text-dim);
        font-size: 13px;
        padding: 20px;
        text-align: center;
      }
      .ig-placeholder .ig-icon { font-size: 40px; }

      nav {
        display: flex;
        background: var(--surface);
        border-top: 1px solid var(--border);
        padding-bottom: env(safe-area-inset-bottom, 0px);
        flex-shrink: 0;
        z-index: 9999;
        position: relative;
      }

      .tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 8px 4px 6px;
        gap: 2px;
        background: none;
        border: none;
        color: var(--text-dim);
        font-family: inherit;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.15s;
        -webkit-tap-highlight-color: transparent;
      }
      .tab:active { opacity: 0.7; }
      .tab.active { color: var(--accent); }
      .tab-icon { font-size: 20px; line-height: 1; }
      .tab-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); position: absolute; top: 4px; right: calc(50% - 16px); }
    `,
  ];

  @state() activeTab: Tab = 'home';
  @state() igOpen = false;

  private async switchTab(tab: Tab) {
    const previousTab = this.activeTab;
    this.activeTab = tab;

    if (tab === 'instagram') {
      // Check if Instagram is already open
      try {
        const status = await isInstagramOpen();
        if (status.open) {
          await showInstagram();
        } else {
          await openInstagram();
        }
        this.igOpen = true;
      } catch (e) {
        console.warn('[ECHA] Failed to show Instagram:', e);
      }
    } else {
      // Hide Instagram WebView when switching to other tabs
      if (this.igOpen) {
        try {
          await hideInstagram();
        } catch (e) {
          console.warn('[ECHA] Failed to hide Instagram:', e);
        }
      }
    }
  }

  render() {
    return html`
      <div class="screen-area">
        ${this.activeTab === 'home' ? html`<screen-home @instagram-opened=${() => { this.igOpen = true; this.activeTab = 'instagram'; }}></screen-home>` : ''}
        ${this.activeTab === 'instagram' ? html`
          <div class="ig-placeholder">
            <div class="ig-icon">&#128247;</div>
            <div>Instagram est ouvert au-dessus</div>
            <div style="font-size:11px">Parcourez votre fil, les données sont capturées en arrière-plan</div>
          </div>
        ` : ''}
        ${this.activeTab === 'enrichment' ? html`<screen-enrichment></screen-enrichment>` : ''}
        ${this.activeTab === 'posts' ? html`<screen-posts></screen-posts>` : ''}
        ${this.activeTab === 'settings' ? html`<screen-settings></screen-settings>` : ''}
      </div>

      <nav>
        ${!this.igOpen ? html`
          <button class="tab ${this.activeTab === 'home' ? 'active' : ''}" @click=${() => this.switchTab('home')}>
            <span class="tab-icon">&#9673;</span>
            Accueil
          </button>
        ` : ''}
        <button class="tab ${this.activeTab === 'instagram' ? 'active' : ''}" @click=${() => this.switchTab('instagram')} style="position:relative">
          ${this.igOpen ? html`<span class="tab-dot"></span>` : ''}
          <span class="tab-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg></span>
          Instagram
        </button>
        <button class="tab ${this.activeTab === 'enrichment' ? 'active' : ''}" @click=${() => this.switchTab('enrichment')}>
          <span class="tab-icon">&#9733;</span>
          Enrichment
        </button>
        <button class="tab ${this.activeTab === 'posts' ? 'active' : ''}" @click=${() => this.switchTab('posts')}>
          <span class="tab-icon">&#9776;</span>
          Posts
        </button>
        <button class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click=${() => this.switchTab('settings')}>
          <span class="tab-icon">&#9881;</span>
          Config
        </button>
      </nav>
    `;
  }
}
