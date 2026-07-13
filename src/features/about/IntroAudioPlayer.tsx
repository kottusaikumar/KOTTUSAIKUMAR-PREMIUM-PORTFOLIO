import { useEffect, useRef, useState } from "react";

// Premium "Listen to My Introduction" player for the About section.
// Self-contained: owns its own <audio> element, play/pause state,
// scrubbable progress bar, and elapsed/total time readout. Styled to
// sit naturally inside .about-copy (see .intro-audio-player in
// portfolio.css) and themed off the same --w-abt-gold/--w-abt-ink
// custom properties the rest of the About section already uses, so
// it automatically matches the section's emerald & gold palette.
// Does not autoplay — playback only starts on an explicit tap.
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function IntroAudioPlayer({
  src,
  title = "Listen to My Introduction",
  subtitle = "A quick hello from me",
}: {
  src: string;
  title?: string;
  subtitle?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onLoadedMetadata = () => setDuration(el.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("ended", onEnded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    if (el.readyState >= 1) onLoadedMetadata();

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [src]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const value = Number(event.target.value);
    el.currentTime = value;
    setCurrentTime(value);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`intro-audio-player${isPlaying ? " is-playing" : ""}`}
      role="group"
      aria-label={title}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="intro-audio-play-btn"
        onClick={togglePlay}
        aria-label={
          isPlaying ? "Pause introduction audio" : "Play introduction audio"
        }
        aria-pressed={isPlaying}
      >
        {isPlaying ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="5" y="4" width="5" height="16" rx="1.5" />
            <rect x="14" y="4" width="5" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M7 4.5c0-1.1 1.2-1.78 2.15-1.22l11 6.5a1.42 1.42 0 0 1 0 2.44l-11 6.5A1.42 1.42 0 0 1 7 17.22V4.5Z" />
          </svg>
        )}
      </button>

      <div className="intro-audio-body">
        <div className="intro-audio-top">
          <div className="intro-audio-labels">
            <strong className="intro-audio-title">{title}</strong>
            <span className="intro-audio-subtitle">{subtitle}</span>
          </div>
          <div className="intro-audio-eq" aria-hidden="true">
            <span className="intro-audio-eq-bar" />
            <span className="intro-audio-eq-bar" />
            <span className="intro-audio-eq-bar" />
            <span className="intro-audio-eq-bar" />
          </div>
        </div>

        <div className="intro-audio-scrubber">
          <span className="intro-audio-time">{formatTime(currentTime)}</span>
          <div className="intro-audio-track">
            <div
              className="intro-audio-track-fill"
              style={{ width: `${progressPct}%` }}
            />
            <input
              type="range"
              className="intro-audio-range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Seek introduction audio"
            />
          </div>
          <span className="intro-audio-time">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
