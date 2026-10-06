// ------------------------------------------------------------
// Section progress rail: a slim column of dots on the right
// edge. Active section glows; click (or Enter) glides to it.
// ------------------------------------------------------------

export function createRail(scrollDirector) {
  const sections = scrollDirector.sections;
  const rail = document.createElement('nav');
  rail.className = 'rail';
  rail.setAttribute('aria-label', 'Sections');

  const names = sections.map((s) => s.getAttribute('aria-label') || `Section`);
  const dots = names.map((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rail-dot';
    b.setAttribute('aria-label', `Go to ${name}`);
    b.title = name;
    b.addEventListener('click', () => {
      window.scrollTo({ top: i * window.innerHeight, behavior: 'smooth' });
    });
    rail.appendChild(b);
    return b;
  });
  document.body.appendChild(rail);

  let active = -1;
  function update(visibility) {
    let best = 0, bestV = -1;
    for (let i = 0; i < visibility.length; i++) {
      if (visibility[i] > bestV) { bestV = visibility[i]; best = i; }
    }
    if (best !== active) {
      active = best;
      dots.forEach((d, i) => d.classList.toggle('active', i === active));
    }
  }

  return { update };
}
