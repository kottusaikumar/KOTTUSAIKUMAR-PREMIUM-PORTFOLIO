// Lazy loader for the scroll-motion stack (GSAP + ScrollTrigger + Lenis).
//
// Why this exists: PortfolioPage.tsx used to `import gsap from "gsap"`,
// `import { ScrollTrigger } from "gsap/ScrollTrigger"`, and
// `import Lenis from "lenis"` as static top-level imports. Because this
// app has no server-rendered HTML (see vite.config.ts — pure static
// SPA build) and no route-level code splitting (a single route, see
// router.tsx), those static imports sat directly in the module graph
// between `main.tsx`'s `createRoot(...).render(...)` call and the
// first JSX ever produced — the browser had to fetch, parse, and
// execute the whole motion-vendor chunk (GSAP core + ScrollTrigger +
// Lenis) before React could paint anything at all, on every visit,
// even though none of it is needed until the user actually scrolls.
//
// Every real usage of gsap/ScrollTrigger/Lenis in this codebase already
// lives inside a `useEffect` (i.e. post-mount) — none of it needs to be
// synchronous with module evaluation. Routing the three libraries
// through this single cached dynamic import lets first paint (and the
// Hero's LCP image) proceed without waiting on this chunk, while every
// call site keeps its exact same code, just wrapped in a
// `loadMotion().then(({ gsap, ScrollTrigger, Lenis }) => { ... })`.
import type gsapType from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import type LenisType from "lenis";

export interface MotionModules {
  gsap: typeof gsapType;
  ScrollTrigger: typeof ScrollTriggerType;
  Lenis: typeof LenisType;
}

let modulePromise: Promise<MotionModules> | null = null;

export function loadMotion(): Promise<MotionModules> {
  if (!modulePromise) {
    modulePromise = Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
      import("lenis"),
    ]).then(([gsapMod, scrollTriggerMod, lenisMod]) => {
      const gsap = gsapMod.default;
      const ScrollTrigger = scrollTriggerMod.ScrollTrigger;
      const Lenis = lenisMod.default;
      gsap.registerPlugin(ScrollTrigger);
      return { gsap, ScrollTrigger, Lenis };
    });
  }
  return modulePromise;
}
