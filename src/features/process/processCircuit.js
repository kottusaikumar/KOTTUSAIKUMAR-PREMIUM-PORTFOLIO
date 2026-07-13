/**
 * processCircuit.js
 * -------------------
 * Bespoke Three.js scene for the Process section — a "circuit board"
 * schematic, deliberately different in KIND from Experience's organic
 * curve-reveal:
 *   - Orthogonal traces (right-angle risers), not a smooth curve
 *   - A distinct geometric primitive PER STEP (tetrahedron / octahedron /
 *     box / cone) instead of uniform spheres — variety within the section
 *   - Small pulse packets flow continuously along the trace at all times
 *     (ambient "current flowing through the pipeline"), independent of
 *     scroll — whereas Experience's motion is entirely scroll-driven
 *   - Scroll progress still separately controls which node is "powered on"
 *     (lit chip), so scrolling still tells the step-by-step story
 */

export class ProcessCircuit {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} opts.container
   * @param {string} opts.color        base trace/node color
   * @param {string} [opts.lightColor] pulse/highlight color
   * @param {number} opts.stepCount    number of pipeline steps
   */
  constructor({
    canvas,
    container,
    color = "#A97846",
    lightColor,
    stepCount = 4,
    rainbow = false,
  }) {
    this.canvas = canvas;
    this.container = container;
    this.color = color;
    this.lightColor = lightColor || color;
    this.rainbow = rainbow;
    this.stepCount = Math.max(1, stepCount);
    this.disposed = false;
    this.scrollFrac = 0;
    this.litLevels = new Array(this.stepCount).fill(0);
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

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.15, 6.4);
    this.camera = camera;

    const base = new THREE.Color(this.color);
    const pulseCol = new THREE.Color(this.lightColor);

    scene.add(new THREE.HemisphereLight(0xfff6ea, 0xe8dcc8, 0.75));
    const key = new THREE.DirectionalLight(pulseCol, 0.9);
    key.position.set(3, 5, 6);
    scene.add(key);

    const n = this.stepCount;
    const span = 8.6;
    const startX = -span / 2;
    const stepX = n > 1 ? span / (n - 1) : 0;

    // Node x-positions and alternating riser direction (up/down) for a
    // blueprint zigzag rather than a flat line.
    this.nodeX = [];
    for (let i = 0; i < n; i++) this.nodeX.push(startX + i * stepX);
    const riserY = 0.85;

    // ── Main horizontal trace (thin box) ────────────────────────────
    const traceGeo = new THREE.BoxGeometry(span + 0.6, 0.045, 0.045);
    const traceMat = new THREE.MeshStandardMaterial({
      color: base,
      emissive: base,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.2,
    });
    const trace = new THREE.Mesh(traceGeo, traceMat);
    scene.add(trace);
    this.trace = trace;

    // ── Per-node riser stub + distinct primitive "chip" ─────────────
    const shapeGeos = [
      new THREE.TetrahedronGeometry(0.46),
      new THREE.OctahedronGeometry(0.44),
      new THREE.BoxGeometry(0.62, 0.62, 0.62),
      new THREE.ConeGeometry(0.4, 0.76, 4),
    ];
    const riserGeo = new THREE.CylinderGeometry(0.02, 0.02, riserY, 6);
    const ringGeo = new THREE.TorusGeometry(0.62, 0.026, 8, 28);

    this.nodes = [];
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const x = this.nodeX[i];
      const nodeY = dir * riserY;

      const riser = new THREE.Mesh(
        riserGeo,
        new THREE.MeshStandardMaterial({
          color: base,
          roughness: 0.5,
          metalness: 0.15,
        }),
      );
      riser.position.set(x, nodeY / 2, 0);
      scene.add(riser);

      const shapeGeo = shapeGeos[i % shapeGeos.length];
      const nodeCol = this.rainbow
        ? new THREE.Color().setHSL(((i / n) * 0.82 + 0.0) % 1, 0.72, 0.56)
        : base;
      const ringCol = this.rainbow
        ? new THREE.Color().setHSL(((i / n) * 0.82 + 0.04) % 1, 0.85, 0.64)
        : pulseCol;
      const mat = new THREE.MeshStandardMaterial({
        color: nodeCol,
        emissive: nodeCol,
        emissiveIntensity: 0.15,
        roughness: 0.28,
        metalness: 0.25,
        transparent: true,
        opacity: 0.6,
      });
      const shape = new THREE.Mesh(shapeGeo, mat);
      shape.position.set(x, nodeY, 0);
      scene.add(shape);

      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: ringCol,
          transparent: true,
          opacity: 0,
        }),
      );
      ring.position.set(x, nodeY, 0);
      scene.add(ring);

      this.nodes.push({
        t: n === 1 ? 0.5 : i / (n - 1),
        x,
        y: nodeY,
        riser,
        shape,
        mat,
        ring,
        ringMat: ring.material,
        spinSpeed: 0.25 + (i % 3) * 0.12,
      });
    }

    // ── Continuously flowing pulse packets along the main trace ─────
    const pulseGeo = new THREE.SphereGeometry(0.075, 12, 12);
    const pulseCount = 6;
    this.pulses = [];
    for (let i = 0; i < pulseCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: pulseCol,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(pulseGeo, mat);
      scene.add(mesh);
      this.pulses.push({ mesh, offset: i / pulseCount });
    }
    this.traceHalfSpan = (span + 0.6) / 2;

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

  _tick() {
    if (this.disposed) return;
    const t = this.clock.getElapsedTime();

    // Flowing pulse packets — continuous ambient motion, independent
    // of scroll, moving left-to-right and looping.
    const speed = 0.16;
    for (const p of this.pulses) {
      const loopT = (t * speed + p.offset) % 1;
      p.mesh.position.x = -this.traceHalfSpan + loopT * this.traceHalfSpan * 2;
      p.mesh.position.y = 0;
      p.mesh.position.z = 0.02;
      // Fade in/out at the very ends so packets don't pop.
      const edgeFade = Math.min(loopT / 0.06, (1 - loopT) / 0.06, 1);
      p.mesh.material.opacity = 0.85 * edgeFade;
    }

    // Scroll-driven node activation: powered on once scroll passes
    // that node's fraction along the section.
    const progress = Math.min(1, Math.max(0, this.scrollFrac));
    for (const nd of this.nodes) {
      const idx = this.nodes.indexOf(nd);
      const target = progress >= nd.t - 0.02 ? 1 : 0;
      this.litLevels[idx] += (target - this.litLevels[idx]) * 0.07;
      const lit = this.litLevels[idx];

      nd.mat.emissiveIntensity = 0.15 + lit * 1.5;
      nd.mat.opacity = 0.6 + lit * 0.4;
      const scale = 1 + lit * 0.35;
      nd.shape.scale.setScalar(scale);
      nd.shape.rotation.x = t * nd.spinSpeed;
      nd.shape.rotation.y = t * nd.spinSpeed * 0.8;

      nd.ringMat.opacity = lit * 0.55;
      nd.ring.scale.setScalar(1 + Math.sin(t * 1.4 + idx) * 0.06 * lit);
      nd.ring.rotation.z = t * 0.3;
    }

    // Gentle whole-scene parallax breathing.
    this.camera.position.y = 0.15 + Math.sin(t * 0.12) * 0.06;
    this.camera.position.x = Math.sin(t * 0.07) * 0.2;
    this.camera.lookAt(0, 0, 0);

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
    this.trace?.geometry?.dispose();
    this.trace?.material?.dispose();
    this.nodes?.forEach((nd) => {
      nd.riser.geometry?.dispose();
      nd.riser.material?.dispose();
      nd.shape.geometry?.dispose();
      nd.mat.dispose();
      nd.ring.geometry?.dispose();
      nd.ringMat.dispose();
    });
    this.pulses?.forEach((p) => {
      p.mesh.geometry?.dispose();
      p.mesh.material?.dispose();
    });
    this.renderer?.dispose();
  }
}
