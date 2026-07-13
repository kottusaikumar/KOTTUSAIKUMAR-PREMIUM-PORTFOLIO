import { ScrubEngine } from "./scrubEngine.js";
import { withBase } from "../../shared/assetPath";

/**
 * ContactScrubber
 * --------------
 * Manages the WebGL rendering and scroll scrubbing of the contact page's
 * vintage rotary telephone image sequence. Features a cover-fit shader and
 * interactive scroll-linked preloader.
 */
export class ContactScrubber {
  constructor({ canvas, container }) {
    this.canvas = canvas;
    this.container = container;
    this.disposed = false;
    this.scrollProgress = 0;
  }

  async init(THREE) {
    if (this.disposed) return;
    this.THREE = THREE;

    // Frames 001-150 (the folder now only contains the frames this
    // scene actually uses — the previously-unused trailing 10 source
    // frames were dropped during the asset cleanup).
    this.engine = new ScrubEngine({
      basePath: withBase("/media/contact-phone-scrub"),
      prefix: "ezgif-frame-",
      frameCount: 150,
      padLength: 3,
      extension: ".jpg",
      concurrency: 6,
    });

    const texture = await this.engine.init(THREE);
    if (this.disposed) {
      this.engine.dispose();
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    // Flat camera for rendering full-viewport plane
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera = camera;

    // Custom ShaderMaterial to achieve cover-fit UV calculation
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uResolution: { value: new THREE.Vector2() },
        uImageAspect: { value: this.engine.imageAspect },
        uProgress: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform float uImageAspect;
        uniform float uProgress;
        varying vec2 vUv;

        vec2 coverUv(vec2 uv, float screenAspect, float imageAspect) {
          vec2 ratio;
          if (screenAspect > imageAspect) {
            ratio = vec2(imageAspect / screenAspect, 1.0);
          } else {
            ratio = vec2(1.0, screenAspect / imageAspect);
          }
          return (uv - 0.5) * ratio + 0.5;
        }

        void main() {
          float screenAspect = uResolution.x / uResolution.y;
          vec2 uv = coverUv(vUv, screenAspect, uImageAspect);

          vec4 color = texture2D(uTexture, uv);

          // Subtle vignette and fade to black
          float dist = length(vUv - 0.5);
          float vignette = smoothstep(0.8, 0.45, dist);
          color.rgb *= mix(0.6, 1.0, vignette);

          // Fade out edges if UV goes out of bounds (failsafe)
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            color = vec4(0.0, 0.0, 0.0, 1.0);
          }

          gl_FragColor = color;
          
          #include <colorspace_fragment>
        }
      `,
      transparent: false,
    });
    this.material = material;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    this.mesh = mesh;

    this._resize();
    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize);

    this._animId = requestAnimationFrame(() => this._tick());
  }

  setScrollProgress(p) {
    this.scrollProgress = p;
    if (this.engine) {
      this.engine.setFrameByProgress(p);
    }
    if (this.material) {
      this.material.uniforms.uProgress.value = p;
    }
  }

  _resize() {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);

    if (this.material) {
      this.material.uniforms.uResolution.value.set(w, h);
      this.material.uniforms.uImageAspect.value = this.engine.imageAspect;
    }
  }

  _tick() {
    if (this.disposed) return;
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

    if (this.mesh) {
      this.scene?.remove(this.mesh);
      this.mesh.geometry?.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.engine) {
      this.engine.dispose();
    }
    this.renderer?.dispose();
  }
}
