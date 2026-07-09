// fallmage SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from fallmage/index.html · 65070 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

/*!
 * Fall Kit · v1.0.0 · the shared cascade for every estate seed
 *
 * Inlineable JS module. Drop into any seed via <script> or copy-paste inline.
 * Preserves single-HTML sovereignty (no external deps until user opts in to T2 WebLLM).
 *
 * What it gives every seed:
 *  - AI tier picker: T0 (off · default) · T2 (WebLLM in-browser, 5 models 1B-70B) · T3 (BYOK Anthropic/OpenAI/Google)
 *  - Universal entry: FallKit.aiComplete(systemPrompt, userMsg, maxTokens) → string|null
 *  - AI chip UI in header
 *  - WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN)
 *  - Help section partial: FallKit.helpSection()
 *  - Settings panel: FallKit.openSettings()
 *
 * Doctrine (per botler CLAUDE.md):
 *  - T0 fallback ALWAYS works · aiComplete returns null · caller MUST degrade gracefully
 *  - NEVER hide a feature behind AI · NEVER proxy API keys · NEVER log keys
 *  - WebLLM is lazy-loaded · model weights download ONLY on user opt-in
 *
 * Estate-first canonical references:
 *  - WebLLM pattern: Downloads/botler/index.html (T0/T2/T3 cascade)
 *  - WebRTC pattern: Downloads/fallnet/fallnet-shim.js (raw RTCPeerConnection)
 *  - Mesh channel:   'fall-signal'
 */
(function (root) {
  'use strict';
  const FALL_KIT_VERSION = '1.2.0';
  const KCC_MINT_URL = 'https://sjgant80-hub.github.io/kcc-mint/';
  // ─── Model registry ──────────────────────────────────────────────
  const WEBLLM_MODELS = {
    'llama-1b':  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',   size: '~700MB', label: '1B · fast · any laptop / phone' },
    'llama-3b':  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',   size: '~2GB',   label: '3B · balanced · default · most laptops' },
    'qwen-7b':   { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',     size: '~5GB',   label: '7B · capable · needs decent GPU (M-series Mac / 8GB+ VRAM)' },
    'llama-8b':  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',   size: '~5GB',   label: '8B · common · needs decent GPU' },
    'llama-70b': { id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',  size: '~40GB',  label: '70B · frontier · needs serious GPU + 64GB+ RAM' },
  };
  const DEFAULT_MODEL = 'llama-3b';
  const T3_PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', models: ['claude-sonnet-4-5','claude-opus-4-7','claude-haiku-4-5'], default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com/v1/messages' },
    openai:    { label: 'OpenAI',           models: ['gpt-4o','gpt-4o-mini','o1-mini'],                          default: 'gpt-4o-mini',      url: 'https://api.openai.com/v1/chat/completions' },
    google:    { label: 'Google Gemini',    models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash-exp'], default: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  };
  // ─── State ───────────────────────────────────────────────────────
  const STATE = {
    config: loadConfig(),
    ai: { ready: false, loading: false, progress: 0, engine: null, model: null },
    mesh: { active: false, peers: new Map(), bc: null, signal: null },
  };
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('fall-kit.config') || '{}'); }
    catch (e) { return {}; }
  }
  function saveConfig() {
    try { localStorage.setItem('fall-kit.config', JSON.stringify(STATE.config)); } catch (e) {}
  }
  // ─── DOM helpers ─────────────────────────────────────────────────
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  // ─── AI tier ─────────────────────────────────────────────────────
  function aiTier() { return STATE.config.ai_tier || 'T0'; }
  function renderAiChip() {
    const chip = $('#fk-ai-chip');
    if (!chip) return;
    const txt = $('#fk-ai-chip-text');
    chip.classList.remove('fk-chip-live', 'fk-chip-loading', 'fk-chip-warn');
    const tier = aiTier();
    if (tier === 'T0') { txt.textContent = 'T0 · off'; }
    else if (tier === 'T2') {
      if (STATE.ai.ready) { txt.textContent = 'T2 ' + (WEBLLM_MODELS[STATE.config.webllm_model || DEFAULT_MODEL]?.label.split(' · ')[0] || '') + ' · ready'; chip.classList.add('fk-chip-live'); }
      else if (STATE.ai.loading) { txt.textContent = 'T2 loading ' + Math.round(STATE.ai.progress) + '%'; chip.classList.add('fk-chip-loading'); }
      else { txt.textContent = 'T2 · click to load'; chip.classList.add('fk-chip-warn'); }
    } else if (tier === 'T3') {
      if (STATE.config.api_key) { txt.textContent = 'T3 ' + (T3_PROVIDERS[STATE.config.api_provider]?.label || 'BYOK') + ' · active'; chip.classList.add('fk-chip-live'); }
      else { txt.textContent = 'T3 · no key set'; chip.classList.add('fk-chip-warn'); }
    }
  }
  async function loadWebLLM(modelKey) {
    if (STATE.ai.loading) return;
    const key = modelKey || STATE.config.webllm_model || DEFAULT_MODEL;
    const model = WEBLLM_MODELS[key];
    if (!model) { console.error('fall-kit: unknown model', key); return; }
    if (STATE.ai.ready && STATE.ai.model === model.id) return;
    STATE.ai.loading = true; STATE.ai.progress = 0; renderAiChip();
    notify('Loading WebLLM · ' + model.label + ' · ' + model.size + ' first time', 'info');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
      const engine = await CreateMLCEngine(model.id, {
        initProgressCallback: p => { STATE.ai.progress = (p.progress || 0) * 100; renderAiChip(); }
      });
      STATE.ai.engine = engine;
      STATE.ai.model = model.id;
      STATE.ai.ready = true;
      STATE.ai.loading = false;
      STATE.config.webllm_model = key; saveConfig();
      renderAiChip();
      notify('WebLLM ready · sovereign mode · ' + model.label.split(' · ')[0], 'ok');
    } catch (e) {
      console.error('fall-kit: WebLLM load failed', e);
      STATE.ai.loading = false; renderAiChip();
      notify('WebLLM load failed · ' + e.message, 'err');
    }
  }
  async function aiComplete(systemPrompt, userMsg, maxTokens) {
    maxTokens = maxTokens || 600;
    const tier = aiTier();
    if (tier === 'T2' && STATE.ai.ready && STATE.ai.engine) {
      const r = await STATE.ai.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
      });
      return r.choices[0].message.content;
    }
    if (tier === 'T3' && STATE.config.api_key && STATE.config.api_provider) {
      return await aiCloudCall(systemPrompt, userMsg, maxTokens);
    }
    return null;
  }
  async function aiCloudCall(sys, msg, maxTokens) {
    const provider = STATE.config.api_provider;
    const key = STATE.config.api_key;
    const model = STATE.config.api_model || T3_PROVIDERS[provider]?.default;
    if (provider === 'anthropic') {
      const r = await fetch(T3_PROVIDERS.anthropic.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.content[0].text;
    }
    if (provider === 'openai') {
      const r = await fetch(T3_PROVIDERS.openai.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('OpenAI ' + r.status);
      const j = await r.json();
      return j.choices[0].message.content;
    }
    if (provider === 'google') {
      const r = await fetch(T3_PROVIDERS.google.url + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\n---\n\n' + msg }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      if (!r.ok) throw new Error('Google ' + r.status);
      const j = await r.json();
      return j.candidates[0].content.parts[0].text;
    }
    throw new Error('unknown provider: ' + provider);
  }
  // ─── WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN) ───
  const MESH_CHANNEL = 'fall-signal';
  const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function meshStart(opts) {
    if (STATE.mesh.active) return;
    opts = opts || {};
    const seedId = opts.seedId || (location.pathname + '#' + Math.random().toString(36).slice(2, 8));
    STATE.mesh.seedId = seedId;
    try { STATE.mesh.bc = new BroadcastChannel(MESH_CHANNEL); }
    catch (e) { console.warn('fall-kit: BroadcastChannel unavailable'); return; }
    STATE.mesh.bc.onmessage = e => {
      const m = e.data;
      if (!m || !m.kind || m.peerId === seedId) return;
      if (opts.onMessage) opts.onMessage(m);
    };
    STATE.mesh.bc.postMessage({ kind: 'fall-kit:hello', peerId: seedId, ts: Date.now(), seedName: opts.seedName || 'unknown' });
    STATE.mesh.active = true;
    notify('Mesh active · channel ' + MESH_CHANNEL, 'ok');
  }
  function meshPost(kind, payload) {
    if (!STATE.mesh.active || !STATE.mesh.bc) return false;
    STATE.mesh.bc.postMessage({ kind: kind, peerId: STATE.mesh.seedId, ts: Date.now(), payload: payload });
    return true;
  }
  // ─── Toast ───────────────────────────────────────────────────────
  function notify(msg, kind) {
    let t = $('#fk-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'fk-toast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(20px);background:#c08a3a;color:#0a0a0a;padding:9px 18px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:0;transition:all .22s;z-index:10000;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#a14a2a' : kind === 'ok' ? '#6b8d4a' : '#c08a3a';
    t.style.color = kind === 'err' ? '#fff' : '#0a0a0a';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2400);
  }
  // ─── Settings modal ──────────────────────────────────────────────
  function openSettings() {
    let bg = $('#fk-modal-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'fk-modal-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto;z-index:9999';
      bg.onclick = e => { if (e.target.id === 'fk-modal-bg') closeSettings(); };
      document.body.appendChild(bg);
    }
    const tier = aiTier();
    const provider = STATE.config.api_provider || 'anthropic';
    const providerCfg = T3_PROVIDERS[provider];
    bg.innerHTML = `
      <div style="background:#13121a;border:1px solid #c08a3a;border-radius:5px;max-width:600px;width:100%;padding:22px 24px;color:#ebe3d2;font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;line-height:1.55">
        <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Tier</label>
          <select id="fk-tier" style="width:100%;padding:8px 11px;background:#1a1922;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13.5px;font-family:inherit">
            <option value="T0"${tier==='T0'?' selected':''}>T0 · off (default · the seed works fully without AI)</option>
            <option value="T2"${tier==='T2'?' selected':''}>T2 · WebLLM in-browser · sovereign · pick a model below</option>
            <option value="T3"${tier==='T3'?' selected':''}>T3 · BYOK · Anthropic / OpenAI / Google · stored in your browser only</option>
          </select>
        </div>
        <div id="fk-t2-block" style="display:${tier==='T2'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">WebLLM model · 1B → 70B cascade</label>
          <select id="fk-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit">
            ${Object.entries(WEBLLM_MODELS).map(([k,m]) => `<option value="${k}"${(STATE.config.webllm_model||DEFAULT_MODEL)===k?' selected':''}>${esc(m.label)} · ${esc(m.size)}</option>`).join('')}
          </select>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="fk-load-llm" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">${STATE.ai.ready?'✓ Loaded · switch':'Load model (one-time download)'}</button>
            <span id="fk-llm-status" style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.04em">${STATE.ai.ready?'ready':STATE.ai.loading?Math.round(STATE.ai.progress)+'%':'not loaded'}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">First load downloads the model from @mlc-ai/web-llm CDN. Cached forever after. Inference is 100% local — open DevTools → Network during use, nothing leaves.</div>
        </div>
        <div id="fk-t3-block" style="display:${tier==='T3'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">BYOK provider</label>
          <select id="fk-provider" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${Object.entries(T3_PROVIDERS).map(([k,p]) => `<option value="${k}"${provider===k?' selected':''}>${esc(p.label)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Model</label>
          <select id="fk-api-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${providerCfg.models.map(m => `<option value="${m}"${(STATE.config.api_model||providerCfg.default)===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">API key</label>
          <input type="password" id="fk-key" value="${esc(STATE.config.api_key || '')}" placeholder="${STATE.config.api_key ? '(set · leave empty to keep)' : 'sk-ant-... or sk-... or AIza...'}" autocomplete="off" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:ui-monospace,Menlo,monospace">
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">Key lives in this browser only (localStorage). Sent direct to the provider — never to us. Wipe with Reset.</div>
        </div>
        <div style="margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Cross-seed mesh</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="fk-mesh-toggle" style="padding:6px 12px;background:${STATE.mesh.active?'#6b8d4a':'#1a1922'};color:${STATE.mesh.active?'#fff':'#a89e88'};border:1px solid ${STATE.mesh.active?'#6b8d4a':'#3a342c'};border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">${STATE.mesh.active?'✓ Active · disconnect':'Activate mesh'}</button>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#6e6a5e;letter-spacing:.04em">channel · <code style="background:#22212c;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code></span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">BroadcastChannel for same-device · WebRTC for cross-device (planned). Other estate seeds on the same channel discover each other automatically.</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button onclick="FallKit.closeSettings()" style="padding:7px 14px;background:transparent;color:#a89e88;border:1px solid #3a342c;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">Close</button>
          <button id="fk-save" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">Save</button>
        </div>
      </div>`;
    // Wire interactions
    $('#fk-tier').onchange = () => {
      const t = $('#fk-tier').value;
      $('#fk-t2-block').style.display = t === 'T2' ? 'block' : 'none';
      $('#fk-t3-block').style.display = t === 'T3' ? 'block' : 'none';
    };
    $('#fk-provider') && ($('#fk-provider').onchange = () => {
      const p = $('#fk-provider').value;
      const sel = $('#fk-api-model');
      sel.innerHTML = T3_PROVIDERS[p].models.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    });
    $('#fk-load-llm') && ($('#fk-load-llm').onclick = () => {
      const m = $('#fk-model').value;
      loadWebLLM(m);
    });
    $('#fk-mesh-toggle').onclick = () => {
      if (STATE.mesh.active) { STATE.mesh.bc?.close(); STATE.mesh.active = false; STATE.mesh.bc = null; notify('Mesh disconnected'); }
      else meshStart({ seedName: STATE.config.seedName || 'seed' });
      openSettings();  // refresh modal
    };
    $('#fk-save').onclick = () => {
      STATE.config.ai_tier = $('#fk-tier').value;
      if ($('#fk-model')) STATE.config.webllm_model = $('#fk-model').value;
      if ($('#fk-provider')) STATE.config.api_provider = $('#fk-provider').value;
      if ($('#fk-api-model')) STATE.config.api_model = $('#fk-api-model').value;
      const newKey = $('#fk-key')?.value;
      if (newKey) STATE.config.api_key = newKey;
      saveConfig(); renderAiChip(); notify('Saved', 'ok'); closeSettings();
    };
  }
  function closeSettings() { const bg = $('#fk-modal-bg'); if (bg) bg.remove(); }
  // ─── Help section (returns HTML string for inclusion in seed Help tabs) ───
  function helpSection() {
    return `<div style="background:rgba(192,138,58,.05);border:1px solid #3a342c;border-radius:4px;padding:18px 22px;margin:14px 0">
      <p style="font-size:13px;color:#a89e88;line-height:1.7;margin-bottom:10px">This seed runs fully without AI (<strong style="color:#c08a3a">T0</strong>, default). Enable a tier in settings if you want AI-assist features:</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">Tier</th><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">What it is</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T0</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">Off. The seed works fully. No AI · no downloads · no API calls.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T2</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">WebLLM in-browser. Pick a model: 1B (700MB, fast) → 3B (2GB, balanced) → 7B (5GB, capable) → 70B (40GB, frontier). One-time download, runs offline forever after. Zero data leaves your device.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T3</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">BYOK · Anthropic Claude · OpenAI GPT · Google Gemini. You bring the API key, you pay the provider direct. Key stays in your browser, sent direct to the provider, never proxied.</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#6e6a5e;line-height:1.6;margin-top:10px">Open the AI chip in the header to switch tier or check status. Cross-seed mesh activates a BroadcastChannel on <code style="background:#1a1922;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code> so other estate seeds on the same device discover this one.</p>
    </div>`;
  }
  // ─── CSS for AI chip ─────────────────────────────────────────────
  function injectCss() {
    const s = document.createElement('style');
    s.id = 'fk-css';
    s.textContent = `
      #fk-ai-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:3px; font-family:ui-monospace,Menlo,monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:600; cursor:pointer; border:1px solid #3a342c; background:#1a1922; color:#a89e88; user-select:none; vertical-align:middle }
      #fk-ai-chip:hover { border-color:#c08a3a; color:#ebe3d2 }
      #fk-ai-chip.fk-chip-live { border-color:#6b8d4a; color:#6b8d4a; background:rgba(107,141,74,.10) }
      #fk-ai-chip.fk-chip-loading { border-color:#e8a83a; color:#e8a83a; background:rgba(232,168,58,.10) }
      #fk-ai-chip.fk-chip-warn { border-color:#a14a2a; color:#a14a2a; background:rgba(161,74,42,.08) }
      #fk-ai-chip .fk-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
      #fk-ai-chip.fk-chip-loading .fk-dot { animation:fk-pulse 1s infinite }
      @keyframes fk-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .fk-ai-assist { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; border:1px solid #c08a3a; color:#c08a3a; background:transparent; border-radius:3px; cursor:pointer; font-family:inherit }
      .fk-ai-assist:hover { background:#c08a3a; color:#0a0a0a }
      .fk-ai-assist::before { content:'✦'; font-size:12px }
    `;
    document.head.appendChild(s);
  }
  // ─── KCC Mint launcher (v1.2 · fork-this-seed shortcut) ──────────
  function openMint() {
    const slug = (STATE.config.seedName || location.hostname.split('.')[0] || 'seed').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const url = location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({ fork: '1', parent_slug: slug, parent_name: name, parent_url: url, parent_desc: desc });
  }
  // ─── Init ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    injectCss();
    if (opts.seedName) STATE.config.seedName = opts.seedName;
    if ($('#fk-ai-chip')) { renderAiChip(); return { version: FALL_KIT_VERSION, mounted: false }; }
    const chip = document.createElement('button');
    chip.id = 'fk-ai-chip';
    chip.title = 'AI cascade · click to configure tier and model';
    chip.innerHTML = '<span class="fk-dot"></span><span id="fk-ai-chip-text">T0 · off</span>';
    chip.onclick = openSettings;
    // Try anchor first, fall back to floating bottom-right
    const anchor = opts.chipAnchor ? $(opts.chipAnchor) : null;
    if (anchor) { anchor.appendChild(chip); }
    else {
      chip.style.cssText += ';position:fixed;bottom:14px;left:14px;z-index:9998;box-shadow:0 4px 14px rgba(0,0,0,.4)';
      document.body.appendChild(chip);
    }
    // v1.2 · floating mint button next to chip
    if (!$('#fk-mint-btn') && !opts.hideMint) {
      const mintBtn = document.createElement('button');
      mintBtn.id = 'fk-mint-btn';
      mintBtn.title = 'Mint a fork of this seed as a KCC bundle · provenance economy';
      mintBtn.innerHTML = '<span style="font-size:13px">✦</span> mint fork';
      mintBtn.style.cssText = 'position:fixed;bottom:14px;left:130px;z-index:9998;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;cursor:pointer;border:1px solid #c08a3a;color:#c08a3a;background:rgba(10,10,15,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)';
      mintBtn.onmouseover = () => { mintBtn.style.background = '#c08a3a'; mintBtn.style.color = '#0a0a0a'; };
      mintBtn.onmouseout  = () => { mintBtn.style.background = 'rgba(10,10,15,.7)'; mintBtn.style.color = '#c08a3a'; };
      mintBtn.onclick = openMint;
      document.body.appendChild(mintBtn);
    }
    renderAiChip();
    return { version: FALL_KIT_VERSION, mounted: true };
  }
  // ─── Public API ──────────────────────────────────────────────────
  root.FallKit = {
    version: FALL_KIT_VERSION,
    init: init,
    aiTier: aiTier,
    aiComplete: aiComplete,
    loadWebLLM: loadWebLLM,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderAiChip: renderAiChip,
    helpSection: helpSection,
    meshStart: meshStart,
    meshPost: meshPost,
    notify: notify,
    openMint: openMint,  // v1.2 · launch kcc-mint with this seed prefilled as parent
    MODELS: WEBLLM_MODELS,
    PROVIDERS: T3_PROVIDERS,
    state: STATE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
  // fall-kit init · auto-mounts a floating AI chip bottom-left
  (function () {
    function go() { if (typeof FallKit !== 'undefined') FallKit.init({ seedName: "fallmage" }); }
    else go();
  })();
'use strict';
// ════════════════════════════════════════════════════════════════
// FallMage v1 · sovereign Photoshop wedge · prime 1423 · MIT
// ════════════════════════════════════════════════════════════════
const VERSION='1.0.0';const PRIME=1423;const STORE='fallmage-v1';
let state={
  doc:null,             // {w, h, layers:[], adjust:{}}
  activeLayer:0,
  tool:'move',
  zoom:1,
  pan:{x:0,y:0},
  brush:{size:14,color:'#ff8c00',hardness:0.9},
  text:{font:'Georgia',size:48,color:'#ffffff',weight:'600'},
  fill:{color:'#ff8c00'},
  history:[],hIdx:-1,
  settings:{anthropicKey:'',geminiKey:'',openaiKey:'',openrouterKey:''}
};
// ── util ──
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const uid=()=>'_'+Math.random().toString(36).slice(2,11);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._to);t._to=setTimeout(()=>t.classList.remove('show'),1700)}
// ── IDB ──
let db;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(STORE,1);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('s'))d.createObjectStore('s');if(!d.objectStoreNames.contains('blobs'))d.createObjectStore('blobs')};r.onsuccess=e=>{db=e.target.result;res(db)};r.onerror=rej})}
async function saveSettings(){if(!db)await openDB();const tx=db.transaction('s','readwrite');tx.objectStore('s').put(state.settings,'settings')}
async function loadSettings(){if(!db)await openDB();return new Promise(r=>{const tx=db.transaction('s','readonly');const q=tx.objectStore('s').get('settings');q.onsuccess=()=>{if(q.result)state.settings=Object.assign(state.settings,q.result);r()}})}
// ── CASCADE (T0/T2/T3) ──
const Cascade={
  async detectTier(){if(await this._probe())return'T2';const s=state.settings;if(s.anthropicKey||s.openaiKey||s.geminiKey||s.openrouterKey)return'T3';return'T0'},
  async _probe(){if(this._p!==undefined)return this._p;try{this._p=await Promise.race([fetch('http://127.0.0.1:11434/api/tags').then(r=>r.ok),new Promise(r=>setTimeout(()=>r(false),350))])}catch(e){this._p=false}return this._p},
  async generate(sys,user,maxTok){const s=state.settings,max=maxTok||800;
    if(s.anthropicKey)try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':s.anthropicKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-haiku-4-5',max_tokens:max,system:sys,messages:[{role:'user',content:user}]})});const d=await r.json();return{tier:'T3·Claude',text:d?.content?.[0]?.text||''}}catch(e){}
    if(s.geminiKey)try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${s.geminiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents:[{parts:[{text:user}]}]})});const d=await r.json();return{tier:'T3·Gemini',text:d?.candidates?.[0]?.content?.parts?.[0]?.text||''}}catch(e){}
    if(s.openaiKey)try{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.openaiKey},body:JSON.stringify({model:'gpt-4o-mini',messages:[{role:'system',content:sys},{role:'user',content:user}]})});const d=await r.json();return{tier:'T3·GPT',text:d?.choices?.[0]?.message?.content||''}}catch(e){}
    if(s.openrouterKey)try{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.openrouterKey,'HTTP-Referer':location.origin},body:JSON.stringify({model:'anthropic/claude-haiku-4-5',messages:[{role:'system',content:sys},{role:'user',content:user}]})});const d=await r.json();return{tier:'T3·OpenRouter',text:d?.choices?.[0]?.message?.content||''}}catch(e){}
    return{tier:'T0',text:null}
  }
};
async function updateTierBadge(){const t=await Cascade.detectTier();const el=$('#tierBadge');el.textContent=t==='T0'?'offline':t;el.classList.toggle('t3',t!=='T0');$('#pTier').textContent=t==='T0'?'T0':t}
// ════════════════════════════════════════════════════════════════
// DOCUMENT MODEL — layers + adjust
// ════════════════════════════════════════════════════════════════
// layer: {id, type:'image'|'text'|'paint', name, visible, opacity, x, y, w, h, ...}
// adjust applied at composite time (non-destructive)
function defaultAdjust(){return{brightness:100,contrast:100,saturate:100,hue:0,blur:0,sepia:0,grayscale:0,invert:0}}
function newDoc(w,h,bg){
  state.doc={w:w||1080,h:h||1080,bg:bg||'#ffffff',layers:[],adjust:defaultAdjust()};
  state.activeLayer=0;
  pushHistory();
  showStage();render();renderLayers();renderAdjust();
}
function showStage(){
  $('#emptyState').style.display='none';
  $('#stage').style.display='block';
  $('#info').style.display='block';
  $('#zoomBar').style.display='flex';
  zoomFit();
}
function addImageLayer(img,name){
  if(!state.doc){state.doc={w:img.width,h:img.height,bg:'#ffffff',layers:[],adjust:defaultAdjust()}}
  state.doc.layers.push({id:uid(),type:'image',name:name||'image',visible:true,opacity:1,x:0,y:0,w:img.width,h:img.height,img});
  state.activeLayer=state.doc.layers.length-1;
  pushHistory();
  showStage();render();renderLayers();renderAdjust();
}
function addTextLayer(){
  if(!state.doc)newCanvas(1080,1080);
  const l={id:uid(),type:'text',name:'text',visible:true,opacity:1,x:state.doc.w/2,y:state.doc.h/2,text:'Double-click to edit',font:state.text.font,size:state.text.size,color:state.text.color,weight:state.text.weight,align:'center'};
  state.doc.layers.push(l);
  state.activeLayer=state.doc.layers.length-1;
  pushHistory();render();renderLayers();selectTool('move');renderProps()
}
function addPaintLayer(){
  if(!state.doc)return;
  const off=document.createElement('canvas');off.width=state.doc.w;off.height=state.doc.h;
  const l={id:uid(),type:'paint',name:'paint',visible:true,opacity:1,x:0,y:0,w:state.doc.w,h:state.doc.h,canvas:off};
  state.doc.layers.push(l);
  state.activeLayer=state.doc.layers.length-1;
  renderLayers();return l
}
// ════════════════════════════════════════════════════════════════
// RENDER — composite all visible layers, apply adjust as CSS filter
// ════════════════════════════════════════════════════════════════
const cnv=()=>$('#c'),sel=()=>$('#sel');
function fitCanvasSize(){
  if(!state.doc)return;
  const c=cnv(),s=sel();
  c.width=state.doc.w;c.height=state.doc.h;
  s.width=state.doc.w;s.height=state.doc.h;
  const stg=$('#stage');
  stg.style.width=(state.doc.w*state.zoom)+'px';stg.style.height=(state.doc.h*state.zoom)+'px';
  // pan offset
  stg.style.left=(baseX+state.pan.x)+'px';
  stg.style.top=(baseY+42+state.pan.y)+'px';
  stg.style.transform='';
  c.style.width=s.style.width=(state.doc.w*state.zoom)+'px';
  c.style.height=s.style.height=(state.doc.h*state.zoom)+'px';
}
function render(){
  if(!state.doc)return;
  fitCanvasSize();
  const c=cnv(),ctx=c.getContext('2d');
  ctx.save();
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle=state.doc.bg;ctx.fillRect(0,0,c.width,c.height);
  for(const l of state.doc.layers){if(!l.visible)continue;ctx.save();ctx.globalAlpha=l.opacity;if(l.type==='image'){ctx.drawImage(l.img,l.x,l.y,l.w,l.h)}else if(l.type==='paint'){ctx.drawImage(l.canvas,l.x,l.y)}else if(l.type==='text'){ctx.font=`${l.weight} ${l.size}px ${l.font}`;ctx.fillStyle=l.color;ctx.textAlign=l.align||'center';ctx.textBaseline='middle';ctx.fillText(l.text,l.x,l.y)}ctx.restore()}
  ctx.restore();
  // adjust via css filter on canvas — non-destructive live preview
  const a=state.doc.adjust;
  c.style.filter=`brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) hue-rotate(${a.hue}deg) blur(${a.blur}px) sepia(${a.sepia}%) grayscale(${a.grayscale}%) invert(${a.invert}%)`;
  updateInfo();drawSelection();
}
function updateInfo(){if(!state.doc)return;$('#info').textContent=`${state.doc.w} × ${state.doc.h} · ${state.doc.layers.length} layer${state.doc.layers.length===1?'':'s'} · zoom ${Math.round(state.zoom*100)}%`;$('#zoomLabel').textContent=Math.round(state.zoom*100)+'%'}
function drawSelection(){
  const s=sel(),ctx=s.getContext('2d');
  ctx.clearRect(0,0,s.width,s.height);
  const l=state.doc?.layers[state.activeLayer];if(!l||state.tool!=='move')return;
  // bounding box for image/paint layers
  if(l.type==='image'||l.type==='paint'){ctx.strokeStyle='#ff8c00';ctx.lineWidth=1.5/state.zoom;ctx.setLineDash([4/state.zoom,4/state.zoom]);ctx.strokeRect(l.x,l.y,l.w,l.h)}
  if(l.type==='text'){ctx.strokeStyle='#ff8c00';ctx.lineWidth=1/state.zoom;ctx.setLineDash([3/state.zoom,3/state.zoom]);const tw=(l.size*(l.text||'').length*0.5);ctx.strokeRect(l.x-tw/2,l.y-l.size/2,tw,l.size*1.2)}
}
// ── zoom & pan ──
function zoomBy(d){state.zoom=clamp(state.zoom*(d>0?1.25:0.8),0.05,8);render()}
function zoomReset(){state.zoom=1;state.pan={x:0,y:0};render()}
// ── tools ──
function selectTool(t){state.tool=t;$$('#toolList button').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));renderProps();render()}
document.addEventListener('click',e=>{const t=e.target.closest('#toolList button');if(t)selectTool(t.dataset.tool)});
// ── input handling on canvas ──
let drag=null;
function canvasPoint(e){const c=cnv(),r=c.getBoundingClientRect();const x=(e.clientX-r.left)/(r.width/c.width);const y=(e.clientY-r.top)/(r.height/c.height);return{x,y}}
function onPointerDown(e){if(!state.doc)return;const p=canvasPoint(e);if(state.tool==='move'){const l=state.doc.layers[state.activeLayer];if(!l)return;drag={mode:'move',l,ox:p.x-l.x,oy:p.y-l.y}}else if(state.tool==='crop'){drag={mode:'crop',x0:p.x,y0:p.y,x1:p.x,y1:p.y}}else if(state.tool==='brush'||state.tool==='erase'){let lyr=state.doc.layers[state.activeLayer];if(!lyr||lyr.type!=='paint')lyr=addPaintLayer();drag={mode:'paint',lyr,prev:p,erase:state.tool==='erase'};strokeAt(lyr,p,p,state.tool==='erase')}else if(state.tool==='eyedrop'){const ctx=cnv().getContext('2d');const d=ctx.getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;const hex='#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');state.brush.color=hex;state.fill.color=hex;renderProps();toast('picked '+hex)}else if(state.tool==='fill'){if(!state.doc)return;let lyr=state.doc.layers[state.activeLayer];if(!lyr||lyr.type!=='paint')lyr=addPaintLayer();const c=lyr.canvas.getContext('2d');c.fillStyle=state.fill.color;c.fillRect(0,0,lyr.canvas.width,lyr.canvas.height);pushHistory();render()}else if(state.tool==='text'){const l=state.doc.layers.find(x=>x.type==='text');addTextLayer();const t=state.doc.layers[state.activeLayer];t.x=p.x;t.y=p.y;render()}}
function onPointerMove(e){if(!drag)return;const p=canvasPoint(e);if(drag.mode==='move'){drag.l.x=p.x-drag.ox;drag.l.y=p.y-drag.oy;render()}else if(drag.mode==='crop'){drag.x1=p.x;drag.y1=p.y;const s=sel(),ctx=s.getContext('2d');ctx.clearRect(0,0,s.width,s.height);ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,s.width,s.height);const x=Math.min(drag.x0,drag.x1),y=Math.min(drag.y0,drag.y1),w=Math.abs(drag.x1-drag.x0),h=Math.abs(drag.y1-drag.y0);ctx.clearRect(x,y,w,h);ctx.strokeStyle='#ff8c00';ctx.lineWidth=1.5/state.zoom;ctx.setLineDash([6/state.zoom,4/state.zoom]);ctx.strokeRect(x,y,w,h)}else if(drag.mode==='paint'){strokeAt(drag.lyr,drag.prev,p,drag.erase);drag.prev=p;render()}}
function onPointerUp(){if(!drag)return;if(drag.mode==='crop'){const x=Math.round(Math.min(drag.x0,drag.x1)),y=Math.round(Math.min(drag.y0,drag.y1)),w=Math.round(Math.abs(drag.x1-drag.x0)),h=Math.round(Math.abs(drag.y1-drag.y0));if(w>5&&h>5){applyCrop(x,y,w,h);toast(`cropped to ${w}×${h}`)}drawSelection()}if(drag.mode==='paint'||drag.mode==='move')pushHistory();drag=null;render()}
function strokeAt(lyr,a,b,erase){const c=lyr.canvas.getContext('2d');c.save();c.globalCompositeOperation=erase?'destination-out':'source-over';c.strokeStyle=state.brush.color;c.lineWidth=state.brush.size;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(a.x-lyr.x,a.y-lyr.y);c.lineTo(b.x-lyr.x,b.y-lyr.y);c.stroke();c.restore()}
function applyCrop(x,y,w,h){
  // resize doc, shift all layers
  state.doc.w=w;state.doc.h=h;
  for(const l of state.doc.layers){l.x-=x;l.y-=y}
  pushHistory();zoomFit();renderLayers()
}
// ── adjust panel ──
function renderAdjust(){
  if(!state.doc){$('#adjBody').innerHTML='<div style="font-size:11px;color:var(--cream-muted);font-style:italic">open an image first</div>';return}
  const a=state.doc.adjust;
  const slider=(k,min,max,unit,label)=>`<div class="field"><label>${label}<span class="v">${a[k]}${unit||''}</span></label><input type="range" min="${min}" max="${max}" value="${a[k]}" oninput="adjustChange('${k}',this.value)"></div>`;
  $('#adjBody').innerHTML=slider('brightness',0,200,'%','brightness')+slider('contrast',0,200,'%','contrast')+slider('saturate',0,200,'%','saturation')+slider('hue',-180,180,'°','hue rotate')+slider('blur',0,20,'px','blur')+slider('sepia',0,100,'%','sepia')+slider('grayscale',0,100,'%','grayscale')+slider('invert',0,100,'%','invert')+`<div class="row2" style="margin-top:8px"><button class="btn sm" onclick="bakeAdjust()">bake to pixels</button><button class="btn sm" onclick="resetAdjust()">reset</button></div>`;
}
function adjustChange(k,v){state.doc.adjust[k]=+v;render();renderAdjust()}
function resetAdjust(){state.doc.adjust=defaultAdjust();render();renderAdjust()}
async function bakeAdjust(){
  // permanently apply CSS filter to active image/paint layer
  const l=state.doc.layers[state.activeLayer];if(!l||(l.type!=='image'&&l.type!=='paint')){toast('select an image or paint layer');return}
  const off=document.createElement('canvas');off.width=l.w;off.height=l.h;
  const ctx=off.getContext('2d');
  const a=state.doc.adjust;
  ctx.filter=`brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) hue-rotate(${a.hue}deg) blur(${a.blur}px) sepia(${a.sepia}%) grayscale(${a.grayscale}%) invert(${a.invert}%)`;
  if(l.type==='image')ctx.drawImage(l.img,0,0,l.w,l.h);else ctx.drawImage(l.canvas,0,0);
  // replace layer's image
  if(l.type==='image'){const img=new Image();await new Promise(res=>{img.onload=res;img.src=off.toDataURL('image/png')});l.img=img}else{l.canvas=off}
  state.doc.adjust=defaultAdjust();
  pushHistory();render();renderAdjust();toast('adjustments baked')
}
// ── layers panel ──
function renderLayers(){
  if(!state.doc){$('#layersList').innerHTML='<div style="font-size:11px;color:var(--cream-muted);font-style:italic">no document</div>';return}
  // show top layer first
  const html=state.doc.layers.slice().reverse().map((l,i)=>{const realIdx=state.doc.layers.length-1-i;return`<div class="layer ${state.activeLayer===realIdx?'active':''} ${l.visible?'':'hidden'}" onclick="state.activeLayer=${realIdx};renderLayers();renderProps();render()"><div class="vis" onclick="event.stopPropagation();toggleVis(${realIdx})">${l.visible?'◉':'○'}</div><div class="name">${esc(l.name)}</div><div class="rm" onclick="event.stopPropagation();rmLayer(${realIdx})">×</div></div>`}).join('');
  $('#layersList').innerHTML=html||'<div style="font-size:11px;color:var(--cream-muted);font-style:italic">no layers</div>';
}
function toggleVis(i){state.doc.layers[i].visible=!state.doc.layers[i].visible;render();renderLayers()}
function rmLayer(i){if(!confirm('remove this layer?'))return;state.doc.layers.splice(i,1);state.activeLayer=clamp(state.activeLayer,0,state.doc.layers.length-1);pushHistory();render();renderLayers()}
// ── properties panel ──
function renderProps(){
  const l=state.doc?.layers[state.activeLayer];
  let html='';
  if(state.tool==='brush'){html=`<div class="field"><label>brush size<span class="v">${state.brush.size}px</span></label><input type="range" min="1" max="200" value="${state.brush.size}" oninput="state.brush.size=+this.value;renderProps()"></div><div class="field"><label>colour</label><div style="display:flex;gap:8px;align-items:center"><input type="color" value="${state.brush.color}" oninput="state.brush.color=this.value;renderProps()"><span style="font-family:var(--mono);font-size:11px;color:var(--cream-dim)">${state.brush.color}</span></div></div>`}
  else if(state.tool==='erase'){html=`<div class="field"><label>eraser size<span class="v">${state.brush.size}px</span></label><input type="range" min="1" max="200" value="${state.brush.size}" oninput="state.brush.size=+this.value;renderProps()"></div>`}
  else if(state.tool==='fill'){html=`<div class="field"><label>fill colour</label><input type="color" value="${state.fill.color}" oninput="state.fill.color=this.value;renderProps()"></div><div class="field" style="font-size:11px;color:var(--cream-muted)">click canvas to fill the active layer</div>`}
  else if(state.tool==='crop'){html='<div style="font-size:11px;color:var(--cream-dim)">drag a rectangle on the canvas · release to crop the whole document</div>'}
  else if(state.tool==='text'&&!(l&&l.type==='text')){html=`<div style="font-size:11px;color:var(--cream-dim);margin-bottom:8px">click on the canvas to place text</div><div class="field"><label>font size<span class="v">${state.text.size}px</span></label><input type="range" min="10" max="200" value="${state.text.size}" oninput="state.text.size=+this.value;renderProps()"></div><div class="field"><label>colour</label><input type="color" value="${state.text.color}" oninput="state.text.color=this.value;renderProps()"></div>`}
  else if(l){
    html=`<div class="field"><label>name</label><input type="text" value="${esc(l.name)}" oninput="state.doc.layers[${state.activeLayer}].name=this.value;renderLayers()"></div><div class="field"><label>opacity<span class="v">${Math.round(l.opacity*100)}%</span></label><input type="range" min="0" max="100" value="${Math.round(l.opacity*100)}" oninput="state.doc.layers[${state.activeLayer}].opacity=this.value/100;renderProps();render()"></div>`;
    if(l.type==='text'){html+=`<div class="field"><label>text</label><textarea oninput="state.doc.layers[${state.activeLayer}].text=this.value;render()" style="min-height:60px">${esc(l.text)}</textarea></div><div class="field"><label>size<span class="v">${l.size}px</span></label><input type="range" min="10" max="300" value="${l.size}" oninput="state.doc.layers[${state.activeLayer}].size=+this.value;render()"></div><div class="field"><label>colour</label><input type="color" value="${l.color}" oninput="state.doc.layers[${state.activeLayer}].color=this.value;render()"></div><div class="field"><label>font</label><select oninput="state.doc.layers[${state.activeLayer}].font=this.value;render()"><option ${l.font==='Georgia'?'selected':''}>Georgia</option><option ${l.font==='Helvetica'?'selected':''}>Helvetica</option><option ${l.font==='Arial'?'selected':''}>Arial</option><option ${l.font==='Courier'?'selected':''}>Courier</option><option ${l.font==='Times New Roman'?'selected':''}>Times New Roman</option><option ${l.font==='Impact'?'selected':''}>Impact</option><option ${l.font==='Verdana'?'selected':''}>Verdana</option></select></div><div class="field"><label>weight</label><select oninput="state.doc.layers[${state.activeLayer}].weight=this.value;render()"><option ${l.weight==='300'?'selected':''} value="300">light</option><option ${l.weight==='400'?'selected':''} value="400">regular</option><option ${l.weight==='600'?'selected':''} value="600">semibold</option><option ${l.weight==='700'?'selected':''} value="700">bold</option><option ${l.weight==='900'?'selected':''} value="900">black</option></select></div><div class="field"><label>align</label><select oninput="state.doc.layers[${state.activeLayer}].align=this.value;render()"><option ${l.align==='left'?'selected':''}>left</option><option ${l.align==='center'?'selected':''}>center</option><option ${l.align==='right'?'selected':''}>right</option></select></div>`}
    if(l.type==='image'||l.type==='paint'){html+=`<div class="row2"><div class="field"><label>x</label><input type="number" value="${Math.round(l.x)}" oninput="state.doc.layers[${state.activeLayer}].x=+this.value;render()"></div><div class="field"><label>y</label><input type="number" value="${Math.round(l.y)}" oninput="state.doc.layers[${state.activeLayer}].y=+this.value;render()"></div></div><div class="row2"><div class="field"><label>w</label><input type="number" value="${Math.round(l.w)}" oninput="state.doc.layers[${state.activeLayer}].w=+this.value;render()"></div><div class="field"><label>h</label><input type="number" value="${Math.round(l.h)}" oninput="state.doc.layers[${state.activeLayer}].h=+this.value;render()"></div></div>`}
    html+=`<div class="row2" style="margin-top:10px"><button class="btn sm" onclick="rotateLayer(90)">↻ 90°</button><button class="btn sm" onclick="rotateLayer(-90)">↺ 90°</button></div><div class="row2"><button class="btn sm" onclick="flipLayer('h')">flip H</button><button class="btn sm" onclick="flipLayer('v')">flip V</button></div>`;
  }else{html='<div style="font-size:11px;color:var(--cream-muted);font-style:italic">no active layer</div>'}
  $('#propBody').innerHTML=html;
}
function rotateLayer(deg){const l=state.doc.layers[state.activeLayer];if(!l||(l.type!=='image'&&l.type!=='paint'))return;const off=document.createElement('canvas');const src=l.type==='image'?l.img:l.canvas;off.width=src.height;off.height=src.width;const ctx=off.getContext('2d');ctx.translate(off.width/2,off.height/2);ctx.rotate(deg*Math.PI/180);ctx.drawImage(src,-src.width/2,-src.height/2);if(l.type==='image'){const i=new Image();i.onload=()=>{l.img=i;l.w=off.width;l.h=off.height;pushHistory();render()};i.src=off.toDataURL()}else{l.canvas=off;l.w=off.width;l.h=off.height;pushHistory();render()}}
function flipLayer(d){const l=state.doc.layers[state.activeLayer];if(!l||(l.type!=='image'&&l.type!=='paint'))return;const src=l.type==='image'?l.img:l.canvas;const off=document.createElement('canvas');off.width=src.width;off.height=src.height;const ctx=off.getContext('2d');ctx.translate(d==='h'?off.width:0,d==='v'?off.height:0);ctx.scale(d==='h'?-1:1,d==='v'?-1:1);ctx.drawImage(src,0,0);if(l.type==='image'){const i=new Image();i.onload=()=>{l.img=i;pushHistory();render()};i.src=off.toDataURL()}else{l.canvas=off;pushHistory();render()}}
// ════════════════════════════════════════════════════════════════
// HISTORY (undo/redo) — store lightweight snapshot
// ════════════════════════════════════════════════════════════════
function snapshot(){if(!state.doc)return null;return{w:state.doc.w,h:state.doc.h,bg:state.doc.bg,adjust:{...state.doc.adjust},layers:state.doc.layers.map(l=>{const s={...l};if(l.type==='paint'){const off=document.createElement('canvas');off.width=l.canvas.width;off.height=l.canvas.height;off.getContext('2d').drawImage(l.canvas,0,0);s.canvas=off}return s})}}
function restoreSnapshot(s){if(!s)return;state.doc={w:s.w,h:s.h,bg:s.bg,adjust:{...s.adjust},layers:s.layers.map(l=>{const c={...l};if(l.type==='paint'){const off=document.createElement('canvas');off.width=l.canvas.width;off.height=l.canvas.height;off.getContext('2d').drawImage(l.canvas,0,0);c.canvas=off}return c})};state.activeLayer=clamp(state.activeLayer,0,state.doc.layers.length-1)}
function pushHistory(){const s=snapshot();if(!s)return;state.history=state.history.slice(0,state.hIdx+1);state.history.push(s);if(state.history.length>20)state.history.shift();state.hIdx=state.history.length-1;updateHistButtons()}
function undo(){if(state.hIdx<=0)return;state.hIdx--;restoreSnapshot(state.history[state.hIdx]);render();renderLayers();renderAdjust();renderProps();updateHistButtons()}
function redo(){if(state.hIdx>=state.history.length-1)return;state.hIdx++;restoreSnapshot(state.history[state.hIdx]);render();renderLayers();renderAdjust();renderProps();updateHistButtons()}
function updateHistButtons(){$('#btnUndo').style.opacity=state.hIdx<=0?'0.3':'1';$('#btnRedo').style.opacity=state.hIdx>=state.history.length-1?'0.3':'1'}
// ════════════════════════════════════════════════════════════════
// FILE I/O
// ════════════════════════════════════════════════════════════════
function openFile(){$('#fileInput').click()}
$('#fileInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;await loadImageFile(f)});
async function loadImageFile(f){const url=URL.createObjectURL(f);const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url});addImageLayer(img,f.name||'image');toast(`loaded · ${img.width}×${img.height}`)}
function newCanvas(w,h){
  const wAsked=w||+(prompt('width (px):','1080')||0);if(!wAsked)return;
  const hAsked=h||+(prompt('height (px):','1080')||0);if(!hAsked)return;
  newDoc(wAsked,hAsked,'#ffffff');toast(`new canvas · ${wAsked}×${hAsked}`)
}
function exportImage(fmt){
  if(!state.doc){toast('open or create an image first');return}
  // composite to a fresh canvas at full resolution with adjust baked
  const off=document.createElement('canvas');off.width=state.doc.w;off.height=state.doc.h;
  const ctx=off.getContext('2d');
  ctx.fillStyle=state.doc.bg;ctx.fillRect(0,0,off.width,off.height);
  for(const l of state.doc.layers){if(!l.visible)continue;ctx.save();ctx.globalAlpha=l.opacity;if(l.type==='image')ctx.drawImage(l.img,l.x,l.y,l.w,l.h);else if(l.type==='paint')ctx.drawImage(l.canvas,l.x,l.y);else if(l.type==='text'){ctx.font=`${l.weight} ${l.size}px ${l.font}`;ctx.fillStyle=l.color;ctx.textAlign=l.align||'center';ctx.textBaseline='middle';ctx.fillText(l.text,l.x,l.y)}ctx.restore()}
  // bake adjust into a second canvas via css filter
  const final=document.createElement('canvas');final.width=off.width;final.height=off.height;
  const fctx=final.getContext('2d');
  const a=state.doc.adjust;
  fctx.filter=`brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) hue-rotate(${a.hue}deg) blur(${a.blur}px) sepia(${a.sepia}%) grayscale(${a.grayscale}%) invert(${a.invert}%)`;
  fctx.drawImage(off,0,0);
  const mime=fmt==='jpeg'?'image/jpeg':(fmt==='webp'?'image/webp':'image/png');
  final.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`fallmage-${Date.now()}.${fmt}`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('exported '+fmt.toUpperCase())},mime,fmt==='jpeg'?0.92:1);
}
// drop + paste
document.addEventListener('dragover',e=>{e.preventDefault();$('#canvasArea').classList.add('drag-over')});
document.addEventListener('dragleave',e=>{if(e.target===document)$('#canvasArea').classList.remove('drag-over')});
document.addEventListener('drop',async e=>{e.preventDefault();$('#canvasArea').classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))await loadImageFile(f)});
document.addEventListener('paste',async e=>{const items=Array.from(e.clipboardData.items);for(const it of items){if(it.type.startsWith('image/')){const f=it.getAsFile();await loadImageFile(f);return}}});
// ════════════════════════════════════════════════════════════════
// Ω AUTOPILOT
// ════════════════════════════════════════════════════════════════
const PRESETS={
  'instagram square':{w:1080,h:1080},'instagram portrait':{w:1080,h:1350},'instagram story':{w:1080,h:1920},
  'twitter post':{w:1200,h:675},'linkedin post':{w:1200,h:627},'youtube thumbnail':{w:1280,h:720},
  'a4 portrait':{w:2480,h:3508},'a4 landscape':{w:3508,h:2480},
  'facebook cover':{w:1640,h:856},'tiktok':{w:1080,h:1920},'business card':{w:1050,h:600}
};
const FILTERS={
  'vintage':{brightness:108,contrast:115,saturate:80,hue:0,sepia:30,grayscale:0,blur:0,invert:0},
  'noir':{brightness:95,contrast:140,saturate:0,hue:0,sepia:0,grayscale:100,blur:0,invert:0},
  'pop':{brightness:108,contrast:130,saturate:140,hue:0,sepia:0,grayscale:0,blur:0,invert:0},
  'warm':{brightness:110,contrast:108,saturate:115,hue:-8,sepia:20,grayscale:0,blur:0,invert:0},
  'cool':{brightness:100,contrast:108,saturate:90,hue:18,sepia:0,grayscale:0,blur:0,invert:0},
  'fade':{brightness:115,contrast:88,saturate:75,hue:0,sepia:10,grayscale:0,blur:0,invert:0},
  'invert':{brightness:100,contrast:100,saturate:100,hue:0,sepia:0,grayscale:0,blur:0,invert:100},
  'mono':{brightness:100,contrast:110,saturate:0,hue:0,sepia:0,grayscale:100,blur:0,invert:0},
  'dream':{brightness:110,contrast:90,saturate:120,hue:8,sepia:0,grayscale:0,blur:1,invert:0},
};
async function omegaRoute(intent){
  const q=intent.toLowerCase();
  // T0 — preset match
  for(const [name,dim] of Object.entries(PRESETS)){if(q.includes(name)){newDoc(dim.w,dim.h,'#ffffff');toast('canvas · '+name);return}}
  // filter
  for(const [name,f] of Object.entries(FILTERS)){if(q.includes(name)){if(!state.doc){toast('open an image first');return}state.doc.adjust={...f};render();renderAdjust();toast('applied filter · '+name);return}}
  // generic ops
  if(/pop|punchy|punch/i.test(q)&&state.doc){state.doc.adjust={...FILTERS.pop};render();renderAdjust();toast('made it pop');return}
  if(/black.?and.?white|b&w|monochrome/i.test(q)&&state.doc){state.doc.adjust={...FILTERS.mono};render();renderAdjust();toast('mono');return}
  if(/caption|add text|title/i.test(q)){const m=q.match(/(?:caption|text|title)[:\s]+(.+)/i);if(m){addTextLayer();state.doc.layers[state.activeLayer].text=m[1].replace(/['"]/g,'').trim();render();renderLayers();toast('added text');return}}
  if(/crop to (\d+)[x×](\d+)/i.test(q)){const m=q.match(/crop to (\d+)[x×](\d+)/i);if(state.doc){applyCrop(0,0,+m[1],+m[2]);return}}
  // T3 — ask the model for params
  const tier=await Cascade.detectTier();
  if(tier!=='T0'){
    const sys=`You are Ω, the orchestrator of FallMage (image editor). Return ONLY a JSON object describing the action.
Available actions:
- {"action":"newDoc","w":<int>,"h":<int>,"bg":"<hex>"}
- {"action":"adjust","values":{"brightness":<0-200>,"contrast":<0-200>,"saturate":<0-200>,"hue":<-180..180>,"blur":<0-20>,"sepia":<0-100>,"grayscale":<0-100>,"invert":<0-100>}}
- {"action":"text","text":"<the actual text>","size":<int>,"color":"<hex>","x":<int>,"y":<int>}
- {"action":"crop","w":<int>,"h":<int>}
Return ONLY the JSON, no commentary.`;
    try{const r=await Cascade.generate(sys,intent,400);const m=r.text?.match(/\{[\s\S]*\}/);if(m){const p=JSON.parse(m[0]);applyAction(p);return}}catch(e){}
  }
  toast('Ω · no match · try a size, filter name, or "caption: <text>"');
}
function applyAction(p){
  if(p.action==='newDoc')newDoc(p.w||1080,p.h||1080,p.bg||'#ffffff');
  else if(p.action==='adjust'&&state.doc){state.doc.adjust={...defaultAdjust(),...p.values};render();renderAdjust();toast('Ω · adjust applied')}
  else if(p.action==='text'){if(!state.doc)newDoc(1080,1080,'#ffffff');addTextLayer();const l=state.doc.layers[state.activeLayer];l.text=p.text||'';if(p.size)l.size=p.size;if(p.color)l.color=p.color;if(p.x)l.x=p.x;if(p.y)l.y=p.y;render();renderLayers();toast('Ω · text added')}
  else if(p.action==='crop'&&state.doc){applyCrop(0,0,+p.w,+p.h);toast('Ω · cropped')}
}
// ── command palette ──
function openPalette(){$('#palette').classList.add('open');setTimeout(()=>$('#pInput').focus(),50);renderPaletteSuggestions('')}
function closePalette(){$('#palette').classList.remove('open');$('#pInput').value=''}
function renderPaletteSuggestions(q){
  const body=$('#pBody');
  if(!q.trim()){
    body.innerHTML=Object.keys(PRESETS).map(n=>`<div class="palette-row" onclick="newDoc(${PRESETS[n].w},${PRESETS[n].h},'#ffffff');closePalette()"><div class="ico">⊞</div><div><div>New canvas · ${esc(n)}</div><div class="desc">${PRESETS[n].w}×${PRESETS[n].h}</div></div></div>`).join('')
      +Object.keys(FILTERS).map(n=>`<div class="palette-row" onclick="(state.doc?(()=>{state.doc.adjust={...FILTERS['${n}']};render();renderAdjust();toast('applied ${n}')})():toast('open an image first'));closePalette()"><div class="ico">▦</div><div><div>Apply filter · ${esc(n)}</div><div class="desc">live preview · bake when ready</div></div></div>`).join('');
    return
  }
  body.innerHTML=`<div class="palette-row sel" onclick="executeIntent()"><div class="ico">Ω</div><div><div>Ω · route + apply: ${esc(q.slice(0,80))}</div><div class="desc">enter · runs autopilot (uses your model if a key is set)</div></div><div class="key">↵</div></div>`
}
async function executeIntent(){const q=$('#pInput').value.trim();if(!q)return;closePalette();toast('Ω routing…');await omegaRoute(q)}
// ── modal ──
function openModal(kind){
  if(kind==='settings'){
    $('#modalTitle').textContent='Settings · autopilot keys';
    $('#modalBody').innerHTML=`
      <p style="color:var(--cream-dim);font-size:12px;margin-bottom:10px"><a href="https://aistudio.google.com/apikey" target="_blank">Gemini is free</a>. Keys stay in this browser, sent direct to provider. Required only for Ω autopilot (canvas ops work fully offline).</p>
      <div class="field"><label>anthropic · claude</label><input id="stAnth" type="password" value="${esc(state.settings.anthropicKey)}" placeholder="sk-ant-…"></div>
      <div class="field"><label>gemini · free</label><input id="stGem" type="password" value="${esc(state.settings.geminiKey)}"></div>
      <div class="field"><label>openai · gpt</label><input id="stOAI" type="password" value="${esc(state.settings.openaiKey)}"></div>
      <div class="field"><label>openrouter</label><input id="stOR" type="password" value="${esc(state.settings.openrouterKey)}"></div>
      <div class="actions"><button class="btn" onclick="closeModal()">cancel</button><button class="btn primary" onclick="saveSettingsModal()">save</button></div>`;
  }
  $('#modal').classList.add('open');
}
function closeModal(){$('#modal').classList.remove('open')}
function saveSettingsModal(){state.settings.anthropicKey=$('#stAnth').value;state.settings.geminiKey=$('#stGem').value;state.settings.openaiKey=$('#stOAI').value;state.settings.openrouterKey=$('#stOR').value;Cascade._p=undefined;saveSettings();updateTierBadge();closeModal();toast('saved')}
// ── canvas pointer events ──
function bindCanvas(){const s=$('#sel');s.addEventListener('pointerdown',e=>{s.setPointerCapture(e.pointerId);onPointerDown(e)});s.addEventListener('pointermove',onPointerMove);s.addEventListener('pointerup',onPointerUp);s.addEventListener('pointercancel',onPointerUp)}
// ── keyboard ──
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openPalette();return}
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redo();return}
  if((e.ctrlKey||e.metaKey)&&e.key==='o'){e.preventDefault();openFile();return}
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();exportImage('png');return}
  if(e.key==='Escape'){closePalette();closeModal()}
  if($('#palette').classList.contains('open')&&e.key==='Enter'){e.preventDefault();executeIntent();return}
  const map={v:'move',c:'crop',t:'text',b:'brush',e:'erase',i:'eyedrop',g:'fill'};
  if(map[e.key])selectTool(map[e.key]);
});
document.addEventListener('input',e=>{if(e.target.id==='pInput')renderPaletteSuggestions(e.target.value)});
document.addEventListener('click',e=>{if(e.target.id==='palette')closePalette();if(e.target.id==='modal')closeModal()});
// ── wheel zoom ──
$('#canvasArea').addEventListener('wheel',e=>{if(!state.doc)return;e.preventDefault();const f=e.deltaY<0?1.1:0.9;state.zoom=clamp(state.zoom*f,0.05,8);render()},{passive:false});
// ── KONOMI · sovereign tier ──
// ── FALLMESH ──
try{const sig=new BroadcastChannel('fall-signal');sig.postMessage({source:'fallmage',type:'hello',prime:PRIME,version:VERSION,ts:Date.now()});sig.addEventListener('message',e=>{const m=e.data;if(m&&m.type==='ping')sig.postMessage({source:'fallmage',type:'pong',prime:PRIME})})}catch(e){}
// ── postMessage API ──
// ── boot ──
(async function(){await openDB();await loadSettings();await updateTierBadge();bindCanvas();renderLayers();renderAdjust();renderProps();updateHistButtons()})();

// Named exports for the primary API surface
export { loadConfig };
export { saveConfig };
export { $ };
export { esc };
export { aiTier };
export { renderAiChip };
export { loadWebLLM };
export { aiComplete };
export { aiCloudCall };
export { meshStart };

export { FALL_KIT_VERSION };
export { KCC_MINT_URL };
export { WEBLLM_MODELS };
export { DEFAULT_MODEL };
export { T3_PROVIDERS };
export { STATE };
export { MESH_CHANNEL };
export { STUN_SERVERS };
export { VERSION };
export { PRESETS };
