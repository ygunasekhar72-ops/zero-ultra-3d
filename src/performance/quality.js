// ------------------------------------------------------------
// Quality tiers + adaptive downgrade. Intel-class integrated
// GPUs are the target floor: keep the product gorgeous, shed
// post-processing first, then shadows.
// ------------------------------------------------------------

export const RENDER_STEPS = [1, 1.6, 2, 2.5];
// gentle ladder for AUTO mode: converge to the highest scale the
// device can hold above ~50fps
export const AUTO_LADDER = [1, 1.25, 1.6, 2, 2.5];

export function detectQuality() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = coarse || small;
  const dpr = window.devicePixelRatio || 1;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // peak rendering: supersample low-dpr displays, honor hidpi natively
  const baseScale = mobile
    ? Math.min(dpr, 2)
    : (dpr >= 1.5 ? Math.min(dpr, 2) : 1.6);

  return {
    mobile,
    reducedMotion,
    renderScale: baseScale,
    pixelRatio: baseScale,
    bloom: !mobile,
    msaaSamples: mobile ? 0 : 4,
    shadow: true,
    shadowMapSize: mobile ? 1024 : 2048,
    particles: mobile ? 150 : 340,
  };
}

// Watches the first seconds of runtime. Stage 1: reduce render scale.
// Stage 2: drop the composer entirely. Never upgrades back — stable
// beats fancy on the default setting.
export function createFpsGuard(world, onDowngrade) {
  let frames = 0;
  let elapsed = 0;
  let stage = 0;

  return function tick(dt) {
    if (stage >= 2) return;
    frames += 1;
    elapsed += dt;
    if (elapsed < 3.0) return;
    const fps = frames / elapsed;
    if (fps < 40 && stage === 0) {
      stage = 1;
      frames = 0; elapsed = 0;
      world.setRenderScale(Math.min(1.25, world.getRenderScale()));
      return;
    }
    if (elapsed >= 3.0 && fps < 28 && stage === 1) {
      stage = 2;
      onDowngrade();
    }
  };
}
