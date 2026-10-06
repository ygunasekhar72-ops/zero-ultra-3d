import * as THREE from 'three';
import { CAN_R, WALL_BOTTOM, WALL_TOP } from './canGeometry.js';

// ------------------------------------------------------------
// Condensation, done properly: instanced water domes whose
// shader REFRACTS the label texture beneath them (each drop is
// a tiny lens showing bent label), plus fresnel edge glow and a
// hot specular point. That combination is what makes drops read
// as water instead of bumps. Sizes cluster naturally; a subset
// slides down and respawns. Parented to the can group.
// ------------------------------------------------------------

const VERT = /* glsl */ `
  // instanceMatrix is auto-declared by three for InstancedMesh
  attribute vec2 aUv;
  attribute float aScale;
  attribute float aSeed;
  varying vec2 vLabelUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vLabelUv = aUv;
    // break the perfect sphere: subtle per-drop silhouette noise
    vec3 p = position;
    float w = sin(p.x * 9.0 + aSeed) * sin(p.y * 11.0 + aSeed * 1.7) * sin(p.z * 7.0 + aSeed * 0.6);
    p *= 1.0 + w * 0.14;
    vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uLabelTex;
  uniform vec3 uLightDir;
  varying vec2 vLabelUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 v = normalize(cameraPosition - vWorldPos);
    vec3 nn = dot(n, v) < 0.0 ? -n : n;      // face the viewer (dome side)

    // wall frame in world space (can axis is world-Y through origin)
    vec3 radial = normalize(vec3(vWorldPos.x, 0.0, vWorldPos.z));
    vec3 circ = normalize(vec3(radial.z, 0.0, -radial.x));
    vec3 tangential = nn - radial * dot(nn, radial);

    // lens refraction: sample the label bent by the dome's curvature
    vec2 refr = vec2(dot(tangential, circ), tangential.y) * 0.12;
    vec2 uv = vLabelUv + refr;
    vec3 lab = texture2D(uLabelTex, uv).rgb;

    // water body: slightly darker label seen through the drop
    vec3 col = lab * 0.8;

    // fresnel edge (light gathering at the rim) + contact shading
    float fres = pow(1.0 - abs(dot(nn, v)), 3.5);
    col += vec3(0.82, 0.9, 1.0) * fres * 0.55;
    col *= 0.8 + 0.2 * abs(nn.y);

    // hot specular point from the key light
    vec3 h = normalize(uLightDir + v);
    float spec = pow(max(dot(nn, h), 0.0), 90.0);
    col += vec3(1.0) * spec * 1.1;

    gl_FragColor = vec4(col, 0.9);
    #include <colorspace_fragment>
  }
`;

export function createDroplets(count, labelTexture, lightDir) {
  const geo = new THREE.SphereGeometry(1, 18, 14);

  // natural clustering: droplets gather around nucleation centers
  const clusters = [];
  for (let i = 0; i < 16; i++) {
    clusters.push({
      theta: Math.random() * Math.PI * 2,
      y: 0.12 + Math.random() * 1.0,
      spread: 0.10 + Math.random() * 0.22,
    });
  }
  const pickTheta = () => {
    if (Math.random() < 0.7) {
      const c = clusters[(Math.random() * clusters.length) | 0];
      let t = c.theta + (Math.random() - 0.5) * c.spread * 2.4;
      return (t + Math.PI * 4) % (Math.PI * 2);
    }
    return Math.random() * Math.PI * 2;
  };
  const pickY = () => {
    if (Math.random() < 0.7) {
      const c = clusters[(Math.random() * clusters.length) | 0];
      return Math.min(1.2, Math.max(0.07, c.y + (Math.random() - 0.5) * c.spread * 2.2));
    }
    return 0.08 + Math.random() * 1.08;
  };
  const pickSize = () => {
    const r = Math.random();
    if (r < 0.06) return 0.011 + Math.random() * 0.009;   // few big drops
    if (r < 0.58) return 0.005 + Math.random() * 0.005;   // mid
    return 0.003 + Math.random() * 0.0025;                // micro mist
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uLabelTex: { value: labelTexture },
      uLightDir: { value: lightDir.clone().normalize() },
    },
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  const uvAttr = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  const scaleAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  const seedAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  geo.setAttribute('aUv', uvAttr);
  geo.setAttribute('aScale', scaleAttr);
  geo.setAttribute('aSeed', seedAttr);

  const drops = [];
  for (let i = 0; i < count; i++) {
    drops.push({
      theta: pickTheta(),
      y: pickY(),
      r: CAN_R + 0.0022 + Math.random() * 0.003,
      s: pickSize(),
      // contact-angle flattening + elliptical footprint + in-plane roll:
      // what makes a dome read as water instead of a ball
      fl: 0.28 + Math.random() * 0.22,       // squash along the wall normal
      ex: 0.8 + Math.random() * 0.45,        // ellipse axes
      ey: 0.8 + Math.random() * 0.45,
      roll: Math.random() * Math.PI * 2,
      slide: Math.random() < 0.15,
      speed: 0.012 + Math.random() * 0.03,
      wob: Math.random() * Math.PI * 2,
      seed: Math.random() * 100,
    });
  }

  const WALL_H = WALL_TOP - WALL_BOTTOM;
  const dummy = new THREE.Object3D();

  function writeAttrs() {
    for (let i = 0; i < count; i++) {
      const d = drops[i];
      // cylinder UV convention: u = ((π/2 − φ) mod 2π)/2π, v from wall span
      let u = ((Math.PI / 2 - d.theta) / (Math.PI * 2)) % 1;
      if (u < 0) u += 1;
      uvAttr.setXY(i, u, (d.y - WALL_BOTTOM) / WALL_H);
      scaleAttr.setX(i, d.s);
      seedAttr.setX(i, d.seed);
    }
    uvAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
    seedAttr.needsUpdate = true;
  }
  writeAttrs();

  function update(dt, time, reducedMotion) {
    let respawned = false;
    for (let i = 0; i < count; i++) {
      const d = drops[i];
      if (d.slide && !reducedMotion) {
        d.y -= d.speed * dt;
        d.theta += Math.sin(time * 0.8 + d.wob) * 0.0004;
        if (d.y < 0.07) {
          d.y = 1.05 + Math.random() * 0.12;
          d.theta = pickTheta();
          d.s = pickSize();
          d.speed = 0.012 + Math.random() * 0.03;
          respawned = true;
        }
      }
      dummy.position.set(Math.cos(d.theta) * d.r, d.y, Math.sin(d.theta) * d.r);
      dummy.lookAt(0, d.y, 0);
      dummy.rotateZ(d.roll);
      // flat dome: strongly squashed along the wall normal, elliptical footprint
      dummy.scale.set(d.s * d.ex, d.s * d.ey, d.s * d.fl);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (respawned) writeAttrs();
  }

  function dispose() {
    geo.dispose();
    mat.dispose();
  }

  return { mesh, update, dispose };
}
