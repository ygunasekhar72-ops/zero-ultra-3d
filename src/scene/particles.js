import * as THREE from 'three';

// ------------------------------------------------------------
// Restrained 3D particle field: real positions in a cylindrical
// shell around the product, slow rise + sway, depth via size
// attenuation and fog. Camera orbit produces natural parallax.
// ------------------------------------------------------------

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(210,228,255,0.55)');
  g.addColorStop(1, 'rgba(160,200,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createParticles(count) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.25 + Math.pow(Math.random(), 0.7) * 4.6;
    positions[i * 3 + 0] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.random() * 3.4;
    positions[i * 3 + 2] = Math.sin(a) * r;
    seeds[i * 2 + 0] = 0.02 + Math.random() * 0.05;   // rise speed
    seeds[i * 2 + 1] = Math.random() * Math.PI * 2;   // sway phase
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    map: dotTexture(),
    size: 0.036,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0x9fc4ff,
    fog: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  let time = 0;
  function update(dt, reducedMotion) {
    if (reducedMotion) return;
    time += dt;
    const pos = geo.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < count; i++) {
      const speed = seeds[i * 2];
      const phase = seeds[i * 2 + 1];
      let y = arr[i * 3 + 1] + speed * dt;
      if (y > 3.4) y = 0;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 0] += Math.sin(time * 0.4 + phase) * 0.00045;
    }
    pos.needsUpdate = true;
  }

  function dispose() {
    geo.dispose();
    mat.map?.dispose();
    mat.dispose();
  }

  return { points, update, dispose };
}
