import * as THREE from 'three';
import {
  lathe, wallGeometry, tabGeometry, scoreGeometry,
  BASE_PROFILE, TOP_PROFILE, CAN_R,
} from './canGeometry.js';
import { paintLabel, paintLabelBump, paintProceduralArtwork, loadReferenceImage, compositeReferenceLabel } from './labelTexture.js';

// ------------------------------------------------------------
// Assembles the Zero Ultra can from real meshes and returns
// an updater that drives the exploded view. Parts: tab, lid
// (with tab + score), printed wall, base dome.
// ------------------------------------------------------------

let cachedTextures = null;

function makeTextures() {
  const colorCanvas = paintLabel();
  const bumpCanvas = paintLabelBump();
  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  return { map, bumpMap, colorCanvas };
}

function configureTextures({ map, bumpMap }, renderer) {
  for (const t of [map, bumpMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  }
  map.colorSpace = THREE.SRGBColorSpace;
}

function getTextures(renderer) {
  if (cachedTextures) return cachedTextures;
  const tex = makeTextures();
  configureTextures(tex, renderer);
  cachedTextures = tex;
  // composite the reference-photo label exactly once, onto the shared
  // canvas (a second buildCan — e.g. the floor-reflection mirror —
  // reuses this texture and must not double-apply the ink)
  tex.labelPromise = loadReferenceImage().then((img) => {
    if (!img || !compositeReferenceLabel(tex.colorCanvas, img)) {
      paintProceduralArtwork(tex.colorCanvas);
    }
    tex.map.needsUpdate = true;
  });
  return tex;
}

export function buildCan(renderer) {
  const texs = getTextures(renderer);
  const { map, bumpMap, colorCanvas } = texs;

  // --- materials (PBR aluminum) ---
  const bareMetal = new THREE.MeshStandardMaterial({
    color: 0xdfe2e7,
    metalness: 1.0,
    roughness: 0.26,
    envMapIntensity: 0.8,
  });
  const labelMetal = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    bumpMap,
    bumpScale: 0.0025,
    // printed aluminum: keep the wall nearly as metallic as the bare lid
    // so the shoulder doesn't read as a separate cap — the ink darkens
    // the reflection through the map, whites stay the same silver
    metalness: 0.86,
    roughness: 0.34,
    envMapIntensity: 0.78,
    side: THREE.DoubleSide,
  });
  const tabMetal = new THREE.MeshStandardMaterial({
    color: 0xc9ccd2,
    metalness: 1.0,
    roughness: 0.32,
    envMapIntensity: 1.0,
  });
  const scoreMat = new THREE.MeshStandardMaterial({
    color: 0x1b1e24,
    metalness: 0.6,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  // --- meshes ---
  const baseMesh = new THREE.Mesh(lathe(BASE_PROFILE), bareMetal);
  const wallMesh = new THREE.Mesh(wallGeometry(), labelMetal);
  const lidMesh = new THREE.Mesh(lathe(TOP_PROFILE), bareMetal);

  const tabMesh = new THREE.Mesh(tabGeometry(), tabMetal);
  tabMesh.position.set(0, 1.500, 0.098);

  const rivet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.019, 0.016, 24),
    tabMetal,
  );
  rivet.position.set(0, 1.500, 0.098);

  const score = new THREE.Mesh(scoreGeometry(), scoreMat);
  score.position.set(0, 1.4985, 0.028);

  // --- hierarchy: parts are separate groups so they explode apart ---
  const group = new THREE.Group();
  const baseGroup = new THREE.Group();
  const wallGroup = new THREE.Group();
  const lidGroup = new THREE.Group();

  baseGroup.add(baseMesh);
  wallGroup.add(wallMesh);
  lidGroup.add(lidMesh, tabMesh, rivet, score);
  group.add(baseGroup, wallGroup, lidGroup);

  group.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });

  // exploded offsets along Y (rest position is 0 for each part group);
  // the whole can also rises during the explode — see main.js — so the
  // base dome separates without sinking under the floor
  const parts = [
    { obj: lidGroup, dy: 0.32 },
    { obj: baseGroup, dy: -0.18 },
    { obj: wallGroup, dy: 0.0 },
  ];
  // the tab lifts even higher than the lid itself
  const tabLift = { obj: tabMesh, base: tabMesh.position.y, dy: 0.20 };
  const rivetLift = { obj: rivet, base: rivet.position.y, dy: 0.20 };

  function update(explode) {
    const e = THREE.MathUtils.smoothstep(explode, 0, 1);
    for (const p of parts) p.obj.position.y = p.dy * e;
    tabMesh.position.y = tabLift.base + tabLift.dy * e;
    rivet.position.y = rivetLift.base + rivetLift.dy * e;
    // a touch of rotation on the lid while it lifts — machined, not floaty
    lidGroup.rotation.y = e * 0.35;
  }
  update(0);

  return {
    group, update, radius: CAN_R,
    labelMaterial: labelMetal, labelTexture: map, colorCanvas,
    labelReady: texs.labelPromise,
  };
}

// Two companion cans for the formation section — same geometry,
// same materials (shared), arranged behind the hero can.
export function buildTrio(can) {
  const trio = new THREE.Group();
  const cans = [];
  const placements = [
    { x: -0.98, z: -0.62, rotY: 0.55, s: 0.97 },
    { x: 0.98, z: -0.62, rotY: -0.62, s: 0.97 },
  ];
  for (const p of placements) {
    const c = can.group.clone(true);
    c.position.set(p.x, 0, p.z);
    c.rotation.y = p.rotY;
    c.scale.setScalar(p.s);
    trio.add(c);
    cans.push(c);
  }
  trio.visible = false;

  function update(factor) {
    const f = THREE.MathUtils.smoothstep(factor, 0, 1);
    trio.visible = f > 0.001;
    if (!trio.visible) return;
    for (const c of cans) {
      c.position.y = -0.85 * (1 - f);
      const s = 0.97 * (0.85 + 0.15 * f);
      c.scale.setScalar(s);
    }
  }
  return { trio, update };
}
