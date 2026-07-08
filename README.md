# @ai-native-solutions/fallmage-sdk

Sovereign image-editor primitives, extracted from the fallmage single-file tool.

Ships:

- 11 canvas presets (Instagram, Twitter, LinkedIn, YouTube, A4, TikTok, business card, ...)
- 9 filter presets (vintage, noir, pop, warm, cool, fade, invert, mono, dream)
- Layer/document model (image, text, paint layers with visibility, opacity, transform)
- Non-destructive adjust (brightness, contrast, saturate, hue, blur, sepia, grayscale, invert)
- Ω autopilot router — natural-language intent → structured action
- Composite renderer + two-pass export (adjust baked via `ctx.filter`)

Runs in the browser out of the box. Runs in Node when you pass a `createCanvas` from `canvas` or `@napi-rs/canvas`.

## Install

```bash
npm install @ai-native-solutions/fallmage-sdk
```

## Browser

```js
import sdk from '@ai-native-solutions/fallmage-sdk';

const doc = sdk.newDoc(1080, 1080, '#ffffff');
const img = new Image(); img.src = url; await img.decode();
sdk.addImageLayer(doc, img, 'photo');
doc.adjust = { ...sdk.FILTERS.vintage };

const out = sdk.exportCanvas(doc);            // returns a canvas
out.toBlob(b => downloadBlob(b, 'edit.png'));
```

## Node

```js
import { createCanvas, loadImage } from 'canvas';
import { createSDK } from '@ai-native-solutions/fallmage-sdk';

const sdk = createSDK({ createCanvas, loadImage });
const img = await loadImage('./photo.jpg');
const doc = sdk.newDoc(img.width, img.height);
sdk.addImageLayer(doc, img);
doc.adjust = { ...sdk.FILTERS.noir };

const out = sdk.exportCanvas(doc);
require('fs').writeFileSync('out.png', out.toBuffer('image/png'));
```

## Ω autopilot

```js
sdk.omegaRoute('instagram square');
// → { action: 'newDoc', preset: 'instagram square', w: 1080, h: 1080, bg: '#ffffff' }

sdk.omegaRoute('make it pop');
// → { action: 'adjust', filter: 'pop', values: {...} }

sdk.omegaRoute('caption: launch day');
// → { action: 'text', text: 'launch day' }

sdk.omegaRoute('crop to 800x600');
// → { action: 'crop', w: 800, h: 600 }
```

For anything not matched, feed `OMEGA_SYSTEM_PROMPT` + the user intent to any LLM and pipe the response through `parseOmegaJson`.

## API surface

| Export | Purpose |
|---|---|
| `PRESETS`, `FILTERS`, `FONTS`, `WEIGHTS`, `TOOLS` | Constant libraries |
| `defaultAdjust()` | Fresh adjust object |
| `adjustToFilter(a)` | Serialize adjust → CSS filter string |
| `newDoc(w,h,bg)` | New document |
| `addImageLayer(doc,img,name)` | Append image layer |
| `addTextLayer(doc,opts)` | Append text layer |
| `addPaintLayer(doc,canvas)` | Append paint layer |
| `applyCrop(doc,x,y,w,h)` | Crop document + shift layers |
| `renderTo(canvas,doc)` | Composite all visible layers onto a canvas |
| `exportCanvas(doc)` | Composite + bake adjust → returns final canvas |
| `omegaRoute(intent)` | Local NL router |
| `OMEGA_SYSTEM_PROMPT` + `parseOmegaJson(text)` | LLM fallback |

## License

MIT · AI-Native Solutions
