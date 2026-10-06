// ------------------------------------------------------------
// Cinema mode: the page films itself. A slow, constant-velocity
// auto-scroll glides through the whole scroll film (the camera
// rig + section cues react exactly as if the user scrolled).
// Any user intent (wheel, touch, keys) hands control back.
// ------------------------------------------------------------

export function createCinema() {
  let active = false;
  let speed = 0;          // px per second
  let onTick = null;      // (scrollY) => void, set by main
  let stopCbs = [];

  function maxScroll() {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  function start() {
    const max = maxScroll();
    // at (near) the end: restart from the top for a replay
    if (window.scrollY > max - 10) window.scrollTo(0, 0);
    // full journey ≈ 60 seconds → smooth cinematic pacing
    speed = maxScroll() / 58;
    active = true;
    stopCbs.forEach((f) => f(true));
  }

  function stop() {
    if (!active) return;
    active = false;
    stopCbs.forEach((f) => f(false));
  }

  function toggle() {
    active ? stop() : start();
    return active;
  }

  function update(dt) {
    if (!active) return;
    const max = maxScroll();
    let y = window.scrollY + speed * dt;
    if (y >= max) {
      y = max;
      active = false;
      stopCbs.forEach((f) => f(false));
    }
    window.scrollTo(0, y);
    onTick?.(y);
  }

  // user intent interrupts cinema — but taps on the control docks
  // (cinema/brightness/quality buttons, cart) must not
  const interrupt = (e) => {
    if (e && e.target && e.target.closest && e.target.closest('.light-ctrl, .buy-dock, .nav')) return;
    stop();
  };
  window.addEventListener('wheel', interrupt, { passive: true });
  window.addEventListener('touchstart', interrupt, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) interrupt();
  });

  return {
    toggle, stop, update,
    isActive: () => active,
    setTick: (f) => { onTick = f; },
    onStop: (f) => stopCbs.push(f),
  };
}
