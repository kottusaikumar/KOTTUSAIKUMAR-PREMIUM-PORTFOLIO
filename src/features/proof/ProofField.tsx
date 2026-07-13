import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  observeNearViewport,
  observeVisibilityToggle,
} from "../../shared/nearViewport";
import type { ProofRadar as ProofRadarScene } from "./proofRadar.js";

// Bespoke Proof-section mount: a continuously sweeping radar
// scanner with ping rings.
export function ProofField({
  color,
  lightColor,
  nodeCount,
  className,
}: {
  color: string;
  lightColor?: string;
  nodeCount: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let disposed = false;
    let field: ProofRadarScene | undefined;
    let st: ScrollTrigger | undefined;
    let stopToggle: (() => void) | undefined;

    const stopObserving = observeNearViewport(wrap, () => {
      if (disposed) return;
      (async () => {
        const [THREE, { ProofRadar }] = await Promise.all([
          import("three"),
          import("./proofRadar.js"),
        ]);
        if (disposed) return;
        const scene = new ProofRadar({
          canvas,
          container: wrap,
          color,
          lightColor,
          nodeCount,
        });
        field = scene;
        await scene.init(THREE);
        if (disposed) {
          scene.dispose();
          return;
        }

        st = ScrollTrigger.create({
          trigger: wrap.closest(".proof") || wrap,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          onUpdate: (self) => scene.setScrollProgress(self.progress),
        });

        stopToggle = observeVisibilityToggle(wrap, (isNear) => {
          if (isNear) scene.resume();
          else scene.pause();
        });
      })().catch((err) => console.error("Proof radar failed:", err));
    });

    return () => {
      disposed = true;
      stopObserving();
      stopToggle?.();
      st?.kill();
      field?.dispose();
    };
  }, [color, lightColor, nodeCount]);

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
