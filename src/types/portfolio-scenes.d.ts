// Ambient module declarations for the plain-.js Three.js scene modules
// under src/features/*/ (they're dynamically import()ed from .tsx
// wrapper components, so TypeScript needs a type shape for them).
// The `*/name.js` wildcard matches the file by name regardless of
// which feature folder it lives in.
// Shape of the Three.js module namespace, as received from the
// dynamic `import("three")` calls in the wrapper components.
type ThreeModule = typeof import("three");

declare module "*/scrubEngine.js" {
  export class ScrubEngine {
    constructor(opts: {
      basePath: string;
      prefix?: string;
      frameCount?: number;
      padLength?: number;
      extension?: string;
      concurrency?: number;
      onProgress?: (loaded: number, total: number) => void;
    });
    imageAspect: number;
    init(THREE: ThreeModule): Promise<unknown>;
    setFrameByProgress(p: number): void;
    dispose(): void;
  }
}
declare module "*/ambientField.js" {
  export class AmbientField {
    constructor(opts: {
      canvas: HTMLCanvasElement;
      container: HTMLElement;
      color?: string;
      lightColor?: string;
      motif?: "glass" | "paper" | "dust" | "gem" | "orb" | "shard" | "halo";
      count?: number;
      parallax?: number;
    });
    init(THREE: ThreeModule): Promise<void>;
    setScrollProgress(p: number): void;
    pause(): void;
    resume(): void;
    dispose(): void;
  }
}
declare module "*/experienceTimeline.js" {
  export class ExperienceTimeline {
    constructor(opts: {
      canvas: HTMLCanvasElement;
      container: HTMLElement;
      color?: string;
      lightColor?: string;
      nodeCount?: number;
    });
    init(THREE: ThreeModule): Promise<void>;
    setScrollProgress(p: number): void;
    pause(): void;
    resume(): void;
    dispose(): void;
  }
}
declare module "*/processCircuit.js" {
  export class ProcessCircuit {
    constructor(opts: {
      canvas: HTMLCanvasElement;
      container: HTMLElement;
      color?: string;
      lightColor?: string;
      stepCount?: number;
      rainbow?: boolean;
    });
    init(THREE: ThreeModule): Promise<void>;
    setScrollProgress(p: number): void;
    pause(): void;
    resume(): void;
    dispose(): void;
  }
}
declare module "*/proofRadar.js" {
  export class ProofRadar {
    constructor(opts: {
      canvas: HTMLCanvasElement;
      container: HTMLElement;
      color?: string;
      lightColor?: string;
      nodeCount?: number;
    });
    init(THREE: ThreeModule): Promise<void>;
    setScrollProgress(p: number): void;
    pause(): void;
    resume(): void;
    dispose(): void;
  }
}
declare module "*/contactScrubber.js" {
  export class ContactScrubber {
    constructor(opts: { canvas: HTMLCanvasElement; container: HTMLElement });
    init(THREE: ThreeModule): Promise<void>;
    setScrollProgress(p: number): void;
    pause(): void;
    resume(): void;
    dispose(): void;
  }
}
