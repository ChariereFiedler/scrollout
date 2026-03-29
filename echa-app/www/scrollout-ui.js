"use strict";
var ScrolloutUI = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/tracker/scrollout-ui.ts
  var scrollout_ui_exports = {};
  __export(scrollout_ui_exports, {
    __test__: () => __test__
  });
  var SCROLLOUT_COLORS = [
    "#FFE94A",
    "#6BE88B",
    "#6B6BFF",
    "#FF7B33",
    "#E88BE8",
    "#8B44E8",
    "#FF2222",
    "#88CCFF",
    "#88EEBB"
  ];
  var BTN_ID = "echa-scrollout-btn";
  var FIREWORK_ID = "echa-scrollout-firework";
  var STYLE_ID = "echa-scrollout-styles";
  var CHARGE_THRESHOLD = 15;
  var currentProgress = 0;
  var isCharged = false;
  var lastKnownPostCount = 0;
  var scrollVelocity = 0;
  var lastScrollY = 0;
  var blobIntensity = 0;
  var blobPhase = 0;
  var blobRafId = null;
  var scrollHeat = 0;
  function killAppBanner() {
    const bannerPatterns = /^(utiliser l.application|use the app|open app|ouvrir|get the app|t[ée]l[ée]charger)$/i;
    document.querySelectorAll("a, div, span, button").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (!bannerPatterns.test(text)) return;
      let container = el;
      for (let i = 0; i < 6; i++) {
        const parent = container.parentElement;
        if (!parent || parent === document.body) break;
        const ps = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (ps.position === "fixed" || ps.position === "sticky" || rect.height < 70) {
          container = parent;
        } else {
          break;
        }
      }
      container.style.setProperty("display", "none", "important");
    });
  }
  function nukeIGChrome() {
    killAppBanner();
  }
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    @keyframes echa-pulse-glow {
      0%, 100% { box-shadow: 0 0 10px 3px rgba(107,107,255,0.4), 0 2px 8px rgba(0,0,0,0.5); }
      50% { box-shadow: 0 0 22px 8px rgba(139,68,232,0.6), 0 2px 8px rgba(0,0,0,0.5); }
    }

    #${BTN_ID} {
      transition: border-radius 0.15s ease-out;
    }

    #${BTN_ID}.echa-charged {
      animation: echa-pulse-glow 1.8s ease-in-out infinite;
    }

    .echa-particle {
      position: absolute;
      width: 6px; height: 6px;
      border-radius: 50%;
      pointer-events: none;
    }
  `;
    document.head.appendChild(style);
  }
  function createLogoSVG() {
    return `<svg width="28" height="28" viewBox="0 0 540 540" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M540 270C540 419.117 419.117 540 270 540C120.883 540 0 419.117 0 270C0 120.883 120.883 0 270 0C419.117 0 540 120.883 540 270Z" fill="white"/>
<path d="M375.996 269.424C376.38 331.49 345.296 379.381 270.465 378.998C189.877 378.615 163.781 334.938 163.014 269.807C162.246 207.741 193.33 161 269.697 161C344.913 161 375.613 208.124 375.996 269.424ZM309.224 269.424C309.224 239.157 299.63 213.105 270.465 213.488C237.846 213.871 229.403 239.157 229.403 270.19C229.403 301.607 238.613 326.893 270.465 326.51C299.63 326.127 309.607 300.84 309.224 269.424Z" fill="black" fill-opacity="0.9"/>
<path d="M399 167.053C399 180.133 388.396 190.737 375.316 190.737C362.235 190.737 351.632 180.133 351.632 167.053C351.632 153.972 362.235 143.368 375.316 143.368C388.396 143.368 399 153.972 399 167.053Z" fill="#8C43E9"/>
<path d="M351.632 144.316C351.632 151.118 346.118 156.632 339.316 156.632C332.514 156.632 327 151.118 327 144.316C327 137.514 332.514 132 339.316 132C346.118 132 351.632 137.514 351.632 144.316Z" fill="#FF6701"/>
</svg>`;
  }
  function spawnFirework(btn) {
    const existing = document.getElementById(FIREWORK_ID);
    if (existing) existing.remove();
    const container = document.createElement("div");
    container.id = FIREWORK_ID;
    Object.assign(container.style, {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      pointerEvents: "none",
      overflow: "visible",
      zIndex: "99998"
    });
    spawnBurst(container, { count: 24, minDist: 40, maxDist: 90, minSize: 5, maxSize: 10, duration: 1e3, delay: 0 });
    spawnBurst(container, { count: 16, minDist: 20, maxDist: 55, minSize: 3, maxSize: 7, duration: 800, delay: 150 });
    spawnBurst(container, { count: 12, minDist: 10, maxDist: 35, minSize: 2, maxSize: 5, duration: 600, delay: 300 });
    const flash = document.createElement("span");
    Object.assign(flash.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: "0",
      height: "0",
      borderRadius: "50%",
      background: "rgba(255,255,255,0.9)",
      transform: "translate(-50%,-50%)",
      pointerEvents: "none"
    });
    container.appendChild(flash);
    requestAnimationFrame(() => {
      flash.animate([
        { width: "0px", height: "0px", opacity: "1", background: "rgba(255,255,255,0.95)" },
        { width: "70px", height: "70px", opacity: "0.6", background: "rgba(139,68,232,0.4)", offset: 0.3 },
        { width: "100px", height: "100px", opacity: "0", background: "rgba(107,107,255,0)" }
      ], { duration: 600, easing: "cubic-bezier(0, 0.6, 0.3, 1)", fill: "forwards" });
    });
    btn.appendChild(container);
    setTimeout(() => container.remove(), 1800);
  }
  function spawnBurst(container, opts) {
    for (let i = 0; i < opts.count; i++) {
      const particle = document.createElement("span");
      particle.className = "echa-particle";
      const angle = 360 / opts.count * i + (Math.random() - 0.5) * 20;
      const distance = opts.minDist + Math.random() * (opts.maxDist - opts.minDist);
      const rad = angle * Math.PI / 180;
      const tx = Math.cos(rad) * distance;
      const ty = Math.sin(rad) * distance;
      const color = SCROLLOUT_COLORS[i % SCROLLOUT_COLORS.length];
      const size = opts.minSize + Math.random() * (opts.maxSize - opts.minSize);
      const delay = opts.delay + Math.random() * 100;
      Object.assign(particle.style, {
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        top: "50%",
        left: "50%",
        marginTop: `${-size / 2}px`,
        marginLeft: `${-size / 2}px`,
        boxShadow: `0 0 ${size}px ${color}`
      });
      requestAnimationFrame(() => {
        particle.animate([
          { transform: "translate(0, 0) scale(1.2)", opacity: "1" },
          { transform: `translate(${tx * 0.6}px, ${ty * 0.6}px) scale(1)`, opacity: "0.9", offset: 0.3 },
          { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: "0" }
        ], {
          duration: opts.duration + Math.random() * 400,
          delay,
          easing: "cubic-bezier(0, 0.7, 0.3, 1)",
          fill: "forwards"
        });
      });
      container.appendChild(particle);
    }
  }
  function createButton() {
    const btn = document.createElement("div");
    btn.id = BTN_ID;
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", "Menu Scrollout");
    Object.assign(btn.style, {
      position: "relative",
      width: "46px",
      height: "46px",
      borderRadius: "50%",
      background: "#262626",
      border: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: "0",
      padding: "0",
      WebkitTapHighlightColor: "transparent",
      boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
    });
    const logoWrap = document.createElement("div");
    Object.assign(logoWrap.style, {
      width: "28px",
      height: "28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      zIndex: "2"
    });
    logoWrap.innerHTML = createLogoSVG();
    btn.appendChild(logoWrap);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        if (isCharged) {
          window.EchaBridge?.onData(JSON.stringify({ type: "open_wrapped" }));
          resetCharge();
        } else {
          window.EchaBridge?.onData(JSON.stringify({ type: "open_sidebar" }));
        }
      } catch {
      }
    });
    return btn;
  }
  function updateProgress(progress) {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const clamped = Math.min(1, Math.max(0, progress));
    currentProgress = clamped;
    if (clamped >= 1 && !isCharged) {
      isCharged = true;
      btn.classList.add("echa-charged");
      btn.setAttribute("aria-label", "Voir votre Wrapped Scrollout");
      spawnFirework(btn);
      logDebug(`Charged! ${CHARGE_THRESHOLD} posts reached`);
    }
  }
  function incandescent(progress) {
    const p = Math.min(1, Math.max(0, progress));
    const stops = [
      [0, 38, 38, 38],
      // #262626 dark
      [0.4, 55, 35, 30],
      // barely warm (stays dark a long time)
      [0.6, 100, 35, 15],
      // dark ember
      [0.75, 170, 55, 10],
      // red glow
      [0.85, 220, 130, 20],
      // orange
      [0.95, 250, 220, 120],
      // yellow
      [1, 255, 250, 230]
      // white-hot
    ];
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (p >= stops[i][0] && p <= stops[i + 1][0]) {
        lo = stops[i];
        hi = stops[i + 1];
        break;
      }
    }
    const range = hi[0] - lo[0] || 1;
    const t = (p - lo[0]) / range;
    const r = Math.round(lo[1] + (hi[1] - lo[1]) * t);
    const g = Math.round(lo[2] + (hi[2] - lo[2]) * t);
    const b = Math.round(lo[3] + (hi[3] - lo[3]) * t);
    return `rgb(${r},${g},${b})`;
  }
  function blobRadius(intensity, phase) {
    if (intensity < 0.01) return "50%";
    const i = Math.min(1, intensity);
    const offsets = [
      Math.sin(phase) * 35,
      Math.cos(phase * 1.3 + 1) * 30,
      Math.sin(phase * 0.9 + 2) * 38,
      Math.cos(phase * 1.1 + 3) * 32,
      Math.sin(phase * 1.2 + 0.5) * 33,
      Math.cos(phase * 0.8 + 1.5) * 36,
      Math.sin(phase * 1.4 + 2.5) * 28,
      Math.cos(phase * 1.1 + 3.5) * 34
    ];
    const vals = offsets.map((o) => Math.round(50 + o * i));
    return `${vals[0]}% ${vals[1]}% ${vals[2]}% ${vals[3]}% / ${vals[4]}% ${vals[5]}% ${vals[6]}% ${vals[7]}%`;
  }
  function startBlobLoop() {
    if (blobRafId !== null) return;
    lastScrollY = window.scrollY || window.pageYOffset || 0;
    function tick() {
      const btn = document.getElementById(BTN_ID);
      if (!btn || btn.dataset.hidden === "1") {
        blobRafId = requestAnimationFrame(tick);
        return;
      }
      const currentY = window.scrollY || window.pageYOffset || 0;
      const delta = Math.abs(currentY - lastScrollY);
      lastScrollY = currentY;
      scrollVelocity = delta;
      const targetIntensity = Math.min(1, delta / 25);
      if (targetIntensity > blobIntensity) {
        blobIntensity += (targetIntensity - blobIntensity) * 0.5;
      } else {
        blobIntensity += (targetIntensity - blobIntensity) * 0.05;
      }
      blobPhase += 0.06 + blobIntensity * 0.25;
      const radius = blobRadius(blobIntensity, blobPhase);
      btn.style.borderRadius = radius;
      const scale = 1 + blobIntensity * 0.18;
      if (!isCharged) {
        btn.style.transform = `scale(${scale.toFixed(3)})`;
      }
      scrollHeat = Math.min(1, scrollHeat + delta * 3e-4);
      if (delta < 2) {
        scrollHeat = Math.max(0, scrollHeat - 1e-3);
      }
      const heatLevel = Math.max(scrollHeat, currentProgress);
      btn.style.background = incandescent(heatLevel);
      blobRafId = requestAnimationFrame(tick);
    }
    blobRafId = requestAnimationFrame(tick);
  }
  function resetCharge() {
    isCharged = false;
    currentProgress = 0;
    lastKnownPostCount = 0;
    const btn = document.getElementById(BTN_ID);
    if (btn) {
      btn.classList.remove("echa-charged");
      btn.setAttribute("aria-label", "Menu Scrollout");
    }
    updateProgress(0);
  }
  function pollPostCount() {
    const count = window.__echaPostCount || 0;
    if (count <= lastKnownPostCount) return;
    lastKnownPostCount = count;
    const progress = count / CHARGE_THRESHOLD;
    updateProgress(progress);
    if (progress >= 1 && isCharged) {
      scheduleFireworkLoop();
    }
  }
  var fireworkLoopId = null;
  function scheduleFireworkLoop() {
    if (fireworkLoopId) return;
    fireworkLoopId = setInterval(() => {
      if (!isCharged) {
        if (fireworkLoopId) clearInterval(fireworkLoopId);
        fireworkLoopId = null;
        return;
      }
      const btn = document.getElementById(BTN_ID);
      if (btn && btn.dataset.hidden !== "1") {
        spawnFirework(btn);
      }
    }, 8e3);
  }
  function injectScrolloutButton() {
    const existing = document.getElementById(BTN_ID);
    if (existing && document.body.contains(existing)) return;
    if (existing) existing.remove();
    injectStyles();
    const btn = createButton();
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 58px)",
      right: "6px",
      zIndex: "99999"
    });
    document.body.appendChild(btn);
    const count = window.__echaPostCount || 0;
    if (count > 0) {
      lastKnownPostCount = count;
      updateProgress(count / CHARGE_THRESHOLD);
    }
    logDebug("FAB injected with progress ring");
  }
  function logDebug(msg) {
    console.log("[Scrollout] " + msg);
    try {
      window.EchaBridge?.onData(JSON.stringify({ type: "scrollout_debug", msg }));
    } catch {
    }
  }
  function init() {
    if (window.__SCROLLOUT_UI_LOADED) return;
    window.__SCROLLOUT_UI_LOADED = true;
    logDebug("UI script loaded, waiting for IG render...");
    setTimeout(() => {
      nukeIGChrome();
      injectScrolloutButton();
    }, 1500);
    setTimeout(() => {
      if (!document.getElementById(BTN_ID)) {
        logDebug("Retry injection at 3s...");
        injectScrolloutButton();
      }
    }, 3e3);
    setTimeout(() => {
      if (!document.getElementById(BTN_ID)) {
        logDebug("Retry injection at 6s...");
        injectScrolloutButton();
      }
    }, 6e3);
    setInterval(pollPostCount, 1e3);
    startBlobLoop();
    setInterval(() => {
      nukeIGChrome();
      const existing = document.getElementById(BTN_ID);
      if (!existing || !document.body.contains(existing)) {
        if (existing) existing.remove();
        injectScrolloutButton();
      }
      const btn = document.getElementById(BTN_ID);
      if (btn) {
        const url = window.location.href;
        const isFullscreen = url.includes("/stories/") || url.includes("/reels/") || url.includes("/reel/") || url.includes("/p/");
        const isHidden = btn.dataset.hidden === "1";
        if (isFullscreen && !isHidden) {
          btn.dataset.hidden = "1";
          btn.style.pointerEvents = "none";
          btn.style.transition = "transform 0.15s cubic-bezier(0, 0, 0.2, 1.6), opacity 0.15s ease";
          btn.style.transform = "scale(1.2) translateY(-12px)";
          setTimeout(() => {
            btn.style.transition = "transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease";
            btn.style.transform = "scale(0) translateY(30px)";
            btn.style.opacity = "0";
          }, 150);
        } else if (!isFullscreen && isHidden) {
          btn.dataset.hidden = "0";
          btn.style.pointerEvents = "";
          btn.style.transition = "transform 0.35s cubic-bezier(0, 0, 0.2, 1.4), opacity 0.25s ease";
          btn.style.transform = "scale(1) translateY(0)";
          btn.style.opacity = "1";
        }
      }
    }, 2e3);
    new MutationObserver(() => {
      const existing = document.getElementById(BTN_ID);
      if (!existing || !document.body.contains(existing)) {
        if (existing) existing.remove();
        injectScrolloutButton();
      }
      nukeIGChrome();
    }).observe(document.body, { childList: true, subtree: true });
  }
  var __test__ = {
    CHARGE_THRESHOLD,
    resetCharge,
    pollPostCount,
    incandescent,
    blobRadius,
    get currentProgress() {
      return currentProgress;
    },
    get isCharged() {
      return isCharged;
    },
    get blobIntensity() {
      return blobIntensity;
    }
  };
  init();
  return __toCommonJS(scrollout_ui_exports);
})();
