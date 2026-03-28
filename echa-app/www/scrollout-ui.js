/**
 * Scrollout UI overlay — injected into Instagram WebView.
 * - Adds Scrollout floating button
 * - Hides app banners
 */
(function() {
  'use strict';

  if (window.__SCROLLOUT_UI_LOADED) return;
  window.__SCROLLOUT_UI_LOADED = true;

  const BTN_ID = 'echa-scrollout-btn';

  function createLogoSVG() {
    return `<svg width="28" height="28" viewBox="0 0 540 540" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M540 270C540 419.117 419.117 540 270 540C120.883 540 0 419.117 0 270C0 120.883 120.883 0 270 0C419.117 0 540 120.883 540 270Z" fill="white"/>
<path d="M375.996 269.424C376.38 331.49 345.296 379.381 270.465 378.998C189.877 378.615 163.781 334.938 163.014 269.807C162.246 207.741 193.33 161 269.697 161C344.913 161 375.613 208.124 375.996 269.424ZM309.224 269.424C309.224 239.157 299.63 213.105 270.465 213.488C237.846 213.871 229.403 239.157 229.403 270.19C229.403 301.607 238.613 326.893 270.465 326.51C299.63 326.127 309.607 300.84 309.224 269.424Z" fill="black" fill-opacity="0.9"/>
<path d="M399 167.053C399 180.133 388.396 190.737 375.316 190.737C362.235 190.737 351.632 180.133 351.632 167.053C351.632 153.972 362.235 143.368 375.316 143.368C388.396 143.368 399 153.972 399 167.053Z" fill="#8C43E9"/>
<path d="M351.632 144.316C351.632 151.118 346.118 156.632 339.316 156.632C332.514 156.632 327 151.118 327 144.316C327 137.514 332.514 132 339.316 132C346.118 132 351.632 137.514 351.632 144.316Z" fill="#FF6701"/>
</svg>`;
  }

  function logDebug(msg) {
    console.log('[ScrolloutUI] ' + msg);
    try {
      if (window.EchaBridge && window.EchaBridge.onData) {
        window.EchaBridge.onData(JSON.stringify({ type: 'scrollout_debug', msg }));
      }
    } catch (e) {}
  }

  function killAppBanner() {
    const bannerPatterns = /^(utiliser l'application|use the app|open app|ouvrir|get the app|t[ée]l[ée]charger)$/i;
    document.querySelectorAll('a, div, span, button').forEach(el => {
      const text = (el.textContent || '').trim();
      if (!bannerPatterns.test(text)) return;
      let container = el;
      for (let i = 0; i < 6; i++) {
        const parent = container.parentElement;
        if (!parent || parent === document.body) break;
        const style = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (style.position === 'fixed' || style.position === 'sticky' || rect.height < 70) {
          container = parent;
        } else {
          break;
        }
      }
      container.style.setProperty('display', 'none', 'important');
    });
  }

  function ensureButton() {
    let btn = document.getElementById(BTN_ID);
    if (!btn) {
      btn = document.createElement('div');
      btn.id = BTN_ID;
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', 'Menu Scrollout');
      btn.innerHTML = createLogoSVG();
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (window.EchaBridge && window.EchaBridge.onData) {
            window.EchaBridge.onData(JSON.stringify({ type: 'open_sidebar' }));
          }
        } catch (err) {}
      });
      document.body.appendChild(btn);
      logDebug('FAB injected');
    }

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '58px',
      right: '6px',
      width: '46px',
      height: '46px',
      zIndex: '99999',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#262626',
      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      cursor: 'pointer',
      padding: '0',
      opacity: '1',
      transform: 'scale(1) translateY(0)',
    });

    const url = window.location.href;
    const isFullscreen = url.includes('/stories/') || url.includes('/reels/') || url.includes('/reel/') || url.includes('/p/');
    btn.style.pointerEvents = isFullscreen ? 'none' : '';
    btn.style.opacity = isFullscreen ? '0' : '1';
    btn.style.transform = isFullscreen ? 'scale(0) translateY(30px)' : 'scale(1) translateY(0)';
  }

  function init() {
    logDebug('UI script loaded');
    setTimeout(function() {
      killAppBanner();
      ensureButton();
    }, 1500);

    setInterval(function() {
      killAppBanner();
      ensureButton();
    }, 2000);

    new MutationObserver(function() {
      killAppBanner();
      ensureButton();
    }).observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
