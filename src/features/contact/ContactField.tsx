import { useEffect, useRef } from "react";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import { loadMotion } from "../../shared/motion";
import {
  observeNearViewport,
  observeVisibilityToggle,
} from "../../shared/nearViewport";
import type { ContactScrubber as ContactScrubberScene } from "./contactScrubber.js";

export function ContactField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let disposed = false;
    let scrubber: ContactScrubberScene | undefined;
    let st: ScrollTriggerType | undefined;
    let stopToggle: (() => void) | undefined;

    const stopObserving = observeNearViewport(wrap, () => {
      if (disposed) return;
      (async () => {
        const [THREE, { ContactScrubber }, { ScrollTrigger }] =
          await Promise.all([
            import("three"),
            import("./contactScrubber.js"),
            loadMotion(),
          ]);
        if (disposed) return;
        const scene = new ContactScrubber({
          canvas,
          container: wrap,
        });
        scrubber = scene;
        await scene.init(THREE);
        if (disposed) {
          scene.dispose();
          return;
        }

        st = ScrollTrigger.create({
          trigger: wrap.closest(".contact") || wrap,
          // Start scrubbing slightly after the top of the contact section enters the viewport
          start: "top bottom",
          end: "bottom 20%",
          scrub: true,
          onUpdate: (self) => scene.setScrollProgress(self.progress),
        });

        stopToggle = observeVisibilityToggle(wrap, (isNear) => {
          if (isNear) scene.resume();
          else scene.pause();
        });
      })().catch((err) => console.error("Contact image scrubber failed:", err));
    });

    return () => {
      disposed = true;
      stopObserving();
      stopToggle?.();
      st?.kill();
      scrubber?.dispose();
    };
  }, []);

  return (
    <div
      className={`section-field section-field--vivid contact-scrubber-field ${className ?? ""}`}
      ref={wrapRef}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
