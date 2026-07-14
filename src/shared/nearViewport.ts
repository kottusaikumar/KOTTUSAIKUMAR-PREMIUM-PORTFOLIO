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
//
// `rootMargin` used to default to 600px. Every one of these Field
// sections (Skills, Experience, Process, Proof, Contact) sits
// directly below a 100vh Hero, so at initial scroll position (scrollY
// = 0) the section's top edge is already exactly one viewport-height
// below the current viewport bottom — well within a 600px expanded
// root on any phone (viewport heights here are ~650–900px). That
// means the IntersectionObserver fired immediately on mount, not
// after real scrolling, so Three.js (~185KB gzip) plus each section's
// scene module started fetching and evaluating right alongside the
// still-in-flight critical resources during startup, instead of once
// the visitor actually approached the section. 150px — matching the
// pause/resume observer just below — still starts the fetch/build
// early enough that nothing pops in blank, but no longer overlaps
// with first paint.
export function observeNearViewport(
  el: Element,
  onNear: () => void,
  rootMargin = "150px 0px",
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
