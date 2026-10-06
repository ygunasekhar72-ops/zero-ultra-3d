// ------------------------------------------------------------
// Pinch-to-zoom for touch: two-finger pinch dollies the camera
// (radius boost 0.72–1.5). Desktop keeps scroll = cinema.
// ------------------------------------------------------------

export function createPinchZoom(canvas, rig) {
  const active = new Map();
  let startDist = 0;
  let startBoost = 1;

  function dist() {
    const p = [...active.values()];
    return Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    active.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (active.size === 2) {
      startDist = dist();
      startBoost = rig.getRadiusBoost();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!active.has(e.pointerId)) return;
    active.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (active.size === 2 && startDist > 0) {
      rig.setRadiusBoost(startBoost * (startDist / dist()));
    }
  });

  const release = (e) => {
    active.delete(e.pointerId);
    if (active.size < 2) startDist = 0;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}
