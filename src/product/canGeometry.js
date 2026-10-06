import * as THREE from 'three';

// ------------------------------------------------------------
// Physically proportioned 16oz tallboy: H ≈ 2.3 × diameter.
// Radius R = 0.331, total height ≈ 1.50 scene units.
// Built from three lathe/cylinder pieces so the exploded view
// separates real meshes: base dome, printed wall, lid unit.
// ------------------------------------------------------------

export const CAN_R = 0.331;
export const CAN_H = 1.50;
export const WALL_TOP = 1.285;
export const WALL_BOTTOM = 0.058;

// base: dished dome + outward chime into the wall
export const BASE_PROFILE = [
  [0.000, 0.030],
  [0.100, 0.026],
  [0.190, 0.018],
  [0.258, 0.012],
  [0.292, 0.013],
  [0.316, 0.024],
  [0.328, 0.044],
  [0.331, 0.062],
];

// lid: necked shoulder -> double seam -> slightly dished panel
export const TOP_PROFILE = [
  [0.331, 1.285],
  [0.325, 1.316],
  [0.316, 1.352],
  [0.307, 1.388],
  [0.301, 1.412],
  [0.304, 1.432],
  [0.311, 1.448],
  [0.312, 1.460],
  [0.306, 1.472],
  [0.295, 1.479],
  [0.279, 1.484],
  [0.248, 1.489],
  [0.200, 1.492],
  [0.120, 1.495],
  [0.000, 1.497],
];

export function lathe(profile, segments = 220, phiStart = 0) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, segments, phiStart, Math.PI * 2);
  geo.computeVertexNormals();
  return geo;
}

export function wallGeometry(segments = 220) {
  const h = WALL_TOP - WALL_BOTTOM;
  const geo = new THREE.CylinderGeometry(CAN_R, CAN_R, h, segments, 1, true);
  geo.translate(0, WALL_BOTTOM + h / 2, 0);
  return geo;
}

// stay-on tab: flat plate with a finger hole, extruded
export function tabGeometry() {
  const shape = new THREE.Shape();
  const L = 0.115, W = 0.047;
  const r = W / 2;
  // rounded plate from z=-L*0.42 (nose) to z=+L*0.58 (tail), centered on x=0
  shape.absarc(0, L * 0.58 - r, r, -Math.PI / 2, Math.PI / 2, false);
  shape.absarc(0, -L * 0.42 + r, r, Math.PI / 2, -Math.PI / 2, false);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, L * 0.16, 0.0175, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.010,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 3,
    curveSegments: 32,
  });
  geo.rotateX(-Math.PI / 2); // lie flat, extrusion along Y
  return geo;
}

// the score line (opening) — a dark elliptical ring flat on the lid
export function scoreGeometry() {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 0.062, 0.040, 0, Math.PI * 2, false, 0);
  const inner = new THREE.Path();
  inner.absellipse(0, 0, 0.048, 0.028, 0, Math.PI * 2, true, 0);
  shape.holes.push(inner);
  const geo = new THREE.ShapeGeometry(shape, 32);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
