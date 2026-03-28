import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { theme, scrolloutDots } from './styles/theme.js';
import {
  openInstagram,
  showInstagram,
  hideInstagram,
  isInstagramOpen,
} from './services/native-bridge.js';
import { startDaemon, getDaemonStatus } from './services/enrichment-daemon.js';

type Tab = 'home' | 'instagram' | 'cognition' | 'posts' | 'settings';

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
        position: relative;
      }

      /* ── Header bar ──────────────────────────────────────── */

      .header {
        display: flex;
        align-items: center;
        height: 48px;
        padding: 0 12px;
        padding-top: env(safe-area-inset-top, 0px);
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
        z-index: 9999;
        position: relative;
      }

      .menu-btn {
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface2);
        border: 1px solid var(--border);
        color: var(--text);
        cursor: pointer;
        border-radius: 50%;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.15s, transform 0.15s;
        padding: 0;
      }
      .menu-btn:active { background: var(--surface3); transform: scale(0.92); }
      .menu-btn .logo-dots {
        display: grid;
        grid-template-columns: repeat(3, 5px);
        gap: 2px;
      }
      .menu-btn .logo-dots span {
        width: 5px;
        height: 5px;
        border-radius: 50%;
      }

      .header-title {
        flex: 1;
        font-family: var(--font-heading);
        font-size: 15px;
        font-weight: 700;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text);
      }

      .header-spacer {
        width: 36px;
      }

      .header-live {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--vert-menthe);
        box-shadow: 0 0 6px var(--vert-menthe);
        margin-left: 6px;
        display: inline-block;
      }

      /* ── Sidebar ─────────────────────────────────────────── */

      .sidebar-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      }
      .sidebar-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }

      .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: 260px;
        background: var(--surface);
        z-index: 10001;
        transform: translateX(-100%);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        padding-top: env(safe-area-inset-top, 0px);
      }
      .sidebar.open {
        transform: translateX(0);
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 20px 18px 16px;
        border-bottom: 1px solid var(--border);
      }
      .sidebar-logo {
        display: flex;
        gap: 3px;
      }
      .sidebar-logo span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .sidebar-brand {
        font-family: var(--font-heading);
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .sidebar-nav {
        flex: 1;
        padding: 12px 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .sidebar-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 20px;
        background: none;
        border: none;
        color: var(--text-dim);
        font-family: var(--font-body);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background 0.15s, color 0.15s;
        text-align: left;
        width: 100%;
        position: relative;
      }
      .sidebar-item:active { background: var(--surface2); }
      .sidebar-item.active {
        color: var(--accent);
        background: rgba(107, 107, 255, 0.08);
      }
      .sidebar-item.active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 8px;
        bottom: 8px;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: var(--accent);
      }

      .sidebar-item .item-icon {
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .sidebar-item .item-icon svg {
        width: 20px;
        height: 20px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .sidebar-footer {
        padding: 16px 20px;
        border-top: 1px solid var(--border);
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        letter-spacing: 0.05em;
      }

      /* ── Wrapped overlay ─────────────────────────────────── */

      .wrapped-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        animation: wrapped-in 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes wrapped-in {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* ── Screen area ─────────────────────────────────────── */

      .screen-area {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
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
    `,
  ];

  @state() activeTab: Tab = 'home';
  @state() igOpen = false;
  @state() showWrapped = false;
  @state() sidebarOpen = false;

  connectedCallback() {
    super.connectedCallback();
    this.purgeAndRestart();
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
    this.sidebarOpen = false;
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
  }

  private get tabLabel(): string {
    const labels: Record<Tab, string> = {
      home: 'Profil',
      instagram: 'Capture',
      cognition: 'Bulle',
      posts: 'Feed',
      settings: 'Config',
    };
    return labels[this.activeTab];
  }

  // ── Render ─────────────────────────────────────────────────

  render() {
    return html`
      ${this.showWrapped ? html`
        <div class="wrapped-overlay">
          <screen-wrapped @close-wrapped=${() => { this.showWrapped = false; }}></screen-wrapped>
        </div>
      ` : ''}

      <!-- Sidebar backdrop -->
      <div
        class="sidebar-backdrop ${this.sidebarOpen ? 'open' : ''}"
        @click=${() => { this.sidebarOpen = false; }}
      ></div>

      <!-- Sidebar -->
      <div class="sidebar ${this.sidebarOpen ? 'open' : ''}">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            ${scrolloutDots.slice(0, 5).map(c => html`<span style="background:${c}"></span>`)}
          </div>
          <span class="sidebar-brand">Scrollout</span>
        </div>

        <div class="sidebar-nav">
          <button class="sidebar-item ${this.activeTab === 'home' ? 'active' : ''}" @click=${() => this.switchTab('home')}>
            <span class="item-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></span>
            Profil
          </button>
          <button class="sidebar-item ${this.activeTab === 'instagram' ? 'active' : ''}" @click=${() => this.switchTab('instagram')}>
            <span class="item-icon"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg></span>
            Capture
            ${this.igOpen ? html`<span class="header-live"></span>` : ''}
          </button>
          <button class="sidebar-item ${this.activeTab === 'cognition' ? 'active' : ''}" @click=${() => this.switchTab('cognition')}>
            <span class="item-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" stroke-width="1.5"/><circle cx="12" cy="12" r="10" stroke-dasharray="3 3" stroke-width="1"/><circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="5.5" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="5.5" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none"/></svg></span>
            Bulle cognitive
          </button>
          <button class="sidebar-item ${this.activeTab === 'posts' ? 'active' : ''}" @click=${() => this.switchTab('posts')}>
            <span class="item-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span>
            Feed
          </button>
          <button class="sidebar-item ${this.activeTab === 'settings' ? 'active' : ''}" @click=${() => this.switchTab('settings')}>
            <span class="item-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></span>
            Configuration
          </button>
        </div>

        <div class="sidebar-footer">
          scrollout v0.9
        </div>
      </div>

      <!-- Header bar -->
      <div class="header">
        <button class="menu-btn" @click=${() => { this.sidebarOpen = !this.sidebarOpen; }}>
          <span class="logo-dots">
            ${scrolloutDots.map(c => html`<span style="background:${c}"></span>`)}
          </span>
        </button>
        <span class="header-title">
          ${this.tabLabel}
          ${this.activeTab === 'instagram' && this.igOpen ? html`<span class="header-live"></span>` : ''}
        </span>
        <span class="header-spacer"></span>
      </div>

      <!-- Screen content -->
      <div class="screen-area">
        ${this.activeTab === 'home' ? html`
          <screen-home
            @instagram-opened=${() => { this.igOpen = true; this.activeTab = 'instagram'; }}
            @open-wrapped=${() => { this.showWrapped = true; }}
          ></screen-home>
          <screen-enrichment></screen-enrichment>
        ` : ''}
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
        ${this.activeTab === 'posts' ? html`<screen-posts></screen-posts>` : ''}
        ${this.activeTab === 'settings' ? html`<screen-settings></screen-settings>` : ''}
      </div>
    `;
  }
}
