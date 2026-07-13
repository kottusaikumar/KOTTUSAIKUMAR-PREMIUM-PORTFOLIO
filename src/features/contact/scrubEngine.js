/**
 * scrubEngine.js
 * --------------
 * ScrubEngine handles the image-sequence side of the hero: preloading
 * the 190 JPG frames, exposing scroll-driven frame selection, and
 * managing a single shared THREE.Texture instance so we never hold
 * more than one full-resolution decoded frame in GPU memory at a time.
 *
 * Loading strategy:
 *  - Frame 1 loads first and blocks "ready" so the hero never paints
 *    a blank canvas.
 *  - The remaining 189 frames load with limited concurrency in the
 *    background, prioritized roughly in scroll order so early scrubbing
 *    is unlikely to outrun the network.
 *  - Each decoded HTMLImageElement is cached; texture.image is swapped
 *    and texture.needsUpdate is set on demand instead of allocating a
 *    new GPU texture per frame.
 */

export class ScrubEngine {
  /**
   * @param {Object} opts
   * @param {string} opts.basePath          folder containing the frames
   * @param {string} opts.prefix            filename prefix, e.g. "ezgif-frame-"
   * @param {number} opts.frameCount        total frame count (190)
   * @param {number} [opts.padLength]       zero-pad length for frame numbers (3)
   * @param {string} [opts.extension]       file extension (".jpg")
   * @param {number} [opts.concurrency]     parallel image loads (6)
   * @param {Function} [opts.onProgress]    (loadedCount, total) => void
   */
  constructor({
    basePath,
    prefix = "ezgif-frame-",
    frameCount = 190,
    padLength = 3,
    extension = ".jpg",
    concurrency = 6,
    onProgress = () => {},
  }) {
    this.basePath = basePath.endsWith("/") ? basePath : basePath + "/";
    this.prefix = prefix;
    this.frameCount = frameCount;
    this.padLength = padLength;
    this.extension = extension;
    this.concurrency = concurrency;
    this.onProgress = onProgress;

    /** @type {HTMLImageElement[]} sparse array, index 0..frameCount-1 */
    this.images = new Array(frameCount);
    this.loadedCount = 0;
    this.currentFrameIndex = -1;

    this._readyResolve = null;
    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
    });

    this.texture = null; // assigned once frame 0 decodes, see init()
    this.imageAspect = 16 / 9; // sensible default until frame 0 loads
  }

  urlFor(index) {
    const num = String(index + 1).padStart(this.padLength, "0");
    return `${this.basePath}${this.prefix}${num}${this.extension}`;
  }

  _loadImage(index) {
    return new Promise((resolve) => {
      if (this.images[index]) {
        resolve(this.images[index]);
        return;
      }
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.images[index] = img;
        this.loadedCount += 1;
        this.onProgress(this.loadedCount, this.frameCount);
        resolve(img);
      };
      img.onerror = () => {
        // Don't let one bad frame stall the whole sequence — log and
        // resolve with null so the caller can fall back gracefully.
        console.warn(`ScrubEngine: failed to load frame ${index + 1}`);
        this.loadedCount += 1;
        this.onProgress(this.loadedCount, this.frameCount);
        resolve(null);
      };
      img.src = this.urlFor(index);
    });
  }

  /**
   * Loads the first frame (blocking) and creates the shared THREE.Texture,
   * then kicks off background loading of the rest with bounded concurrency.
   * @param {typeof import('three')} THREE
   */
  async init(THREE) {
    const first = await this._loadImage(0);
    this.texture = new THREE.Texture(first || undefined);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    if (first) {
      this.imageAspect = first.naturalWidth / first.naturalHeight;
      this.texture.needsUpdate = true;
    }
    this.currentFrameIndex = 0;
    this._readyResolve();

    this._loadRemainingFrames();
    return this.texture;
  }

  async _loadRemainingFrames() {
    const remaining = [];
    for (let i = 1; i < this.frameCount; i++) remaining.push(i);

    let cursor = 0;
    const worker = async () => {
      while (cursor < remaining.length) {
        const idx = remaining[cursor++];
        await this._loadImage(idx);
      }
    };

    const workers = Array.from(
      { length: Math.min(this.concurrency, remaining.length) },
      () => worker(),
    );
    await Promise.all(workers);
  }

  /** Resolves once the first frame has decoded and the texture exists. */
  ready() {
    return this._readyPromise;
  }

  /**
   * Sets the active frame by scroll progress (0..1) across the full
   * sequence. Falls back to the nearest already-loaded frame if the
   * exact target hasn't decoded yet, so scrubbing ahead of the
   * preloader never shows a blank/black frame.
   * @param {number} progress 0..1
   */
  setFrameByProgress(progress) {
    const clamped = Math.min(1, Math.max(0, progress));
    const target = Math.round(clamped * (this.frameCount - 1));
    this.setFrame(target);
  }

  setFrame(index) {
    let target = Math.min(this.frameCount - 1, Math.max(0, index));

    if (!this.images[target]) {
      target = this._nearestLoadedFrame(target);
      if (target === -1) return; // nothing loaded yet
    }

    if (target === this.currentFrameIndex) return;

    this.texture.image = this.images[target];
    this.texture.needsUpdate = true;
    this.currentFrameIndex = target;
  }

  _nearestLoadedFrame(target) {
    for (let offset = 0; offset < this.frameCount; offset++) {
      const down = target - offset;
      const up = target + offset;
      if (down >= 0 && this.images[down]) return down;
      if (up < this.frameCount && this.images[up]) return up;
    }
    return -1;
  }

  /** Releases decoded image references so they can be garbage collected. */
  dispose() {
    if (this.texture) this.texture.dispose();
    this.images.length = 0;
  }
}
