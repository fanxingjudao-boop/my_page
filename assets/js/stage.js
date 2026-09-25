// Real-time gown stage: scroll-directed camera, live dye (colorway) shader, drifting gold dust.
// Progressive enhancement: the poster <img> stays visible until the first frame is rendered;
// without WebGL2 the page keeps the poster and hides the colorway controls.
import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, Color, Vector3,
  SpotLight, DirectionalLight, Mesh, PlaneGeometry, ShadowMaterial, MeshBasicMaterial,
  CanvasTexture, BufferGeometry, BufferAttribute, Points, ShaderMaterial, Group,
  ACESFilmicToneMapping, SRGBColorSpace, PCFShadowMap, MathUtils,
  GLTFLoader, MeshoptDecoder, RoomEnvironment,
} from './three.vendor.js';

const root = document.documentElement;
const stageEl = document.getElementById('stage');
const canvas = document.getElementById('gown-canvas');
const loaderEl = document.getElementById('stage-loader');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const TAU = Math.PI * 2;

const fail = () => root.classList.add('no-webgl');

// ---------- Camera direction: one keyframe per chapter ----------
// offX shifts the framing horizontally (fraction of viewport width) so the copy has room.
const KEYS = [
  { pos: [0, 0.56, 2.75], tgt: [0, 0.5, 0], rot: 0, offX: 0.16 },          // hero
  { pos: [0, 0.54, 2.45], tgt: [0, 0.5, 0], rot: TAU, offX: -0.17 },       // 360°
  { pos: [0.1, 0.74, 0.95], tgt: [0, 0.68, 0.02], rot: TAU - 0.12, offX: 0.2 }, // detail (belt & jewel)
  { pos: [0.55, 0.6, 2.25], tgt: [0, 0.5, 0], rot: TAU - 0.35, offX: -0.16 }, // colorway
];

// ---------- Dye (colorway) shader state ----------
const COLORWAYS = {
  celadon: { color: '#9fb5a8', amount: 0 },
  rose: { color: '#c07f8b', amount: 1 },
  indigo: { color: '#2f437f', amount: 1 },
  sumi: { color: '#1b1d20', amount: 1 },
  crimson: { color: '#8a1a2b', amount: 1 },
};
const dye = {
  uColA: { value: new Color(COLORWAYS.celadon.color) }, uAmtA: { value: 0 },
  uColB: { value: new Color(COLORWAYS.celadon.color) }, uAmtB: { value: 0 },
  uSweep: { value: -1 },
};

const patchDye = (material) => {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, dye);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float _dye;\nvarying float vWY;\nvarying float vDye;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;\nvDye = _dye;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vWY;
        varying float vDye;
        uniform vec3 uColA; uniform float uAmtA;
        uniform vec3 uColB; uniform float uAmtB;
        uniform float uSweep;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          // vDye marks the celadon silk parts (classified per part at bake time);
          // inside them, saturated gold thread is kept undyed
          vec3 s = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2));
          float mx = max(s.r, max(s.g, s.b)), mn = min(s.r, min(s.g, s.b)), d = mx - mn;
          float h = 0.0;
          if (d > 1e-4) {
            if (mx == s.r) h = mod((s.g - s.b) / d, 6.0);
            else if (mx == s.g) h = (s.b - s.r) / d + 2.0;
            else h = (s.r - s.g) / d + 4.0;
          }
          h *= 60.0;
          float sat = d / max(mx, 1e-4);
          float thread = (1.0 - smoothstep(44.0, 52.0, h)) * smoothstep(0.13, 0.2, sat) * smoothstep(0.5, 0.65, mx);
          float mask = vDye * (1.0 - thread);
          float k = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.42;
          vec3 a = mix(diffuseColor.rgb, uColA * k, uAmtA * mask);
          vec3 b = mix(diffuseColor.rgb, uColB * k, uAmtB * mask);
          diffuseColor.rgb = mix(a, b, smoothstep(uSweep - 0.025, uSweep + 0.025, vWY));
          float seam = exp(-pow((vWY - uSweep) * 55.0, 2.0)) * mask;
          totalEmissiveRadiance += vec3(1.0, 0.78, 0.42) * seam * 0.55;
        }`);
  };
  material.customProgramCacheKey = () => 'gown-dye';
};

// ---------- Gold dust ----------
const makeDust = (count) => {
  const geo = new BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 0.18 + Math.pow(Math.random(), 1.6) * 0.55;
    const a = Math.random() * TAU;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 1.3;
    pos[i * 3 + 2] = Math.sin(a) * r * 0.8;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('seed', new BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uFade: { value: 0 } },
    vertexShader: `
      attribute float seed; uniform float uTime; uniform float uPx; varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * (0.018 + seed * 0.025);
        p.y = mod(p.y + t, 1.4) - 0.05;
        p.x += sin(uTime * 0.3 + seed * 40.0) * 0.03;
        p.z += cos(uTime * 0.25 + seed * 30.0) * 0.03;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.55 + 0.45 * sin(uTime * (1.2 + seed * 2.5) + seed * 60.0);
        vA = tw * smoothstep(-0.05, 0.2, p.y) * (1.0 - smoothstep(1.1, 1.35, p.y));
        gl_PointSize = uPx * (1.0 + seed * 1.8) * (2.2 / -mv.z);
      }`,
    fragmentShader: `
      uniform float uFade; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float g = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.84, 0.56), g * g * vA * uFade * 0.55);
      }`,
  });
  return new Points(geo, mat);
};

// soft light pool under the gown
const makePool = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,232,196,0.2)');
  grad.addColorStop(0.5, 'rgba(255,226,190,0.06)');
  grad.addColorStop(1, 'rgba(255,226,190,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(new PlaneGeometry(2.4, 2.4), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.001;
  return m;
};

async function init() {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    fail();
    return;
  }
  if (!renderer.capabilities.isWebGL2) { fail(); return; }

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new PerspectiveCamera(30, 1, 0.02, 30);

  // key: warm spotlight from above-front-left; follows the pointer a little
  const key = new SpotLight(0xfff0d8, 26, 8, 0.42, 0.75, 1.2);
  key.position.set(-1.1, 2.6, 1.6);
  key.target.position.set(0, 0.45, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  scene.add(key, key.target);

  // rim: cool celadon backlight to cut the silhouette out of the dark
  const rim = new DirectionalLight(0xcfeee0, 2.4);
  rim.position.set(1.4, 1.6, -2.2);
  scene.add(rim);
  const fill = new DirectionalLight(0xffe6c8, 0.35);
  fill.position.set(1.8, 0.8, 1.5);
  scene.add(fill);

  const floor = new Mesh(new PlaneGeometry(6, 6), new ShadowMaterial({ opacity: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor, makePool());

  const dust = makeDust(window.innerWidth < 760 ? 90 : 160);
  scene.add(dust);

  const gown = new Group();
  scene.add(gown);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await loader.loadAsync(canvas.dataset.model, (e) => {
      if (e.lengthComputable && loaderEl) loaderEl.style.setProperty('--load', (e.loaded / e.total).toFixed(3));
    });
  } catch (e) {
    fail();
    return;
  }
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    patchDye(o.material);
  });
  gown.add(gltf.scene);

  // ---------- sizing ----------
  let W = 0, H = 0, compact = false;
  const resize = () => {
    W = canvas.clientWidth; H = canvas.clientHeight;
    compact = W < 900;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.75 : 2));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    dust.material.uniforms.uPx.value = renderer.getPixelRatio() * (H / 900) * 2.2;
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- inputs: scroll chapter, pointer, drag ----------
  const chapters = KEYS.length - 1;
  const scrollProgress = () => {
    const r = stageEl.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    return span > 0 ? MathUtils.clamp(-r.top / span, 0, 1) * chapters : 0;
  };
  let p = scrollProgress();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  let spin = 0, spinVel = 0, dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); root.classList.add('is-dragging'); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    spinVel = dx * 0.008;
    spin += spinVel;
  });
  const endDrag = () => { dragging = false; root.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { spin -= 0.3; e.preventDefault(); }
    if (e.key === 'ArrowRight') { spin += 0.3; e.preventDefault(); }
  });

  // ---------- colorway ----------
  const swatches = [...document.querySelectorAll('[data-colorway]')];
  let dyeAnim = null;
  const setColorway = (name) => {
    const cw = COLORWAYS[name];
    if (!cw) return;
    // current look becomes A; B sweeps in from the top
    dye.uColA.value.copy(dye.uColB.value); dye.uAmtA.value = dye.uAmtB.value;
    dye.uColB.value.set(cw.color); dye.uAmtB.value = cw.amount;
    dyeAnim = { t0: performance.now(), dur: reduceMotion.matches ? 1 : 1500 };
    swatches.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.colorway === name)));
    const label = document.getElementById('colorway-name');
    if (label) label.textContent = swatches.find((b) => b.dataset.colorway === name)?.dataset.label || '';
  };
  swatches.forEach((b) => b.addEventListener('click', () => setColorway(b.dataset.colorway)));

  // ---------- intro & loop ----------
  const t0 = performance.now();
  let intro = reduceMotion.matches ? 1 : 0;
  let visible = true, raf = 0;
  const cur = { pos: new Vector3(), tgt: new Vector3(), rot: 0, offX: 0, offY: 0 };
  const tmpA = new Vector3(), tmpB = new Vector3();
  const ease = (x) => x * x * (3 - 2 * x);

  const sample = (q) => {
    const i = Math.min(Math.floor(q), chapters - 1);
    const f = ease(MathUtils.clamp(q - i, 0, 1));
    const a = KEYS[i], b = KEYS[i + 1];
    return {
      pos: tmpA.fromArray(a.pos).lerp(tmpB.fromArray(b.pos), f).clone(),
      tgt: tmpA.fromArray(a.tgt).lerp(tmpB.fromArray(b.tgt), f).clone(),
      rot: MathUtils.lerp(a.rot, b.rot, f),
      offX: MathUtils.lerp(a.offX, b.offX, f),
    };
  };
  const first = sample(p);
  cur.pos.copy(first.pos); cur.tgt.copy(first.tgt); cur.rot = first.rot;

  const frame = (now) => {
    const time = (now - t0) / 1000;
    const still = reduceMotion.matches;
    const ie = 1 - Math.pow(1 - intro, 3);

    // scroll-directed camera (reduced motion: hold the hero framing)
    const target = sample(still ? 0 : scrollProgress());
    const dt = Math.min(0.25, (now - (frame.last || now)) / 1000); frame.last = now;
    const k = still || !frame.last0 ? 1 : 1 - Math.exp(-dt * 3.2);
    frame.last0 = true;
    if (!still) intro = Math.min(1, intro + dt / 1.8);
    // phones: pull back so the gown sits in the upper half, copy below
    if (compact) target.pos.sub(target.tgt).multiplyScalar(target.pos.distanceTo(target.tgt) < 1.2 ? 1.25 : 1.32).add(target.tgt);
    cur.pos.lerp(target.pos, k);
    cur.tgt.lerp(target.tgt, k);
    cur.rot += (target.rot - cur.rot) * k;
    cur.offX += ((compact ? 0 : target.offX) - cur.offX) * k;
    cur.offY += ((compact ? 0.17 : 0) - cur.offY) * k;

    if (!dragging) { spin += spinVel; spinVel *= Math.pow(0.94, dt * 60); }
    const kp = 1 - Math.exp(-dt * 3);
    pointer.sx += (pointer.x - pointer.sx) * kp;
    pointer.sy += (pointer.y - pointer.sy) * kp;

    gown.rotation.y = cur.rot + spin + (still ? 0 : pointer.sx * 0.25);
    camera.position.copy(cur.pos);
    camera.position.z += (1 - ie) * 0.12;
    camera.position.y -= still ? 0 : pointer.sy * 0.04;
    camera.lookAt(cur.tgt);
    if (W && H) camera.setViewOffset(W, H, -cur.offX * W, cur.offY * H, W, H);

    key.position.x = -1.1 + (still ? 0 : pointer.sx * 1.2);
    key.position.z = 1.6 - (still ? 0 : pointer.sy * 0.6);

    dust.material.uniforms.uTime.value = still ? 0 : time;
    dust.material.uniforms.uFade.value = ie;

    if (dyeAnim) {
      const q = Math.min(1, (now - dyeAnim.t0) / dyeAnim.dur);
      dye.uSweep.value = MathUtils.lerp(1.08, -0.08, 1 - Math.pow(1 - q, 2));
      if (q >= 1) { dye.uColA.value.copy(dye.uColB.value); dye.uAmtA.value = dye.uAmtB.value; dye.uSweep.value = -1; dyeAnim = null; }
    }

    renderer.render(scene, camera);
    if (!root.classList.contains('stage-live')) {
      root.classList.add('stage-live');
    }

    const animating = !still || dyeAnim || dragging || Math.abs(spinVel) > 1e-4;
    raf = (visible && !document.hidden && animating) ? requestAnimationFrame(frame) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(stageEl);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  window.addEventListener('scroll', kick, { passive: true });
  canvas.addEventListener('pointerdown', kick);
  window.addEventListener('pointermove', () => { if (!reduceMotion.matches) kick(); }, { passive: true });
  swatches.forEach((b) => b.addEventListener('click', kick));
  reduceMotion.addEventListener('change', kick);
  new ResizeObserver(kick).observe(canvas);

  // compile before first visible frame to avoid a hitch
  renderer.compile(scene, camera);
  kick();
}

init();
