// Shared by the per-section 3D "Field" components (SkillsField,
// ExperienceField, ProcessField, ProofField, ContactField). Each of
// those mounts as soon as PortfolioPage renders — which is immediately
// on initial load, regardless of scroll position, since every section
// is present in the DOM from the start. Left ungated, that means all
// five sections' `import("three")` + scene-module chunks (and the GPU
// work of constructing each scene) fire back-to-back right after first
// paint, even for sections far below the fold that the visitor may
// never reach.
//
// observeNearViewport defers the caller's work until the element is
// within `rootMargin` of the viewport, so a section's heavy Three.js
// scene is only ever fetched/built once it's actually about to be
// seen. Returns a cleanup function that disconnects the observer,
// which callers should invoke from their effect's cleanup so an
// unmounted-before-intersecting section doesn't leak an observer.
export function observeNearViewport(
  el: Element,
  onNear: () => void,
  rootMargin = "600px 0px",
): () => void {
  if (!("IntersectionObserver" in window)) {
    // No IO support: just run immediately rather than never rendering
    // the scene at all.
    onNear();
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        io.disconnect();
        onNear();
      }
    },
    { rootMargin, threshold: 0.01 },
  );
  io.observe(el);

  return () => io.disconnect();
}

// Like observeNearViewport, but doesn't disconnect after firing once —
// used to pause/resume a section's Three.js render loop every time it
// crosses in or out of view, rather than only gating the initial load.
export function observeVisibilityToggle(
  el: Element,
  onChange: (isNear: boolean) => void,
  rootMargin = "150px 0px",
): () => void {
  if (!("IntersectionObserver" in window)) {
    onChange(true);
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      onChange(entry.isIntersecting);
    },
    { rootMargin, threshold: 0.01 },
  );
  io.observe(el);

  return () => io.disconnect();
}
