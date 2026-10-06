# MONSTER ZERO ULTRA — Real-Time 3D Product Study

A cinematic, scroll-driven WebGL product experience. The can is a **genuine
Three.js object** — procedural lathe geometry, PBR aluminum, custom PMREM
studio environment — not an image. The front label is the **actual artwork
from the supplied reference photo** (`assets/reference.webp`): the can is
auto-detected in the photo, the printed wall is cropped and re-projected
onto the cylinder wrap with per-column arc correction, edge-shading
compensation and feathered seams over a procedural frost base.

## Run

```bash
node server.mjs        # → http://localhost:8218
```

Zero dependencies, zero build step. Three.js r186 is vendored in `vendor/`
(ES modules + importmap). Any static file server works too.

## Controls

- **Drag** the can (mouse or touch) to spin it — inertia included
- **Tap/click** the can — one full eased revolution (+ synthesized crack
  & hiss if sound is on)
- **Sound toggle** (nav, top-right) — full synthesized sound design:
  ambient fridge hum, spin-follow air (volume/pitch track the can's
  real angular velocity), crack + stereo fizz on tap, section whooshes,
  metallic servo on the exploded view, chord swell on the finale, cart
  pop + UI ticks. Muted until opted in; preference persists and arms on
  your first click after a reload.
- **LIGHT slider** (bottom-right, sun button toggles it) — scene brightness
  50–150%, scales key/rim/fill/top lights + tone-mapping exposure, saved to
  localStorage (default 88%)
- **BUY dock** (bottom-left) — glass order card: qty stepper, live
  subtotal, add-to-cart with nav badge + toast (concept demo, no checkout)
- **Section rail** (right edge) — glowing progress dots, click to glide
- **Scroll** drives the 7-section camera film: hero → reveal → lid detail
  (hotspots) → 360° orbit → exploded view → formation → finale
- **Q button** (bottom-right, next to the sun) — cycles render scale
  1× / 1.6× / 2× / 2.5× (persisted). Peak = 2.5× ≈ 3600×2250 internal on
  a 1440×900 screen, with 4× MSAA, 2048px PCF-soft shadows and a 4K label
  texture. Adaptive guard steps quality down automatically if FPS drops.
- **Cinema ▶ button** (bottom-right) — optional auto-scroll: the page
  films itself through the whole 7-section sequence in ~17 seconds of
  ultra-smooth motion; any wheel/touch/keypress hands control back
- **Q·AUTO button** — fps-adaptive render scale (converges to the
  highest quality the device holds above ~50fps); click to fix 1×–2.5×
- **Signature effects**: condensation droplets with true lens refraction,
  cold vapor, floor mirror reflection, orbiting key-light sweep
- **PNG capture** (camera icon) — downloads a clean product still at the
  current render scale
- **Fullscreen** (expand icon) for pitching
- **Pinch-to-zoom** on touch
- WebGL-unavailable fallback, reduced-motion support, and an automatic
  quality downgrade (render scale first, then bloom) are built in

## Signature effects

- **Condensation**: ~150 instanced water domes grip the printed wall
  (`MeshPhysicalMaterial` clearcoat), a subset slides down and respawns
- **Cold vapor**: restrained additive mist breathing around the base
- **Photographic label**: the reference photo is re-projected as an ink
  layer over the shared frost-silver metal (see below)

## Structure

```
index.html            UI layer + importmap
styles/main.css
server.mjs            static server (no deps)
vendor/               three.module.js + postprocessing addons
src/
  main.js             bootstrap + render loop (renderOnce core, QA-steppable)
  scene/environment.js  renderer, PMREM softbox studio, lights, floor, bloom
  scene/particles.js    3D particle field
  product/canGeometry.js  lathe profiles, tab, score line
  product/buildCan.js     can assembly, materials, exploded view, trio
  product/labelTexture.js procedural frost base + reference-photo label
                          re-projection (detectCan, compositeReferenceLabel)
  camera/cameraRig.js     scroll keyframes + parallax + portrait pull-back
  interaction/dragRotate.js
  scroll/scrollDirector.js
  ui/hotspots.js          3D-anchored DOM hotspot markers
  performance/quality.js  device tiers + fps guard
```

## Selling it / reskinning

- **Product config** — `window.ZU_CONFIG` at the top of `index.html`:
  `name`, `subtitle`, `price`, `currency`, `checkoutUrl`. Paste a Shopify
  cart permalink (`https://store.myshopify.com/cart/VARIANT_ID:`) into
  `checkoutUrl` and ADD TO CART routes to the real store cart with the
  quantity appended. Empty = clearly-labeled demo mode.
- **Embed mode** — open `?embed=1` for a bare interactive stage
  (hero camera, drag + tap-spin + droplets only, no page chrome). Drop it
  into any product page: `<iframe src="https://…/?embed=1" style="width:100%;height:600px;border:0"></iframe>`
- **Social preview** — `assets/og.png` + OG/Twitter meta tags are set;
  swap the image for your own shot, and use absolute URLs when deployed.
- Rendering auto-pauses when the tab is hidden.

## QA API

`window.__canQA` on the page: `setUserRotation`, `getState`, `scrollTo`,
`setPaused`, `step(n, dt)` (deterministic frame stepping for testing),
`debug()`.

*Independent non-commercial concept study. Not affiliated with or endorsed
by Monster Energy Company.*
