// core.js - AI Homework Solver V4.0 (Multi-API & Key Rotation)
window.initAISolver = function () {
    // Danh sách cấu hình mặc định của các nhà cung cấp API
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
    let lastSelectedText = '';
    let keyIndexMap = { gemini: 0, groq: 0, openrouter: 0, openai: 0 };

    // Lấy danh sách mảng các API Key của nhà cung cấp hiện tại (hỗ trợ nhập nhiều key cách nhau bằng dấu phẩy)
    function getKeyList(provider = currentProvider) {
        const raw = GM_getValue(`KEYS_${provider}`, '');
        // Tương thích ngược với biến GEMINI_API_KEY cũ
        if (!raw && provider === 'gemini') {
            const oldKey = GM_getValue('GEMINI_API_KEY', '');
            if (oldKey) return [oldKey.trim()];
        }
        return raw.split(/[,;\n]+/).map(k => k.trim()).filter(Boolean);
    }

    function promptManageKeys() {
        const currentRaw = getKeyList(currentProvider).join(', ');
        const input = prompt(
            `🔑 Quản lý API Key cho [${PROVIDERS[currentProvider].name}]\n` +
            `• Bạn có thể nhập NHIỀU API Key cách nhau bởi dấu phẩy (,)\n` +
            `• Khi 1 Key hết hạn mức (429), hệ thống sẽ tự động xoay sang Key tiếp theo:\n`,
            currentRaw
        );
        if (input !== null) {
            GM_setValue(`KEYS_${currentProvider}`, input.trim());
            keyIndexMap[currentProvider] = 0;
            const count = getKeyList(currentProvider).length;
            showStatus(`✅ Đã lưu ${count} API Key cho ${PROVIDERS[currentProvider].name}!`);
        }
    }

    function promptSwitchProvider() {
        const choice = prompt(
            `🌐 Chọn dịch vụ AI muốn sử dụng (nhập số 1 -> 4):\n` +
            `1. Google Gemini (Hỗ trợ nhiều Key, đọc ảnh/toán tốt nhất)\n` +
            `2. Groq (Miễn phí, phản hồi siêu tốc 0.3s)\n` +
            `3. OpenRouter (Dùng DeepSeek, Qwen, Claude...)\n` +
            `4. OpenAI (ChatGPT - gpt-4o-mini / gpt-4o)`,
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

        const keys = getKeyList(currentProvider);
        if (keys.length === 0) {
            promptManageKeys();
        } else {
            showStatus(`✅ Đã chuyển sang ${PROVIDERS[currentProvider].name} (${modelId}) - Có ${keys.length} Key.`);
        }
    }

    function promptModelChange() {
        const p = PROVIDERS[currentProvider];
        const listStr = p.models.map((m, idx) => `${idx + 1}. ${m}`).join('\n');
        const choice = prompt(
            `🤖 Chọn Model cho [${p.name}] (Nhập số thứ tự hoặc tên model bất kỳ):\n${listStr}`,
            modelId
        );
        if (!choice) return;
        const idx = parseInt(choice.trim(), 10) - 1;
        modelId = (idx >= 0 && idx < p.models.length) ? p.models[idx] : choice.trim();
        GM_setValue(`MODEL_${currentProvider}`, modelId);
        updateHeaderTitle();
        showStatus(`✅ Đã đổi model sang: ${modelId}`);
    }

    function updateHeaderTitle() {
        const titleEl = document.getElementById('ai-solver-title');
        if (titleEl) {
            const shortModel = modelId.split('/').pop();
            titleEl.textContent = `✨ ${currentProvider.toUpperCase()}: ${shortModel}`;
        }
        const fabProviderBtn = document.getElementById('fab-switch-provider');
        if (fabProviderBtn) {
            fabProviderBtn.textContent = `🌐 Nguồn AI: ${PROVIDERS[currentProvider].name}`;
        }
    }

    document.addEventListener('selectionchange', () => {
        const text = window.getSelection().toString().trim();
        if (text.length > 2) lastSelectedText = text;
    });

    // ==================== GIAO DIỆN & CSS ====================
    const style = document.createElement('style');
    style.textContent = `
        #ai-mobile-fab { position: fixed; right: 8px; bottom: 45%; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-family: system-ui, sans-serif; user-select: none; -webkit-user-select: none; }
        #ai-fab-trigger { width: 34px; height: 34px; border-radius: 50%; background: rgba(30, 30, 46, 0.45); color: #cdd6f4; border: 1px solid rgba(255,255,255,0.15); font-size: 13px; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        #ai-mobile-fab.stealth #ai-fab-trigger { opacity: 0.2; width: 26px; height: 26px; font-size: 10px; }
        #ai-fab-menu { display: none; flex-direction: column; gap: 5px; background: rgba(24, 24, 37, 0.95); padding: 6px; border-radius: 10px; border: 1px solid #313244; box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
        #ai-fab-menu.open { display: flex; }
        .ai-fab-item { background: #313244; color: #cdd6f4; border: none; border-radius: 6px; padding: 7px 10px; font-size: 12px; font-weight: 500; text-align: left; cursor: pointer; white-space: nowrap; }
        .ai-fab-item:active { background: #45475a; }
        #ai-solver-panel { position: fixed; bottom: 12px; right: 12px; width: min(92vw, 370px); max-height: 45vh; background: #1e1e2e; color: #cdd6f4; border: 1px solid #313244; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 2147483646; font-family: system-ui, sans-serif; display: none; flex-direction: column; overflow: hidden; }
        #ai-solver-panel.stealth-mode { width: min(75vw, 240px); max-height: 110px; background: rgba(20, 20, 30, 0.78); border: 1px solid rgba(255,255,255,0.08); box-shadow: none; opacity: 0.25; border-radius: 6px; }
        #ai-solver-panel.stealth-mode:hover, #ai-solver-panel.stealth-mode:active { opacity: 0.92; }
        #ai-solver-header { background: #181825; padding: 7px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; font-weight: 600; font-size: 11.5px; }
        #ai-solver-header .actions button { background: transparent; border: none; color: #a6adc8; cursor: pointer; font-size: 13px; padding: 2px 4px; }
        #ai-solver-body { padding: 10px; overflow-y: auto; font-size: 13px; line-height: 1.45; white-space: pre-wrap; -webkit-overflow-scrolling: touch; }
        .ai-stealth-mark { display: inline-block; margin-left: 6px; color: currentColor; opacity: 0.38; font-size: 12px; pointer-events: none; }
        .ai-stealth-option-border { border-bottom: 1px dotted rgba(128, 128, 128, 0.38) !important; }
        #ai-snip-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.2); cursor: crosshair; z-index: 2147483647; display: none; touch-action: none; user-select: none; -webkit-user-select: none; }
        #ai-snip-hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(24, 24, 37, 0.9); color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-family: system-ui, sans-serif; pointer-events: none; }
        #ai-snip-box { position: fixed; border: 1.5px dashed #89b4fa; background: rgba(137, 180, 250, 0.15); pointer-events: none; display: none; }
    `;
    document.head.appendChild(style);

    const fabContainer = document.createElement('div');
    fabContainer.id = 'ai-mobile-fab';
    if (isStealthUI) fabContainer.classList.add('stealth');
    fabContainer.innerHTML = `
        <div id="ai-fab-menu">
            <button class="ai-fab-item" id="fab-solve-text">📝 Giải chữ bôi đen</button>
            <button class="ai-fab-item" id="fab-snip-img">📸 Vuốt chụp ảnh/toán</button>
            <button class="ai-fab-item" id="fab-scan-stealth">🎯 Chấm ngầm đáp án</button>
            <button class="ai-fab-item" id="fab-scan-auto">⚡ Tự động khoanh</button>
            <button class="ai-fab-item" id="fab-switch-provider">🌐 Nguồn AI: ${PROVIDERS[currentProvider].name}</button>
            <button class="ai-fab-item" id="fab-change-model">🤖 Đổi Model AI</button>
            <button class="ai-fab-item" id="fab-set-key">🔑 Quản lý danh sách Key</button>
            <button class="ai-fab-item" id="fab-toggle-stealth">🕵️ Chế độ mờ (Stealth)</button>
        </div>
        <button id="ai-fab-trigger" title="Menu AI">•••</button>
    `;
    document.body.appendChild(fabContainer);

    const fabMenu = document.getElementById('ai-fab-menu');
    document.getElementById('ai-fab-trigger').addEventListener('click', (e) => {
        e.stopPropagation();
        fabMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!fabContainer.contains(e.target)) fabMenu.classList.remove('open');
    });

    const panel = document.createElement('div');
    panel.id = 'ai-solver-panel';
    if (isStealthUI) panel.classList.add('stealth-mode');
    panel.innerHTML = `
        <div id="ai-solver-header">
            <span id="ai-solver-title">✨ ${currentProvider.toUpperCase()}: ${modelId.split('/').pop()}</span>
            <div class="actions">
                <button id="ai-btn-provider" title="Đổi nhà cung cấp AI (Gemini/Groq/OpenRouter)">🌐</button>
                <button id="ai-btn-model" title="Đổi Model">🤖</button>
                <button id="ai-btn-key" title="Thêm nhiều API Key">🔑</button>
                <button id="ai-btn-stealth" title="Bật/Tắt chế độ mờ">🕵️</button>
                <button id="ai-btn-copy" title="Copy">📋</button>
                <button id="ai-btn-close" title="Đóng">✖</button>
            </div>
        </div>
        <div id="ai-solver-body">Hỗ trợ xoay vòng nhiều API Key & Đa nền tảng AI.</div>
    `;
    document.body.appendChild(panel);

    const snipOverlay = document.createElement('div');
    snipOverlay.id = 'ai-snip-overlay';
    snipOverlay.innerHTML = `<div id="ai-snip-hint">Kéo chọn vùng câu hỏi hoặc công thức</div>`;
    const snipBox = document.createElement('div');
    snipBox.id = 'ai-snip-box';
    snipOverlay.appendChild(snipBox);
    document.body.appendChild(snipOverlay);

    const bodyEl = document.getElementById('ai-solver-body');

    function showStatus(msg) {
        panel.style.display = 'flex';
        bodyEl.textContent = msg;
    }

    function toggleStealthUI() {
        isStealthUI = !isStealthUI;
        GM_setValue('STEALTH_UI', isStealthUI);
        panel.classList.toggle('stealth-mode', isStealthUI);
        fabContainer.classList.toggle('stealth', isStealthUI);
    }

    // Sự kiện menu
    document.getElementById('fab-solve-text').addEventListener('click', () => {
        fabMenu.classList.remove('open');
        const currentSel = window.getSelection().toString().trim() || lastSelectedText;
        if (currentSel) solveTextQuestion(currentSel);
        else {
            const manual = prompt('Dán hoặc nhập câu hỏi:');
            if (manual && manual.trim()) solveTextQuestion(manual.trim());
        }
    });
    document.getElementById('fab-snip-img').addEventListener('click', () => { fabMenu.classList.remove('open'); startScreenSnip(); });
    document.getElementById('fab-scan-stealth').addEventListener('click', () => { fabMenu.classList.remove('open'); scanAndSolveMCQs(false); });
    document.getElementById('fab-scan-auto').addEventListener('click', () => { fabMenu.classList.remove('open'); scanAndSolveMCQs(true); });
    document.getElementById('fab-switch-provider').addEventListener('click', () => { fabMenu.classList.remove('open'); promptSwitchProvider(); });
    document.getElementById('fab-change-model').addEventListener('click', () => { fabMenu.classList.remove('open'); promptModelChange(); });
    document.getElementById('fab-set-key').addEventListener('click', () => { fabMenu.classList.remove('open'); promptManageKeys(); });
    document.getElementById('fab-toggle-stealth').addEventListener('click', () => { fabMenu.classList.remove('open'); toggleStealthUI(); });

    document.getElementById('ai-btn-close').addEventListener('click', () => (panel.style.display = 'none'));
    document.getElementById('ai-btn-provider').addEventListener('click', promptSwitchProvider);
    document.getElementById('ai-btn-model').addEventListener('click', promptModelChange);
    document.getElementById('ai-btn-key').addEventListener('click', promptManageKeys);
    document.getElementById('ai-btn-stealth').addEventListener('click', toggleStealthUI);
    document.getElementById('ai-btn-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(bodyEl.innerText);
        showStatus('✅ Đã sao chép!');
    });

    document.addEventListener('keydown', (e) => {
        if (!e.altKey) return;
        if (e.code === 'KeyQ') {
            e.preventDefault();
            const text = window.getSelection().toString().trim() || lastSelectedText;
            if (text) solveTextQuestion(text);
        } else if (e.code === 'KeyS') {
            e.preventDefault();
            startScreenSnip();
        } else if (e.code === 'KeyA') {
            e.preventDefault();
            scanAndSolveMCQs(e.shiftKey);
        } else if (e.code === 'KeyH') {
            e.preventDefault();
            toggleStealthUI();
        }
    });

    function solveTextQuestion(text) {
        if (!ensureApiKey()) return;
        showStatus(`⏳ Đang giải (${PROVIDERS[currentProvider].name})...`);
        const prompt = `Giải ngắn gọn, chính xác câu sau:
- Trắc nghiệm: Dòng đầu chốt "Đáp án: [A/B/C/D] - [Nội dung]", dòng sau giải thích ngắn.
- Tự luận/toán: Chốt đáp số ở dòng đầu rồi tóm tắt cách giải.
Câu hỏi:\n${text}`;
        callMultiAI({ textPrompt: prompt }, (res) => showStatus(res));
    }

    // ==================== CHỤP VÙNG ẢNH ====================
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
            }, (res) => showStatus(res));
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

    // ==================== QUÉT TRẮC NGHIỆM ====================
    function extractQuestionsFromDOM() {
        const extracted = [];
        const gItems = document.querySelectorAll('div[role="listitem"]');
        if (gItems.length > 0) {
            gItems.forEach(item => {
                const h = item.querySelector('[role="heading"]');
                const opts = item.querySelectorAll('[role="radio"], [role="checkbox"]');
                if (h && opts.length > 0) {
                    const arr = [];
                    opts.forEach(o => {
                        const txt = o.getAttribute('data-value') || o.getAttribute('aria-label') || o.innerText.trim();
                        arr.push({ text: txt, clickEl: o, markEl: o.closest('label') || o.parentElement || o });
                    });
                    extracted.push({ question: h.innerText.trim(), options: arr });
                }
            });
            if (extracted.length) return extracted;
        }

        const qzQ = document.querySelector('[data-testid="question-container-text"], .question-text-color');
        const qzOpts = document.querySelectorAll('button.option, [data-testid^="option-"]');
        if (qzQ && qzOpts.length > 0) {
            const arr = [];
            qzOpts.forEach(o => arr.push({ text: o.innerText.trim(), clickEl: o, markEl: o }));
            extracted.push({ question: qzQ.innerText.trim(), options: arr });
            return extracted;
        }

        const groups = {};
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(inp => {
            const key = inp.name || inp.closest('.que, .question')?.id || 'default';
            if (!groups[key]) groups[key] = [];
            groups[key].push(inp);
        });
        Object.values(groups).forEach(inputs => {
            if (inputs.length < 2) return;
            const w = inputs[0].closest('.que, .question, .panel, div');
            const qTxt = w ? w.innerText.split('\n')[0].trim() : 'Câu hỏi';
            const arr = inputs.map(i => {
                const lbl = document.querySelector(`label[for="${i.id}"]`) || i.closest('label') || i.parentElement;
                return { text: lbl ? lbl.innerText.trim() : i.value, clickEl: i, markEl: lbl || i };
            });
            extracted.push({ question: qTxt, options: arr });
        });
        return extracted;
    }

    function scanAndSolveMCQs(autoClick = false) {
        if (!ensureApiKey()) return;
        document.querySelectorAll('.ai-stealth-mark').forEach(e => e.remove());
        document.querySelectorAll('.ai-stealth-option-border').forEach(e => e.classList.remove('ai-stealth-option-border'));
        const questions = extractQuestionsFromDOM();
        if (!questions.length) return showStatus('⚠️ Không thấy câu hỏi trắc nghiệm.');

        showStatus(`⏳ Đang giải ${questions.length} câu bằng ${PROVIDERS[currentProvider].name}...`);
        const payload = questions.map((q, i) => ({ id: i, question: q.question, options: q.options.map((o, idx) => `${idx}: ${o.text}`) }));
        const prompt = `Chỉ trả về MẢNG JSON thuần túy (không có markdown \`\`\`json): [{"id": <số>, "answerIndices": [<mảng số nguyên chỉ số đúng>]}]\nDữ liệu:\n${JSON.stringify(payload)}`;

        callMultiAI({ textPrompt: prompt, forceJson: true }, (res) => {
            try {
                const jsonMatch = res.match(/\[[\s\S]*\]/);
                const clean = jsonMatch ? jsonMatch[0] : res.replace(/```json|```/g, '').trim();
                const results = JSON.parse(clean);
                let solved = 0; const sum = [];
                results.forEach(it => {
                    const qObj = questions[it.id];
                    if (!qObj || !Array.isArray(it.answerIndices)) return;
                    const letters = [];
                    it.answerIndices.forEach(idx => {
                        const opt = qObj.options[idx];
                        if (!opt) return;
                        letters.push(String.fromCharCode(65 + idx));
                        const dot = document.createElement('span');
                        dot.className = 'ai-stealth-mark'; dot.textContent = '•';
                        opt.markEl.appendChild(dot);
                        opt.markEl.classList.add('ai-stealth-option-border');
                        if (autoClick && opt.clickEl && opt.clickEl.getAttribute('aria-checked') !== 'true' && !opt.clickEl.checked) {
                            opt.clickEl.click();
                        }
                    });
                    if (letters.length) { solved++; sum.push(`C${it.id + 1}:${letters.join('')}`); }
                });
                showStatus(`✅ (${solved}/${questions.length}): ` + sum.join(' | '));
            } catch {
                showStatus('❌ Lỗi định dạng JSON:\n' + res);
            }
        });
    }

    function ensureApiKey() {
        if (getKeyList(currentProvider).length === 0) promptManageKeys();
        return getKeyList(currentProvider).length > 0;
    }

    // ==================== BỘ ĐIỀU PHỐI XOAY VÒNG NHIỀU API KEY & ĐA NỀN TẢNG ====================
    function callMultiAI({ textPrompt, base64Image = null, forceJson = false }, onSuccess, retryAttempt = 0) {
        const keys = getKeyList(currentProvider);
        if (keys.length === 0) return showStatus('❌ Chưa có API Key!');

        const currentIdx = keyIndexMap[currentProvider] % keys.length;
        const activeKey = keys[currentIdx];

        // 1. Nếu là Google Gemini
        if (currentProvider === 'gemini') {
            const parts = [{ text: textPrompt }];
            if (base64Image) {
                parts.push({ inline_data: { mime_type: 'image/png', data: base64Image } });
            }
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
                            // Tự động xoay sang Key tiếp theo nếu hết hạn mức (429) hoặc Key lỗi
                            if (retryAttempt < keys.length - 1) {
                                keyIndexMap[currentProvider] = (currentIdx + 1) % keys.length;
                                showStatus(`🔄 Key #${currentIdx + 1} hết hạn mức, đang tự chuyển sang Key #${keyIndexMap[currentProvider] + 1}...`);
                                return callMultiAI({ textPrompt, base64Image, forceJson }, onSuccess, retryAttempt + 1);
                            }
                            return showStatus(`❌ Lỗi Gemini (Đã thử hết ${keys.length} Key): ${data.error.message}`);
                        }
                        // Xoay vòng đều các key cho lần gọi kế tiếp
                        keyIndexMap[currentProvider] = (currentIdx + 1) % keys.length;
                        onSuccess(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
                    } catch {
                        showStatus('❌ Lỗi đọc dữ liệu phản hồi.');
                    }
                },
                onerror: () => showStatus('❌ Lỗi mạng khi gọi Gemini API.')
            });
        }
        // 2. Nếu là Groq, OpenRouter, hoặc OpenAI (Chuẩn OpenAI Chat Completions)
        else {
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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeKey}`
                },
                data: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: contentPayload }],
                    temperature: 0.1
                }),
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
