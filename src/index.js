// fallmage-sdk · sovereign image editor primitives
// Extracted verbatim from the fallmage single-file tool.
// Runs in browser (uses HTMLCanvasElement) and in Node (bring your own canvas
// factory via createSDK({ createCanvas, loadImage })).

export const VERSION = '1.0.0';

// ── canvas-preset library (verbatim) ──
export const PRESETS = {
  'instagram square':   { w: 1080, h: 1080 },
  'instagram portrait': { w: 1080, h: 1350 },
  'instagram story':    { w: 1080, h: 1920 },
  'twitter post':       { w: 1200, h: 675  },
  'linkedin post':      { w: 1200, h: 627  },
  'youtube thumbnail':  { w: 1280, h: 720  },
  'a4 portrait':        { w: 2480, h: 3508 },
  'a4 landscape':       { w: 3508, h: 2480 },
  'facebook cover':     { w: 1640, h: 856  },
  'tiktok':             { w: 1080, h: 1920 },
  'business card':      { w: 1050, h: 600  }
};

// ── filter library (verbatim) ──
export const FILTERS = {
  vintage: { brightness:108, contrast:115, saturate:80,  hue:0,   sepia:30,  grayscale:0,   blur:0, invert:0   },
  noir:    { brightness:95,  contrast:140, saturate:0,   hue:0,   sepia:0,   grayscale:100, blur:0, invert:0   },
  pop:     { brightness:108, contrast:130, saturate:140, hue:0,   sepia:0,   grayscale:0,   blur:0, invert:0   },
  warm:    { brightness:110, contrast:108, saturate:115, hue:-8,  sepia:20,  grayscale:0,   blur:0, invert:0   },
  cool:    { brightness:100, contrast:108, saturate:90,  hue:18,  sepia:0,   grayscale:0,   blur:0, invert:0   },
  fade:    { brightness:115, contrast:88,  saturate:75,  hue:0,   sepia:10,  grayscale:0,   blur:0, invert:0   },
  invert:  { brightness:100, contrast:100, saturate:100, hue:0,   sepia:0,   grayscale:0,   blur:0, invert:100 },
  mono:    { brightness:100, contrast:110, saturate:0,   hue:0,   sepia:0,   grayscale:100, blur:0, invert:0   },
  dream:   { brightness:110, contrast:90,  saturate:120, hue:8,   sepia:0,   grayscale:0,   blur:1, invert:0   }
};

export const FONTS = ['Georgia', 'Helvetica', 'Arial', 'Courier', 'Times New Roman', 'Impact', 'Verdana'];
export const WEIGHTS = ['300', '400', '600', '700', '900'];
export const TOOLS = ['move', 'crop', 'text', 'brush', 'erase', 'eyedrop', 'fill'];

// ── adjust default (verbatim) ──
export function defaultAdjust () {
  return { brightness:100, contrast:100, saturate:100, hue:0, blur:0, sepia:0, grayscale:0, invert:0 };
}

// ── CSS filter string builder (verbatim math) ──
export function adjustToFilter (a) {
  return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) hue-rotate(${a.hue}deg) blur(${a.blur}px) sepia(${a.sepia}%) grayscale(${a.grayscale}%) invert(${a.invert}%)`;
}

const uid = () => '_' + Math.random().toString(36).slice(2, 11);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── document model ──
export function newDoc (w = 1080, h = 1080, bg = '#ffffff') {
  return { w, h, bg, layers: [], adjust: defaultAdjust() };
}

export function addImageLayer (doc, img, name = 'image') {
  const layer = {
    id: uid(), type: 'image', name,
    visible: true, opacity: 1,
    x: 0, y: 0, w: img.width, h: img.height, img
  };
  doc.layers.push(layer);
  return layer;
}

export function addTextLayer (doc, opts = {}) {
  const layer = {
    id: uid(), type: 'text', name: opts.name || 'text',
    visible: true, opacity: 1,
    x: opts.x ?? doc.w / 2,
    y: opts.y ?? doc.h / 2,
    text: opts.text || 'Double-click to edit',
    font: opts.font || 'Georgia',
    size: opts.size || 48,
    color: opts.color || '#ffffff',
    weight: opts.weight || '600',
    align: opts.align || 'center'
  };
  doc.layers.push(layer);
  return layer;
}

export function addPaintLayer (doc, canvas) {
  const layer = {
    id: uid(), type: 'paint', name: 'paint',
    visible: true, opacity: 1,
    x: 0, y: 0, w: doc.w, h: doc.h, canvas
  };
  doc.layers.push(layer);
  return layer;
}

export function applyCrop (doc, x, y, w, h) {
  doc.w = w; doc.h = h;
  for (const l of doc.layers) { l.x -= x; l.y -= y; }
  return doc;
}

// ── Ω autopilot router (verbatim) ──
// Returns { action, params } describing what a caller should do.
export function omegaRoute (intent) {
  const q = String(intent || '').toLowerCase();

  // preset match — new canvas
  for (const [name, dim] of Object.entries(PRESETS)) {
    if (q.includes(name)) return { action: 'newDoc', preset: name, w: dim.w, h: dim.h, bg: '#ffffff' };
  }
  // filter match
  for (const [name, f] of Object.entries(FILTERS)) {
    if (q.includes(name)) return { action: 'adjust', filter: name, values: { ...f } };
  }
  // generic ops (verbatim regexes)
  if (/pop|punchy|punch/i.test(q)) return { action: 'adjust', filter: 'pop', values: { ...FILTERS.pop } };
  if (/black.?and.?white|b&w|monochrome/i.test(q)) return { action: 'adjust', filter: 'mono', values: { ...FILTERS.mono } };
  const cap = q.match(/(?:caption|text|title)[:\s]+(.+)/i);
  if (cap) return { action: 'text', text: cap[1].replace(/['"]/g, '').trim() };
  const crop = q.match(/crop to (\d+)[x×](\d+)/i);
  if (crop) return { action: 'crop', w: +crop[1], h: +crop[2] };
  return { action: 'none', reason: 'no match — try a preset name, filter name, "caption: <text>", or "crop to WxH"' };
}

// ── T3 system prompt for LLM Ω fallback (verbatim from source) ──
export const OMEGA_SYSTEM_PROMPT =
`You are Ω, the orchestrator of FallMage (image editor). Return ONLY a JSON object describing the action.
Available actions:
- {"action":"newDoc","w":<int>,"h":<int>,"bg":"<hex>"}
- {"action":"adjust","values":{"brightness":<0-200>,"contrast":<0-200>,"saturate":<0-200>,"hue":<-180..180>,"blur":<0-20>,"sepia":<0-100>,"grayscale":<0-100>,"invert":<0-100>}}
- {"action":"text","text":"<the actual text>","size":<int>,"color":"<hex>","x":<int>,"y":<int>}
- {"action":"crop","w":<int>,"h":<int>}
Return ONLY the JSON, no commentary.`;

// Parse an LLM response like the source did — first {...} block.
export function parseOmegaJson (text) {
  if (!text) return null;
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// ── composite renderer ──
// Renders a doc to a canvas. Pass canvas + optional loadImage helper.
// In browser, canvas = document.createElement('canvas'). In Node, use node-canvas.
export function renderTo (canvas, doc) {
  canvas.width = doc.w;
  canvas.height = doc.h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = doc.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const l of doc.layers) {
    if (!l.visible) continue;
    ctx.save();
    ctx.globalAlpha = l.opacity;
    if (l.type === 'image')      ctx.drawImage(l.img, l.x, l.y, l.w, l.h);
    else if (l.type === 'paint') ctx.drawImage(l.canvas, l.x, l.y);
    else if (l.type === 'text') {
      ctx.font = `${l.weight} ${l.size}px ${l.font}`;
      ctx.fillStyle = l.color;
      ctx.textAlign = l.align || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.text, l.x, l.y);
    }
    ctx.restore();
  }
  return canvas;
}

// Export helper: composite doc → apply adjust as ctx.filter → return canvas.
// Two-pass to match the source's export path exactly.
export function exportCanvas (createCanvas, doc) {
  const first = createCanvas(doc.w, doc.h);
  renderTo(first, doc);
  const final = createCanvas(doc.w, doc.h);
  const fctx = final.getContext('2d');
  fctx.filter = adjustToFilter(doc.adjust);
  fctx.drawImage(first, 0, 0);
  return final;
}

// Factory: bind a canvas creator (and optional image loader) up front.
export function createSDK ({ createCanvas, loadImage } = {}) {
  const _create = createCanvas || ((w, h) => {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w; c.height = h; return c;
    }
    throw new Error('fallmage-sdk: no createCanvas provided and no DOM available');
  });
  return {
    VERSION, PRESETS, FILTERS, FONTS, WEIGHTS, TOOLS,
    defaultAdjust, adjustToFilter,
    newDoc, addImageLayer, addTextLayer, addPaintLayer, applyCrop,
    omegaRoute, parseOmegaJson, OMEGA_SYSTEM_PROMPT,
    renderTo,
    exportCanvas: (doc) => exportCanvas(_create, doc),
    loadImage
  };
}

export default createSDK();
