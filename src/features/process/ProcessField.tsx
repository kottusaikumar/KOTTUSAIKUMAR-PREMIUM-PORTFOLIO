import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  observeNearViewport,
  observeVisibilityToggle,
} from "../../shared/nearViewport";
import type { ProcessCircuit as ProcessCircuitScene } from "./processCircuit.js";

// Bespoke Process-section mount: an orthogonal circuit schematic
// with per-step primitives and flowing pulses.
export function ProcessField({
  color,
  lightColor,
  stepCount,
  className,
  rainbow,
}: {
  color: string;
  lightColor?: string;
  stepCount: number;
  className?: string;
  rainbow?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let disposed = false;
    let field: ProcessCircuitScene | undefined;
    let st: ScrollTrigger | undefined;
    let stopToggle: (() => void) | undefined;

    const stopObserving = observeNearViewport(wrap, () => {
      if (disposed) return;
      (async () => {
        const [THREE, { ProcessCircuit }] = await Promise.all([
          import("three"),
          import("./processCircuit.js"),
        ]);
        if (disposed) return;
        const scene = new ProcessCircuit({
          canvas,
          container: wrap,
          color,
          lightColor,
          stepCount,
          rainbow,
        });
        field = scene;
        await scene.init(THREE);
        if (disposed) {
          scene.dispose();
          return;
        }

        st = ScrollTrigger.create({
          trigger: wrap,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          onUpdate: (self) => scene.setScrollProgress(self.progress),
        });

        stopToggle = observeVisibilityToggle(wrap, (isNear) => {
          if (isNear) scene.resume();
          else scene.pause();
        });
      })().catch((err) => console.error("Process circuit failed:", err));
    });

    return () => {
      disposed = true;
      stopObserving();
      stopToggle?.();
      st?.kill();
      field?.dispose();
    };
  }, [color, lightColor, stepCount, rainbow]);

  return (
    <div
      className={`section-field section-field--vivid ${className ?? ""}`}
      ref={wrapRef}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
