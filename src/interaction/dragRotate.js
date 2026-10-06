// ------------------------------------------------------------
// Physical drag interaction: horizontal drag spins the can with
// inertia; vertical drag nudges camera elevation. Touch uses
// pointer events with touch-action: pan-y so page scroll on
// mobile stays native while horizontal swishes rotate the can.
// Keyboard: ArrowLeft/Right when the canvas has focus.
// ------------------------------------------------------------

export function createDragRotate(canvas, rig, onTap) {
  const state = { userRotY: 0, velY: 0, dragging: false };
  let lastX = 0, lastY = 0, lastInteraction = 0;
  let downX = 0, downY = 0, downT = 0;

  canvas.addEventListener('pointerdown', (e) => {
    state.dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
    state.velY = 0;
    canvas.classList.add('dragging');
    canvas.setPointerCapture?.(e.pointerId);
    lastInteraction = performance.now();
  });

  canvas.addEventListener('pointermove', (e) => {
    rig.setPointer(
      (e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1,
    );
    if (!state.dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    state.userRotY += dx * 0.0055;
    state.velY = dx * 0.0055;
    rig.addUserElevation(dy * 0.0016);
    lastInteraction = performance.now();
  });

  const end = (e) => {
    if (!state.dragging) return;
    state.dragging = false;
    canvas.classList.remove('dragging');
    lastInteraction = performance.now();
    try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* already released */ }
    // a tap (not a drag) spins the can a full satisfying turn
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (dist < 7 && performance.now() - downT < 450 && onTap) {
      onTap();
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);

  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { state.userRotY -= 0.35; state.velY = -0.02; lastInteraction = performance.now(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { state.userRotY += 0.35; state.velY = 0.02; lastInteraction = performance.now(); e.preventDefault(); }
  });

  function update(dt, reducedMotion) {
    // inertia decay
    if (!state.dragging) {
      state.userRotY += state.velY;
      state.velY *= Math.pow(0.06, dt); // frame-rate independent decay
    }
    // idle sway only on the hero screen, after the user pauses
    const idle = performance.now() - lastInteraction > 2600;
    if (idle && !reducedMotion) {
      state.userRotY += dt * 0.045;
    }
  }

  return { state, update, poke: () => { lastInteraction = performance.now(); } };
}
