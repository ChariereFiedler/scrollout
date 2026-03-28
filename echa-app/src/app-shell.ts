import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme } from './styles/theme.js';
import {
  openInstagram,
  showInstagram,
  hideInstagram,
  isInstagramOpen,
  onOpenCognition,
  setCognitionButtonVisible,
} from './services/native-bridge.js';

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

      .floating-cognition:active {
        cursor: grabbing;
      }

      .floating-cognition svg {
        width: 28px;
        height: 28px;
        fill: #fff;
      }
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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.cognitionListener) {
      void this.cognitionListener.remove();
      this.cognitionListener = null;
    }
  }

  private async switchTab(tab: Tab) {
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

  render() {
    return html`
      <div
        class="screen-area"
        style=${`--fab-left:${this.fabX}px;--fab-top:${this.fabY}px;`}
      >
        ${this.activeTab === 'home' ? html`<screen-home @instagram-opened=${() => { this.igOpen = true; this.activeTab = 'instagram'; }}></screen-home>` : ''}
        ${this.activeTab === 'instagram' ? html`
          <div class="ig-placeholder">
            <div class="ig-icon">&#128247;</div>
            <div>Instagram est ouvert au-dessus</div>
            <div style="font-size:11px">Parcourez votre fil, les données sont capturées en arrière-plan</div>
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
