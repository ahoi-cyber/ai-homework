/*!
 * ============================================================================
 * AI Homework Solver Pro - Core Engine V5.4
 * Copyright (c) 2026 ahoi-cyber (https://github.com/ahoi-cyber/ai-homework)
 * Author: ahoi-cyber
 * License: All Rights Reserved. Nghiêm cấm sao chép hoặc xóa bản quyền.
 * ============================================================================
 */

window.initAISolver = function () {
    'use strict';

    // ==================== ©️ KHÓA BẢN QUYỀN & LINK CHIA SẺ ====================
    const COPYRIGHT = Object.freeze({
        AUTHOR: 'ahoi-cyber',
        YEAR: '2026',
        VERSION: '5.4',
        REPO: 'https://github.com/ahoi-cyber/ai-homework',
        SHARE_URL: 'https://share.gemini.google/zxOtJrRfkFjDP',
        SIGNATURE: '© 2026 Bản quyền thuộc về ahoi-cyber'
    });

    console.log(
        `%c ✨ AI Homework Solver v${COPYRIGHT.VERSION} %c ${COPYRIGHT.SIGNATURE} `,
        'background:#89b4fa; color:#11111b; font-weight:bold; padding:4px 8px; border-radius:4px 0 0 4px;',
        'background:#1e1e2e; color:#cdd6f4; padding:4px 8px; border-radius:0 4px 4px 0; border:1px solid #89b4fa;'
    );

    try {
        Object.defineProperty(window, '__AI_SOLVER_AUTHOR__', {
            value: COPYRIGHT.AUTHOR,
            writable: false,
            configurable: false
        });
    } catch {}

    const PROVIDERS = {
        gemini: {
            name: 'Google Gemini',
            defaultModel: 'gemini-3.8-flash',
            models: ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-3.5-flash-lite']
        },
        groq: {
            name: 'Groq (Siêu tốc)',
            url: 'https://api.groq.com/openai/v1/chat/completions',
            defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
            models: ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile']
        },
        openrouter: {
            name: 'OpenRouter (Đa Model)',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            defaultModel: 'deepseek/deepseek-chat:free',
            models: ['deepseek/deepseek-chat:free', 'google/gemini-2.5-flash-exp:free', 'qwen/qwen-2.5-vl-72b-instruct:free']
        },
        openai: {
            name: 'OpenAI (ChatGPT)',
            url: 'https://api.openai.com/v1/chat/completions',
            defaultModel: 'gpt-4o-mini',
            models: ['gpt-4o-mini', 'gpt-4o']
        }
    };

    let currentProvider = GM_getValue('AI_PROVIDER', 'gemini');
    let modelId = GM_getValue(`MODEL_${currentProvider}`, PROVIDERS[currentProvider].defaultModel);
    let isStealthUI = GM_getValue('STEALTH_UI', false);
    let isShieldActive = GM_getValue('ANTI_DETECT_SHIELD', true);
    let isTitleSpoof = GM_getValue('TITLE_SPOOF', false);
    let isHumanDelay = GM_getValue('HUMAN_DELAY', true);
    let isPanicMode = false;

    const originalPageTitle = document.title;
    let lastSelectedText = '';
    let lastSolvedSnapshot = null; // Lưu đáp án lần giải gần nhất để xuất gói chia sẻ cho bạn bè
    let keyIndexMap = { gemini: 0, groq: 0, openrouter: 0, openai: 0 };

    // ==================== 💾 BỘ NHỚ ĐỆM CÂU HỎI (LOCAL CACHE) ====================
    function getCacheStore() {
        try {
            return JSON.parse(GM_getValue('AI_QUESTION_CACHE', '{}'));
        } catch {
            return {};
        }
    }

    function setCacheItem(hashKey, value) {
        try {
            const store = getCacheStore();
            const keys = Object.keys(store);
            if (keys.length > 400) delete store[keys[0]];
            store[hashKey] = value;
            GM_setValue('AI_QUESTION_CACHE', JSON.stringify(store));
        } catch {}
    }

    function clearCacheStore() {
        GM_setValue('AI_QUESTION_CACHE', '{}');
        showStatus('🗑️ Đã xóa sạch bộ nhớ đệm câu hỏi (Cache)!');
    }

    function normalizeHash(str) {
        return String(str || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 350);
    }

    function toBase64UTF8(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    function fromBase64UTF8(b64) {
        return decodeURIComponent(escape(atob(b64)));
    }

    // ==================== 📐 TRÍCH XUẤT CÔNG THỨC TOÁN (LATEX / MATHJAX / KATEX) ====================
    function extractTextWithMath(rootNode) {
        if (!rootNode) return '';
        const clone = rootNode.cloneNode(true);

        clone.querySelectorAll('annotation[encoding="application/x-tex"]').forEach((ann) => {
            const tex = ann.textContent.trim();
            const container = ann.closest('.katex, mjx-container, math') || ann;
            container.replaceWith(` $${tex}$ `);
        });

        clone.querySelectorAll('script[type^="math/tex"], [data-latex], [data-tex], [data-math]').forEach((el) => {
            const tex = el.getAttribute('data-latex') || el.getAttribute('data-tex') || el.getAttribute('data-math') || el.textContent.trim();
            if (tex) el.replaceWith(` $${tex}$ `);
        });

        clone.querySelectorAll('img').forEach((img) => {
            const alt = (img.getAttribute('alt') || img.getAttribute('title') || '').trim();
            if (alt) img.replaceWith(` [${alt}] `);
        });

        clone.querySelectorAll('.katex-html, .MJX_Assistive_MathML, [data-ai-mark]').forEach((el) => el.remove());

        return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function getSelectionTextWithMath() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return '';
        const container = document.createElement('div');
        for (let i = 0; i < sel.rangeCount; i++) {
            container.appendChild(sel.getRangeAt(i).cloneContents());
        }
        return extractTextWithMath(container) || sel.toString().trim();
    }

    document.addEventListener('selectionchange', () => {
        const text = getSelectionTextWithMath();
        if (text.length > 2) lastSelectedText = text;
    });

    // ==================== 🛡️ KHIÊN CHỐNG PHÁT HIỆN CHUYỂN TAB & MỞ KHÓA COPY ====================
    const unlockStyle = document.createElement('style');
    unlockStyle.textContent = `
        *, *::before, *::after {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            user-select: text !important;
        }
    `;

    function applyPageSpoofing() {
        try {
            const pageWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const pageDoc = pageWin.document;

            Object.defineProperty(pageDoc, 'hidden', { get: () => false, configurable: true });
            Object.defineProperty(pageDoc, 'mozHidden', { get: () => false, configurable: true });
            Object.defineProperty(pageDoc, 'webkitHidden', { get: () => false, configurable: true });
            Object.defineProperty(pageDoc, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(pageDoc, 'webkitVisibilityState', { get: () => 'visible', configurable: true });

            pageDoc.hasFocus = () => true;
            pageWin.onblur = null;
            pageDoc.onvisibilitychange = null;
        } catch {}
    }

    function clearInlineCopyLocks() {
        if (!isShieldActive || isPanicMode) return;
        const lockedAttrs = ['oncopy', 'oncut', 'onpaste', 'oncontextmenu', 'onselectstart', 'ondragstart', 'onblur'];
        document.querySelectorAll('[oncopy],[oncontextmenu],[onselectstart],[oncut]').forEach((el) => {
            lockedAttrs.forEach((attr) => {
                if (el.hasAttribute(attr)) el.removeAttribute(attr);
                el[attr] = null;
            });
        });
        if (document.body) lockedAttrs.forEach((attr) => (document.body[attr] = null));
        document.oncopy = null;
        document.oncontextmenu = null;
        document.onselectstart = null;
    }

    const blockedBlurEvents = ['visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange', 'blur', 'focusout', 'pagehide', 'mouseleave'];
    blockedBlurEvents.forEach((evtName) => {
        window.addEventListener(
            evtName,
            (e) => {
                if (!isShieldActive) return;
                if (e.target === window || e.target === document || e.target === document.documentElement || e.target === document.body || evtName.includes('visibility') || evtName === 'pagehide') {
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                }
            },
            true
        );
    });

    const unlockedCopyEvents = ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'];
    unlockedCopyEvents.forEach((evtName) => {
        window.addEventListener(
            evtName,
            (e) => {
                if (!isShieldActive) return;
                e.stopImmediatePropagation();
            },
            true
        );
    });

    // ==================== 👻 CLOSED SHADOW DOM & GIAO DIỆN CHÍNH ====================
    const shadowHost = document.createElement('div');
    shadowHost.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; pointer-events: none;';
    document.documentElement.appendChild(shadowHost);

    const shadow = shadowHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
        * { box-sizing: border-box; }
        #ai-mobile-fab { position: fixed; right: 8px; bottom: 45%; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-family: system-ui, -apple-system, sans-serif; user-select: none; pointer-events: auto; }
        #ai-fab-trigger { width: 34px; height: 34px; border-radius: 50%; background: rgba(30, 30, 46, 0.45); color: #cdd6f4; border: 1px solid rgba(255,255,255,0.15); font-size: 13px; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        #ai-mobile-fab.stealth #ai-fab-trigger { opacity: 0.18; width: 26px; height: 26px; font-size: 10px; }
        #ai-fab-menu { display: none; flex-direction: column; gap: 4px; background: rgba(24, 24, 37, 0.96); padding: 6px; border-radius: 10px; border: 1px solid #313244; box-shadow: 0 6px 20px rgba(0,0,0,0.45); max-height: 76vh; overflow-y: auto; }
        #ai-fab-menu.open { display: flex; }
        .ai-fab-item { background: #313244; color: #cdd6f4; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 500; text-align: left; cursor: pointer; white-space: nowrap; }
        .ai-fab-item:hover, .ai-fab-item:active { background: #45475a; }
        .ai-fab-copyright { font-size: 10px; color: #89b4fa; text-align: center; padding-top: 4px; margin-top: 2px; border-top: 1px solid #313244; font-weight: 600; }
        #ai-solver-panel { position: fixed; bottom: 12px; right: 12px; width: min(92vw, 415px); max-height: 50vh; background: #1e1e2e; color: #cdd6f4; border: 1px solid #313244; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 2147483646; font-family: system-ui, -apple-system, sans-serif; display: none; flex-direction: column; overflow: hidden; pointer-events: auto; }
        #ai-solver-panel.stealth-mode { width: min(75vw, 240px); max-height: 115px; background: rgba(20, 20, 30, 0.75); border: 1px solid rgba(255,255,255,0.08); box-shadow: none; opacity: 0.22; border-radius: 6px; }
        #ai-solver-panel.stealth-mode:hover, #ai-solver-panel.stealth-mode:active { opacity: 0.92; }
        #ai-solver-header { background: #181825; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; font-weight: 600; font-size: 11.5px; }
        #ai-solver-header .actions button { background: transparent; border: none; color: #a6adc8; cursor: pointer; font-size: 12.5px; padding: 2px 2.8px; }
        #ai-solver-header .actions button:hover { color: #fff; }
        #ai-solver-body { padding: 10px; overflow-y: auto; font-size: 13px; line-height: 1.45; white-space: pre-wrap; -webkit-overflow-scrolling: touch; }
        #ai-solver-footer { background: #11111b; color: #a6adc8; padding: 4px 10px; font-size: 10.5px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #313244; user-select: none; }
        #ai-solver-footer a, #ai-solver-footer button { color: #89b4fa; text-decoration: none; font-weight: 700; background: none; border: none; cursor: pointer; font-size: 10.5px; padding: 0; }
        #ai-solver-footer a:hover, #ai-solver-footer button:hover { text-decoration: underline; }
        #ai-snip-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.2); cursor: crosshair; z-index: 2147483647; display: none; touch-action: none; user-select: none; pointer-events: auto; }
        #ai-snip-hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(24, 24, 37, 0.9); color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-family: system-ui, sans-serif; pointer-events: none; }
        #ai-snip-box { position: fixed; border: 1.5px dashed #89b4fa; background: rgba(137, 180, 250, 0.15); pointer-events: none; display: none; }
    `;
    shadow.appendChild(style);

    const fabContainer = document.createElement('div');
    fabContainer.id = 'ai-mobile-fab';
    if (isStealthUI) fabContainer.classList.add('stealth');
    fabContainer.innerHTML = `
        <div id="ai-fab-menu">
            <button class="ai-fab-item" id="fab-solve-text">📝 Giải chữ & LaTeX (Alt+Q)</button>
            <button class="ai-fab-item" id="fab-snip-img">📸 Vuốt chụp ảnh/toán (Alt+S)</button>
            <button class="ai-fab-item" id="fab-scan-stealth">🎯 Chấm ngầm đáp án (Alt+A)</button>
            <button class="ai-fab-item" id="fab-scan-auto">⚡ Tự khoanh & Điền ô trống (Alt+Shift+A)</button>
            <button class="ai-fab-item" id="fab-import-link">📥 Nhập Link / Mã đáp án (Alt+I)</button>
            <button class="ai-fab-item" id="fab-share">🔗 Chia sẻ / Xuất gói đáp án</button>
            <button class="ai-fab-item" id="fab-toggle-delay">⏱️ Trễ giống người thật: ${isHumanDelay ? 'BẬT' : 'TẮT'}</button>
            <button class="ai-fab-item" id="fab-toggle-title">🏷️ Hiện đáp án trên Tab: ${isTitleSpoof ? 'BẬT' : 'TẮT'}</button>
            <button class="ai-fab-item" id="fab-toggle-shield">🛡️ Khiên Anti-Tab & Copy: ${isShieldActive ? 'BẬT' : 'TẮT'}</button>
            <button class="ai-fab-item" id="fab-check-keys">🩺 Kiểm tra API Key (Alt+C)</button>
            <button class="ai-fab-item" id="fab-switch-provider">🌐 Nguồn AI: ${PROVIDERS[currentProvider].name}</button>
            <button class="ai-fab-item" id="fab-change-model">🤖 Đổi Model AI</button>
            <button class="ai-fab-item" id="fab-set-key">🔑 Quản lý danh sách Key</button>
            <button class="ai-fab-item" id="fab-clear-cache">🗑️ Xóa Cache câu hỏi</button>
            <button class="ai-fab-item" id="fab-toggle-stealth">🕵️ Chế độ mờ (Alt+H)</button>
            <button class="ai-fab-item" id="fab-panic">🚨 Khẩn cấp Ẩn tất cả (Alt+X)</button>
            <div class="ai-fab-copyright">© ${COPYRIGHT.YEAR} by ${COPYRIGHT.AUTHOR}</div>
        </div>
        <button id="ai-fab-trigger" title="AI Solver by ${COPYRIGHT.AUTHOR}">•••</button>
    `;
    shadow.appendChild(fabContainer);

    const panel = document.createElement('div');
    panel.id = 'ai-solver-panel';
    if (isStealthUI) panel.classList.add('stealth-mode');
    panel.innerHTML = `
        <div id="ai-solver-header">
            <span id="ai-solver-title">✨ ${currentProvider.toUpperCase()}: ${modelId.split('/').pop()}</span>
            <div class="actions">
                <button id="ai-btn-import" title="Nhập Link / Mã đáp án của người khác (Alt+I)">📥</button>
                <button id="ai-btn-share" title="Chia sẻ / Xuất gói đáp án">🔗</button>
                <button id="ai-btn-shield" title="Bật/Tắt Khiên Anti-Tab & Copy (Alt+U)">🛡️</button>
                <button id="ai-btn-title" title="Bật/Tắt hiện đáp án trên tên Tab">🏷️</button>
                <button id="ai-btn-check" title="Kiểm tra API Key (Alt+C)">🩺</button>
                <button id="ai-btn-provider" title="Đổi nguồn AI">🌐</button>
                <button id="ai-btn-model" title="Đổi Model">🤖</button>
                <button id="ai-btn-key" title="Quản lý API Key">🔑</button>
                <button id="ai-btn-stealth" title="Bật/Tắt chế độ mờ (Alt+H)">🕵️</button>
                <button id="ai-btn-copy" title="Copy">📋</button>
                <button id="ai-btn-close" title="Đóng">✖</button>
            </div>
        </div>
        <div id="ai-solver-body">👻 AI Homework Solver v${COPYRIGHT.VERSION} (${COPYRIGHT.SIGNATURE})\n• Alt+A: Chấm ngầm | Alt+Shift+A: Tự khoanh & điền\n• Alt+I: Nhập Link đáp án người khác | Alt+X: Ẩn khẩn cấp</div>
        <div id="ai-solver-footer">
            <span>© ${COPYRIGHT.YEAR} Bản quyền <a href="${COPYRIGHT.REPO}" target="_blank">${COPYRIGHT.AUTHOR}</a></span>
            <span><button id="ai-footer-import">📥 Nhập</button> · <button id="ai-footer-share">🔗 Share</button> · v${COPYRIGHT.VERSION}</span>
        </div>
    `;
    shadow.appendChild(panel);

    const snipOverlay = document.createElement('div');
    snipOverlay.id = 'ai-snip-overlay';
    snipOverlay.innerHTML = `<div id="ai-snip-hint">Kéo chọn vùng câu hỏi hoặc công thức (${COPYRIGHT.AUTHOR})</div>`;
    const snipBox = document.createElement('div');
    snipBox.id = 'ai-snip-box';
    snipOverlay.appendChild(snipBox);
    shadow.appendChild(snipOverlay);

    const $ = (id) => shadow.getElementById(id);
    const bodyEl = $('ai-solver-body');
    const fabMenu = $('ai-fab-menu');

    // ==================== 📥 NHẬP LINK / MÃ ĐÁP ÁN CỦA NGƯỜI KHÁC (ALT + I) ====================
    function extractCleanUrl(rawInput) {
        const match = String(rawInput || '').match(/https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/);
        return match ? match[0].replace(/[.,;)\]]+$/, '') : '';
    }

    function stripHtmlToPlainText(html) {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            doc.querySelectorAll('script, style, noscript, svg, template, head').forEach((el) => el.remove());
            return (doc.body?.innerText || doc.body?.textContent || '').replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
        } catch {
            return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    // Giải mã Gói đáp án AHOI_ANS:... (tự khớp kể cả khi bị đảo thứ tự câu hỏi và đảo đáp án!)
    function matchAnswerPackToQuestions(packString, questions) {
        const tokenMatch = packString.match(/AHOI_ANS:([A-Za-z0-9+/=]+)/);
        if (!tokenMatch) return null;
        try {
            const parsed = JSON.parse(fromBase64UTF8(tokenMatch[1]));
            if (!parsed || !Array.isArray(parsed.items)) return null;

            const resultsMap = {};
            let matchedCount = 0;

            questions.forEach((qObj, qIdx) => {
                const qHash = normalizeHash(qObj.question);
                // Ưu tiên tìm đúng nội dung câu hỏi (chống đảo đề), nếu không thấy mới khớp theo số thứ tự
                let found = parsed.items.find((it) => it.q && (it.q === qHash || qHash.includes(it.q) || it.q.includes(qHash)));
                if (!found && parsed.items[qIdx] && parsed.items[qIdx].t === qObj.type) {
                    found = parsed.items[qIdx];
                }
                if (!found) return;

                if (qObj.type === 'mcq') {
                    let indices = [];
                    // Khớp theo nội dung đáp án đúng (chống đảo đáp án A/B/C/D)
                    if (Array.isArray(found.at) && found.at.length > 0) {
                        found.at.forEach((ansTextHash) => {
                            const optIdx = qObj.options.findIndex((o) => {
                                const oHash = normalizeHash(o.text);
                                return oHash === ansTextHash || oHash.includes(ansTextHash) || ansTextHash.includes(oHash);
                            });
                            if (optIdx !== -1 && !indices.includes(optIdx)) indices.push(optIdx);
                        });
                    }
                    // Dự phòng theo chỉ số gốc
                    if (indices.length === 0 && Array.isArray(found.ai)) {
                        indices = found.ai.filter((idx) => idx >= 0 && idx < qObj.options.length);
                    }
                    if (indices.length > 0) {
                        resultsMap[qIdx] = { id: qIdx, answerIndices: indices };
                        matchedCount++;
                    }
                } else if (qObj.type === 'text' && found.ta !== undefined) {
                    resultsMap[qIdx] = { id: qIdx, textAnswer: found.ta };
                    matchedCount++;
                }
            });

            return matchedCount > 0 ? resultsMap : null;
        } catch {
            return null;
        }
    }

    // Tách đáp án từ JSON hoặc chuỗi đáp án chuẩn (VD: "1A 2C 3D", "Câu 1: B", "1. A")
    function parseStructuredAnswers(rawText, questions) {
        const resultsMap = {};
        let count = 0;

        // 1. Thử đọc mảng JSON chuẩn từ script
        try {
            const jsonMatch = rawText.match(/\[\s*\{[\s\S]*?"id"[\s\S]*?\}\s*\]/);
            if (jsonMatch) {
                const arr = JSON.parse(jsonMatch[0]);
                arr.forEach((it) => {
                    if (typeof it.id === 'number' && questions[it.id]) {
                        resultsMap[it.id] = it;
                        count++;
                    }
                });
                if (count > 0) return resultsMap;
            }
        } catch {}

        // 2. Thử tách các cặp số thứ tự + chữ cái đáp án (VD: Câu 1: A, 2. C, 3D, C4:B)
        const pattern = /(?:^|[\s|,;\n])(?:câu\s*|c\s*)?(\d{1,3})\s*(?:[:.\-)\]]\s*|\s+)?([A-F]{1,4})(?=$|[\s|,;.\n)])/gi;
        let match;
        while ((match = pattern.exec(rawText)) !== null) {
            const qNum = parseInt(match[1], 10);
            const letters = match[2].toUpperCase();
            if (qNum < 1 || qNum > questions.length) continue;

            const qIdx = qNum - 1;
            const qObj = questions[qIdx];
            if (!qObj || qObj.type !== 'mcq') continue;

            const indices = [];
            for (const ch of letters) {
                const optIdx = ch.charCodeAt(0) - 65;
                if (optIdx >= 0 && optIdx < qObj.options.length && !indices.includes(optIdx)) {
                    indices.push(optIdx);
                }
            }
            if (indices.length > 0 && !resultsMap[qIdx]) {
                resultsMap[qIdx] = { id: qIdx, answerIndices: indices };
                count++;
            }
        }

        return count > 0 ? resultsMap : null;
    }

    // Nhờ AI đối chiếu nội dung văn bản từ link người khác sang danh sách câu hỏi trên trang hiện tại
    function mapExternalTextWithAI(externalText, questions, autoAct) {
        if (!ensureApiKey()) return;
        showStatus(`🤖 Đang đối chiếu đáp án từ nguồn chia sẻ với ${questions.length} câu hỏi trên trang...`);

        const payloadForAI = questions.map((q, idx) => ({
            id: idx,
            type: q.type,
            question: q.question,
            options: q.type === 'mcq' ? q.options.map((o, oIdx) => `${oIdx}: ${o.text}`) : undefined
        }));

        const prompt = `Dưới đây là NỘI DUNG ĐÁP ÁN TỪ LINK CHIA SẺ của người khác và DANH SÁCH CÂU HỎI HIỆN TẠI.
Hãy dựa vào nội dung đáp án được cung cấp để ánh xạ chính xác sang từng câu hỏi hiện tại (chú ý đề có thể bị đảo thứ tự câu hoặc đảo thứ tự đáp án A/B/C/D).
Chỉ trả về MẢNG JSON thuần túy (không markdown):
- Câu type="mcq": {"id": <số>, "answerIndices": [<mảng chỉ số đáp án đúng>]}
- Câu type="text": {"id": <số>, "textAnswer": "<đáp án ngắn>"}

=== NỘI DUNG ĐÁP ÁN TỪ LINK ===
${externalText.slice(0, 12000)}

=== CÂU HỎI TRÊN TRANG HIỆN TẠI ===
${JSON.stringify(payloadForAI)}`;

        callMultiAI({ textPrompt: prompt, forceJson: true }, (res) => {
            try {
                const jsonMatch = res.match(/\[[\s\S]*\]/);
                const clean = jsonMatch ? jsonMatch[0] : res.replace(/```json|```/g, '').trim();
                const aiResults = JSON.parse(clean);
                const resultsMap = {};
                aiResults.forEach((it) => (resultsMap[it.id] = it));
                applyQuestionResults(questions, resultsMap, autoAct, '📥 ĐÃ ÁP DỤNG TỪ LINK');
            } catch {
                showStatus('❌ Không thể ánh xạ đáp án từ nội dung này:\n' + res);
            }
        });
    }

    function processImportedContent(contentText, questions, autoAct, sourceUrl = '') {
        // Ưu tiên 1: Gói đáp án AHOI_ANS:... (chống đảo đề, 0 tốn API)
        const packMap = matchAnswerPackToQuestions(contentText, questions);
        if (packMap) {
            applyQuestionResults(questions, packMap, autoAct, '📥 TỪ GÓI ĐÁP ÁN (0ms)');
            return;
        }

        // Ưu tiên 2: Chuỗi đáp án chuẩn (1A 2C 3D, Câu 1: B, JSON...) (0 tốn API)
        const parsedMap = parseStructuredAnswers(contentText, questions);
        if (parsedMap && Object.keys(parsedMap).length >= Math.min(questions.length, 1)) {
            applyQuestionResults(questions, parsedMap, autoAct, '📥 TỪ ĐÁP ÁN NHẬP VÀO');
            return;
        }

        // Ưu tiên 3: Nếu là bài giải chữ dài từ link web/Gemini -> Dùng AI đối chiếu tự động
        if (contentText.length > 40) {
            mapExternalTextWithAI(contentText, questions, autoAct);
        } else {
            showStatus(
                `⚠️ Không đọc được nội dung đáp án trực tiếp từ link này (trang có thể yêu cầu tải bằng JavaScript).\n` +
                (sourceUrl ? `👉 Gợi ý: Mở link ${sourceUrl}, copy toàn bộ lời giải rồi bấm 📥 và dán thẳng chữ vào ô nhập!` : '')
            );
        }
    }

    function importAnswersFromLinkOrText() {
        if (!verifyCopyrightIntegrity()) return;

        const questions = extractQuestionsFromDOM();
        if (!questions.length) {
            showStatus('⚠️ Không tìm thấy câu hỏi nào trên trang hiện tại để áp dụng đáp án.');
            return;
        }

        const lastLink = GM_getValue('LAST_IMPORT_LINK', '');
        const rawInput = prompt(
            `📥 NHẬP LINK HOẶC MÃ ĐÁP ÁN CỦA NGƯỜI KHÁC (${questions.length} câu trên trang)\n` +
            `Hỗ trợ dán 1 trong 3 dạng:\n` +
            `1. Đường link chia sẻ (Gemini Share, Pastebin, GitHub Raw/Gist...)\n` +
            `2. Mã gói đáp án xuất từ Script (AHOI_ANS:... - chống đảo đề)\n` +
            `3. Chuỗi đáp án dán trực tiếp (VD: 1A 2C 3D hoặc toàn bộ bài giải)`,
            lastLink
        );
        if (!rawInput || !rawInput.trim()) return;

        const autoAct = confirm(
            `Chọn cách áp dụng đáp án cho ${questions.length} câu hỏi:\n` +
            `• Nhấn [OK] = ⚡ Tự động khoanh & điền ô trống\n` +
            `• Nhấn [Hủy / Cancel] = 🎯 Chỉ chấm ngầm (•) bên cạnh đáp án`
        );

        clearStealthMarksFromPage();

        const cleanedUrl = extractCleanUrl(rawInput);

        // Trường hợp người dùng dán Link HTTP/HTTPS
        if (cleanedUrl && !rawInput.includes('AHOI_ANS:')) {
            GM_setValue('LAST_IMPORT_LINK', cleanedUrl);
            showStatus(`📥 Đang tải đáp án từ link:\n${cleanedUrl}...`);

            GM_xmlhttpRequest({
                method: 'GET',
                url: cleanedUrl,
                timeout: 15000,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 400 && res.responseText) {
                        const rawBody = res.responseText;
                        // Kiểm tra xem trong mã nguồn HTML/text thô có chứa gói AHOI_ANS hay không
                        if (rawBody.includes('AHOI_ANS:')) {
                            processImportedContent(rawBody, questions, autoAct, cleanedUrl);
                            return;
                        }
                        const plainText = stripHtmlToPlainText(rawBody);
                        // Kiểm tra trường hợp trang SPA (như Google/Gemini) chỉ trả về khung rỗng yêu cầu trình duyệt chạy JS
                        const looksLikeEmptySpa = plainText.length < 60 || /enable javascript|sign in to continue|gemini/i.test(plainText) && plainText.length < 220;
                        if (looksLikeEmptySpa) {
                            showStatus(
                                `⚠️ Link này dùng cơ chế tải động (JavaScript SPA) nên không đọc ngầm được trực tiếp:\n${cleanedUrl}\n\n` +
                                `👉 Cách xử lý cực nhanh:\n1. Mở link đó ở tab mới.\n2. Copy toàn bộ phần đáp án.\n3. Quay lại đây bấm 📥 (Alt + I) và dán trực tiếp đoạn chữ đó vào!`
                            );
                            if (confirm('Link này cần mở trực tiếp trên trình duyệt để copy chữ. Bạn có muốn mở link này ở tab mới ngay bây giờ không?')) {
                                window.open(cleanedUrl, '_blank', 'noopener,noreferrer');
                            }
                            return;
                        }
                        processImportedContent(plainText, questions, autoAct, cleanedUrl);
                    } else {
                        showStatus(`❌ Không tải được link (Mã HTTP ${res.status}). Hãy kiểm tra xem link đã mở quyền công khai chưa.`);
                    }
                },
                onerror: () => showStatus('❌ Lỗi mạng khi tải link đáp án. Đảm bảo Loader Tampermonkey đã có dòng "// @connect *".'),
                ontimeout: () => showStatus('❌ Quá thời gian tải link (>15s).')
            });
        } else {
            // Trường hợp dán Mã AHOI_ANS:... hoặc Chuỗi đáp án (1A 2B 3C / Bài giải copy)
            processImportedContent(rawInput.trim(), questions, autoAct);
        }
    }

    // ==================== 🔗 CHIA SẺ & XUẤT GÓI ĐÁP ÁN CHO BẠN BÈ ====================
    function buildExportAnswerPack() {
        if (!lastSolvedSnapshot || !lastSolvedSnapshot.questions.length) return null;
        const { questions, resultsMap } = lastSolvedSnapshot;
        const items = [];

        questions.forEach((qObj, idx) => {
            const res = resultsMap[idx];
            if (!res) return;
            if (qObj.type === 'mcq' && Array.isArray(res.answerIndices)) {
                const ansTexts = res.answerIndices
                    .map((i) => qObj.options[i]?.text)
                    .filter(Boolean)
                    .map((t) => normalizeHash(t));
                items.push({
                    t: 'mcq',
                    q: normalizeHash(qObj.question),
                    ai: res.answerIndices,
                    at: ansTexts
                });
            } else if (qObj.type === 'text' && res.textAnswer !== undefined) {
                items.push({
                    t: 'text',
                    q: normalizeHash(qObj.question),
                    ta: String(res.textAnswer).trim()
                });
            }
        });

        if (!items.length) return null;
        return 'AHOI_ANS:' + toBase64UTF8(JSON.stringify({ v: 5, items }));
    }

    async function shareContent() {
        const choice = prompt(
            `🔗 CHIA SẺ (${COPYRIGHT.SIGNATURE})\n` +
            `Nhập lựa chọn:\n` +
            `1. Xuất MÃ GÓI ĐÁP ÁN (AHOI_ANS:...) gửi bạn bè nhập vào là khoanh luôn (chống đảo đề!)\n` +
            `2. Chia sẻ Lời giải đang hiển thị trên bảng\n` +
            `3. Chia sẻ Link Script & GitHub\n` +
            `4. Mở trực tiếp Link Share`,
            '1'
        );
        if (!choice) return;

        const mode = choice.trim();
        const shareUrl = COPYRIGHT.SHARE_URL || COPYRIGHT.REPO;

        if (mode === '4') {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        const shareTitle = `AI Homework Solver Pro v${COPYRIGHT.VERSION} by ${COPYRIGHT.AUTHOR}`;
        let shareText = '';

        if (mode === '1') {
            const packCode = buildExportAnswerPack();
            if (!packCode) {
                showStatus('⚠️ Bạn chưa quét giải đề nào trên trang này! Hãy bấm 🎯 (Alt + A) giải đề trước rồi xuất mã gửi bạn bè.');
                return;
            }
            shareText = packCode;
        } else if (mode === '2') {
            shareText = `📝 Lời giải từ AI Homework Solver (${COPYRIGHT.AUTHOR}):\n\n${bodyEl.innerText.trim()}\n\n🔗 ${shareUrl}`;
        } else {
            shareText =
                `✨ AI Homework Solver Pro v${COPYRIGHT.VERSION} (${COPYRIGHT.SIGNATURE})\n` +
                `Hỗ trợ giải bài tập đa AI, đọc công thức toán LaTeX, nhập link đáp án & tự khoanh trắc nghiệm.\n` +
                `🔗 Link chia sẻ: ${shareUrl}\n` +
                `📦 GitHub: ${COPYRIGHT.REPO}`;
        }

        if (navigator.share && mode !== '1') {
            try {
                await navigator.share({ title: shareTitle, text: shareText, url: mode === '3' ? shareUrl : undefined });
                showStatus('✅ Đã mở bảng chia sẻ!');
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }

        try {
            await navigator.clipboard.writeText(shareText);
            showStatus(
                mode === '1'
                    ? `✅ ĐÃ XUẤT & COPY MÃ GÓI ĐÁP ÁN (chống đảo đề)!\nBạn chỉ cần gửi mã này (hoặc up lên Pastebin/GitHub lấy link) cho người khác bấm 📥 (Alt + I) dán vào là khoanh tức thì.`
                    : `✅ Đã copy nội dung chia sẻ vào bộ nhớ tạm!\n\n${shareText}`
            );
        } catch {
            prompt('Sao chép nội dung bên dưới:', shareText);
        }
    }

    // Kiểm tra bảo vệ bản quyền trong JS
    function verifyCopyrightIntegrity() {
        const footerEl = $('ai-solver-footer');
        const fabCopyEl = shadow.querySelector('.ai-fab-copyright');
        if (
            COPYRIGHT.AUTHOR !== 'ahoi-cyber' ||
            !footerEl ||
            !footerEl.innerText.includes('ahoi-cyber') ||
            !fabCopyEl ||
            !fabCopyEl.innerText.includes('ahoi-cyber')
        ) {
            showStatus('❌ LỖI BẢN QUYỀN: Phát hiện hành vi xóa hoặc chỉnh sửa tên tác giả (ahoi-cyber). Script đã dừng hoạt động!');
            return false;
        }
        return true;
    }

    // ==================== 🚨 PHÍM KHẨN CẤP (PANIC KEY: ALT + X) ====================
    function clearStealthMarksFromPage() {
        document.querySelectorAll('[data-ai-mark]').forEach((el) => el.remove());
        document.querySelectorAll('[data-ai-border]').forEach((el) => {
            el.style.borderBottom = '';
            el.removeAttribute('data-ai-border');
        });
    }

    function togglePanicMode() {
        isPanicMode = !isPanicMode;
        if (isPanicMode) {
            shadowHost.style.display = 'none';
            clearStealthMarksFromPage();
            document.title = originalPageTitle;
        } else {
            shadowHost.style.display = 'block';
        }
    }

    // ==================== CÀI ĐẶT & ĐIỀU KHIỂN ====================
    function showStatus(msg, shortTabSummary = '') {
        if (!isPanicMode) {
            panel.style.display = 'flex';
            bodyEl.textContent = msg;
        }
        if (isTitleSpoof && shortTabSummary && !isPanicMode) {
            document.title = `[${shortTabSummary}] ${originalPageTitle}`;
        }
    }

    function syncShieldState(showMsg = false) {
        if (isShieldActive) {
            if (!unlockStyle.isConnected) document.head.appendChild(unlockStyle);
            applyPageSpoofing();
            clearInlineCopyLocks();
        } else {
            unlockStyle.remove();
        }
        $('ai-btn-shield').style.opacity = isShieldActive ? '1' : '0.35';
        $('fab-toggle-shield').textContent = `🛡️ Khiên Anti-Tab & Copy: ${isShieldActive ? 'BẬT' : 'TẮT'}`;
        if (showMsg) {
            showStatus(isShieldActive ? '🛡️ Đã BẬT Khiên Anti-Tab & Mở khóa Copy.' : '⚠️ Đã TẮT Khiên Bảo Vệ.');
        }
    }

    function toggleShield() {
        isShieldActive = !isShieldActive;
        GM_setValue('ANTI_DETECT_SHIELD', isShieldActive);
        syncShieldState(true);
    }

    function toggleTitleSpoof() {
        isTitleSpoof = !isTitleSpoof;
        GM_setValue('TITLE_SPOOF', isTitleSpoof);
        $('ai-btn-title').style.opacity = isTitleSpoof ? '1' : '0.35';
        $('fab-toggle-title').textContent = `🏷️ Hiện đáp án trên Tab: ${isTitleSpoof ? 'BẬT' : 'TẮT'}`;
        if (!isTitleSpoof) document.title = originalPageTitle;
        showStatus(isTitleSpoof ? '🏷️ Đã BẬT hiển thị đáp án lên thanh Tiêu đề Tab trình duyệt.' : '🏷️ Đã TẮT hiển thị đáp án trên Tab.');
    }

    function toggleHumanDelay() {
        isHumanDelay = !isHumanDelay;
        GM_setValue('HUMAN_DELAY', isHumanDelay);
        $('fab-toggle-delay').textContent = `⏱️ Trễ giống người thật: ${isHumanDelay ? 'BẬT' : 'TẮT'}`;
        showStatus(isHumanDelay ? '⏱️ Đã BẬT độ trễ ngẫu nhiên (0.7s - 1.5s) khi tự động khoanh & gõ chữ.' : '⚡ Đã chuyển sang chế độ khoanh tức thì (0ms).');
    }

    function toggleStealthUI() {
        isStealthUI = !isStealthUI;
        GM_setValue('STEALTH_UI', isStealthUI);
        panel.classList.toggle('stealth-mode', isStealthUI);
        fabContainer.classList.toggle('stealth', isStealthUI);
    }

    syncShieldState(false);
    $('ai-btn-title').style.opacity = isTitleSpoof ? '1' : '0.35';
    setInterval(clearInlineCopyLocks, 2500);

    function getKeyList(provider = currentProvider) {
        const raw = GM_getValue(`KEYS_${provider}`, '');
        if (!raw && provider === 'gemini') {
            const oldKey = GM_getValue('GEMINI_API_KEY', '');
            if (oldKey) return [oldKey.trim()];
        }
        return raw.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
    }

    function maskKey(key) {
        if (!key || key.length <= 10) return '***';
        return `${key.slice(0, 6)}...${key.slice(-4)}`;
    }

    function promptManageKeys() {
        const currentRaw = getKeyList(currentProvider).join(', ');
        const input = prompt(
            `🔑 Quản lý danh sách API Key cho [${PROVIDERS[currentProvider].name}] (${COPYRIGHT.SIGNATURE})\n• Nhập nhiều Key cách nhau bởi dấu phẩy (,):`,
            currentRaw
        );
        if (input !== null) {
            GM_setValue(`KEYS_${currentProvider}`, input.trim());
            keyIndexMap[currentProvider] = 0;
            showStatus(`✅ Đã lưu ${getKeyList(currentProvider).length} Key cho ${PROVIDERS[currentProvider].name}.`);
        }
    }

    function promptSwitchProvider() {
        const choice = prompt(
            `🌐 Chọn dịch vụ AI (1 -> 4):\n1. Google Gemini\n2. Groq (Siêu tốc)\n3. OpenRouter (DeepSeek/Qwen)\n4. OpenAI (ChatGPT)`,
            currentProvider === 'gemini' ? '1' : currentProvider === 'groq' ? '2' : currentProvider === 'openrouter' ? '3' : '4'
        );
        if (!choice) return;
        const map = { '1': 'gemini', '2': 'groq', '3': 'openrouter', '4': 'openai' };
        const selected = map[choice.trim()];
        if (!selected) return;

        currentProvider = selected;
        GM_setValue('AI_PROVIDER', currentProvider);
        modelId = GM_getValue(`MODEL_${currentProvider}`, PROVIDERS[currentProvider].defaultModel);
        updateHeaderTitle();

        if (getKeyList(currentProvider).length === 0) promptManageKeys();
        else showStatus(`✅ Đã chuyển sang ${PROVIDERS[currentProvider].name} (${modelId}).`);
    }

    function promptModelChange() {
        const p = PROVIDERS[currentProvider];
        const listStr = p.models.map((m, idx) => `${idx + 1}. ${m}`).join('\n');
        const choice = prompt(`🤖 Chọn Model cho [${p.name}]:\n${listStr}`, modelId);
        if (!choice) return;
        const idx = parseInt(choice.trim(), 10) - 1;
        modelId = idx >= 0 && idx < p.models.length ? p.models[idx] : choice.trim();
        GM_setValue(`MODEL_${currentProvider}`, modelId);
        updateHeaderTitle();
        showStatus(`✅ Đã đổi model sang: ${modelId}`);
    }

    function updateHeaderTitle() {
        $('ai-solver-title').textContent = `✨ ${currentProvider.toUpperCase()}: ${modelId.split('/').pop()}`;
        $('fab-switch-provider').textContent = `🌐 Nguồn AI: ${PROVIDERS[currentProvider].name}`;
    }

    $('ai-fab-trigger').addEventListener('click', (e) => {
        e.stopPropagation();
        fabMenu.classList.toggle('open');
    });

    document.addEventListener('click', () => fabMenu.classList.remove('open'));

    $('fab-solve-text').addEventListener('click', () => {
        fabMenu.classList.remove('open');
        const sel = getSelectionTextWithMath() || lastSelectedText;
        if (sel) solveTextQuestion(sel);
        else {
            const manual = prompt('Nhập hoặc dán câu hỏi:');
            if (manual && manual.trim()) solveTextQuestion(manual.trim());
        }
    });
    $('fab-snip-img').addEventListener('click', () => { fabMenu.classList.remove('open'); startScreenSnip(); });
    $('fab-scan-stealth').addEventListener('click', () => { fabMenu.classList.remove('open'); scanAndSolveQuestions(false); });
    $('fab-scan-auto').addEventListener('click', () => { fabMenu.classList.remove('open'); scanAndSolveQuestions(true); });
    $('fab-import-link').addEventListener('click', () => { fabMenu.classList.remove('open'); importAnswersFromLinkOrText(); });
    $('fab-share').addEventListener('click', () => { fabMenu.classList.remove('open'); shareContent(); });
    $('fab-toggle-delay').addEventListener('click', () => { fabMenu.classList.remove('open'); toggleHumanDelay(); });
    $('fab-toggle-title').addEventListener('click', () => { fabMenu.classList.remove('open'); toggleTitleSpoof(); });
    $('fab-toggle-shield').addEventListener('click', () => { fabMenu.classList.remove('open'); toggleShield(); });
    $('fab-check-keys').addEventListener('click', () => { fabMenu.classList.remove('open'); checkAllApiKeys(); });
    $('fab-switch-provider').addEventListener('click', () => { fabMenu.classList.remove('open'); promptSwitchProvider(); });
    $('fab-change-model').addEventListener('click', () => { fabMenu.classList.remove('open'); promptModelChange(); });
    $('fab-set-key').addEventListener('click', () => { fabMenu.classList.remove('open'); promptManageKeys(); });
    $('fab-clear-cache').addEventListener('click', () => { fabMenu.classList.remove('open'); clearCacheStore(); });
    $('fab-toggle-stealth').addEventListener('click', () => { fabMenu.classList.remove('open'); toggleStealthUI(); });
    $('fab-panic').addEventListener('click', () => { fabMenu.classList.remove('open'); togglePanicMode(); });

    $('ai-btn-close').addEventListener('click', () => (panel.style.display = 'none'));
    $('ai-btn-import').addEventListener('click', importAnswersFromLinkOrText);
    $('ai-footer-import').addEventListener('click', importAnswersFromLinkOrText);
    $('ai-btn-share').addEventListener('click', shareContent);
    $('ai-footer-share').addEventListener('click', shareContent);
    $('ai-btn-shield').addEventListener('click', toggleShield);
    $('ai-btn-title').addEventListener('click', toggleTitleSpoof);
    $('ai-btn-check').addEventListener('click', checkAllApiKeys);
    $('ai-btn-provider').addEventListener('click', promptSwitchProvider);
    $('ai-btn-model').addEventListener('click', promptModelChange);
    $('ai-btn-key').addEventListener('click', promptManageKeys);
    $('ai-btn-stealth').addEventListener('click', toggleStealthUI);
    $('ai-btn-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(bodyEl.innerText);
        showStatus('✅ Đã sao chép!\n\n' + bodyEl.innerText);
    });

    document.addEventListener('keydown', (e) => {
        if (!e.altKey) return;
        if (e.code === 'KeyX') {
            e.preventDefault();
            togglePanicMode();
        } else if (isPanicMode) {
            return;
        } else if (e.code === 'KeyQ') {
            e.preventDefault();
            const text = getSelectionTextWithMath() || lastSelectedText;
            if (text) solveTextQuestion(text);
        } else if (e.code === 'KeyS') {
            e.preventDefault();
            startScreenSnip();
        } else if (e.code === 'KeyA') {
            e.preventDefault();
            scanAndSolveQuestions(e.shiftKey);
        } else if (e.code === 'KeyI') {
            e.preventDefault();
            importAnswersFromLinkOrText();
        } else if (e.code === 'KeyC') {
            e.preventDefault();
            checkAllApiKeys();
        } else if (e.code === 'KeyU') {
            e.preventDefault();
            toggleShield();
        } else if (e.code === 'KeyH') {
            e.preventDefault();
            toggleStealthUI();
        }
    });

    // ==================== 🩺 CHECK API KEY (ALT + C) ====================
    function testSingleKey(provider, model, key) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            if (provider === 'gemini') {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ contents: [{ parts: [{ text: '1' }] }], generationConfig: { maxOutputTokens: 2 } }),
                    timeout: 10000,
                    onload: (res) => {
                        const ms = Date.now() - startTime;
                        try {
                            const data = JSON.parse(res.responseText);
                            if (res.status === 200 && data.candidates) resolve({ key, status: 'LIVE', detail: `🟢 LIVE (${ms}ms)` });
                            else if (res.status === 429 || data.error?.code === 429) resolve({ key, status: 'QUOTA', detail: `🟡 HẾT QUOTA 429 (${ms}ms)` });
                            else resolve({ key, status: 'DEAD', detail: `🔴 LỖI: ${data.error?.message?.slice(0, 40) || res.status}` });
                        } catch {
                            resolve({ key, status: 'DEAD', detail: `🔴 LỖI PHẢN HỒI (${res.status})` });
                        }
                    },
                    onerror: () => resolve({ key, status: 'NETWORK', detail: '⚪ LỖI MẠNG' }),
                    ontimeout: () => resolve({ key, status: 'TIMEOUT', detail: '⚪ TIMEOUT' })
                });
            } else {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: PROVIDERS[provider].url,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    data: JSON.stringify({ model, messages: [{ role: 'user', content: '1' }], max_tokens: 2 }),
                    timeout: 10000,
                    onload: (res) => {
                        const ms = Date.now() - startTime;
                        try {
                            const data = JSON.parse(res.responseText);
                            if (res.status === 200 && data.choices) resolve({ key, status: 'LIVE', detail: `🟢 LIVE (${ms}ms)` });
                            else if (res.status === 429) resolve({ key, status: 'QUOTA', detail: `🟡 HẾT QUOTA 429 (${ms}ms)` });
                            else resolve({ key, status: 'DEAD', detail: `🔴 LỖI: ${data.error?.message?.slice(0, 40) || res.status}` });
                        } catch {
                            resolve({ key, status: 'DEAD', detail: `🔴 LỖI PHẢN HỒI` });
                        }
                    },
                    onerror: () => resolve({ key, status: 'NETWORK', detail: '⚪ LỖI MẠNG' }),
                    ontimeout: () => resolve({ key, status: 'TIMEOUT', detail: '⚪ TIMEOUT' })
                });
            }
        });
    }

    async function checkAllApiKeys() {
        if (!verifyCopyrightIntegrity()) return;
        const keys = getKeyList(currentProvider);
        if (!keys.length) return promptManageKeys();
        showStatus(`🩺 Đang kiểm tra ${keys.length} Key của [${PROVIDERS[currentProvider].name}]...`);
        const results = await Promise.all(keys.map((k) => testSingleKey(currentProvider, modelId, k)));
        let live = 0, quota = 0, dead = 0;
        const validKeys = [];
        const lines = results.map((r, i) => {
            if (r.status === 'LIVE') { live++; validKeys.push(r.key); }
            else if (r.status === 'QUOTA') { quota++; validKeys.push(r.key); }
            else if (r.status === 'DEAD') dead++;
            else validKeys.push(r.key);
            return `Key #${i + 1} (${maskKey(r.key)}): ${r.detail}`;
        });
        const header = `📊 KẾT QUẢ CHECK API [${PROVIDERS[currentProvider].name}]\n• Tổng: ${keys.length} | 🟢 Sống: ${live} | 🟡 Hết lượt: ${quota} | 🔴 Hỏng: ${dead}\n──────────────────────────\n`;
        showStatus(header + lines.join('\n'));
        if (dead > 0) {
            setTimeout(() => {
                if (confirm(`Phát hiện ${dead} Key hỏng (🔴). Tự động xóa các Key hỏng khỏi danh sách?`)) {
                    GM_setValue(`KEYS_${currentProvider}`, validKeys.join(', '));
                    showStatus(header + lines.join('\n') + `\n\n🧹 Đã lọc bỏ ${dead} Key hỏng!`);
                }
            }, 250);
        }
    }

    // ==================== 📝 GIẢI CÂU HỎI VĂN BẢN + LATEX + CACHE ====================
    function solveTextQuestion(text) {
        if (!verifyCopyrightIntegrity()) return;
        const hash = 'TXT_' + normalizeHash(text);
        const cache = getCacheStore();
        if (cache[hash]) {
            showStatus(`⚡ [TỪ BỘ NHỚ ĐỆM - 0ms]\n${cache[hash]}`, cache[hash].slice(0, 25));
            return;
        }
        if (!ensureApiKey()) return;
        showStatus(`⏳ Đang giải (${PROVIDERS[currentProvider].name})...`);
        const prompt = `Giải chính xác và ngắn gọn câu hỏi sau (chú ý các công thức toán đặt trong dấu $...$):
- Nếu là trắc nghiệm: Dòng đầu ghi "Đáp án: [A/B/C/D] - [Nội dung]", dòng sau giải thích ngắn.
- Nếu là tự luận/điền khuyết: Dòng đầu chốt ngay KẾT QUẢ CUỐI CÙNG, dòng sau tóm tắt cách tính.
Câu hỏi:\n${text}`;
        callMultiAI({ textPrompt: prompt }, (res) => {
            setCacheItem(hash, res);
            showStatus(res, res.split('\n')[0].replace(/Đáp án:?/i, '').trim().slice(0, 25));
        });
    }

    // ==================== 📸 VUỐT CHỤP VÙNG ẢNH / TOÁN ====================
    let startX = 0, startY = 0, isSnipping = false;
    function startScreenSnip() {
        if (!verifyCopyrightIntegrity() || !ensureApiKey()) return;
        panel.style.display = 'none';
        snipOverlay.style.display = 'block';
        snipBox.style.display = 'none';
    }

    function getPoint(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function onSnipStart(e) {
        e.preventDefault();
        isSnipping = true;
        const pt = getPoint(e);
        startX = pt.x; startY = pt.y;
        snipBox.style.left = `${startX}px`; snipBox.style.top = `${startY}px`;
        snipBox.style.width = '0px'; snipBox.style.height = '0px';
        snipBox.style.display = 'block';
    }

    function onSnipMove(e) {
        if (!isSnipping) return;
        e.preventDefault();
        const pt = getPoint(e);
        snipBox.style.left = `${Math.min(startX, pt.x)}px`;
        snipBox.style.top = `${Math.min(startY, pt.y)}px`;
        snipBox.style.width = `${Math.abs(pt.x - startX)}px`;
        snipBox.style.height = `${Math.abs(pt.y - startY)}px`;
    }

    async function onSnipEnd(e) {
        if (!isSnipping) return;
        e.preventDefault();
        isSnipping = false;
        const rect = snipBox.getBoundingClientRect();
        snipOverlay.style.display = 'none';
        snipBox.style.display = 'none';
        if (rect.width < 15 || rect.height < 15) return;

        showStatus(`📸 Đang đọc ảnh bằng ${PROVIDERS[currentProvider].name}...`);
        try {
            const canvas = await html2canvas(document.body, {
                x: rect.left + window.scrollX, y: rect.top + window.scrollY,
                width: rect.width, height: rect.height,
                useCORS: true, allowTaint: false, logging: false,
                scale: Math.min(window.devicePixelRatio || 1, 2)
            });
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            callMultiAI({
                textPrompt: 'Đọc công thức/hình học trong ảnh và giải chính xác. Dòng đầu chốt ngay đáp án/kết quả.',
                base64Image: base64
            }, (res) => showStatus(res, res.split('\n')[0].slice(0, 25)));
        } catch {
            showStatus('❌ Lỗi chụp ảnh vùng này.');
        }
    }

    snipOverlay.addEventListener('mousedown', onSnipStart);
    snipOverlay.addEventListener('mousemove', onSnipMove);
    snipOverlay.addEventListener('mouseup', onSnipEnd);
    snipOverlay.addEventListener('touchstart', onSnipStart, { passive: false });
    snipOverlay.addEventListener('touchmove', onSnipMove, { passive: false });
    snipOverlay.addEventListener('touchend', onSnipEnd, { passive: false });

    // ==================== ⌨️ GIẢ LẬP GÕ PHÍM & CLICK TỰ NHIÊN ====================
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function simulateHumanTyping(inputEl, textValue) {
        if (!inputEl) return;
        inputEl.focus();
        const proto = inputEl.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (isHumanDelay) {
            let currentStr = '';
            for (const ch of String(textValue)) {
                currentStr += ch;
                if (nativeSetter) nativeSetter.call(inputEl, currentStr);
                else inputEl.value = currentStr;
                inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
                await sleep(25 + Math.random() * 45);
            }
        } else {
            if (nativeSetter) nativeSetter.call(inputEl, textValue);
            else inputEl.value = textValue;
            inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        inputEl.blur();
    }

    function injectStealthMark(targetEl, textContent = '•') {
        if (!targetEl || isPanicMode) return;
        const span = document.createElement('span');
        span.setAttribute('data-ai-mark', '1');
        span.style.cssText = 'display:inline-block;margin-left:6px;color:currentColor;opacity:0.36;font-size:12px;pointer-events:none;user-select:none;';
        span.textContent = textContent;
        targetEl.appendChild(span);
        targetEl.setAttribute('data-ai-border', '1');
        targetEl.style.borderBottom = '1px dotted rgba(128,128,128,0.36)';
    }

    // ==================== 🎯 QUÉT ĐỀ (TRẮC NGHIỆM + ĐIỀN Ô TRỐNG + LATEX) ====================
    function extractQuestionsFromDOM() {
        const extracted = [];

        const gItems = document.querySelectorAll('div[role="listitem"]');
        if (gItems.length > 0) {
            gItems.forEach((item) => {
                const h = item.querySelector('[role="heading"]');
                if (!h) return;
                const qText = extractTextWithMath(h);
                const opts = item.querySelectorAll('[role="radio"], [role="checkbox"]');
                if (opts.length > 0) {
                    const arr = [];
                    opts.forEach((o) => {
                        const container = o.closest('label') || o.parentElement?.parentElement || o;
                        const txt = o.getAttribute('data-value') || o.getAttribute('aria-label') || extractTextWithMath(container);
                        arr.push({ text: txt, clickEl: o, markEl: container });
                    });
                    extracted.push({ type: 'mcq', question: qText, options: arr });
                } else {
                    const textInp = item.querySelector('input[type="text"], input:not([type]), textarea');
                    if (textInp) {
                        extracted.push({ type: 'text', question: qText, inputEl: textInp, markEl: h });
                    }
                }
            });
            if (extracted.length) return extracted;
        }

        const qzQ = document.querySelector('[data-testid="question-container-text"], .question-text-color');
        if (qzQ) {
            const qText = extractTextWithMath(qzQ);
            const qzOpts = document.querySelectorAll('button.option, [data-testid^="option-"]');
            if (qzOpts.length > 0) {
                const arr = [];
                qzOpts.forEach((o) => arr.push({ text: extractTextWithMath(o), clickEl: o, markEl: o }));
                extracted.push({ type: 'mcq', question: qText, options: arr });
                return extracted;
            }
            const qzInput = document.querySelector('input[data-testid*="input"], textarea');
            if (qzInput) {
                extracted.push({ type: 'text', question: qText, inputEl: qzInput, markEl: qzQ });
                return extracted;
            }
        }

        const groups = {};
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((inp) => {
            const key = inp.name || inp.closest('.que, .question, .question-item')?.id || 'default';
            if (!groups[key]) groups[key] = [];
            groups[key].push(inp);
        });
        Object.values(groups).forEach((inputs) => {
            if (inputs.length < 2) return;
            const w = inputs[0].closest('.que, .question, .question-item, .panel, fieldset, div');
            const qTxt = w ? extractTextWithMath(w).split('\n')[0].trim() : 'Câu hỏi';
            const arr = inputs.map((i) => {
                const lbl = document.querySelector(`label[for="${i.id}"]`) || i.closest('label') || i.parentElement;
                return { text: lbl ? extractTextWithMath(lbl) : i.value, clickEl: i, markEl: lbl || i };
            });
            extracted.push({ type: 'mcq', question: qTxt, options: arr });
        });

        document.querySelectorAll('.que input[type="text"], .question input[type="text"]').forEach((inp) => {
            const w = inp.closest('.que, .question');
            if (w) {
                extracted.push({ type: 'text', question: extractTextWithMath(w), inputEl: inp, markEl: inp.parentElement || w });
            }
        });

        return extracted;
    }

    async function applyQuestionResults(questions, resultsMap, autoAct = false, statusPrefix = '✅ Đã xử lý') {
        lastSolvedSnapshot = { questions, resultsMap };
        let solved = 0;
        const summary = [];

        for (let i = 0; i < questions.length; i++) {
            if (isPanicMode) break;
            const qObj = questions[i];
            const res = resultsMap[i];
            if (!res) continue;

            if (qObj.type === 'mcq' && Array.isArray(res.answerIndices)) {
                const letters = [];
                for (const idx of res.answerIndices) {
                    const opt = qObj.options[idx];
                    if (!opt) continue;
                    letters.push(String.fromCharCode(65 + idx));
                    injectStealthMark(opt.markEl, '•');

                    if (autoAct && opt.clickEl) {
                        const alreadyChecked = opt.clickEl.getAttribute('aria-checked') === 'true' || opt.clickEl.checked;
                        if (!alreadyChecked) {
                            if (isHumanDelay && solved > 0) {
                                opt.clickEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                await sleep(650 + Math.random() * 850);
                            }
                            opt.clickEl.click();
                        }
                    }
                }
                if (letters.length) {
                    solved++;
                    summary.push(`${i + 1}${letters.join('')}`);
                }
            } else if (qObj.type === 'text' && res.textAnswer !== undefined) {
                const ansStr = String(res.textAnswer).trim();
                if (!ansStr) continue;
                injectStealthMark(qObj.markEl, `• [${ansStr}]`);
                if (autoAct && qObj.inputEl) {
                    if (isHumanDelay && solved > 0) {
                        qObj.inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await sleep(600 + Math.random() * 750);
                    }
                    await simulateHumanTyping(qObj.inputEl, ansStr);
                }
                solved++;
                summary.push(`${i + 1}:${ansStr}`);
            }
        }

        const tabShort = summary.join(' ');
        showStatus(`${statusPrefix} (${solved}/${questions.length} câu):\n` + summary.join(' | '), tabShort);
    }

    function scanAndSolveQuestions(autoAct = false) {
        if (!verifyCopyrightIntegrity()) return;
        clearStealthMarksFromPage();
        const questions = extractQuestionsFromDOM();
        if (!questions.length) return showStatus('⚠️ Không tìm thấy câu hỏi nào trên trang.');

        const cacheStore = getCacheStore();
        const resultsMap = {};
        const uncachedList = [];

        questions.forEach((q, idx) => {
            const rawKey = q.type === 'mcq'
                ? `MCQ_${q.question}_${q.options.map((o) => o.text).join('|')}`
                : `FILL_${q.question}`;
            const hash = normalizeHash(rawKey);
            if (cacheStore[hash]) {
                resultsMap[idx] = cacheStore[hash];
            } else {
                uncachedList.push({
                    id: idx,
                    hash,
                    type: q.type,
                    question: q.question,
                    options: q.type === 'mcq' ? q.options.map((o, oIdx) => `${oIdx}: ${o.text}`) : undefined
                });
            }
        });

        if (uncachedList.length === 0) {
            showStatus(`⚡ Đã tải 100% đáp án từ Bộ nhớ đệm (0ms)...`);
            applyQuestionResults(questions, resultsMap, autoAct);
            return;
        }

        if (!ensureApiKey()) return;
        showStatus(`⏳ Đang giải ${uncachedList.length} câu mới (${questions.length - uncachedList.length} câu trong Cache)...`);

        const payloadForAI = uncachedList.map(({ id, type, question, options }) => ({ id, type, question, options }));
        const prompt = `Giải danh sách câu hỏi sau (chú ý công thức LaTeX trong dấu $...$).
Chỉ trả về MẢNG JSON thuần túy (không có markdown \`\`\`json):
- Với câu type="mcq": {"id": <số>, "answerIndices": [<mảng số nguyên chỉ số đúng>]}
- Với câu type="text" (điền vào ô trống): {"id": <số>, "textAnswer": "<đáp án ngắn gọn chính xác để điền vào ô>"}

Dữ liệu:
${JSON.stringify(payloadForAI)}`;

        callMultiAI({ textPrompt: prompt, forceJson: true }, (res) => {
            try {
                const jsonMatch = res.match(/\[[\s\S]*\]/);
                const clean = jsonMatch ? jsonMatch[0] : res.replace(/```json|```/g, '').trim();
                const aiResults = JSON.parse(clean);

                aiResults.forEach((item) => {
                    resultsMap[item.id] = item;
                    const meta = uncachedList.find((u) => u.id === item.id);
                    if (meta) setCacheItem(meta.hash, item);
                });

                applyQuestionResults(questions, resultsMap, autoAct);
            } catch {
                showStatus('❌ Lỗi phân tích JSON:\n' + res);
            }
        });
    }

    function ensureApiKey() {
        if (getKeyList(currentProvider).length === 0) promptManageKeys();
        return getKeyList(currentProvider).length > 0;
    }

    function callMultiAI({ textPrompt, base64Image = null, forceJson = false }, onSuccess, retryAttempt = 0) {
        if (!verifyCopyrightIntegrity()) return;
        const keys = getKeyList(currentProvider);
        if (!keys.length) return showStatus('❌ Chưa có API Key!');

        const currentIdx = keyIndexMap[currentProvider] % keys.length;
        const activeKey = keys[currentIdx];

        if (currentProvider === 'gemini') {
            const parts = [{ text: textPrompt }];
            if (base64Image) parts.push({ inline_data: { mime_type: 'image/png', data: base64Image } });
            const generationConfig = { temperature: 0.1 };
            if (forceJson) generationConfig.responseMimeType = 'application/json';

            GM_xmlhttpRequest({
                method: 'POST',
                url: `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${activeKey}`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ contents: [{ parts }], generationConfig }),
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.error) {
                            if (retryAttempt < keys.length - 1) {
                                keyIndexMap[currentProvider] = (currentIdx + 1) % keys.length;
                                showStatus(`🔄 Key #${currentIdx + 1} hết hạn mức, đang chuyển sang Key #${keyIndexMap[currentProvider] + 1}...`);
                                return callMultiAI({ textPrompt, base64Image, forceJson }, onSuccess, retryAttempt + 1);
                            }
                            return showStatus(`❌ Lỗi Gemini: ${data.error.message}`);
                        }
                        keyIndexMap[currentProvider] = (currentIdx + 1) % keys.length;
                        onSuccess(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
                    } catch {
                        showStatus('❌ Lỗi đọc dữ liệu phản hồi.');
                    }
                },
                onerror: () => showStatus('❌ Lỗi mạng khi gọi Gemini API.')
            });
        } else {
            const endpoint = PROVIDERS[currentProvider].url;
            let contentPayload = textPrompt;
            if (base64Image) {
                contentPayload = [
                    { type: 'text', text: textPrompt },
                    { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } }
                ];
            }

            GM_xmlhttpRequest({
                method: 'POST',
                url: endpoint,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey}` },
                data: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: contentPayload }], temperature: 0.1 }),
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.error) {
                            if (retryAttempt < keys.length - 1) {
                                keyIndexMap[currentProvider] = (currentIdx + 1) % keys.length;
                                showStatus(`🔄 Key #${currentIdx + 1} lỗi, đang đổi sang Key #${keyIndexMap[currentProvider] + 1}...`);
                                return callMultiAI({ textPrompt, base64Image, forceJson }, onSuccess, retryAttempt + 1);
                            }
                            return showStatus(`❌ Lỗi ${PROVIDERS[currentProvider].name}: ${data.error.message || JSON.stringify(data.error)}`);
                        }
                        keyIndexMap[currentProvider] = (currentIdx + 1) % keys.length;
                        onSuccess(data.choices?.[0]?.message?.content || '');
                    } catch {
                        showStatus('❌ Lỗi phản hồi từ máy chủ AI.');
                    }
                },
                onerror: () => showStatus(`❌ Lỗi mạng khi kết nối ${PROVIDERS[currentProvider].name}.`)
            });
        }
    }
};
