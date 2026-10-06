import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ------------------------------------------------------------
// The studio: renderer, camera, PMREM environment (custom
// softbox room so the metal picks up streaky highlights that
// slide as the can rotates), cinematic lights, floor, accents.
// ------------------------------------------------------------

function makeStudioEnvironment(renderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x050608);

  const box = (w, h, color, intensity, pos, lookAt) => {
    const mat = new THREE.MeshBasicMaterial();
    mat.color = new THREE.Color(color).multiplyScalar(intensity);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(pos);
    m.lookAt(lookAt);
    room.add(m);
  };
  const O = new THREE.Vector3(0, 0.8, 0);

  box(6.0, 2.6, 0xffffff, 2.6, new THREE.Vector3(0.0, 5.0, 0.5), O);   // key softbox above
  box(1.4, 4.0, 0xdde6f2, 1.2, new THREE.Vector3(-5.0, 1.5, -0.5), O); // cool strip left
  box(1.8, 4.0, 0xf2ece2, 0.7, new THREE.Vector3(5.0, 1.2, 0.8), O);   // warm dim strip right
  box(7.0, 1.3, 0x3d7bff, 0.45, new THREE.Vector3(0.5, 2.6, -5.0), O); // blue back wash
  box(4.0, 0.7, 0xcfd6e0, 0.4, new THREE.Vector3(0.0, 0.4, 5.0), O);   // low front fill

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(room, 0.06).texture;
  pmrem.dispose();
  room.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
  return envTex;
}

function radialShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.72)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.30)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(64, 110, 190, 0.55)');
  g.addColorStop(0.45, 'rgba(30, 55, 105, 0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWorld(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !quality.bloom, // MSAA when we skip the composer
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030407);
  scene.fog = new THREE.FogExp2(0x030407, 0.075);

  const camera = new THREE.PerspectiveCamera(
    34, window.innerWidth / window.innerHeight, 0.1, 60,
  );
  camera.position.set(0, 1.0, 3.4);

  // --- environment reflections ---
  const envTex = makeStudioEnvironment(renderer);
  scene.environment = envTex;

  // --- lights ---
  const key = new THREE.SpotLight(0xffffff, quality.shadow ? 420 : 0, 0, 0.55, 1.0, 1.6);
  key.position.set(2.6, 4.6, 2.4);
  if (quality.shadow) {
    key.castShadow = true;
    key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
  }
  const keyTarget = new THREE.Object3D();
  keyTarget.position.set(0, 0.8, 0);
  scene.add(keyTarget);
  key.target = keyTarget;

  const rim = new THREE.DirectionalLight(0x7fb4ff, 1.4);
  rim.position.set(-2.4, 2.6, -2.8);

  const fill = new THREE.DirectionalLight(0xdfe6f2, 0.35);
  fill.position.set(-1.6, 0.9, 2.2);

  const top = new THREE.PointLight(0xdfe9ff, 2.0, 7.0, 1.8);
  top.position.set(0, 3.2, 0);

  scene.add(key, rim, fill, top);

  // --- floor (semi-transparent so the mirrored can below reads as a
  //     reflection in the dark studio surface) ---
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(18, 64),
    new THREE.MeshStandardMaterial({
      color: 0x05060a,
      metalness: 0.5,
      roughness: 0.5,
      envMapIntensity: 0.16,
      transparent: true,
      opacity: 0.84,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.renderOrder = 1;
  scene.add(floor);

  // --- contact shadows ---
  const shadowTex = radialShadowTexture();
  const contactMat = new THREE.MeshBasicMaterial({
    map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8,
  });
  const heroContact = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), contactMat);
  heroContact.rotation.x = -Math.PI / 2;
  heroContact.position.y = 0.002;
  scene.add(heroContact);

  const trioContacts = [-0.98, 0.98].map((x) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), contactMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.002, -0.62);
    m.material = contactMat.clone();
    m.material.opacity = 0;
    scene.add(m);
    return m;
  });

  // --- atmosphere: glow card that always sits behind the can ---
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.4,
  }));
  glow.scale.set(6.0, 6.0, 1);
  scene.add(glow);

  // --- set dressing: floor rings + far light blades ---
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x16283f, transparent: true, opacity: 0.85,
  });
  for (const [r, y] of [[1.55, 0.004], [2.5, 0.003], [3.9, 0.002]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 8, 128), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    scene.add(ring);
  }
  const bladeMat = new THREE.MeshBasicMaterial({
    color: 0x2e62ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  for (const x of [-2.6, 2.6]) {
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 3.4), bladeMat);
    blade.position.set(x, 1.9, -4.2);
    scene.add(blade);
  }

  // --- post-processing: MSAA render target (WebGL2) so the composer
  //     path keeps true edge anti-aliasing, HalfFloat for clean bloom ---
  let composer = null;
  let bloom = null;
  if (quality.bloom) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      samples: quality.msaaSamples || 0,
      type: THREE.HalfFloatType,
    });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.07, 0.4, 0.9,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(quality.pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
  }

  function setRenderScale(scale) {
    const pr = THREE.MathUtils.clamp(scale, 0.75, 3);
    renderer.setPixelRatio(pr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
      composer.setPixelRatio(pr);
      composer.setSize(window.innerWidth, window.innerHeight);
    }
  }
  function getRenderScale() {
    return renderer.getPixelRatio();
  }

  // --- user brightness (exposure + light scaling), persisted by main.js ---
  const BASE = { key: 420, rim: 1.4, fill: 0.35, top: 2.0, exposure: 0.94 };
  let brightness = 1;
  let lightF = 1;
  function applyLight() {
    renderer.toneMappingExposure = BASE.exposure * brightness;
    key.intensity = quality.shadow ? BASE.key * lightF * brightness : 0;
    rim.intensity = BASE.rim * lightF * brightness;
    fill.intensity = BASE.fill * lightF * brightness;
    top.intensity = BASE.top * lightF * brightness;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  }

  // glow follows behind the can relative to the camera;
  // the key light sweeps a slow orbit so highlights stay alive at idle
  function update(camera, canPos) {
    const t = performance.now() * 0.0001;
    key.position.set(
      Math.cos(t) * 3.4,
      4.4 + Math.sin(t * 1.7) * 0.5,
      Math.sin(t) * 3.4,
    );
    const dir = new THREE.Vector3().subVectors(camera.position, canPos).normalize();
    glow.position.copy(canPos).addScaledVector(dir, -2.8);
    glow.position.y = Math.max(1.1, canPos.y + 0.9);
    glow.material.opacity = 0.30 + Math.sin(performance.now() * 0.0004) * 0.05;
  }

  function dispose() {
    renderer.dispose();
    scene.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose();
      }
    });
  }

  return {
    renderer, scene, camera, composer, bloom,
    resize, update, dispose,
    trioContacts,
    setRenderScale, getRenderScale,
    setLightLevel: (f) => { lightF = f; applyLight(); },
    setBrightness: (v) => { brightness = THREE.MathUtils.clamp(v, 0.5, 1.5); applyLight(); },
    getBrightness: () => brightness,
  };
}
