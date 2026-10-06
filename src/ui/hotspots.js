import * as THREE from 'three';

// ------------------------------------------------------------
// Hotspots: DOM markers projected from real 3D anchor points on
// the can. Visible only while the DETAIL section is in view and
// only when their anchor faces the camera. Labels flip sides so
// they never run off-screen.
// ------------------------------------------------------------

const SPOTS = [
  { x: 0, y: 1.50, z: 0.12, label: 'STAY-ON TAB · EXTRUDED ALUMINUM', flip: false, sec: 2 },
  { x: 0, y: 1.44, z: 0.30, label: 'DOUBLE-SEAM CHIME', flip: false, sec: 2 },
  { x: 0, y: 0.92, z: -0.325, label: 'CLAW MARK · FROST PRINT WRAP', flip: true, sec: 1 },
];

export function createHotspots(camera, canGroup, scrollDirector) {
  const layer = document.getElementById('hotspots');
  const els = SPOTS.map((s) => {
    const wrap = document.createElement('div');
    wrap.className = `hotspot${s.flip ? ' hotspot--flip' : ''}`;
    wrap.innerHTML = `
      <button class="hotspot-btn" type="button" aria-label="${s.label}"></button>
      <span class="hotspot-label" aria-hidden="true">${s.label}</span>
    `;
    layer.appendChild(wrap);
    return wrap;
  });

  const anchor = new THREE.Vector3();
  const v = new THREE.Vector3();

  function update() {
    for (let i = 0; i < SPOTS.length; i++) {
      const s = SPOTS[i];
      const vis = scrollDirector.visibility[s.sec] ?? 0;
      if (vis <= 0.02) {
        els[i].style.opacity = '0';
        els[i].style.pointerEvents = 'none';
        continue;
      }
      anchor.set(s.x, s.y, s.z);
      canGroup.localToWorld(v.copy(anchor));
      const world = v.clone();

      // face check: anchor normal (radial from can axis) vs camera dir
      const normal = new THREE.Vector3(s.x, 0, s.z).normalize();
      normal.applyQuaternion(canGroup.quaternion);
      const toCam = new THREE.Vector3().subVectors(camera.position, world).normalize();
      const facing = normal.dot(toCam);

      v.copy(world).project(camera);
      const onScreen = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      const opacity = vis * (facing > 0.25 ? 1 : 0.0) * (onScreen ? 1 : 0);

      const el = els[i];
      el.style.opacity = opacity.toFixed(3);
      if (opacity > 0) {
        el.style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
        el.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
      }
      el.style.pointerEvents = opacity > 0.4 ? 'auto' : 'none';
    }
  }

  return { update };
}
