import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  observeNearViewport,
  observeVisibilityToggle,
} from "../../shared/nearViewport";
import type { AmbientField as AmbientFieldScene } from "./ambientField.js";

// Generic ambient particle field, currently used behind the Skills
// section only (Contact has since moved to its own dedicated
// ContactField/contactScrubber scene). Kept generic — motif, count,
// and color are passed in as props — in case another section wants
// this same "floating particles" treatment later.
export function SkillsField({
  color,
  lightColor,
  motif,
  count,
  className,
}: {
  color: string;
  lightColor?: string;
  motif?: "glass" | "paper" | "dust" | "gem" | "orb" | "shard" | "halo";
  count?: number;
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
    let field: AmbientFieldScene | undefined;
    let st: ScrollTrigger | undefined;
    let stopToggle: (() => void) | undefined;

    const stopObserving = observeNearViewport(wrap, () => {
      if (disposed) return;
      (async () => {
        const [THREE, { AmbientField }] = await Promise.all([
          import("three"),
          import("./ambientField.js"),
        ]);
        if (disposed) return;
        const scene = new AmbientField({
          canvas,
          container: wrap,
          color,
          lightColor,
          motif,
          count,
          parallax: 0.5,
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

        // The scene otherwise keeps rendering every frame forever, even
        // while this section is scrolled far out of view — stop/start
        // it as it crosses the viewport instead.
        stopToggle = observeVisibilityToggle(wrap, (isNear) => {
          if (isNear) scene.resume();
          else scene.pause();
        });
      })().catch((err) => console.error("Ambient field failed:", err));
    });

    return () => {
      disposed = true;
      stopObserving();
      stopToggle?.();
      st?.kill();
      field?.dispose();
    };
  }, [color, lightColor, motif, count]);

  return (
    <div
      className={`section-field ${className ?? ""}`}
      ref={wrapRef}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
