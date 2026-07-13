/**
 * experienceTimeline.js
 * ----------------------
 * Bespoke Three.js scene for the Experience section — NOT a variant of
 * the generic AmbientField motifs used elsewhere. Instead of floating
 * ambient shapes, this draws an actual 3D "career path": a glowing tube
 * that traces itself through depth as the visitor scrolls, with a lit
 * waypoint node for each role. As scroll progress passes a node's
 * position along the path, that node switches from dormant to lit —
 * literally visualizing "progress through a timeline", which is the
 * one thing this section is actually about.
 *
 * Built with a small custom shader (consistent with tunnelShader.js
 * elsewhere in this codebase) so the tube can reveal itself along its
 * length rather than simply fading in as a whole.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uColorA; // path start hue
  uniform vec3 uColorB; // path end hue
  uniform float uProgress; // 0..1, how much of the path is drawn
  varying vec2 vUv;

  #include <common>

  void main() {
    // TubeGeometry UV.x runs along the path length, UV.y around the radius.
    float along = vUv.x;
    if (along > uProgress) discard;

    // Bright traveling "comet head" at the drawing edge, fading to a
    // calmer (but still solid) line behind it.
    float edge = smoothstep(0.0, 0.09, uProgress - along);
    float head = 1.0 - smoothstep(0.0, 0.05, uProgress - along);
    float radialFade = 1.0;

    // Multi-colour gradient down the length so the line reads clearly
    // against the section background instead of blending into it.
    vec3 grad = along < 0.5
      ? mix(uColorA, uColor, along * 2.0)
      : mix(uColor, uColorB, (along - 0.5) * 2.0);
    vec3 col = mix(grad * 1.12, grad, edge);
    float alpha = clamp((0.96 + head * 0.04) * radialFade, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);

    // ShaderMaterial doesn't auto-apply output color-space conversion the
    // way built-in materials do — without this, uColor (already converted
    // to linear working space by Three's color management) gets displayed
    // as-is, which renders washed-out/pale instead of the intended hue.
    #include <colorspace_fragment>
  }
`;

export class ExperienceTimeline {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} opts.container
   * @param {string} opts.color        base hex color of the path/nodes
   * @param {string} [opts.lightColor] key light color
   * @param {number} opts.nodeCount    one node per timeline entry
   */
  constructor({
    canvas,
    container,
    color = "#9C8C7D",
    lightColor,
    nodeCount = 2,
  }) {
    this.canvas = canvas;
    this.container = container;
    this.color = color;
    this.lightColor = lightColor || color;
    // Solid high-contrast accents for the bright checker background.
    this.colorA = "#004F4D";
    this.colorB = "#9A6B00";
    this.nodeCount = Math.max(1, nodeCount);
    this.disposed = false;
    this.scrollFrac = 0;
    this.litLevels = new Array(this.nodeCount).fill(0); // smoothed 0..1 per node
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
    camera.position.set(0, 0, 13);
    this.camera = camera;

    const base = new THREE.Color(this.color);
    const lightCol = new THREE.Color(this.lightColor);
    const colA = new THREE.Color(this.colorA);
    const colB = new THREE.Color(this.colorB);

    scene.add(new THREE.HemisphereLight(0xfff8ee, 0xe2d8c8, 0.7));
    const key = new THREE.DirectionalLight(lightCol, 0.8);
    key.position.set(4, 6, 6);
    scene.add(key);

    // ── Build the path: a gentle zigzag descending through depth, one
    // control point per node plus lead-in/lead-out so the tube starts
    // and ends off-screen instead of abruptly. ──────────────────────
    const n = this.nodeCount;
    const points = [];
    const span = 9; // total vertical travel
    const top = span / 2;
    points.push(new THREE.Vector3(-2.6, top + 2.2, -3));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = (i % 2 === 0 ? -1 : 1) * 2.1;
      const y = top - t * span;
      const z = -2 - Math.sin(t * Math.PI) * 2.2;
      points.push(new THREE.Vector3(x, y, z));
    }
    points.push(new THREE.Vector3(2.6, -top - 2.2, -3));

    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);
    this.curve = curve;

    const tubeGeo = new THREE.TubeGeometry(curve, 220, 0.17, 16, false);
    const tubeMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: base },
        uColorA: { value: colA },
        uColorB: { value: colB },
        uProgress: { value: 0 },
      },
      transparent: true,
      depthWrite: true,
      blending: THREE.NormalBlending,
    });
    this.tubeMat = tubeMat;
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tube);
    this.tube = tube;

    // ── Waypoint nodes — one glowing sphere per role, positioned at an
    // even t-fraction along the same curve so they sit ON the path. ──
    const nodeGeo = new THREE.SphereGeometry(0.16, 20, 20);
    const haloGeo = new THREE.RingGeometry(0.22, 0.27, 32);
    this.nodes = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const pos = curve.getPointAt(t);

      // Give each waypoint its own warm paper-cut hue so nodes read as
      // distinct, premium accents rather than the same teal as the bg.
      const nodeCol = new THREE.Color()
        .copy(colA)
        .lerp(colB, n === 1 ? 0.5 : i / (n - 1));

      const mat = new THREE.MeshStandardMaterial({
        color: nodeCol,
        emissive: nodeCol,
        emissiveIntensity: 0.1,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
      });
      const node = new THREE.Mesh(nodeGeo, mat);
      node.position.copy(pos);
      scene.add(node);

      const halo = new THREE.Mesh(
        haloGeo,
        new THREE.MeshBasicMaterial({
          color: nodeCol,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        }),
      );
      halo.position.copy(pos);
      scene.add(halo);

      this.nodes.push({
        t,
        mesh: node,
        halo,
        mat,
        haloMat: halo.material,
        basePos: pos,
      });
    }

    // ── Sparse background dust for atmosphere/depth (cheap: Points) ──
    const dustCount = 60;
    const dustGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = -6 - Math.random() * 10;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: base,
      size: 0.045,
      transparent: true,
      opacity: 0.18,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(dustGeo, dustMat);
    scene.add(this.dust);

    this.group = new THREE.Group();
    [
      tube,
      this.dust,
      ...this.nodes.flatMap((nd) => [nd.mesh, nd.halo]),
    ].forEach((o) => this.group.add(o));
    scene.remove(
      tube,
      this.dust,
      ...this.nodes.flatMap((nd) => [nd.mesh, nd.halo]),
    );
    scene.add(this.group);

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

    // Draw the path up to current scroll progress (with a touch of lead).
    const drawProgress = Math.min(1, this.scrollFrac * 1.12);
    if (this.tubeMat) this.tubeMat.uniforms.uProgress.value = drawProgress;

    // Light up each node once the path has reached it; smooth the
    // transition so it reads as an "ignition" rather than a hard cut.
    for (let i = 0; i < this.nodes.length; i++) {
      const nd = this.nodes[i];
      const target = drawProgress >= nd.t ? 1 : 0;
      this.litLevels[i] += (target - this.litLevels[i]) * 0.06;
      const lit = this.litLevels[i];

      nd.mat.emissiveIntensity = 0.1 + lit * 1.6;
      nd.mat.opacity = 0.9 + lit * 0.1;
      const scale = 1 + lit * 0.55 + Math.sin(t * 1.6 + i) * 0.04 * lit;
      nd.mesh.scale.setScalar(scale);

      nd.haloMat.opacity = lit * 0.5;
      nd.halo.scale.setScalar(
        1 + Math.sin(t * 1.2 + i) * 0.08 * lit + lit * 0.3,
      );
      nd.halo.rotation.z = t * 0.2;
    }

    // Whole scene drifts very slightly for a sense of life, plus a
    // gentle scroll-driven parallax dolly.
    this.group.rotation.y = Math.sin(t * 0.08) * 0.06;
    const depthShift = (this.scrollFrac - 0.5) * 2.4;
    this.camera.position.z = 13 - depthShift;
    this.camera.position.x = Math.sin(t * 0.05) * 0.3;

    if (this.dust) this.dust.rotation.y = t * 0.01;

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
    this.tube?.geometry?.dispose();
    this.tubeMat?.dispose();
    this.dust?.geometry?.dispose();
    this.dust?.material?.dispose();
    this.nodes?.forEach((nd) => {
      nd.mesh.geometry?.dispose();
      nd.mat.dispose();
      nd.halo.geometry?.dispose();
      nd.haloMat.dispose();
    });
    this.renderer?.dispose();
  }
}
