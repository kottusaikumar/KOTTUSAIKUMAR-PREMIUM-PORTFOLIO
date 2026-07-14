import { useEffect, useRef } from "react";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import { loadMotion } from "../../shared/motion";
import {
  observeNearViewport,
  observeVisibilityToggle,
} from "../../shared/nearViewport";
import type { ExperienceTimeline as ExperienceTimelineScene } from "./experienceTimeline.js";

// Bespoke Experience-section mount: a 3D career path that draws
// itself on scroll, instead of the generic SectionField above.
export function ExperienceField({
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
    let field: ExperienceTimelineScene | undefined;
    let st: ScrollTriggerType | undefined;
    let stopToggle: (() => void) | undefined;

    const stopObserving = observeNearViewport(wrap, () => {
      if (disposed) return;
      (async () => {
        const [THREE, { ExperienceTimeline }, { ScrollTrigger }] =
          await Promise.all([
            import("three"),
            import("./experienceTimeline.js"),
            loadMotion(),
          ]);
        if (disposed) return;
        const scene = new ExperienceTimeline({
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
      })().catch((err) => console.error("Experience timeline failed:", err));
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
