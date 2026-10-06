import * as THREE from 'three';

// ------------------------------------------------------------
// Cinematic camera rig. Scroll progress t ∈ [0,1] interpolates
// between keyframes pinned to each section's top edge; pointer
// parallax and user elevation offset are layered on top with
// damping. One continuous orbit across the whole page.
// ------------------------------------------------------------

const D2R = Math.PI / 180;

// az/el in degrees, r = orbit radius, ty = look-at height,
// canRot = can rotation driven by scroll (deg), explode/trio factors
const KEYS = [
  // az    el   r     ty    canRot  explode trio  fov
  [16,    5,   3.05, 0.78, 196,    0,      0,    34],  // 00 hero — claw front
  [78,    11,  2.45, 0.80, 262,    0,      0,    32],  // 01 reveal — claw still facing
  [138,   30,  1.52, 1.22, 498,    0,      0,    30],  // 02 detail — tab faces camera
  [240,   7,   2.75, 0.80, 620,    0,      0,    34],  // 03 orbit
  [300,   15,  4.10, 1.15, 840,    1,      0,    32],  // 04 exploded — claw front, wide
  [340,   5,   3.70, 0.82, 880,    0,      1,    31],  // 05 formation
  [376,   8,   2.95, 0.80, 916,    0,      0,    34],  // 06 finale — claw front
];

const easeInOutCubic = (u) =>
  u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

export function createCameraRig(camera) {
  const state = {
    az: KEYS[0][0], el: KEYS[0][1], r: KEYS[0][2], ty: KEYS[0][3],
    canRot: KEYS[0][4], explode: 0, trio: 0, fov: KEYS[0][7],
  };
  const pointer = { x: 0, y: 0 };         // -1..1, smoothed
  const pointerTarget = { x: 0, y: 0 };
  let userEl = 0;                          // vertical drag offset (rad)
  let radiusBoost = 1;                     // pinch-zoom factor
  let radiusBoostTarget = 1;
  let reducedMotion = false;

  function setPointer(nx, ny) {
    pointerTarget.x = nx;
    pointerTarget.y = ny;
  }
  function addUserElevation(dy) {
    userEl = THREE.MathUtils.clamp(userEl + dy, -0.18, 0.3);
  }
  function setRadiusBoost(v) {
    radiusBoostTarget = THREE.MathUtils.clamp(v, 0.72, 1.5);
  }

  function update(t, dt) {
    // map t to keyframe space: key i sits at t = i/(N-1)
    const n = KEYS.length - 1;
    const f = THREE.MathUtils.clamp(t, 0, 1) * n;
    const i = Math.min(Math.floor(f), n - 1);
    let u = f - i;
    u = reducedMotion ? THREE.MathUtils.smoothstep(u, 0, 1) * 0.35 + u * 0.65
                      : easeInOutCubic(u);
    // hold each key briefly at both ends of a segment for pacing
    const A = KEYS[i], B = KEYS[i + 1];
    const L = (a, b) => a + (b - a) * u;

    state.az = L(A[0], B[0]);
    state.el = L(A[1], B[1]);
    state.r = L(A[2], B[2]);
    state.ty = L(A[3], B[3]);
    state.canRot = L(A[4], B[4]);
    state.explode = L(A[5], B[5]);
    state.trio = L(A[6], B[6]);
    state.fov = L(A[7], B[7]);

    // smooth pointer parallax + user elevation
    const k = 1 - Math.exp(-dt * 4.5);
    pointer.x += (pointerTarget.x - pointer.x) * k;
    pointer.y += (pointerTarget.y - pointer.y) * k;
    const par = reducedMotion ? 0 : 1;
    const az = state.az * D2R + pointer.x * 2.6 * D2R * par;
    const el = (state.el + pointer.y * -1.8 * par) * D2R + userEl * par;
    // portrait screens need extra distance or the can crowds the copy
    const portraitBoost = camera.aspect < 0.8 ? 1.3 : 1;
    radiusBoost += (radiusBoostTarget - radiusBoost) * Math.min(1, dt * 8);
    const r = state.r * portraitBoost * radiusBoost;

    camera.position.set(
      Math.sin(az) * Math.cos(el) * r,
      state.ty + Math.sin(el) * r,
      Math.cos(az) * Math.cos(el) * r,
    );
    camera.lookAt(0, state.ty, 0);

    if (Math.abs(camera.fov - state.fov) > 0.01) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }

    // user elevation eases back to the scripted angle
    userEl *= Math.exp(-dt * 0.9);
  }

  return {
    state, update, setPointer, addUserElevation, setRadiusBoost,
    getRadiusBoost: () => radiusBoostTarget,
    setReducedMotion: (v) => { reducedMotion = v; },
  };
}
