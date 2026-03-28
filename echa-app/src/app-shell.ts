import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots } from './styles/theme.js';
import {
  openInstagram,
  showInstagram,
  hideInstagram,
  isInstagramOpen,
  onOpenCognition,
  setCognitionButtonVisible,
} from './services/native-bridge.js';
import { startDaemon, getDaemonStatus } from './services/enrichment-daemon.js';

type Tab = 'home' | 'instagram' | 'cognition' | 'enrichment' | 'posts' | 'settings';

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

      .ig-placeholder {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        color: var(--text-dim);
        font-size: 13px;
        padding: 20px;
        text-align: center;
      }
      .ig-placeholder .ig-dots {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
      }
      .ig-placeholder .ig-dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        animation: pulse 1.5s ease-in-out infinite;
      }
      .ig-placeholder .ig-dots span:nth-child(2) { animation-delay: 0.15s; }
      .ig-placeholder .ig-dots span:nth-child(3) { animation-delay: 0.3s; }
      .ig-placeholder .ig-dots span:nth-child(4) { animation-delay: 0.45s; }
      .ig-placeholder .ig-dots span:nth-child(5) { animation-delay: 0.6s; }
      .ig-placeholder .ig-dots span:nth-child(6) { animation-delay: 0.75s; }
      .ig-placeholder .ig-dots span:nth-child(7) { animation-delay: 0.9s; }
      .ig-placeholder .ig-dots span:nth-child(8) { animation-delay: 1.05s; }
      .ig-placeholder .ig-dots span:nth-child(9) { animation-delay: 1.2s; }

      @keyframes pulse {
        0%, 100% { opacity: 0.3; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.2); }
      }

      .ig-placeholder .ig-title {
        font-family: var(--font-heading);
        font-size: 16px;
        font-weight: 700;
        color: var(--text);
      }
      .ig-placeholder .ig-sub {
        font-size: 12px;
        color: var(--text-dim);
        max-width: 260px;
        line-height: 1.5;
      }

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
        gap: 3px;
        background: none;
        border: none;
        color: var(--text-dim);
        font-family: var(--font-mono);
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color 0.2s;
        -webkit-tap-highlight-color: transparent;
        position: relative;
      }
      .tab:active { opacity: 0.7; }
      .tab.active { color: var(--accent); }
      .tab.active .tab-icon svg { stroke: var(--accent); }
      .tab-icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
      .tab-icon svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

      .tab-live {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--vert-menthe);
        position: absolute;
        top: 4px;
        right: calc(50% - 14px);
        box-shadow: 0 0 6px var(--vert-menthe);
      }
      .tab-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); position: absolute; top: 4px; right: calc(50% - 16px); }
    `,
  ];

  @state() activeTab: Tab = 'home';
  @state() igOpen = false;
  private cognitionListener: { remove: () => Promise<void> } | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.bindNativeListeners();
    void this.syncCognitionButtonVisibility();
    // Enrichment daemon: purge + auto-start
    this.purgeAndRestart();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.cognitionListener) {
      void this.cognitionListener.remove();
      this.cognitionListener = null;
    }
  }

  // ── Enrichment daemon ──────────────────────────────────────

  private async purgeAndRestart() {
    const purged = localStorage.getItem('scrollout-purge-v6');
    if (!purged) {
      try {
        const plugin = (window as any).Capacitor?.Plugins?.InstaWebView;
        if (plugin?.purgeEmptyEnrichments) {
          const result = await plugin.purgeEmptyEnrichments();
          console.log(`[Scrollout] Purged ${result.deleted} empty enrichments`);
          localStorage.setItem('scrollout-purge-v6', 'done');
        }
      } catch (e) {
        console.warn('[Scrollout] Purge failed:', e);
      }
    }
    this.autoStartDaemon();
  }

  private autoStartDaemon() {
    if (getDaemonStatus().running) return;

    const envKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    const apiKey = localStorage.getItem('scrollout-openai-key') || envKey;
    const rulesOnly = localStorage.getItem('scrollout-rules-only') === 'true';
    const intervalSec = parseInt(localStorage.getItem('scrollout-daemon-interval') || '120');

    if (!localStorage.getItem('scrollout-openai-key') && envKey) {
      localStorage.setItem('scrollout-openai-key', envKey);
    }

    startDaemon({
      intervalSec,
      batchSize: 10,
      threshold: 1,
      apiKey,
      rulesOnly: rulesOnly && !apiKey,
    });
  }

  // ── Navigation ─────────────────────────────────────────────

  private async switchTab(tab: Tab) {
    this.activeTab = tab;

    if (tab === 'instagram') {
      try {
        const status = await isInstagramOpen();
        if (status.open) {
          await showInstagram();
        } else {
          await openInstagram();
        }
        this.igOpen = true;
      } catch (e) {
        console.warn('[Scrollout] Failed to show Instagram:', e);
      }
    } else {
      if (this.igOpen) {
        try {
          await hideInstagram();
        } catch (e) {
          console.warn('[Scrollout] Failed to hide Instagram:', e);
        }
      }
    }

    await this.syncCognitionButtonVisibility();
  }

  private async bindNativeListeners() {
    this.cognitionListener = await onOpenCognition(async () => {
      await this.switchTab('cognition');
    });
  }

  private async syncCognitionButtonVisibility() {
    try {
      await setCognitionButtonVisible(false);
    } catch (e) {
      console.warn('[ECHA] Failed to sync native cognition button visibility:', e);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  private async onInstagramOpenedFromHome() {
    this.igOpen = true;
    this.activeTab = 'instagram';
    await this.syncCognitionButtonVisibility();
  }

  render() {
    return html`
      <div class="screen-area">
        ${this.activeTab === 'home' ? html`<screen-home @instagram-opened=${this.onInstagramOpenedFromHome}></screen-home>` : ''}
        ${this.activeTab === 'instagram' ? html`
          <div class="ig-placeholder">
            <div class="ig-dots">
              ${scrolloutDots.map(c => html`<span style="background:${c}"></span>`)}
            </div>
            <div class="ig-title">Capture en cours</div>
            <div class="ig-sub">Parcourez votre fil Instagram normalement. Scrollout analyse chaque post en arriere-plan.</div>
          </div>
        ` : ''}
        ${this.activeTab === 'cognition' ? html`<screen-cognition @go-home=${() => this.switchTab('home')}></screen-cognition>` : ''}
        ${this.activeTab === 'enrichment' ? html`<screen-enrichment></screen-enrichment>` : ''}
        ${this.activeTab === 'posts' ? html`<screen-posts></screen-posts>` : ''}
        ${this.activeTab === 'settings' ? html`<screen-settings></screen-settings>` : ''}
      </div>

      <nav>
        <button class="tab ${this.activeTab === 'home' ? 'active' : ''}" @click=${() => this.switchTab('home')}>
          <span class="tab-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></span>
          Profil
        </button>
        <button class="tab ${this.activeTab === 'instagram' ? 'active' : ''}" @click=${() => this.switchTab('instagram')} style="position:relative">
          ${this.igOpen ? html`<span class="tab-live"></span>` : ''}
          <span class="tab-icon"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg></span>
          Capture
        </button>
        <button class="tab ${this.activeTab === 'enrichment' ? 'active' : ''}" @click=${() => this.switchTab('enrichment')}>
          <span class="tab-icon"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 12l2 2 4-4"/></svg></span>
          Analyse
        </button>
        <button class="tab ${this.activeTab === 'posts' ? 'active' : ''}" @click=${() => this.switchTab('posts')}>
          <span class="tab-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span>
          Feed
        </button>
        <button class="tab ${this.activeTab === 'cognition' ? 'active' : ''}" @click=${() => this.switchTab('cognition')}>
          <span class="tab-icon"><svg viewBox="0 0 24 24"><path d="M7 4h6.8c3.9 0 6.2 1.8 6.2 8s-2.3 8-6.2 8H7z"/><path d="M10 8h3.5c2.3 0 3.5 1 3.5 4s-1.2 4-3.5 4H10"/></svg></span>
          Data
        </button>
        <button class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click=${() => this.switchTab('settings')}>
          <span class="tab-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></span>
          Config
        </button>
      </nav>
    `;
  }
}
