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

      .floating-cognition {
        position: fixed;
        left: var(--fab-left, calc(100vw - 84px));
        top: var(--fab-top, calc(100vh - 180px));
        width: 56px;
        height: 56px;
        border: none;
        border-radius: 18px;
        background: #c13584;
        box-shadow: 0 16px 30px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
        display: grid;
        place-items: center;
        z-index: 10001;
        cursor: grab;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }
      .floating-cognition:active { cursor: grabbing; }
      .floating-cognition svg { width: 28px; height: 28px; fill: #fff; }
    `,
  ];

  @state() activeTab: Tab = 'home';
  @state() igOpen = false;
  @state() private fabX = 0;
  @state() private fabY = 0;

  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private fabStartX = 0;
  private fabStartY = 0;
  private dragged = false;
  private cognitionListener: { remove: () => Promise<void> } | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.resetFabPosition();
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
      if (this.igOpen) {
        try {
          await hideInstagram();
        } catch (e) {
          console.warn('[ECHA] Failed to hide Instagram for cognition:', e);
        }
      }
      this.activeTab = 'cognition';
      await this.syncCognitionButtonVisibility();
    });
  }

  private get showWebFab() {
    return this.activeTab !== 'cognition' && this.activeTab !== 'instagram';
  }

  private async syncCognitionButtonVisibility() {
    try {
      await setCognitionButtonVisible(this.activeTab === 'instagram');
    } catch (e) {
      console.warn('[ECHA] Failed to sync native cognition button visibility:', e);
    }
  }

  // ── FAB drag ───────────────────────────────────────────────

  private resetFabPosition() {
    this.fabX = Math.max(16, window.innerWidth - 84);
    this.fabY = Math.max(96, window.innerHeight - 180);
  }

  private beginFabDrag(event: PointerEvent) {
    this.dragPointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.fabStartX = this.fabX;
    this.fabStartY = this.fabY;
    this.dragged = false;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  private moveFab(event: PointerEvent) {
    if (this.dragPointerId !== event.pointerId) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.dragged = true;

    const maxX = Math.max(16, window.innerWidth - 76);
    const maxY = Math.max(96, window.innerHeight - 140);
    this.fabX = Math.min(maxX, Math.max(16, this.fabStartX + dx));
    this.fabY = Math.min(maxY, Math.max(96, this.fabStartY + dy));
  }

  private endFabDrag(event: PointerEvent) {
    if (this.dragPointerId !== event.pointerId) return;
    this.dragPointerId = null;
  }

  private async openCognitionFromFab() {
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    await this.switchTab('cognition');
  }

  // ── Render ─────────────────────────────────────────────────

  render() {
    return html`
      <div
        class="screen-area"
        style=${`--fab-left:${this.fabX}px;--fab-top:${this.fabY}px;`}
      >
        ${this.activeTab === 'home' ? html`<screen-home @instagram-opened=${() => { this.igOpen = true; this.activeTab = 'instagram'; }}></screen-home>` : ''}
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

        ${this.showWebFab ? html`
          <button
            class="floating-cognition"
            aria-label="Ouvrir les visualisations cognitives"
            title="Cognition"
            @pointerdown=${this.beginFabDrag}
            @pointermove=${this.moveFab}
            @pointerup=${this.endFabDrag}
            @pointercancel=${this.endFabDrag}
            @click=${this.openCognitionFromFab}
          >
            <svg viewBox="0 0 108 108" aria-hidden="true">
              <path d="M66.94 46.02C72.44 50.07 76 56.61 76 64H32C32 56.61 35.56 50.11 40.98 46.06L36.18 41.19C35.45 40.45 35.45 39.3 36.18 38.56C36.91 37.81 38.05 37.81 38.78 38.56L44.25 44.05C47.18 42.57 50.48 41.71 54 41.71C57.48 41.71 60.78 42.57 63.68 44.05L69.11 38.56C69.84 37.81 70.98 37.81 71.71 38.56C72.44 39.3 72.44 40.45 71.71 41.19L66.94 46.02ZM62.94 56.92C64.08 56.92 65 56.01 65 54.88C65 53.76 64.08 52.85 62.94 52.85C61.8 52.85 60.88 53.76 60.88 54.88C60.88 56.01 61.8 56.92 62.94 56.92ZM45.06 56.92C46.2 56.92 47.13 56.01 47.13 54.88C47.13 53.76 46.2 52.85 45.06 52.85C43.92 52.85 43 53.76 43 54.88C43 56.01 43.92 56.92 45.06 56.92Z"/>
            </svg>
          </button>
        ` : ''}
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
        <button class="tab ${this.activeTab === 'settings' ? 'active' : ''}" @click=${() => this.switchTab('settings')}>
          <span class="tab-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></span>
          Config
        </button>
      </nav>
    `;
  }
}
