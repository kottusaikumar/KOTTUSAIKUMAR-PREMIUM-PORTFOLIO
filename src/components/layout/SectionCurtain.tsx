import type { CSSProperties } from "react";

// Per-section gateway curtain — a distinct reveal-shape wipe played
// as each section scrolls in, filled with the *previous* section
// colour so the transition reads as that scene peeling away.
export type CurtainVariant =
  "shutter" | "iris" | "dissolve" | "blinds" | "scanline" | "diamond";

export function SectionCurtain({
  variant,
  color,
}: {
  variant: CurtainVariant;
  color: string;
}) {
  return (
    <div
      className={`section-curtain curtain-${variant}`}
      style={{ "--curtain-color": color } as CSSProperties}
      aria-hidden="true"
    >
      {variant === "shutter" && (
        <>
          <span className="curtain-panel curtain-panel-l" />
          <span className="curtain-panel curtain-panel-r" />
        </>
      )}
      {variant === "blinds" &&
        Array.from({ length: 7 }).map((_, i) => (
          <span className="curtain-bar" key={i} />
        ))}
      {variant === "scanline" && <span className="curtain-scan-line" />}
    </div>
  );
}
