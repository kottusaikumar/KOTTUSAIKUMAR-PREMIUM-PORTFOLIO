/**
 * proofRadar.js
 * --------------
 * Bespoke Three.js scene for the Proof section — a radar/sonar scanner,
 * mechanically distinct from all four previous bespoke scenes:
 *   - Experience = a path drawn once, left to right
 *   - Process    = an orthogonal circuit with flowing pulses
 *   - About      = a slow multi-plane ambient orbit
 *   - Work       = a fixed arc + a moving spotlight "selecting" pieces
 *   - Proof      = a continuously sweeping radar beam + expanding ping
 *                  rings, evoking an always-on verification system
 *                  ("these results are real and re-confirmed"), rather
 *                  than a one-time reveal. Scroll only fades/scales the
 *                  assembly in — the sweep itself runs autonomously,
 *                  since "proof" is a standing state, not a journey.
 */

export class ProofRadar {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} opts.container
   * @param {string} opts.color        base ring/node color
   * @param {string} [opts.lightColor] sweep/ping highlight color
   * @param {number} opts.nodeCount    number of signal nodes (proof stats)
   */
  constructor({
    canvas,
    container,
    color = "#5C7CC4",
    lightColor,
    nodeCount = 4,
  }) {
    this.canvas = canvas;
    this.container = container;
    this.color = color;
    this.lightColor = lightColor || color;
    this.nodeCount = Math.max(1, nodeCount);
    this.disposed = false;
    this.scrollFrac = 0;
    this.entrance = 0; // smoothed 0..1
    this.pings = [];
    this._pingTimer = 0;
  }

  async init(THREE) {
    if (this.disposed) return;
    this.THREE = THREE;

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 5.6, 4.0); // angled radar-screen view, avoids
    camera.lookAt(0, 0, 0); // near-vertical gimbal instability
    this.camera = camera;

    const base = new THREE.Color(this.color);
    const sweepCol = new THREE.Color(this.lightColor);

    scene.add(new THREE.AmbientLight(0x2a3550, 0.6));
    const key = new THREE.DirectionalLight(0xdfe8ff, 0.4);
    key.position.set(2, 4, 2);
    scene.add(key);

    this.root = new THREE.Group();
    scene.add(this.root);

    // ── Static concentric rings (radar screen grid) ─────────────────
    const ringRadii = [0.9, 1.6, 2.3];
    this.rings = [];
    for (const r of ringRadii) {
      const geo = new THREE.RingGeometry(r - 0.006, r + 0.006, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: base,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      this.root.add(mesh);
      this.rings.push(mesh);
    }

    // ── Rotating sweep wedge ─────────────────────────────────────────
    const sweepGeo = new THREE.CircleGeometry(2.3, 40, 0, Math.PI / 5);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: sweepCol,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sweep = new THREE.Mesh(sweepGeo, sweepMat);
    this.sweep.rotation.x = -Math.PI / 2;
    this.root.add(this.sweep);

    // A thin bright leading edge on the sweep for a crisper beam line.
    const edgeGeo = new THREE.PlaneGeometry(2.3, 0.018);
    edgeGeo.translate(1.15, 0, 0);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: sweepCol,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sweepEdge = new THREE.Mesh(edgeGeo, edgeMat);
    this.sweepEdge.rotation.x = -Math.PI / 2;
    this.root.add(this.sweepEdge);

    // ── Signal nodes — one per proof stat, evenly spaced ────────────
    const nodeGeo = new THREE.OctahedronGeometry(0.11, 0);
    this.nodes = [];
    const n = this.nodeCount;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const radius = 1.6;
      const mat = new THREE.MeshStandardMaterial({
        color: base,
        emissive: sweepCol,
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.4,
      });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      this.root.add(mesh);
      this.nodes.push({ mesh, mat, angle });
    }

    // ── Ping pool (reused ring meshes, expand + fade on trigger) ────
    const pingGeo = new THREE.RingGeometry(0.98, 1.05, 48);
    this._pingGeo = pingGeo;
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: sweepCol,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(pingGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.root.add(mesh);
      this.pings.push({ mesh, mat, active: false, life: 0 });
    }

    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);

    this.clock = new THREE.Clock();
    this._animId = requestAnimationFrame(() => this._tick());
  }

  _resize() {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Call with 0..1 progress of this section through the viewport. */
  setScrollProgress(frac) {
    this.scrollFrac = frac;
  }

  _triggerPing() {
    const p = this.pings.find((p) => !p.active);
    if (!p) return;
    p.active = true;
    p.life = 0;
    p.mesh.visible = true;
  }

  _tick() {
    if (this.disposed) return;
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;

    // Entrance fade/scale tied to scroll — the only scroll-driven part.
    const target = this.scrollFrac > 0.02 ? 1 : 0;
    this.entrance += (target - this.entrance) * 0.05;
    this.root.scale.setScalar(0.75 + this.entrance * 0.25);

    // Continuous radar sweep rotation.
    const sweepAngle = t * 0.9;
    this.sweep.rotation.z = -sweepAngle;
    this.sweepEdge.rotation.z = -sweepAngle;

    // Light up nodes as the sweep passes them.
    for (const nd of this.nodes) {
      let diff =
        ((sweepAngle % (Math.PI * 2)) - nd.angle + Math.PI * 4) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      const glow = Math.max(0, 1 - Math.abs(diff) / 0.5);
      nd.mat.emissiveIntensity = 0.3 + glow * 1.6;
      const s = 1 + glow * 0.5;
      nd.mesh.scale.setScalar(s);
    }

    // Periodic ping rings.
    this._pingTimer += dt;
    if (this._pingTimer > 2.4) {
      this._pingTimer = 0;
      this._triggerPing();
    }
    for (const p of this.pings) {
      if (!p.active) continue;
      p.life += dt / 2.0; // ~2s lifetime
      if (p.life >= 1) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const scale = 0.15 + p.life * 2.4;
      p.mesh.scale.setScalar(scale);
      p.mat.opacity = (1 - p.life) * 0.5;
    }

    this.renderer.render(this.scene, this.camera);
    this._animId = requestAnimationFrame(() => this._tick());
  }

  // Stop/restart the render loop without touching scene state — used so
  // the section's Field wrapper can halt this WebGL render loop while
  // scrolled off-screen instead of rendering an invisible canvas forever.
  pause() {
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  resume() {
    if (this.disposed || this._animId) return;
    this._animId = requestAnimationFrame(() => this._tick());
  }

  dispose() {
    this.disposed = true;
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    this.rings?.forEach((r) => {
      r.geometry?.dispose();
      r.material?.dispose();
    });
    this.sweep?.geometry?.dispose();
    this.sweep?.material?.dispose();
    this.sweepEdge?.geometry?.dispose();
    this.sweepEdge?.material?.dispose();
    this.nodes?.forEach((nd) => {
      nd.mesh.geometry?.dispose();
      nd.mat.dispose();
    });
    this._pingGeo?.dispose();
    this.pings?.forEach((p) => p.mat.dispose());
    this.renderer?.dispose();
  }
}
