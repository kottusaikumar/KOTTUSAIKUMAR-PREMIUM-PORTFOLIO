import { memo, useEffect, useRef } from "react";

// Project-card video thumb: keeps muted videos playing while mounted.
// The Projects ring now has only five real videos, so keeping them warm
// avoids orbit transforms being mistaken for offscreen/inactive cards.
//
// Callers (see LazyProjectVideo) only mount this once a resolved,
// shared-cache src is available, so by the time this component exists
// the clip is already fetched (or in-flight and de-duped). `preload`
// stays at "metadata" rather than "auto" as a second line of defense —
// e.g. if the shared cache falls back to the original URL after a
// network error, the browser still won't eagerly buffer the whole file.
function AutoplayVideoBase({ src, label }: { src: string; label: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;

    let lastTime = el.currentTime;
    let stalledChecks = 0;
    let lastReload = 0;

    const tryPlay = () => {
      // The Projects ring intentionally pauses back-of-ring copies of a
      // video (see Portfolio.tsx's applyOrbit) to cap concurrent decoders
      // — respect that instead of fighting it here.
      if (el.dataset.ringActive === "false") return;
      // A click that changes the project view can briefly detach/reattach
      // cards. Always request playback again on the next frame; muted inline
      // video is allowed to autoplay and this also recovers from browser
      // compositor pauses without interrupting a healthy stream.
      if (!el.paused && !el.ended) return;
      void el.play().catch(() => {
        // The next watchdog tick/event will retry after the media is ready.
      });
    };

    const onPause = () => {
      window.requestAnimationFrame(tryPlay);
    };
    const onEnded = () => {
      el.currentTime = 0;
      tryPlay();
    };
    const onError = () => {
      // Reload only for a genuine media error, and throttle it so a transient
      // network event cannot reset every card in a loop.
      const now = Date.now();
      if (!el.error || now - lastReload < 2000) return;
      lastReload = now;
      el.load();
      window.setTimeout(tryPlay, 120);
    };

    tryPlay();

    el.addEventListener("loadedmetadata", tryPlay);
    el.addEventListener("canplay", tryPlay);
    el.addEventListener("stalled", tryPlay);
    el.addEventListener("suspend", tryPlay);
    el.addEventListener("waiting", tryPlay);
    el.addEventListener("loadeddata", tryPlay);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    el.addEventListener("pause", onPause);
    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("focus", tryPlay);
    window.addEventListener("pageshow", tryPlay);
    window.addEventListener("online", tryPlay);
    const retryTimer = window.setInterval(() => {
      if (el.dataset.ringActive === "false") {
        stalledChecks = 0;
        return;
      }
      const current = el.currentTime;
      const progressing = current !== lastTime;
      lastTime = current;

      if (el.paused || el.ended) {
        stalledChecks = 0;
        tryPlay();
      } else if (progressing) {
        stalledChecks = 0;
      } else if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        stalledChecks += 1;
        // Recover a genuinely frozen decoder, but do not reload healthy
        // videos merely because the browser emitted `suspend`/`waiting`.
        if (stalledChecks >= 4) {
          stalledChecks = 0;
          tryPlay();
        }
      }
    }, 500);

    return () => {
      el.removeEventListener("loadedmetadata", tryPlay);
      el.removeEventListener("canplay", tryPlay);
      el.removeEventListener("stalled", tryPlay);
      el.removeEventListener("suspend", tryPlay);
      el.removeEventListener("waiting", tryPlay);
      el.removeEventListener("loadeddata", tryPlay);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      el.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("focus", tryPlay);
      window.removeEventListener("pageshow", tryPlay);
      window.removeEventListener("online", tryPlay);
      window.clearInterval(retryTimer);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      autoPlay
      loop
      playsInline
      preload="metadata"
      aria-label={label}
    />
  );
}

export const AutoplayVideo = memo(AutoplayVideoBase);
