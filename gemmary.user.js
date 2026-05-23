// ==UserScript==
// @name         Gemmary
// @namespace    https://github.com/oooooooo/gemmary
// @version      1.0.0
// @description  Page summarizer powered by the Summarizer API for Gemini Nano
// @author       oooooooo
// @match        *://*/*
// @exclude      *://localhost/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/oooooooo/gemmary/main/gemmary.user.js
// @updateURL    https://raw.githubusercontent.com/oooooooo/gemmary/main/gemmary.user.js
// ==/UserScript==

(() => {
	const isJa = navigator.language.startsWith("ja");
	const isChromeBrowser =
		/Chrome\/\d+/.test(navigator.userAgent) &&
		!/Edg\//.test(navigator.userAgent);

	const LANG_SHARED_CONTEXT = isJa
		? "Output must be written entirely in Japanese (日本語), regardless of the language of the input text. 入力テキストの言語に関わらず、必ず日本語のみで要約してください。"
		: "Summarize in English, regardless of the language of the input text.";
	const LABELS = isJa
		? {
				summarizing: "要約中…",
				showSummary: "要約を表示",
				generating: "要約を生成中…",
				close: "閉じる",
				closeEsc: "閉じる (Esc)",
				rerun: "再実行",
				modalLabel: "ページの要約",
				title: "AI ページ要約",
				types: {
					"key-points": "要点",
					tldr: "TL;DR",
					teaser: "ティザー",
					headline: "見出し",
				},
				errorNotAvailable:
					"Summarizer API が利用できません。Chrome 138+ でフラグを有効にしてください。",
				errorNotChrome: "Gemmary は Chrome 138 以降が必要です。",
			}
		: {
				summarizing: "Summarizing…",
				showSummary: "Show summary",
				generating: "Generating summary…",
				close: "Close",
				closeEsc: "Close (Esc)",
				rerun: "Rerun",
				modalLabel: "Page Summary",
				title: "AI Page Summary",
				types: {
					"key-points": "Key Points",
					tldr: "TL;DR",
					teaser: "Teaser",
					headline: "Headline",
				},
				errorNotAvailable:
					"Summarizer API is not available. Enable the required flags in Chrome 138+.",
				errorNotChrome: "Gemmary requires Chrome 138 or later.",
			};

	const BTN_ID = "__ai-gemmary-btn__";
	const MODAL_ID = "__ai-gemmary-modal__";
	const STYLES_ID = "__ai-gemmary-styles__";

	const TYPES = [
		{ value: "key-points" },
		{ value: "tldr" },
		{ value: "teaser" },
		{ value: "headline" },
	];

	function geminiSvg(size, gradId) {
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#EA4335"/><stop offset="30%" stop-color="#4285F4"/><stop offset="100%" stop-color="#4285F4"/></linearGradient></defs><path fill="url(#${gradId})" d="M12 0C12 6 20 12 24 12C20 12 12 18 12 24C12 18 4 12 0 12C4 12 12 6 12 0Z"/></svg>`;
	}
	const GEMINI_ICON = geminiSvg(20, "__sgi__");
	const GEMINI_ICON_BTN = geminiSvg(52, "__sgib__");

	// ── State ────────────────────────────────────────────────────────────────────

	const results = Object.fromEntries(
		TYPES.map(({ value }) => [
			value,
			{ status: "loading", result: "", error: "" },
		]),
	);

	const listeners = new Set();
	function setState(type, patch) {
		Object.assign(results[type], patch);
		listeners.forEach((fn) => {
			fn();
		});
	}

	function primaryStatus() {
		return results["key-points"].status;
	}

	// ── Styles ───────────────────────────────────────────────────────────────────

	const STYLES = `
    #${BTN_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #1a73e8;
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 20px;
      box-shadow: 0 4px 16px rgba(0,0,0,.35);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .2s, transform .15s;
      overflow: hidden;
    }
    #${BTN_ID}:hover { background: #1557b0; transform: scale(1.08); }
    #${BTN_ID}.done { background: #fff; }
    #${BTN_ID}.done:hover { background: #f1f3f4; }
    #${BTN_ID} .btn-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: sSpin .7s linear infinite;
    }
    @keyframes sSpin { to { transform: rotate(360deg); } }

    #${MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.45);
      backdrop-filter: blur(3px);
      animation: sAniIn .15s ease;
    }
    @keyframes sAniIn { from { opacity:0; } to { opacity:1; } }

    #${MODAL_ID} .s-dialog {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 24px 80px rgba(0,0,0,.3);
      width: min(680px, 90vw);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      color: #202124;
      animation: sSlideIn .18s ease;
    }
    @keyframes sSlideIn {
      from { transform: translateY(-16px); opacity:0; }
      to   { transform: translateY(0);     opacity:1; }
    }

    #${MODAL_ID} .s-header {
      padding: 18px 24px 0;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    #${MODAL_ID} .s-title { flex: 1; }
    #${MODAL_ID} .s-title h2 {
      margin: 0 0 4px;
      font-size: 17px;
      font-weight: 600;
      color: #1a73e8;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #${MODAL_ID} .s-title p {
      margin: 0;
      font-size: 12px;
      color: #5f6368;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 460px;
    }
    #${MODAL_ID} .s-close {
      background: none;
      border: none;
      font-size: 20px;
      color: #5f6368;
      cursor: pointer;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .15s;
      flex-shrink: 0;
    }
    #${MODAL_ID} .s-close:hover { background: #f1f3f4; color: #202124; }

    #${MODAL_ID} .s-tabs {
      display: flex;
      padding: 12px 24px 0;
      gap: 4px;
      border-bottom: 1px solid #e8eaed;
    }
    #${MODAL_ID} .s-tab {
      padding: 8px 16px;
      border: none;
      background: none;
      font-size: 13px;
      font-weight: 500;
      color: #5f6368;
      cursor: pointer;
      border-radius: 8px 8px 0 0;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: color .15s, background .15s;
    }
    #${MODAL_ID} .s-tab:hover { color: #202124; background: #f1f3f4; }
    #${MODAL_ID} .s-tab.active {
      color: #1a73e8;
      border-bottom-color: #1a73e8;
      background: none;
    }
    #${MODAL_ID} .s-tab .tab-spinner {
      width: 10px;
      height: 10px;
      border: 1.5px solid #dadce0;
      border-top-color: #5f6368;
      border-radius: 50%;
      animation: sSpin .7s linear infinite;
    }
    #${MODAL_ID} .s-tab.active .tab-spinner { border-top-color: #1a73e8; }
    #${MODAL_ID} .s-tab .tab-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #34a853;
    }
    #${MODAL_ID} .s-tab .tab-err {
      font-size: 11px;
    }

    #${MODAL_ID} .s-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
      line-height: 1.75;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 15px;
      min-height: 120px;
    }
    #${MODAL_ID} .s-body.loading {
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #5f6368;
    }
    #${MODAL_ID} .s-body.error {
      color: #c5221f;
      font-size: 14px;
      white-space: pre-wrap;
    }
    #${MODAL_ID} .s-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid #e8eaed;
      border-top-color: #1a73e8;
      border-radius: 50%;
      animation: sSpin .7s linear infinite;
      flex-shrink: 0;
    }

    #${MODAL_ID} .s-footer {
      padding: 12px 24px;
      border-top: 1px solid #e8eaed;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    #${MODAL_ID} .s-footer button {
      padding: 8px 18px;
      border-radius: 8px;
      border: 1px solid #dadce0;
      background: #fff;
      color: #444;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background .15s;
    }
    #${MODAL_ID} .s-footer button:hover { background: #f1f3f4; }
    #${MODAL_ID} .s-footer button:disabled { opacity: .45; cursor: not-allowed; }
    #${MODAL_ID} .s-footer .btn-rerun {
      border-color: #1a73e8;
      color: #1a73e8;
    }
    #${MODAL_ID} .s-footer .btn-rerun:hover { background: #e8f0fe; }
    #${MODAL_ID} .s-footer .btn-close-footer {
      margin-left: auto;
    }
  `;

	// ── Helpers ──────────────────────────────────────────────────────────────────

	function extractPageText() {
		const clone = document.body.cloneNode(true);
		clone
			.querySelectorAll(
				'script,style,noscript,nav,footer,aside,form,iframe,svg,canvas,[aria-hidden="true"]',
			)
			.forEach((el) => {
				el.remove();
			});

		const content =
			clone.querySelector("article") ||
			clone.querySelector("main") ||
			clone.querySelector('[role="main"]') ||
			clone;

		return (content.innerText || content.textContent || "")
			.replace(/\n{3,}/g, "\n\n")
			.trim()
			.slice(0, 32000);
	}

	async function getSummarizer(type, length) {
		const opts = {
			type,
			format: "markdown",
			length,
			sharedContext: LANG_SHARED_CONTEXT,
		};
		if (typeof Summarizer !== "undefined") {
			return Summarizer.create(opts);
		}
		if (window.ai?.summarizer) {
			return window.ai.summarizer.create(opts);
		}
		return null;
	}

	async function trimToQuota(summarizer, text) {
		if (
			typeof summarizer.measureInputUsage !== "function" ||
			!summarizer.inputQuota
		)
			return text;
		let input = text;
		let usage = await summarizer.measureInputUsage(input);
		while (usage > summarizer.inputQuota && input.length > 0) {
			input = input.slice(0, Math.floor(input.length * 0.8));
			usage = await summarizer.measureInputUsage(input);
		}
		return input;
	}

	// ── Summarization ─────────────────────────────────────────────────────────────

	async function runOne(type, text, length) {
		setState(type, { status: "loading", result: "", error: "" });
		try {
			const summarizer = await getSummarizer(type, length);
			if (!summarizer) {
				setState(type, { status: "error", error: LABELS.errorNotAvailable });
				return;
			}

			const input = await trimToQuota(summarizer, text);

			if (typeof summarizer.summarizeStreaming === "function") {
				const stream = summarizer.summarizeStreaming(input);
				let accumulated = "";
				for await (const chunk of stream) {
					accumulated += chunk;
					setState(type, { status: "loading", result: accumulated });
				}
				setState(type, { status: "done", result: accumulated });
			} else {
				const result = await summarizer.summarize(input);
				setState(type, { status: "done", result });
			}
		} catch (err) {
			console.log(`[Gemmary] ${type} error:`, err);
			setState(type, { status: "error", error: err.message });
		}
	}

	function runAll(length = "medium") {
		const text = extractPageText();
		TYPES.forEach(({ value }) => {
			runOne(value, text, length);
		});
	}

	// ── Button ────────────────────────────────────────────────────────────────────

	function updateButton(btn) {
		const status = primaryStatus();
		if (status === "error") {
			btn.remove();
			return;
		}
		btn.className = "";
		if (status === "loading") {
			btn.innerHTML = '<div class="btn-spinner"></div>';
			btn.title = LABELS.summarizing;
		} else {
			btn.className = "done";
			btn.innerHTML = GEMINI_ICON_BTN;
			btn.title = LABELS.showSummary;
		}
	}

	// ── Modal ─────────────────────────────────────────────────────────────────────

	function injectStyles() {
		if (document.getElementById(STYLES_ID)) return;
		const el = document.createElement("style");
		el.id = STYLES_ID;
		el.textContent = STYLES;
		document.head.appendChild(el);
	}

	function renderTab(tab, typeValue) {
		const r = results[typeValue];
		const indicator = tab.querySelector(".tab-indicator");
		if (r.status === "loading") {
			indicator.className = "tab-indicator tab-spinner";
			indicator.textContent = "";
		} else if (r.status === "error") {
			indicator.className = "tab-indicator tab-err";
			indicator.textContent = "⚠";
		} else {
			indicator.className = "tab-indicator tab-dot";
			indicator.textContent = "";
		}
	}

	function renderBody(body, typeValue) {
		const r = results[typeValue];
		if (r.status === "error") {
			body.className = "s-body error";
			body.textContent = r.error;
		} else if (r.result) {
			body.className = "s-body";
			body.textContent = r.result;
		} else {
			body.className = "s-body loading";
			body.innerHTML = `<div class="s-spinner"></div><span>${LABELS.generating}</span>`;
		}
	}

	function openModal() {
		if (document.getElementById(MODAL_ID)) return;

		let activeType = TYPES[0].value;

		const overlay = document.createElement("div");
		overlay.id = MODAL_ID;

		const tabsHtml = TYPES.map(
			({ value }) => `
      <button class="s-tab${value === activeType ? " active" : ""}" data-type="${value}">
        <span class="tab-indicator tab-spinner"></span>${LABELS.types[value]}
      </button>`,
		).join("");

		overlay.innerHTML = `
      <div class="s-dialog" role="dialog" aria-modal="true" aria-label="${LABELS.modalLabel}">
        <div class="s-header">
          <div class="s-title">
            <h2>${GEMINI_ICON} ${LABELS.title}</h2>
            <p>${document.title || location.href}</p>
          </div>
          <button class="s-close" title="${LABELS.closeEsc}">✕</button>
        </div>
        <div class="s-tabs">${tabsHtml}</div>
        <div class="s-body loading">
          <div class="s-spinner"></div><span>${LABELS.generating}</span>
        </div>
        <div class="s-footer">
          <button class="btn-rerun">${LABELS.rerun}</button>
          <button class="btn-close-footer">${LABELS.close}</button>
        </div>
      </div>
    `;

		const body = overlay.querySelector(".s-body");
		const tabs = overlay.querySelectorAll(".s-tab");
		const btnRerun = overlay.querySelector(".btn-rerun");

		const close = () => {
			listeners.delete(onState);
			overlay.remove();
		};

		tabs.forEach((tab) => {
			tab.onclick = () => {
				activeType = tab.dataset.type;
				tabs.forEach((t) => {
					t.classList.toggle("active", t.dataset.type === activeType);
				});
				renderBody(body, activeType);
			};
		});

		const onState = () => {
			if (primaryStatus() === "error") {
				close();
				return;
			}
			renderBody(body, activeType);
			tabs.forEach((tab) => {
				renderTab(tab, tab.dataset.type);
			});
			btnRerun.disabled = primaryStatus() === "loading";
		};
		listeners.add(onState);
		onState();

		overlay.querySelector(".s-close").onclick = close;
		overlay.querySelector(".btn-close-footer").onclick = close;
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close();
		});

		const onKey = (e) => {
			if (e.key === "Escape") {
				close();
				document.removeEventListener("keydown", onKey);
			}
		};
		document.addEventListener("keydown", onKey);

		btnRerun.onclick = () => runAll();

		document.body.appendChild(overlay);
	}

	// ── Init ──────────────────────────────────────────────────────────────────────

	function showNotChrome() {
		const div = document.createElement("div");
		div.style.cssText =
			"position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#3c4043;color:#fff;padding:12px 20px;border-radius:8px;font-family:system-ui,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.35);";
		div.textContent = LABELS.errorNotChrome;
		document.body.appendChild(div);
		setTimeout(() => div.remove(), 6000);
	}

	function init() {
		if (!isChromeBrowser) {
			showNotChrome();
			return;
		}
		injectStyles();
		if (document.getElementById(BTN_ID)) return;

		const btn = document.createElement("button");
		btn.id = BTN_ID;
		btn.innerHTML = '<div class="btn-spinner"></div>';
		btn.title = LABELS.summarizing;
		btn.onclick = openModal;
		document.body.appendChild(btn);

		listeners.add(() => updateButton(btn));

		runAll();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
