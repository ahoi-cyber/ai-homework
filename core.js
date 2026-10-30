// core.js - AI Homework Solver V5.0 (Ultimate Stealth, LaTeX, Auto-Fill & Cache)
window.initAISolver = function () {
    'use strict';

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
            // Giới hạn tối đa 400 câu gần nhất để bộ nhớ luôn nhẹ
            if (keys.length > 400) {
                delete store[keys[0]];
            }
            store[hashKey] = value;
            GM_setValue('AI_QUESTION_CACHE', JSON.stringify(store));
        } catch {}
    }

    function clearCacheStore() {
        GM_setValue('AI_QUESTION_CACHE', '{}');
        showStatus('🗑️ Đã xóa sạch bộ nhớ đệm câu hỏi (Cache)!');
    }

    function normalizeHash(str) {
        return str.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 350);
    }

    // ==================== 📐 BỘ TRÍCH XUẤT CÔNG THỨC TOÁN (LATEX / MATHJAX / KATEX) ====================
    function extractTextWithMath(rootNode) {
        if (!rootNode) return '';
        const clone = rootNode.cloneNode(true);

        // 1. Trích xuất KaTeX / MathML annotation (chuẩn phổ biến nhất trên Olm, Azota, Moodle, Quizizz)
        clone.querySelectorAll('annotation[encoding="application/x-tex"]').forEach((ann) => {
            const tex = ann.textContent.trim();
            const container = ann.closest('.katex, mjx-container, math') || ann;
            container.replaceWith(` $${tex}$ `);
        });

        // 2. Trích xuất MathJax v2/v3 script & data-latex
        clone.querySelectorAll('script[type^="math/tex"], [data-latex], [data-tex], [data-math]').forEach((el) => {
            const tex = el.getAttribute('data-latex') || el.getAttribute('data-tex') || el.getAttribute('data-math') || el.textContent.trim();
            if (tex) el.replaceWith(` $${tex}$ `);
        });

        // 3. Trích xuất công thức toán nhúng trong thuộc tính alt của thẻ <img> (Google Forms, VietJack, Shub)
        clone.querySelectorAll('img').forEach((img) => {
            const alt = (img.getAttribute('alt') || img.getAttribute('title') || '').trim();
            if (alt) {
                img.replaceWith(` [${alt}] `);
            }
        });

        // Xóa phần hiển thị trùng lặp của KaTeX/MathJax nếu đã lấy được LaTeX
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

    // ==================== 👻 CLOSED SHADOW DOM (CÔ LẬP GIAO DIỆN TUYỆT ĐỐI) ====================
    const shadowHost = document.createElement('div');
    // Không đặt ID hay Class để trang thi không thể quét thấy
    shadowHost.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; pointer-events: none;';
    document.documentElement.appendChild(shadowHost);

    const shadow = shadowHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
        * { box-sizing: border-box; }
        #ai-mobile-fab { position: fixed; right: 8px; bottom: 45%; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-family: system-ui, -apple-system, sans-serif; user-select: none; pointer-events: auto; }
        #ai-fab-trigger { width: 34px; height: 34px; border-radius: 50%; background: rgba(30, 30, 46, 0.45); color: #cdd6f4; border: 1px solid rgba(255,255,255,0.15); font-size: 13px; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        #ai-mobile-fab.stealth #ai-fab-trigger { opacity: 0.18; width: 26px; height: 26px; font-size: 10px; }
        #ai-fab-menu { display: none; flex-direction: column; gap: 4px; background: rgba(24, 24, 37, 0.96); padding: 6px; border-radius: 10px; border: 1px solid #313244; box-shadow: 0 6px 20px rgba(0,0,0,0.45); max-height: 75vh; overflow-y: auto; }
        #ai-fab-menu.open { display: flex; }
        .ai-fab-item { background: #313244; color: #cdd6f4; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 500; text-align: left; cursor: pointer; white-space: nowrap; }
        .ai-fab-item:hover, .ai-fab-item:active { background: #45475a; }
        #ai-solver-panel { position: fixed; bottom: 12px; right: 12px; width: min(92vw, 395px); max-height: 48vh; background: #1e1e2e; color: #cdd6f4; border: 1px solid #313244; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 2147483646; font-family: system-ui, -apple-system, sans-serif; display: none; flex-direction: column; overflow: hidden; pointer-events: auto; }
        #ai-solver-panel.stealth-mode { width: min(75vw, 240px); max-height: 105px; background: rgba(20, 20, 30, 0.75); border: 1px solid rgba(255,255,255,0.08); box-shadow: none; opacity: 0.22; border-radius: 6px; }
        #ai-solver-panel.stealth-mode:hover, #ai-solver-panel.stealth-mode:active { opacity: 0.92; }
        #ai-solver-header { background: #181825; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; font-weight: 600; font-size: 11.5px; }
        #ai-solver-header .actions button { background: transparent; border: none; color: #a6adc8; cursor: pointer; font-size: 12.5px; padding: 2px 3.5px; }
        #ai-solver-header .actions button:hover { color: #fff; }
        #ai-solver-body { padding: 10px; overflow-y: auto; font-size: 13px; line-height: 1.45; white-space: pre-wrap; -webkit-overflow-scrolling: touch; }
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
        </div>
        <button id="ai-fab-trigger" title="Menu AI (Alt+X để ẩn khẩn cấp)">•••</button>
    `;
    shadow.appendChild(fabContainer);

    const panel = document.createElement('div');
    panel.id = 'ai-solver-panel';
    if (isStealthUI) panel.classList.add('stealth-mode');
    panel.innerHTML = `
        <div id="ai-solver-header">
            <span id="ai-solver-title">✨ ${currentProvider.toUpperCase()}: ${modelId.split('/').pop()}</span>
            <div class="actions">
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
        <div id="ai-solver-body">👻 V5.0 Shadow DOM đã kích hoạt.\n• Alt+A: Chấm ngầm | Alt+Shift+A: Tự khoanh & điền\n• Alt+Q: Giải chữ/LaTeX | Alt+S: Chụp ảnh | Alt+X: Ẩn khẩn cấp</div>
    `;
    shadow.appendChild(panel);

    const snipOverlay = document.createElement('div');
    snipOverlay.id = 'ai-snip-overlay';
    snipOverlay.innerHTML = `<div id="ai-snip-hint">Kéo chọn vùng câu hỏi hoặc công thức</div>`;
    const snipBox = document.createElement('div');
    snipBox.id = 'ai-snip-box';
    snipOverlay.appendChild(snipBox);
    shadow.appendChild(snipOverlay);

    const $ = (id) => shadow.getElementById(id);
    const bodyEl = $('ai-solver-body');
    const fabMenu = $('ai-fab-menu');

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

    // Quản lý Key & Provider
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
            `🔑 Quản lý danh sách API Key cho [${PROVIDERS[currentProvider].name}]\n• Nhập nhiều Key cách nhau bởi dấu phẩy (,):`,
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

    // Sự kiện nút bấm trong Shadow DOM
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

    // Phím tắt bàn phím
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
        if (!ensureApiKey()) return;
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

        // 1. Google Forms (Hỗ trợ cả Trắc nghiệm & Điền câu trả lời ngắn)
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

        // 2. Quizizz
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

        // 3. Các trang LMS chuẩn HTML (Moodle, Canvas, Azota, Olm, Shub)
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

        // Quét thêm các ô điền khuyết độc lập trong khối câu hỏi (.que, .question)
        document.querySelectorAll('.que input[type="text"], .question input[type="text"]').forEach((inp) => {
            const w = inp.closest('.que, .question');
            if (w) {
                extracted.push({ type: 'text', question: extractTextWithMath(w), inputEl: inp, markEl: inp.parentElement || w });
            }
        });

        return extracted;
    }

    async function applyQuestionResults(questions, resultsMap, autoAct = false) {
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
        showStatus(`✅ Đã xử lý (${solved}/${questions.length} câu):\n` + summary.join(' | '), tabShort);
    }

    function scanAndSolveQuestions(autoAct = false) {
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

        // Nếu toàn bộ câu hỏi đã có trong Cache -> Trả kết quả trong 0ms!
        if (uncachedList.length === 0) {
            showStatus(`⚡ Đã tải 100% đáp án từ Bộ nhớ đệm (0ms)...`);
            applyQuestionResults(questions, resultsMap, autoAct);
            return;
        }

        if (!ensureApiKey()) return;
        showStatus(`⏳ Đang giải ${uncachedList.length} câu mới (${questions.length - uncachedList.length} câu đã có trong Cache)...`);

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
