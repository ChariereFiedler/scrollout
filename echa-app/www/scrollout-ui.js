(function() {
	//#region src/tracker/scrollout-ui.ts
	var BTN_ID = "echa-scrollout-btn";
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
				if (ps.position === "fixed" || ps.position === "sticky" || rect.height < 70) container = parent;
				else break;
			}
			container.style.setProperty("display", "none", "important");
		});
	}
	function nukeIGChrome() {
		killAppBanner();
	}
	function createLogoSVG() {
		return `<svg width="28" height="28" viewBox="0 0 540 540" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M540 270C540 419.117 419.117 540 270 540C120.883 540 0 419.117 0 270C0 120.883 120.883 0 270 0C419.117 0 540 120.883 540 270Z" fill="white"/>
<path d="M375.996 269.424C376.38 331.49 345.296 379.381 270.465 378.998C189.877 378.615 163.781 334.938 163.014 269.807C162.246 207.741 193.33 161 269.697 161C344.913 161 375.613 208.124 375.996 269.424ZM309.224 269.424C309.224 239.157 299.63 213.105 270.465 213.488C237.846 213.871 229.403 239.157 229.403 270.19C229.403 301.607 238.613 326.893 270.465 326.51C299.63 326.127 309.607 300.84 309.224 269.424Z" fill="black" fill-opacity="0.9"/>
<path d="M399 167.053C399 180.133 388.396 190.737 375.316 190.737C362.235 190.737 351.632 180.133 351.632 167.053C351.632 153.972 362.235 143.368 375.316 143.368C388.396 143.368 399 153.972 399 167.053Z" fill="#8C43E9"/>
<path d="M351.632 144.316C351.632 151.118 346.118 156.632 339.316 156.632C332.514 156.632 327 151.118 327 144.316C327 137.514 332.514 132 339.316 132C346.118 132 351.632 137.514 351.632 144.316Z" fill="#FF6701"/>
</svg>`;
	}
	function createButton() {
		const btn = document.createElement("div");
		btn.id = BTN_ID;
		btn.setAttribute("role", "button");
		btn.setAttribute("aria-label", "Menu Scrollout");
		Object.assign(btn.style, {
			width: "26px",
			height: "26px",
			borderRadius: "50%",
			background: "transparent",
			border: "none",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			cursor: "pointer",
			flexShrink: "0",
			padding: "0",
			WebkitTapHighlightColor: "transparent"
		});
		btn.innerHTML = createLogoSVG();
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			e.preventDefault();
			try {
				window.EchaBridge?.onData(JSON.stringify({ type: "open_sidebar" }));
			} catch {}
		});
		return btn;
	}
	function injectScrolloutButton() {
		const existing = document.getElementById(BTN_ID);
		if (existing && document.body.contains(existing)) return;
		if (existing) existing.remove();
		const btn = createButton();
		Object.assign(btn.style, {
			position: "fixed",
			bottom: "58px",
			right: "6px",
			width: "46px",
			height: "46px",
			zIndex: "99999",
			borderRadius: "50%",
			background: "#262626",
			boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
		});
		document.body.appendChild(btn);
		logDebug("FAB injected above profile icon");
	}
	function logDebug(msg) {
		console.log("[Scrollout] " + msg);
		try {
			window.EchaBridge?.onData(JSON.stringify({
				type: "scrollout_debug",
				msg
			}));
		} catch {}
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
		}).observe(document.body, {
			childList: true,
			subtree: true
		});
	}
	init();
	//#endregion
})();
