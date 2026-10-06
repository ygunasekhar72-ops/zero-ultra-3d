// ------------------------------------------------------------
// Scroll director: maps scroll position to global progress t and
// drives the DOM text reveals (opacity/translation per section,
// based on distance of each section's center from viewport
// center). Keyframes in the camera rig key off each section's
// top edge, so pacing always matches the DOM.
// ------------------------------------------------------------

export function createScrollDirector() {
  const sections = Array.from(document.querySelectorAll('[data-section]'));
  const revealed = new Set();
  const visibility = new Array(sections.length).fill(0);

  function markVisible(i) {
    for (const el of sections[i].querySelectorAll('[data-reveal]')) {
      el.classList.add('is-in');
    }
    revealed.add(i);
  }

  function update() {
    const vh = window.innerHeight;
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - vh);
    const t = Math.min(1, Math.max(0, window.scrollY / maxScroll));

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const rect = sec.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const d = Math.abs(center - vh / 2) / (vh * 0.62);
      const v = Math.max(0, Math.min(1, 1 - d));
      visibility[i] = v;
      // clamp: reveals stay in once earned
      if (v > 0.62 && !revealed.has(i)) markVisible(i);
    }
    return t;
  }

  window.addEventListener('scroll', () => update(), { passive: true });

  return { sections, visibility, update };
}
