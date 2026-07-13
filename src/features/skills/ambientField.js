/**
 * ambientField.js
 * ---------------
 * A lightweight, reusable Three.js scene mounted behind a single page
 * section. Renders a sparse field of floating soft-lit forms — the
 * exact geometry/material depends on `motif`, so each section gets a
 * visually distinct 3D idea (glass shards, drifting paper planes, dust
 * motes, faceted gem blocks, soft orbs) while sharing one render-loop
 * implementation.
 *
 * Kept deliberately cheap and deliberately quiet: matte/soft materials
 * (no neon emissive), edge-biased placement so the content column stays
 * legible, capped pixel ratio, full teardown on unmount.
 */

const MOTIFS = {
  glass: {
    geo: "icosahedron",
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.5,
  },
  paper: {
    geo: "plane",
    roughness: 0.85,
    metalness: 0.0,
    transparent: false,
    opacity: 1,
  },
  dust: {
    geo: "sphere",
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.7,
  },
  gem: {
    geo: "octahedron",
    roughness: 0.25,
    metalness: 0.35,
    transparent: false,
    opacity: 1,
  },
  orb: {
    geo: "sphere",
    roughness: 0.35,
    metalness: 0.0,
    transparent: true,
    opacity: 0.85,
  },
  shard: {
    geo: "shard",
    roughness: 0.2,
    metalness: 0.5,
    transparent: false,
    opacity: 1,
  },
  halo: {
    geo: "torus",
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.65,
  },
};

export class AmbientField {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} opts.container   element to size/observe against
   * @param {string} opts.color            base hex color for the forms
   * @param {string} [opts.lightColor]     hex color of the key light (defaults to color)
   * @param {keyof MOTIFS} [opts.motif]    visual motif - glass | paper | dust | gem | orb
   * @param {number} [opts.count]          how many shapes to float
   * @param {number} [opts.parallax]       0..1, how much scroll affects depth drift
   */
  constructor({
    canvas,
    container,
    color = "#C9B79F",
    lightColor,
    motif = "glass",
    count = 10,
    parallax = 0.4,
  }) {
    this.canvas = canvas;
    this.container = container;
    this.color = color;
    this.lightColor = lightColor || color;
    this.motif = MOTIFS[motif] ? motif : "glass";
    this.count = count;
    this.parallax = parallax;
    this.disposed = false;
    this.scrollFrac = 0; // 0..1 progress through this section, set externally
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

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 14);
    this.camera = camera;

    const base = new THREE.Color(this.color);
    const lightCol = new THREE.Color(this.lightColor);

    const hemi = new THREE.HemisphereLight(0xfff8ee, 0xe2d8c8, 0.85);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(lightCol, 0.9);
    key.position.set(5, 6, 6);
    scene.add(key);

    const def = MOTIFS[this.motif];
    const geometry = this._buildGeometry(THREE, def.geo);

    const material = new THREE.MeshStandardMaterial({
      color: base,
      roughness: def.roughness,
      metalness: def.metalness,
      transparent: def.transparent,
      opacity: def.opacity,
    });
    this.material = material;

    // Edge-weighted placement: keep the central ~50% of the viewport clear
    // so shapes read as atmosphere framing the content, not clutter on top
    // of it.
    this.meshes = [];
    for (let i = 0; i < this.count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      const side = i % 2 === 0 ? -1 : 1;
      const xEdge = side * (3.4 + Math.random() * 4.8);
      mesh.position.set(
        xEdge,
        (Math.random() - 0.5) * 10,
        -3 - Math.random() * 8,
      );
      const s =
        this.motif === "dust"
          ? 0.08 + Math.random() * 0.14
          : 0.24 + Math.random() * 0.38;
      mesh.scale.setScalar(s);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      mesh.userData.spin = {
        x: (Math.random() - 0.5) * (this.motif === "paper" ? 0.05 : 0.18),
        y: (Math.random() - 0.5) * (this.motif === "paper" ? 0.05 : 0.18),
        z: (Math.random() - 0.5) * 0.1,
      };
      mesh.userData.bob = {
        amp:
          this.motif === "dust"
            ? 0.9 + Math.random() * 0.9
            : 0.4 + Math.random() * 0.6,
        speed:
          this.motif === "dust"
            ? 0.12 + Math.random() * 0.18
            : 0.25 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        baseY: mesh.position.y,
      };
      scene.add(mesh);
      this.meshes.push(mesh);
    }

    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);

    this.clock = new THREE.Clock();
    this._animId = requestAnimationFrame(() => this._tick());
  }

  _buildGeometry(THREE, kind) {
    switch (kind) {
      case "plane":
        return new THREE.PlaneGeometry(1.3, 0.85);
      case "sphere":
        return new THREE.SphereGeometry(0.6, 20, 20);
      case "octahedron":
        return new THREE.OctahedronGeometry(0.85, 0);
      case "shard":
        return new THREE.ConeGeometry(0.42, 1.5, 4, 1);
      case "torus":
        return new THREE.TorusGeometry(0.6, 0.16, 12, 28);
      default:
        return new THREE.IcosahedronGeometry(0.85, 0);
    }
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

    for (const mesh of this.meshes) {
      const { spin, bob } = mesh.userData;
      mesh.rotation.x += spin.x * 0.01;
      mesh.rotation.y += spin.y * 0.01;
      mesh.rotation.z += spin.z * 0.01;
      mesh.position.y =
        bob.baseY + Math.sin(t * bob.speed + bob.phase) * bob.amp;
    }

    const depthShift = (this.scrollFrac - 0.5) * this.parallax * 6;
    this.camera.position.z = 14 - depthShift;
    this.camera.position.y = depthShift * 0.25;

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
    if (this.meshes) {
      for (const m of this.meshes) this.scene?.remove(m);
    }
    this.material?.dispose();
    this.meshes?.[0] && this.meshes[0].geometry?.dispose();
    this.renderer?.dispose();
  }
}
