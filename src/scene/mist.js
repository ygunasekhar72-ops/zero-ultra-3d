import * as THREE from 'three';

// ------------------------------------------------------------
// Cold vapor: a restrained column of soft mist breathing around
// the base of the can. Additive sprites, barely there — sells
// "ice cold" without ever hiding the product.
// ------------------------------------------------------------

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(215,232,255,0.38)');
  g.addColorStop(1, 'rgba(200,225,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMist(count) {
  const group = new THREE.Group();
  const tex = puffTexture();
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xbfd8ff,
    });
    const s = new THREE.Sprite(mat);
    group.add(s);
    puffs.push({
      s,
      theta: Math.random() * Math.PI * 2,
      r: 0.38 + Math.random() * 0.55,
      y: Math.random() * 1.6,
      rise: 0.10 + Math.random() * 0.16,
      size: 0.5 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
    });
  }

  let time = 0;
  function update(dt, reducedMotion) {
    if (reducedMotion) return;
    time += dt;
    for (const p of puffs) {
      p.y += p.rise * dt;
      if (p.y > 1.9) {
        p.y = -0.05;
        p.theta = Math.random() * Math.PI * 2;
        p.r = 0.38 + Math.random() * 0.55;
      }
      const fadeIn = Math.min(1, p.y / 0.35);
      const fadeOut = 1 - Math.min(1, Math.max(0, (p.y - 1.1) / 0.8));
      p.s.material.opacity = 0.11 * fadeIn * fadeOut * (0.75 + 0.25 * Math.sin(time * 0.7 + p.phase));
      const sc = p.size * (0.55 + p.y * 0.75);
      p.s.scale.set(sc, sc, 1);
      p.s.position.set(
        Math.cos(p.theta + time * 0.05) * p.r,
        p.y,
        Math.sin(p.theta + time * 0.05) * p.r,
      );
    }
  }

  function dispose() {
    group.children.forEach((s) => s.material.dispose());
    tex.dispose();
  }

  return { group, update, dispose };
}
