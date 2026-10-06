import * as THREE from 'three';
import { createWorld } from './scene/environment.js';
import { createParticles } from './scene/particles.js';
import { createMist } from './scene/mist.js';
import { buildCan, buildTrio } from './product/buildCan.js';
import { createDroplets } from './product/droplets.js';
import { createCameraRig } from './camera/cameraRig.js';
import { createDragRotate } from './interaction/dragRotate.js';
import { createPinchZoom } from './interaction/pinchZoom.js';
import { createSound } from './interaction/sound.js';
import { createScrollDirector } from './scroll/scrollDirector.js';
import { createHotspots } from './ui/hotspots.js';
import { createCommerce } from './ui/commerce.js';
import { createRail } from './ui/rail.js';
import { detectQuality, RENDER_STEPS, AUTO_LADDER } from './performance/quality.js';
import { createCinema } from './ui/cinema.js';

// ------------------------------------------------------------
// Bootstrap. Canvas = fixed stage; DOM = interface layer.
// ------------------------------------------------------------

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const loaderStatus = document.getElementById('loaderStatus');
const quality = detectQuality();

// embed mode (?embed=1): bare interactive stage for iframes —
// no nav/rail/docks, locked to the hero camera, no page scroll
const EMBED = new URLSearchParams(location.search).has('embed');
if (EMBED) document.body.classList.add('embed');

function showFallback() {
  loaderEl.classList.add('done');
  document.getElementById('fallback').hidden = false;
  canvas.style.display = 'none';
  document.getElementById('lightCtrl').style.display = 'none';
}

let world;
try {
  world = createWorld(canvas, quality);
} catch (err) {
  console.warn('WebGL init failed:', err);
  showFallback();
}

if (world) {
  const { renderer, scene, camera } = world;

  // --- product ---
  const can = buildCan(renderer);
  // rest rotation: claw artwork is painted at cylinder u=0.5 (-Z);
  // rotate PI so it faces the hero camera at +Z.
  const CAN_REST_ROT = Math.PI;
  can.group.rotation.y = CAN_REST_ROT;
  scene.add(can.group);

  const trioPack = buildTrio(can);
  scene.add(trioPack.trio);

  // --- floor-reflection mirror: a second can instance, y-flipped under
  // the semi-transparent floor — the classic studio reflection ---
  const mirror = buildCan(renderer);
  mirror.group.scale.y = -1;
  mirror.group.traverse((o) => {
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
    if (o.isMesh && o.material) o.material.side = THREE.DoubleSide;
  });
  scene.add(mirror.group);

  // --- systems ---
  const rig = createCameraRig(camera);
  rig.setReducedMotion(quality.reducedMotion);
  const scroll = createScrollDirector();
  const hotspots = createHotspots(camera, can.group, scroll);

  // --- particles, mist, condensation ---
  const particles = createParticles(quality.particles);
  scene.add(particles.points);

  const mist = createMist(quality.mobile ? 9 : 14);
  scene.add(mist.group);

  const droplets = createDroplets(
    quality.mobile ? 70 : 150,
    can.labelTexture,
    new THREE.Vector3(2.6, 4.6, 2.4), // key light direction for the specular
  );
  can.group.add(droplets.mesh);

  // --- sound director + tap-to-spin ---
  const sound = createSound();
  const soundBtn = document.getElementById('soundBtn');
  const soundWaves = soundBtn.querySelector('.snd-waves');
  const soundOff = soundBtn.querySelector('.snd-off');
  function reflectSound(on) {
    soundBtn.classList.toggle('on', on);
    soundBtn.setAttribute('aria-pressed', String(on));
    if (soundWaves) soundWaves.style.display = on ? '' : 'none';
    if (soundOff) soundOff.style.display = on ? 'none' : '';
  }
  soundBtn.addEventListener('click', () => {
    const on = !sound.isEnabled();
    sound.setEnabled(on);
    reflectSound(on);
    try { localStorage.setItem('zu-sound', on ? '1' : '0'); } catch { /* storage blocked */ }
    if (on) sound.crack();
  });
  // restore persisted preference on the first real user gesture
  let savedSound = null;
  try { savedSound = localStorage.getItem('zu-sound'); } catch { /* storage blocked */ }
  if (savedSound === '1') {
    const armSound = () => {
      if (!sound.isEnabled()) {
        sound.setEnabled(true);
        reflectSound(true);
      }
      window.removeEventListener('pointerdown', armSound);
    };
    window.addEventListener('pointerdown', armSound, { once: true });
  } else {
    reflectSound(false);
  }
  let spinImpulse = 0;
  const drag = createDragRotate(canvas, rig, () => {
    // tap: one full satisfying revolution + crack & fizz
    spinImpulse += Math.PI * 2;
    drag.poke();
    sound.crack();
    sound.hiss();
  });

  // --- commerce + section rail + pinch zoom + cinema ---
  createCommerce({ tick: sound.tick, pop: sound.pop });
  const rail = createRail(scroll);
  createPinchZoom(canvas, rig);
  const sfxTick = () => sound.tick();

  // CINEMA: optional auto-scroll — the page films itself through the
  // whole sequence; any wheel/touch/key hands control back to the user
  const cinema = createCinema();
  const cinemaBtn = document.getElementById('cinemaBtn');
  function reflectCinema(on) {
    cinemaBtn.classList.toggle('on', on);
    cinemaBtn.setAttribute('aria-pressed', String(on));
    cinemaBtn.querySelector('.cine-play').style.display = on ? 'none' : '';
    cinemaBtn.querySelector('.cine-stop').style.display = on ? '' : 'none';
    cinemaBtn.setAttribute('aria-label', on ? 'Stop cinema auto-scroll' : 'Start cinema auto-scroll');
  }
  cinema.setTick(() => {}); // scroll advances via window.scrollTo in update()
  cinema.onStop((on) => { if (!on) reflectCinema(cinema.isActive()); });
  cinemaBtn.addEventListener('click', () => reflectCinema(cinema.toggle()));

  // --- fullscreen + PNG capture ---
  document.getElementById('fsBtn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  });
  document.getElementById('shotBtn').addEventListener('click', () => {
    renderOnce(); // fresh frame in the same task → readable framebuffer
    const url = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zero-ultra-3d.png';
    a.click();
  });

  // --- intro: lights up + camera settles in from the darkness ---
  const intro = { t: 0, dur: 2.2 };
  world.setLightLevel(0.001);

  // --- replay ---
  document.getElementById('replayBtn').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: quality.reducedMotion ? 'auto' : 'smooth' });
  });

  // --- brightness control (persisted) ---
  const lightRange = document.getElementById('lightRange');
  const lightValue = document.getElementById('lightValue');
  const lightToggle = document.getElementById('lightToggle');
  const lightCtrl = document.getElementById('lightCtrl');
  let savedB = NaN;
  try { savedB = parseFloat(localStorage.getItem('zu-brightness')); } catch { /* storage blocked */ }
  const startB = Number.isFinite(savedB) ? THREE.MathUtils.clamp(savedB, 0.5, 1.5) : 0.88;
  world.setBrightness(startB);
  lightRange.value = Math.round(startB * 100);
  lightValue.textContent = `${Math.round(startB * 100)}%`;
  lightRange.addEventListener('input', () => {
    const v = lightRange.value / 100;
    world.setBrightness(v);
    lightValue.textContent = `${lightRange.value}%`;
    try { localStorage.setItem('zu-brightness', String(v)); } catch { /* storage blocked */ }
  });
  lightToggle.addEventListener('click', () => {
    const collapsed = lightCtrl.classList.toggle('collapsed');
    lightToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  // --- resize + hidden-tab pause (battery/CPU politeness) ---
  let hiddenPause = false;
  document.addEventListener('visibilitychange', () => {
    hiddenPause = document.hidden;
    if (!document.hidden) clock.getDelta(); // swallow the gap
  });
  window.addEventListener('resize', () => world.resize());

  // --- debug / QA API (harmless in production use) ---
  let qaPaused = false;
  let qaFrames = 0;
  window.__canQA = {
    setUserRotation: (rad) => { drag.state.userRotY = rad; drag.state.velY = 0; drag.poke(); },
    getRotation: () => can.group.rotation.y,
    getState: () => ({ ...rig.state, userRot: drag.state.userRotY }),
    scrollTo: (t) => window.scrollTo(0, t * (document.documentElement.scrollHeight - window.innerHeight)),
    setPaused: (v) => { qaPaused = v; },
    soundOn: () => sound.isEnabled(),
    setBrightness: (v) => {
      world.setBrightness(v);
      lightRange.value = Math.round(v * 100);
      lightValue.textContent = `${Math.round(v * 100)}%`;
      try { localStorage.setItem('zu-brightness', String(v)); } catch { /* storage blocked */ }
    },
    // deterministic manual stepping (used when the pane is occluded and
    // Chromium throttles rAF to zero)
    step: (n, dtMs = 16.7) => {
      let ran = 0;
      for (let i = 0; i < n; i++) if (renderOnce(dtMs / 1000)) ran += 1;
      return ran;
    },
    debug: () => ({
      qaPaused, qaFrames, t: scroll.update(),
      scrollY: Math.round(window.scrollY),
      composer: !!world.composer,
    }),
  };

  // --- loader off once fonts AND the 4K label composite are ready ---
  let loaderHidden = false;
  function hideLoader() {
    if (loaderHidden) return;
    loaderHidden = true;
    loaderEl.classList.add('done');
  }
  const labelReady = Promise.race([
    can.labelReady?.catch(() => {}) || Promise.resolve(),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  Promise.all([
    document.fonts?.ready || Promise.resolve(),
    labelReady,
  ]).then(() => setTimeout(hideLoader, 250));
  setTimeout(hideLoader, 4000); // hard cap

  // --- render quality: AUTO (fps-adaptive, ideal for mobile) or fixed ---
  const qBtn = document.getElementById('qBtn');
  const qLabel = document.getElementById('qLabel');
  const MODES = ['auto', ...RENDER_STEPS];
  let savedQ = null;
  try { savedQ = localStorage.getItem('zu-renderScale'); } catch { /* storage blocked */ }
  let qMode = 'auto';
  if (savedQ === 'auto') qMode = 'auto';
  else if (savedQ && !Number.isNaN(parseFloat(savedQ))) qMode = parseFloat(savedQ);
  let autoIdx = AUTO_LADDER.indexOf(
    Math.min(AUTO_LADDER[AUTO_LADDER.length - 1], Math.max(1, quality.renderScale)),
  );
  if (autoIdx < 0) autoIdx = 1;

  function applyQ() {
    if (qMode === 'auto') {
      world.setRenderScale(AUTO_LADDER[autoIdx]);
      qLabel.textContent = 'Q·AUTO';
    } else {
      world.setRenderScale(qMode);
      qLabel.textContent = `Q${qMode}×`;
    }
  }
  applyQ();
  qBtn.addEventListener('click', () => {
    const i = MODES.indexOf(qMode);
    qMode = MODES[(i + 1) % MODES.length];
    applyQ();
    try { localStorage.setItem('zu-renderScale', String(qMode)); } catch { /* storage blocked */ }
    sfxTick();
  });

  // AUTO controller: converges to the highest scale holding ~50fps
  let fpsEma = 60;
  let autoCooldown = 0;
  function autoQualityTick(dt) {
    if (qMode !== 'auto') return;
    autoCooldown -= dt;
    if (autoCooldown > 0) return;
    autoCooldown = 2.5;
    if (fpsEma < 38 && autoIdx > 0) {
      autoIdx -= 1;
      world.setRenderScale(AUTO_LADDER[autoIdx]);
    } else if (fpsEma > 52 && autoIdx < AUTO_LADDER.length - 1) {
      autoIdx += 1;
      world.setRenderScale(AUTO_LADDER[autoIdx]);
    }
  }

  // --- main loop ---
  const clock = new THREE.Clock();
  const canPos = new THREE.Vector3(0, 0.75, 0);
  let lastSec = -1;

  function renderOnce(fixedDt) {
    if (qaPaused || hiddenPause) return false;
    qaFrames += 1;
    const dt = fixedDt ?? Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    cinema.update(dt); // advance auto-scroll before the director reads it
    const t = EMBED ? 0 : scroll.update();
    rig.update(t, dt);
    drag.update(dt, quality.reducedMotion);

    // consumed tap-spin impulse: eased full revolution
    if (spinImpulse > 0.0005) {
      const delta = spinImpulse * (1 - Math.exp(-4.2 * dt));
      drag.state.userRotY += delta;
      spinImpulse -= delta;
      if (spinImpulse < 0.0005) spinImpulse = 0;
    }

    // contextual score: a cue when the active section changes
    const sec = Math.round(t * (scroll.sections.length - 1));
    if (sec !== lastSec) {
      if (lastSec >= 0) sound.section(sec);
      lastSec = sec;
    }
    // spin-follow air: volume/pitch track the can's angular velocity
    sound.setSpin(Math.abs(drag.state.velY) * 60 + spinImpulse * 2.5);

    // can transform: scroll-driven rotation + user drag + gentle float;
    // the can levitates while exploded so parts never sink under the floor
    const float = quality.reducedMotion ? 0 : Math.sin(time * 1.1) * 0.012;
    can.group.rotation.y = THREE.MathUtils.degToRad(rig.state.canRot) + drag.state.userRotY;
    can.group.position.y = float + rig.state.explode * 0.18;
    can.update(rig.state.explode);
    mirror.group.rotation.y = can.group.rotation.y;
    mirror.group.position.y = -can.group.position.y;
    mirror.update(rig.state.explode);
    trioPack.update(rig.state.trio);
    world.trioContacts.forEach((m) => {
      m.material.opacity = 0.8 * THREE.MathUtils.smoothstep(rig.state.trio, 0, 1);
    });

    // intro light fade-in
    if (intro.t < intro.dur) {
      intro.t += dt;
      const k = THREE.MathUtils.smoothstep(intro.t / intro.dur, 0, 1);
      world.setLightLevel(k);
    }

    camera.position.y += float * 0.4; // can float carries the camera a touch
    particles.update(dt, quality.reducedMotion);
    droplets.update(dt, time, quality.reducedMotion);
    mist.update(dt, quality.reducedMotion);
    world.update(camera, canPos);
    hotspots.update();
    rail.update(scroll.visibility);

    // fps tracking → AUTO quality ladder
    if (dt > 0) fpsEma = fpsEma * 0.94 + (1 / dt) * 0.06;
    autoQualityTick(dt);

    if (world.composer) world.composer.render();
    else renderer.render(scene, camera);
    return true;
  }

  function frame() {
    requestAnimationFrame(frame);
    renderOnce();
  }

  scroll.update();
  requestAnimationFrame(frame);
}
