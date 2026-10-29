// core.js
window.initAISolver = function () {
    let apiKey = GM_getValue('GEMINI_API_KEY', '');
    let isStealthUI = GM_getValue('STEALTH_UI', false);
    let lastSelectedText = '';

    function promptApiKey() {
        const key = prompt('Nhập Gemini API Key:', apiKey);
        if (key !== null) {
            apiKey = key.trim();
            GM_setValue('GEMINI_API_KEY', apiKey);
            showStatus('✅ Đã lưu API Key!');
        }
    }

    document.addEventListener('selectionchange', () => {
        const text = window.getSelection().toString().trim();
        if (text.length > 2) lastSelectedText = text;
    });

    const style = document.createElement('style');
    style.textContent = `
        #ai-mobile-fab { position: fixed; right: 8px; bottom: 45%; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-family: system-ui, sans-serif; user-select: none; }
        #ai-fab-trigger { width: 34px; height: 34px; border-radius: 50%; background: rgba(30, 30, 46, 0.45); color: #cdd6f4; border: 1px solid rgba(255,255,255,0.15); font-size: 13px; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); }
        #ai-mobile-fab.stealth #ai-fab-trigger { opacity: 0.2; width: 26px; height: 26px; font-size: 10px; }
        #ai-fab-menu { display: none; flex-direction: column; gap: 5px; background: rgba(24, 24, 37, 0.95); padding: 6px; border-radius: 10px; border: 1px solid #313244; }
        #ai-fab-menu.open { display: flex; }
        .ai-fab-item { background: #313244; color: #cdd6f4; border: none; border-radius: 6px; padding: 7px 10px; font-size: 12px; font-weight: 500; text-align: left; cursor: pointer; white-space: nowrap; }
        .ai-fab-item:active { background: #45475a; }
        #ai-solver-panel { position: fixed; bottom: 12px; right: 12px; width: min(92vw, 360px); max-height: 45vh; background: #1e1e2e; color: #cdd6f4; border: 1px solid #313244; border-radius: 10px; z-index: 2147483646; font-family: system-ui, sans-serif; display: none; flex-direction: column; overflow: hidden; }
        #ai-solver-panel.stealth-mode { width: min(75vw, 240px); max-height: 110px; background: rgba(20, 20, 30, 0.78); opacity: 0.25; }
        #ai-solver-panel.stealth-mode:hover, #ai-solver-panel.stealth-mode:active { opacity: 0.92; }
        #ai-solver-header { background: #181825; padding: 7px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313244; font-weight: 600; font-size: 12.5px; }
        #ai-solver-header .actions button { background: transparent; border: none; color: #a6adc8; cursor: pointer; font-size: 13px; padding: 2px 5px; }
        #ai-solver-body { padding: 10px; overflow-y: auto; font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
        .ai-stealth-mark { display: inline-block; margin-left: 6px; color: currentColor; opacity: 0.38; font-size: 12px; pointer-events: none; }
        .ai-stealth-option-border { border-bottom: 1px dotted rgba(128, 128, 128, 0.38) !important; }
        #ai-snip-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.2); cursor: crosshair; z-index: 2147483647; display: none; touch-action: none; user-select: none; }
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
            <button class="ai-fab-item" id="fab-toggle-stealth">🕵️ Chế độ mờ</button>
            <button class="ai-fab-item" id="fab-set-key">🔑 Cài API Key</button>
        </div>
        <button id="ai-fab-trigger">•••</button>
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
            <span>✨ AI Solver Pro</span>
            <div class="actions">
                <button id="ai-btn-stealth">🕵️</button>
                <button id="ai-btn-copy">📋</button>
                <button id="ai-btn-close">✖</button>
            </div>
        </div>
        <div id="ai-solver-body">Chạm nút ••• để bắt đầu.</div>
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

    document.getElementById('fab-solve-text').addEventListener('click', () => {
        fabMenu.classList.remove('open');
        const currentSel = window.getSelection().toString().trim() || lastSelectedText;
        if (currentSel) solveTextQuestion(currentSel);
        else {
            const manual = prompt('Dán hoặc nhập câu hỏi:');
            if (manual && manual.trim()) solveTextQuestion(manual.trim());
        }
    });

    document.getElementById('fab-snip-img').addEventListener('click', () => {
        fabMenu.classList.remove('open');
        startScreenSnip();
    });

    document.getElementById('fab-scan-stealth').addEventListener('click', () => {
        fabMenu.classList.remove('open');
        scanAndSolveMCQs(false);
    });

    document.getElementById('fab-scan-auto').addEventListener('click', () => {
        fabMenu.classList.remove('open');
        scanAndSolveMCQs(true);
    });

    document.getElementById('fab-toggle-stealth').addEventListener('click', () => {
        fabMenu.classList.remove('open');
        toggleStealthUI();
    });

    document.getElementById('fab-set-key').addEventListener('click', () => {
        fabMenu.classList.remove('open');
        promptApiKey();
    });

    document.getElementById('ai-btn-close').addEventListener('click', () => (panel.style.display = 'none'));
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
        showStatus('⏳ Đang phân tích câu hỏi...');
        const prompt = `Giải ngắn gọn, chính xác câu sau:
- Trắc nghiệm: Dòng đầu chốt "Đáp án: [A/B/C/D] - [Nội dung]", dòng sau giải thích ngắn.
- Tự luận/toán: Chốt đáp số ở dòng đầu rồi tóm tắt cách giải.
Câu hỏi:\n${text}`;
        callGeminiAPI([{ text: prompt }], (res) => showStatus(res));
    }

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
        const l = Math.min(startX, pt.x), t = Math.min(startY, pt.y);
        const w = Math.abs(pt.x - startX), h = Math.abs(pt.y - startY);
        snipBox.style.left = `${l}px`; snipBox.style.top = `${t}px`;
        snipBox.style.width = `${w}px`; snipBox.style.height = `${h}px`;
    }

    async function onSnipEnd(e) {
        if (!isSnipping) return;
        e.preventDefault();
        isSnipping = false;
        const rect = snipBox.getBoundingClientRect();
        snipOverlay.style.display = 'none';
        snipBox.style.display = 'none';
        if (rect.width < 15 || rect.height < 15) return;

        showStatus('📸 Đang xử lý ảnh & công thức...');
        try {
            const canvas = await html2canvas(document.body, {
                x: rect.left + window.scrollX, y: rect.top + window.scrollY,
                width: rect.width, height: rect.height,
                useCORS: true, allowTaint: false, logging: false,
                scale: Math.min(window.devicePixelRatio || 1, 2)
            });
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            callGeminiAPI([
                { text: 'Đọc công thức/hình học trong ảnh và giải chính xác. Dòng đầu chốt ngay đáp án/kết quả.' },
                { inline_data: { mime_type: 'image/png', data: base64 } }
            ], (res) => showStatus(res));
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

        showStatus(`⏳ Đang xử lý ${questions.length} câu...`);
        const payload = questions.map((q, i) => ({ id: i, question: q.question, options: q.options.map((o, idx) => `${idx}: ${o.text}`) }));
        const prompt = `Trả về MẢNG JSON thuần: [{"id": <số>, "answerIndices": [<mảng số nguyên chỉ số đúng>]}]\nDữ liệu:\n${JSON.stringify(payload)}`;

        callGeminiAPI([{ text: prompt }], (res) => {
            try {
                const results = JSON.parse(res.replace(/```json|```/g, '').trim());
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
                showStatus('❌ Lỗi định dạng JSON.');
            }
        }, true);
    }

    function ensureApiKey() {
        if (!apiKey) promptApiKey();
        return !!apiKey;
    }

    function callGeminiAPI(parts, onSuccess, forceJson = false) {
        const generationConfig = { temperature: 0.1 };
        if (forceJson) generationConfig.responseMimeType = 'application/json';
        GM_xmlhttpRequest({
            method: 'POST',
            url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ contents: [{ parts }], generationConfig }),
            onload: (res) => {
                try {
                    const data = JSON.parse(res.responseText);
                    if (data.error) return showStatus(`❌ Lỗi API: ${data.error.message}`);
                    onSuccess(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
                } catch {
                    showStatus('❌ Lỗi phản hồi.');
                }
            },
            onerror: () => showStatus('❌ Lỗi mạng.')
        });
    }
};
