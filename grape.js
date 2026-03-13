/**
 * grape.js — Photo-realistic 3-D grape cluster using Three.js.
 * Modelled after real Cabernet/Concord-style dark blue grapes:
 *   - Deep indigo-blue base colour with pruina (bloom) effect
 *   - Tight organic cluster, wide at top, tapering to a tip
 *   - Strong key light → bright specular; deep inter-berry shadows
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ── Layout ────────────────────────────────────────────────────────
// [x, y, z, radius]  — 23 berries in an organic cone cluster.
// Back-layer berries (z ≈ -0.6 → -0.75) give depth; front-layer
// berries (z ≈ 0.3 → 0.45) sit closest to the camera.
const LAYOUT = [
  // ── Top row — 4 berries (wide shoulder) ──────────────────────
  [-2.05,  2.72, -0.18, 0.52],
  [-0.65,  2.88, -0.08, 0.54],
  [ 0.72,  2.82, -0.14, 0.53],
  [ 2.08,  2.68, -0.22, 0.52],

  // ── Upper-mid — 5 berries ─────────────────────────────────────
  [-2.72,  1.82, -0.04, 0.53],
  [-1.30,  1.94,  0.22, 0.55],
  [ 0.06,  1.98,  0.26, 0.55],
  [ 1.42,  1.88,  0.18, 0.55],
  [ 2.68,  1.76, -0.08, 0.52],

  // ── Middle — 4 berries ────────────────────────────────────────
  [-2.00,  0.97,  0.12, 0.54],
  [-0.64,  1.02,  0.36, 0.55],
  [ 0.72,  0.94,  0.32, 0.55],
  [ 2.02,  0.88,  0.06, 0.53],

  // ── Lower-mid — 3 berries (cluster narrowing) ─────────────────
  [-1.30,  0.06,  0.22, 0.54],
  [ 0.06,  0.02,  0.40, 0.55],
  [ 1.36, -0.04,  0.20, 0.53],

  // ── Lower — 2 berries ─────────────────────────────────────────
  [-0.64, -0.86,  0.24, 0.52],
  [ 0.72, -0.90,  0.20, 0.52],

  // ── Tip — 1 berry ─────────────────────────────────────────────
  [ 0.04, -1.66,  0.10, 0.48],

  // ── Back-layer berries (peek out for depth) ───────────────────
  [-1.30,  2.22, -0.72, 0.50],
  [ 1.36,  2.26, -0.76, 0.50],
  [ 0.04,  1.42, -0.66, 0.52],
  [-1.30,  0.57, -0.56, 0.51],
];

export const TOTAL_BERRIES = LAYOUT.length; // 23
export const BERRY_HUES    = Array.from({ length: TOTAL_BERRIES }, (_, i) => (i * 16) % 360);

// Subtle per-berry colour variation — all deep indigo-blue
const BASE_COLORS = [
  0x181575, 0x161470, 0x1a1878, 0x14126a,
  0x1c1a7c, 0x181576, 0x161470, 0x1a1878, 0x14126a,
  0x1c1a7e, 0x181576, 0x1a187a, 0x161470,
  0x181578, 0x1a187c, 0x161472,
  0x18157a, 0x161470,
  0x181574,
  0x141268, 0x141268, 0x161470, 0x141268,
];

export class GrapeCluster {
  constructor(containerEl) {
    this.container = containerEl;
    this.popped    = new Set();
    this.onBerryPop = null;

    this._poppingMeshes = [];
    this._hoverMesh     = null;

    this._initRenderer();
    this._initScene();
    this._buildGrape();
    this._attachEvents();
  }

  // ── Renderer & camera ─────────────────────────────────────────

  _initRenderer() {
    this._W = 440;
    this._H = 490;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this._W, this._H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;

    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(54, this._W / this._H, 0.1, 60);
    this.camera.position.set(0, 0.80, 8.2);
    this.camera.lookAt(0, 0.65, 0);
  }

  _initScene() {
    this.scene = new THREE.Scene();

    // Room environment — feeds the clearcoat reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env).texture;
    env.dispose();
    pmrem.dispose();

    // ── Lights ────────────────────────────────────────────────

    // Very dark purple-blue ambient — deep inter-berry shadows
    this.scene.add(new THREE.AmbientLight(0x05041a, 3.0));

    // Strong key light — white, upper-left-front.
    // Creates the bright, clean specular spot seen in the reference.
    const key = new THREE.DirectionalLight(0xffffff, 7.5);
    key.position.set(-2.2, 4.0, 5.0);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(1024);
    key.shadow.camera.near   =  1;
    key.shadow.camera.far    = 20;
    key.shadow.camera.left   = key.shadow.camera.bottom = -5.5;
    key.shadow.camera.right  = key.shadow.camera.top    =  5.5;
    this.scene.add(key);

    // Cool blue rim from the right — accentuates berry silhouettes
    const rim = new THREE.DirectionalLight(0x3050d0, 2.2);
    rim.position.set(3.5, 1.5, -3.0);
    this.scene.add(rim);

    // Faint warm fill from below — subtle bounce light
    const fill = new THREE.PointLight(0xff9050, 1.0, 16);
    fill.position.set(0.5, -5.5, 3.5);
    this.scene.add(fill);
  }

  // ── Grape geometry ────────────────────────────────────────────

  _buildGrape() {
    this.berryMeshes = [];
    // Shared high-poly sphere (64 seg = very smooth)
    const geo = new THREE.SphereGeometry(1, 64, 64);

    LAYOUT.forEach(([x, y, z, r], i) => {
      // Pruina (bloom) effect: moderate roughness for the matte waxy skin,
      // clearcoat adds the bright glossy specular on top.
      const mat = new THREE.MeshPhysicalMaterial({
        color:              new THREE.Color(BASE_COLORS[i]),
        roughness:          0.32,          // the matte "bloom" skin
        metalness:          0.0,
        clearcoat:          0.92,          // glassy thin-film on top of skin
        clearcoatRoughness: 0.08,
        reflectivity:       0.72,
        envMapIntensity:    1.1,
        sheen:              0.35,          // soft fabric-like skin sheen
        sheenRoughness:     0.75,
        sheenColor:         new THREE.Color(0x2030c0),
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(r);
      mesh.position.set(x, y, z);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      mesh.userData.berryId   = i;
      mesh.userData.origScale = r;

      this.scene.add(mesh);
      this.berryMeshes.push(mesh);
    });

    this._buildStem();
    this._buildLeaf();
  }

  _buildStem() {
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x4a3210, roughness: 0.85, metalness: 0.0,
    });

    // Main stem
    const main = new THREE.CubicBezierCurve3(
      new THREE.Vector3( 0.00,  3.20, -0.28),
      new THREE.Vector3( 0.08,  3.96, -0.46),
      new THREE.Vector3( 0.22,  4.64, -0.58),
      new THREE.Vector3( 0.36,  5.28, -0.68),
    );
    this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(main, 14, 0.07, 8, false), stemMat));

    // Delicate tendril
    const tendril = new THREE.CubicBezierCurve3(
      new THREE.Vector3( 0.00,  3.90, -0.38),
      new THREE.Vector3(-0.38,  4.18, -0.48),
      new THREE.Vector3(-0.82,  3.96, -0.28),
      new THREE.Vector3(-0.94,  3.64, -0.16),
    );
    this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(tendril, 8, 0.022, 6, false), stemMat));
  }

  _buildLeaf() {
    // Two-lobe vine leaf shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-0.5,  0.6, -1.1,  1.4, -0.5,  2.2);
    shape.bezierCurveTo(-0.1,  2.8,  0.4,  2.8,  0.8,  2.4);
    shape.bezierCurveTo( 1.4,  1.8,  1.2,  0.8,  1.8,  0.4);
    shape.bezierCurveTo( 1.6,  0.0,  0.8, -0.2,  0.4,  0.2);
    shape.bezierCurveTo( 0.2,  0.4, -0.1,  0.3,  0,    0);

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2e8a08, roughness: 0.70, metalness: 0.0, side: THREE.DoubleSide,
    });
    const leaf = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), leafMat);
    leaf.position.set(-0.12, 4.86, -0.52);
    leaf.rotation.set(0.16, 0.18, -0.28);
    this.scene.add(leaf);

    // Vein
    const veinMat = new THREE.LineBasicMaterial({ color: 0x1c5c04 });
    const veinGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(0.4, 1.1, 0.02), new THREE.Vector3(0.6, 2.0, 0.02),
    ]);
    const vein = new THREE.Line(veinGeo, veinMat);
    vein.position.copy(leaf.position);
    vein.rotation.copy(leaf.rotation);
    this.scene.add(vein);
  }

  // ── Events ────────────────────────────────────────────────────

  _attachEvents() {
    const canvas = this.renderer.domElement;
    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();

    const coords = (e) => {
      const rect = canvas.getBoundingClientRect();
      // touchend: e.touches is empty — must use changedTouches instead
      const src  = (e.changedTouches && e.changedTouches[0])
                || (e.touches        && e.touches[0])
                || e;
      return {
        nx: ((src.clientX - rect.left) / rect.width)  * 2 - 1,
        ny: -((src.clientY - rect.top)  / rect.height) * 2 + 1,
        cx: src.clientX, cy: src.clientY,
      };
    };

    canvas.addEventListener('click', (e) => {
      const { nx, ny, cx, cy } = coords(e);
      this._tryPop(nx, ny, cx, cy);
    });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const { nx, ny, cx, cy } = coords(e);
      this._tryPop(nx, ny, cx, cy);
    }, { passive: false });

    canvas.addEventListener('mousemove', (e) => {
      const { nx, ny } = coords(e);
      this._mouse.set(nx, ny);
      this._raycaster.setFromCamera(this._mouse, this.camera);
      const hits = this._raycaster.intersectObjects(this.berryMeshes);
      const hit  = hits.length ? hits[0].object : null;
      if (hit !== this._hoverMesh) {
        if (this._hoverMesh) this._hoverMesh.material.emissiveIntensity = 0;
        this._hoverMesh = hit;
        if (hit) {
          hit.material.emissive          = new THREE.Color(0x1a1060);
          hit.material.emissiveIntensity = 0.5;
        }
        canvas.style.cursor = hit ? 'pointer' : 'default';
      }
    });
  }

  _tryPop(nx, ny, cx, cy) {
    this._mouse.set(nx, ny);
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this._raycaster.intersectObjects(this.berryMeshes);
    if (!hits.length) return;

    const mesh = hits[0].object;
    const id   = mesh.userData.berryId;
    if (this.popped.has(id)) return;
    this.popped.add(id);
    if (this._hoverMesh === mesh) this._hoverMesh = null;

    this._poppingMeshes.push({ mesh, startTime: performance.now(), origScale: mesh.userData.origScale });

    // Project 3-D position to viewport for the firework
    const pos = new THREE.Vector3(...LAYOUT[id].slice(0, 3));
    pos.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const vpX  = (pos.x + 1) / 2 * rect.width  + rect.left;
    const vpY  = (1 - pos.y) / 2 * rect.height + rect.top;

    this._splatter(vpX, vpY);
    if (this.onBerryPop) this.onBerryPop(id, vpX, vpY, BERRY_HUES[id]);
  }

  _splatter(cx, cy) {
    for (let i = 0; i < 9; i++) {
      const dot = document.createElement('div');
      dot.className = 'splatter';
      const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
      const dist  = 20 + Math.random() * 32;
      dot.style.left = `${cx}px`;
      dot.style.top  = `${cy}px`;
      dot.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      dot.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      const sz = 4 + Math.random() * 7;
      dot.style.width  = `${sz}px`;
      dot.style.height = `${sz}px`;
      dot.style.background = `hsla(${240 + Math.floor(Math.random() * 30)},70%,32%,0.9)`;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 750);
    }
  }

  // ── Tick ──────────────────────────────────────────────────────

  tick() {
    const now = performance.now();
    for (let i = this._poppingMeshes.length - 1; i >= 0; i--) {
      const p = this._poppingMeshes[i];
      const t = (now - p.startTime) / 160;
      const s = Math.max(0, 1 - t);
      p.mesh.scale.setScalar(s * p.origScale);
      if (s <= 0) {
        p.mesh.visible = false;
        this._poppingMeshes.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  get totalBerries() { return TOTAL_BERRIES; }
  get poppedCount()  { return this.popped.size; }
  isAllPopped()      { return this.popped.size >= TOTAL_BERRIES; }

  hide() {
    this.container.style.transition = 'opacity 0.8s ease';
    this.container.style.opacity    = '0';
    setTimeout(() => { this.container.style.display = 'none'; }, 900);
  }
}
