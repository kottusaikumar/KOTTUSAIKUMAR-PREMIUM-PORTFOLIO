import { memo, useEffect, useRef, useState } from "react";
import { AutoplayVideo } from "./AutoplayVideo";
import { getSharedVideoSrc } from "./videoSourceCache";

interface LazyProjectVideoProps {
  src: string;
  label: string;
}

// Card-level lazy loader for project videos (used by both the Ring and
// the Slider views). Nothing is fetched until the card is within
// `rootMargin` of the viewport, so videos for projects far below the
// fold never contribute to initial page load / LCP. Once a fetch starts,
// getSharedVideoSrc de-dupes it against any other card requesting the
// same clip (the Ring's back-of-ring copies in particular).
//
// Until the real clip resolves, the slot renders as an empty div — the
// existing dark background/gradient on .work-card-media /
// .project-card-media already fills that space, so there is no visible
// gap, and by the time a card actually scrolls into view the buffered
// rootMargin has almost always already resolved the swap.
function LazyProjectVideoBase({ src, label }: LazyProjectVideoProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    setResolvedSrc(null);
    const el = hostRef.current;
    if (!el) return;

    let cancelled = false;
    const load = () => {
      void getSharedVideoSrc(src).then((url) => {
        if (!cancelled) setResolvedSrc(url);
      });
    };

    if (!("IntersectionObserver" in window)) {
      // No IO support: just load directly rather than never showing a video.
      load();
      return () => {
        cancelled = true;
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          load();
          io.disconnect();
        }
      },
      // Generous buffer so the fetch has time to finish before the card
      // is actually on-screen.
      { rootMargin: "600px 0px", threshold: 0.01 },
    );
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [src]);

  return (
    <div className="project-video-slot" ref={hostRef}>
      {resolvedSrc ? <AutoplayVideo src={resolvedSrc} label={label} /> : null}
    </div>
  );
}

export const LazyProjectVideo = memo(LazyProjectVideoBase);
