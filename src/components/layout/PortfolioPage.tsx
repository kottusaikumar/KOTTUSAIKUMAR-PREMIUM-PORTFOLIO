// The main page: fixed nav, hero, and every scroll-driven section
// (Skills, Experience, Process, About, Projects, Proof, Contact).
//
// This stays one file rather than one-component-per-section because
// almost everything in it is wired to a *single* shared GSAP/Lenis/
// ScrollTrigger orchestration effect below (smooth scroll, the
// scroll-driven background colour crossfade, section-curtain wipes,
// pinned reveals, magnetic CTAs, etc.) that queries across every
// section's DOM by class name. Splitting the JSX out further would
// mean threading a lot of shared refs across files for no real
// clarity gain — the content data and each section's 3D background
// "scene" already live in their own folder under src/features/*,
// this file is left as the composition + interaction layer.
import {
  Fragment,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { ExternalLink, Info, Menu, X } from "lucide-react";
import type gsapType from "gsap";
import type Lenis from "lenis";
import { loadMotion } from "../../shared/motion";
import "../../styles/portfolio/index.css";

import { PROJECTS } from "../../features/projects/projects.data";
import { EXPERIENCE } from "../../features/experience/experience.data";
import { PROCESS } from "../../features/process/process.data";
import { PROOF } from "../../features/proof/proof.data";
import { SKILLS, renderSkillIcon } from "../../features/skills/skills.data";
import { SCROLL_THEME } from "../../shared/scrollTheme";
import { withBase } from "../../shared/assetPath";

import { ToonHubHero } from "../../features/hero/Hero";
import { SkillsField } from "../../features/skills/SkillsField";
import { ExperienceField } from "../../features/experience/ExperienceField";
import { ProcessField } from "../../features/process/ProcessField";
import { ProofField } from "../../features/proof/ProofField";
import { ContactField } from "../../features/contact/ContactField";
import { LazyProjectVideo } from "../../features/projects/LazyProjectVideo";
import { IntroAudioPlayer } from "../../features/about/IntroAudioPlayer";
import { SectionCurtain } from "./SectionCurtain";
import { PortfolioIntro } from "./PortfolioIntro";

// Sonner's toast portal/UI is only ever needed once a visitor submits
// the contact form, so it's split into its own chunk instead of
// shipping in the initial bundle every visitor downloads. The `toast()`
// calls themselves are dynamically imported at the point of use, below.
const Toaster = lazy(() =>
  import("../ui/sonner").then((mod) => ({ default: mod.Toaster })),
);

const PROJECT_CARD_COLORS = [
  "252, 139, 139",
  "245, 255, 118",
  "117, 255, 169",
  "238, 116, 255",
  "115, 218, 255",
];
const PROJECT_RING_ANGLE_KEY = "portfolio.projectRing.angle";
// Depth (0 = far side of the ring, 1 = near side) at/above which a ring
// card is considered "front-facing" and its video should actively play.
// Because every project appears twice, exactly 180deg apart (see
// projectRingItems below), depth_front + depth_back === 1 for any given
// pair at all times — so thresholding at 0.5 guarantees precisely one
// instance of each project's video is playing at once. That keeps total
// concurrent decoders at 5 (matching the previous single-copy ring)
// even though the ring now visually shows 10 video cards.
const PROJECT_RING_FRONT_DEPTH = 0.5;
const PROJECT_RING_DEGREES_PER_MS = 360 / 20000;

export function PortfolioPage() {
  const headerCTARef = useRef<HTMLAnchorElement | null>(null);
  const resumeCTARef = useRef<HTMLAnchorElement | null>(null);
  const bgLayerRef = useRef<HTMLDivElement | null>(null);
  const scrollBarRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const skillsSlabRef = useRef<HTMLDivElement | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [projectView, setProjectView] = useState<"ring" | "slider">("ring");
  const [projectViewPress, setProjectViewPress] = useState<
    "ring" | "slider" | null
  >(null);
  const [messageSent, setMessageSent] = useState(false);
  const [sliderActiveIndex, setSliderActiveIndex] = useState(0);
  const projectViewTimerRef = useRef<number | null>(null);
  const messageResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (messageResetTimerRef.current) {
        window.clearTimeout(messageResetTimerRef.current);
      }
    };
  }, []);

  const moveProjectSlider = (direction: -1 | 1) => {
    setSliderActiveIndex(
      (index) => (index + direction + PROJECTS.length) % PROJECTS.length,
    );
  };

  const getProjectSliderOffset = (index: number) => {
    let offset = index - sliderActiveIndex;
    const half = Math.floor(PROJECTS.length / 2);
    if (offset > half) offset -= PROJECTS.length;
    if (offset < -half) offset += PROJECTS.length;
    return offset;
  };

  const changeProjectView = (next: "ring" | "slider") => {
    if (next === projectView || projectViewTimerRef.current) return;
    setProjectViewPress(next);
    projectViewTimerRef.current = window.setTimeout(() => {
      setProjectView(next);
      projectViewTimerRef.current = null;
      window.setTimeout(() => setProjectViewPress(null), 700);
    }, 240);
  };

  /* Projects — rotating 3D carousel adapted from the provided reference. */
  const workSectionRef = useRef<HTMLElement | null>(null);
  const workTrackRef = useRef<HTMLDivElement | null>(null);
  const projectRingAngleRef = useRef(0);
  // Reference animation shows a fully populated ring of looping videos —
  // no text/placeholder tiles. We only have 5 real project videos, so each
  // one is reused once more to fill out the ring (10 slots total), placed
  // so a project's two copies always sit on opposite sides of the circle
  // (see PROJECT_RING_FRONT_DEPTH above for why that matters for perf).
  const projectRingItems = [...PROJECTS, ...PROJECTS];

  /* Keep the glass menu indicator synced with the section nearest the
     viewport center while scrolling in either direction. */
  useEffect(() => {
    const sections = [
      "hero",
      "skills",
      "experience",
      "process",
      "about",
      "work",
      "proof",
      "contact",
    ];
    let ticking = false;
    const updateActiveNav = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const center = window.innerHeight / 2;
        type ActiveSectionMatch = { id: string; index: number };
        const currentSection = sections.reduce<ActiveSectionMatch | null>(
          (acc, id, index) => {
            const element = document.getElementById(id);
            if (!element) return acc;
            const rect = element.getBoundingClientRect();
            // Use DOM/document order instead of viewport top. The hero is pinned
            // while scrolling, so its top can remain at 0 after later sections
            // have already entered the viewport.
            if (rect.top <= center && (!acc || index > acc.index)) {
              return { id, index };
            }
            return acc;
          },
          null,
        );
        setActiveNav(
          currentSection && !["hero", "contact"].includes(currentSection.id)
            ? currentSection.id
            : null,
        );
        ticking = false;
      });
    };
    // Hash navigation can finish after the first render (including when a
    // bookmarked URL restores a section), so recalculate once the browser has
    // applied the hash and whenever history/hash navigation changes.
    updateActiveNav();
    const initialSync = window.setTimeout(updateActiveNav, 350);
    window.addEventListener("scroll", updateActiveNav, { passive: true });
    window.addEventListener("resize", updateActiveNav);
    window.addEventListener("hashchange", updateActiveNav);
    window.addEventListener("popstate", updateActiveNav);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("scroll", updateActiveNav);
      window.removeEventListener("resize", updateActiveNav);
      window.removeEventListener("hashchange", updateActiveNav);
      window.removeEventListener("popstate", updateActiveNav);
    };
  }, []);

  /* Smooth scroll
     Deferred behind loadMotion() (see src/shared/motion.ts) — Lenis and
     ScrollTrigger are not needed for first paint, only once the visitor
     actually scrolls, so this no longer holds up the initial render. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let lenis: Lenis | null = null;
    let refresh: (() => void) | null = null;

    loadMotion().then(({ gsap, ScrollTrigger, Lenis: LenisCtor }) => {
      if (cancelled) return;
      lenis = new LenisCtor({
        duration: 1.45,
        // A slightly gentler exponential-out — the first ~15% of the
        // curve is flatter (less initial snap) so a wheel tick reads
        // as a soft push rather than a jump, then settles into the
        // same fast decay. Heavier deceleration, no abrupt stop.
        easing: (t: number) => 1 - Math.pow(1 - t, 4),
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.15,
      });
      lenisRef.current = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time) => lenis!.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);

      // Every ScrollTrigger start/end position on this page is computed
      // once, based on layout at the moment each effect runs. Web fonts
      // swapping in (reflowing text height), the hero's character images,
      // and the project ring's videos all finish loading *after* that —
      // so without an explicit refresh, trigger positions drift out of
      // sync with the real, final page height and animations start firing
      // a beat early or late (the same root cause behind the Proof Wall
      // counters reading stale state, just for scroll position instead of
      // a parsed value). Recompute once fonts are actually painted, and
      // once more on window "load" as a catch-all for anything else still
      // settling (images, the initial batch of video metadata).
      refresh = () => ScrollTrigger.refresh();
      document.fonts?.ready?.then(refresh);
      window.addEventListener("load", refresh);
    });

    return () => {
      cancelled = true;
      lenis?.destroy();
      lenisRef.current = null;
      if (refresh) window.removeEventListener("load", refresh);
    };
  }, []);

  /* Projects ring — controlled rotation that survives navigation.
     The current angle is stored outside React's render loop so the
     animation is smooth, then persisted whenever it pauses/unmounts. */
  useEffect(() => {
    const track = workTrackRef.current;
    if (!track || projectView !== "ring") return;

    const storedAngle = Number(localStorage.getItem(PROJECT_RING_ANGLE_KEY));
    if (Number.isFinite(storedAngle)) {
      projectRingAngleRef.current = storedAngle % 360;
    }

    let frame = 0;
    let lastTime = 0;
    let hovered = false;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Elliptical "billboard" ring, matching the reference orbit: cards
    // never keystone/rotate, they just travel along this ellipse while
    // scale/opacity/blur change with depth, so the front card reads as
    // large and crisp and back cards shrink, dim, and soften toward the
    // top of the ring. See 04-projects-theme.css .work-card for the
    // matching transform and the nth-child fallback this mirrors.
    const applyOrbit = () => {
      const cards = Array.from(
        track.querySelectorAll<HTMLElement>(".work-card--glass"),
      );
      const quantity = cards.length || 1;
      const radiusX = track.clientWidth * 0.43;
      const radiusY = track.clientHeight * 0.3;

      track.style.setProperty(
        "--ring-angle",
        `${projectRingAngleRef.current}deg`,
      );
      cards.forEach((card, index) => {
        const angleDeg = projectRingAngleRef.current + (index * 360) / quantity;
        const rad = (angleDeg * Math.PI) / 180;
        const x = Math.sin(rad) * radiusX;
        const y = -Math.cos(rad) * radiusY;
        // depth: 0 = farthest (top of ring), 1 = nearest the camera
        // (bottom/front of ring) — matches PROJECT_RING_FRONT_DEPTH.
        const depth = (1 - Math.cos(rad)) / 2;
        const scale = 0.62 + depth * 0.5;
        const opacity = 0.4 + depth * 0.6;

        // Reference video's back-of-ring cards read as slightly soft/hazy
        // compared to the crisp front cards — a small depth-based blur
        // sells that same sense of a continuous 3D ring.
        const blur = (1 - depth) * 2.2;

        card.style.setProperty("--orbit-x", `${x.toFixed(1)}px`);
        card.style.setProperty("--orbit-y", `${y.toFixed(1)}px`);
        card.style.setProperty("--orbit-scale", scale.toFixed(3));
        card.style.setProperty("--orbit-opacity", opacity.toFixed(3));
        card.style.setProperty("--orbit-z", String(Math.round(depth * 100)));
        card.style.setProperty("--orbit-blur", `${blur.toFixed(2)}px`);

        // Only keep front-facing copies of each project's video decoding —
        // see PROJECT_RING_FRONT_DEPTH for why this holds concurrent video
        // playback at 5 regardless of the ring showing 10 video cards.
        const video = card.querySelector<HTMLVideoElement>("video");
        if (video) {
          const shouldPlay = depth >= PROJECT_RING_FRONT_DEPTH;
          const isActive = video.dataset.ringActive !== "false";
          if (shouldPlay && !isActive) {
            video.dataset.ringActive = "true";
            void video.play().catch(() => {});
          } else if (!shouldPlay && isActive) {
            video.dataset.ringActive = "false";
            video.pause();
          }
        }
      });
    };

    const saveState = () => {
      localStorage.setItem(
        PROJECT_RING_ANGLE_KEY,
        String(projectRingAngleRef.current % 360),
      );
    };

    const tick = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;
      if (!hovered) {
        projectRingAngleRef.current =
          (projectRingAngleRef.current + delta * PROJECT_RING_DEGREES_PER_MS) %
          360;
      }
      applyOrbit();
      frame = requestAnimationFrame(tick);
    };

    applyOrbit();

    // Respect prefers-reduced-motion: render one static, evenly-spaced
    // frame of the ring (via applyOrbit above) and skip the rAF loop
    // entirely — no motion, but still the full ring layout, not a
    // flat list.
    if (reduceMotion) {
      return () => {
        saveState();
      };
    }

    // The loop below previously started unconditionally the instant
    // this effect ran — regardless of whether the Projects section was
    // anywhere near the viewport on initial page load. It now only
    // starts once the section is actually near the viewport (via the
    // observer below), and stops/restarts as it scrolls in and out,
    // instead of running for the entire time the page is open.
    let offscreen = true;
    const pauseAllRingVideos = () => {
      track.querySelectorAll<HTMLVideoElement>("video").forEach((video) => {
        video.dataset.ringActive = "false";
        video.pause();
      });
    };
    const sectionObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              if (!entry) return;
              if (entry.isIntersecting) {
                if (!offscreen) return;
                offscreen = false;
                lastTime = 0;
                if (!frame) frame = requestAnimationFrame(tick);
              } else if (!offscreen) {
                offscreen = true;
                if (frame) {
                  cancelAnimationFrame(frame);
                  frame = 0;
                }
                pauseAllRingVideos();
              }
            },
            { rootMargin: "200px 0px" },
          )
        : null;

    if (sectionObserver) {
      sectionObserver.observe(track);
    } else {
      // No IntersectionObserver support: fall back to the old
      // always-on behavior rather than never animating at all.
      offscreen = false;
      frame = requestAnimationFrame(tick);
    }

    // Pause rotation on hover/focus so a visitor can read a card's title
    // or reach its link — matches the "active project emphasis" the
    // reference gives its nearest/hovered item, without needing a
    // separate timeline or extra GSAP tween.
    const onEnter = () => {
      hovered = true;
    };
    const onLeave = () => {
      hovered = false;
    };
    track.addEventListener("pointerenter", onEnter);
    track.addEventListener("pointerleave", onLeave);
    track.addEventListener("focusin", onEnter);
    track.addEventListener("focusout", onLeave);

    const onPageHide = () => saveState();
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", saveState);

    let resizeFrame = 0;
    const onResize = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(applyOrbit);
    };
    window.addEventListener("resize", onResize);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      sectionObserver?.disconnect();
      track.removeEventListener("pointerenter", onEnter);
      track.removeEventListener("pointerleave", onLeave);
      track.removeEventListener("focusin", onEnter);
      track.removeEventListener("focusout", onLeave);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", saveState);
      saveState();
    };
  }, [projectView]);

  /* Premium section motion director
     Deferred behind loadMotion() — see src/shared/motion.ts. This is
     the largest of the GSAP/ScrollTrigger effects; none of it needs to
     run before first paint, so it no longer blocks it. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;

    loadMotion().then(({ gsap }) => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        gsap.utils
          .toArray<HTMLElement>(".premium-3d-scene")
          .forEach((scene) => {
            const section = scene.closest(".section-world");
            gsap.fromTo(
              scene,
              { yPercent: 9, scale: 1.08, opacity: 0.45, rotateX: 5 },
              {
                yPercent: -7,
                scale: 1,
                opacity: 1,
                rotateX: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1.1,
                },
              },
            );
          });

        gsap.utils
          .toArray<HTMLElement>(".portal-ring, .circuit-node")
          .forEach((el, i) => {
            gsap.to(el, {
              y: i % 2 ? -22 : 22,
              x: i % 3 ? 14 : -14,
              rotate: i % 2 ? 4 : -4,
              ease: "sine.inOut",
              scrollTrigger: {
                trigger: el.closest(".section-world"),
                start: "top bottom",
                end: "bottom top",
                scrub: 1.4,
              },
            });
          });

        gsap.utils.toArray<HTMLElement>(".section-gateway").forEach((gate) => {
          gsap.fromTo(
            gate,
            { clipPath: "inset(0 50% 0 50%)", opacity: 0.2, scaleX: 0.75 },
            {
              clipPath: "inset(0 0% 0 0%)",
              opacity: 1,
              scaleX: 1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: gate.parentElement,
                start: "top 86%",
                end: "top 30%",
                scrub: 0.7,
              },
            },
          );
        });

        /* Unique gateway-curtain reveal per section ───────────── */
        gsap.utils.toArray<HTMLElement>(".curtain-shutter").forEach((c) => {
          const sec = c.closest(".section-world");
          const tl = {
            trigger: sec,
            start: "top 92%",
            end: "top 18%",
            scrub: 0.6,
          };
          gsap.to(c.querySelector(".curtain-panel-l"), {
            xPercent: -100,
            ease: "none",
            scrollTrigger: tl,
          });
          gsap.to(c.querySelector(".curtain-panel-r"), {
            xPercent: 100,
            ease: "none",
            scrollTrigger: tl,
          });
        });

        gsap.utils.toArray<HTMLElement>(".curtain-iris").forEach((c) => {
          gsap.fromTo(
            c,
            { clipPath: "circle(150% at 50% 50%)" },
            {
              clipPath: "circle(0% at 50% 50%)",
              ease: "none",
              scrollTrigger: {
                trigger: c.closest(".section-world"),
                start: "top 92%",
                end: "top 16%",
                scrub: 0.6,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".curtain-dissolve").forEach((c) => {
          gsap.fromTo(
            c,
            { opacity: 1, scale: 1, filter: "blur(0px)" },
            {
              opacity: 0,
              scale: 1.32,
              filter: "blur(28px)",
              ease: "none",
              scrollTrigger: {
                trigger: c.closest(".section-world"),
                start: "top 92%",
                end: "top 20%",
                scrub: 0.6,
              },
            },
          );
        });

        gsap.utils.toArray<HTMLElement>(".curtain-blinds").forEach((c) => {
          const bars = c.querySelectorAll<HTMLElement>(".curtain-bar");
          gsap.set(bars, { transformOrigin: "top" });
          gsap.to(bars, {
            scaleY: 0,
            stagger: 0.045,
            ease: "none",
            scrollTrigger: {
              trigger: c.closest(".section-world"),
              start: "top 92%",
              end: "top 16%",
              scrub: 0.6,
            },
          });
        });

        gsap.utils.toArray<HTMLElement>(".curtain-scanline").forEach((c) => {
          const tl = {
            trigger: c.closest(".section-world"),
            start: "top 92%",
            end: "top 16%",
            scrub: 0.6,
          };
          gsap.fromTo(
            c,
            { clipPath: "inset(0% 0 0% 0)" },
            { clipPath: "inset(100% 0 0% 0)", ease: "none", scrollTrigger: tl },
          );
          gsap.fromTo(
            c.querySelector(".curtain-scan-line"),
            { top: "0%", opacity: 1 },
            { top: "100%", opacity: 0, ease: "none", scrollTrigger: tl },
          );
        });

        gsap.set(".skills-stage", {
          perspective: 1400,
          transformStyle: "preserve-3d",
        });
        gsap.set(skillsSlabRef.current, {
          transformPerspective: 1400,
          transformStyle: "preserve-3d",
          rotateX: -10,
          rotateY: 13,
          rotateZ: -1.5,
          y: 30,
        });
        gsap.to(skillsSlabRef.current, {
          rotateX: 9,
          rotateY: -14,
          rotateZ: 1.5,
          y: -22,
          ease: "none",
          scrollTrigger: {
            trigger: "#skills",
            start: "top 78%",
            end: "bottom 22%",
            scrub: 1.1,
          },
        });

        const skillCells = gsap.utils.toArray<HTMLElement>(".skill-cell");
        gsap.set(skillCells, {
          transformStyle: "preserve-3d",
          transformPerspective: 900,
          transformOrigin: "50% 50%",
        });
        // (Entrance fade removed — cards stay visible at all times; the
        // scroll-scrubbed pulse below is the only per-cell scroll effect,
        // so scrolling up/down only ever moves which cell is zoomed in,
        // never makes cards appear/disappear.)

        const skillPulseTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#skills",
            start: "top 78%",
            end: "bottom 16%",
            scrub: 0.25,
          },
        });
        skillCells.forEach((cell, i) => {
          const step = i * 0.135;
          const swing = i % 2 === 0 ? 4 : -4;
          skillPulseTl
            .to(
              cell,
              {
                scale: 1.28,
                z: 120,
                rotateX: -5,
                rotateY: swing,
                opacity: 1,
                filter: "brightness(1.16)",
                boxShadow:
                  "0 26px 78px rgba(61,255,208,.22), 0 0 0 1px rgba(61,255,208,.34)",
                ease: "power2.out",
                duration: 0.11,
              },
              step,
            )
            .to(
              cell,
              {
                scale: 0.98,
                z: 0,
                rotateX: 0,
                rotateY: 0,
                filter: "brightness(1)",
                boxShadow: "",
                ease: "power2.inOut",
                duration: 0.13,
              },
              step + 0.12,
            );
        });

        gsap.utils
          .toArray<HTMLElement>(".experience-card")
          .forEach((card, i) => {
            gsap.from(card, {
              rotateX: -18,
              rotateY: i % 2 ? -8 : 8,
              y: 70,
              opacity: 0,
              transformOrigin: "50% 0%",
              ease: "power3.out",
              scrollTrigger: {
                trigger: card,
                start: "top 82%",
                end: "top 46%",
                scrub: 0.8,
              },
            });
          });

        gsap.utils.toArray<HTMLElement>(".process-card").forEach((card, i) => {
          gsap.from(card, {
            y: i % 2 ? 80 : -80,
            rotateZ: i % 2 ? 4 : -4,
            opacity: 0,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 86%",
              end: "top 48%",
              scrub: 0.9,
            },
          });
        });
        gsap.to(".process-rail-line", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "#process",
            start: "top 70%",
            end: "bottom 45%",
            scrub: true,
          },
        });

        /* About split-slide transition, adapted from the supplied nested
         outer/inner wrapper demo. The existing flip card and biography are
         the two slides, so no demo images or scroll-hijacking Observer are
         introduced into the portfolio. */
        const aboutIllustration = document.querySelector<HTMLElement>(
          "#about .about-illustration",
        );
        const aboutFlipCard = document.querySelector<HTMLElement>(
          "#about .about-flip-card",
        );
        const aboutCopy =
          document.querySelector<HTMLElement>("#about .about-copy");
        const aboutTitle = document.querySelector<HTMLElement>(
          "#about .about-title",
        );
        const aboutCopyItems = gsap.utils.toArray<HTMLElement>(
          "#about .section-eyebrow, #about .about-lede, #about .about-cta",
        );

        if (aboutIllustration && aboutFlipCard && aboutCopy && aboutTitle) {
          const aboutTransition = gsap.timeline({
            scrollTrigger: {
              trigger: "#about",
              start: "top 88%",
              end: "top 18%",
              scrub: 1.05,
              invalidateOnRefresh: true,
            },
            defaults: { ease: "expo.inOut" },
          });

          aboutTransition
            .fromTo(
              aboutIllustration,
              {
                clipPath: "inset(0% 100% 0% 0% round 26px)",
                xPercent: -18,
              },
              {
                clipPath: "inset(0% 0% 0% 0% round 26px)",
                xPercent: 0,
                duration: 1,
              },
              0,
            )
            .fromTo(
              aboutFlipCard,
              { xPercent: 34, scale: 1.65, filter: "blur(7px)" },
              {
                xPercent: 0,
                scale: 1,
                filter: "blur(0px)",
                duration: 1,
              },
              0,
            )
            .fromTo(
              aboutCopy,
              {
                clipPath: "inset(0% 0% 0% 100% round 22px)",
                xPercent: 18,
              },
              {
                clipPath: "inset(0% 0% 0% 0% round 22px)",
                xPercent: 0,
                duration: 1,
              },
              0,
            )
            .fromTo(
              aboutTitle,
              { xPercent: 28, opacity: 0, letterSpacing: "0.05em" },
              {
                xPercent: 0,
                opacity: 1,
                letterSpacing: "-0.015em",
                duration: 0.82,
              },
              0.08,
            )
            .fromTo(
              aboutCopyItems,
              { x: 34, opacity: 0 },
              {
                x: 0,
                opacity: 1,
                stagger: 0.055,
                duration: 0.62,
              },
              0.22,
            );
        }

        gsap.utils.toArray<HTMLElement>(".work-item").forEach((item, i) => {
          const media = item.querySelector(".work-item-media");
          const info = item.querySelector(".work-item-info");
          const fromLeft = i % 2 === 0;

          gsap.set(item, {
            transformStyle: "preserve-3d",
            transformPerspective: 1200,
            transformOrigin: "50% 50%",
          });

          gsap.fromTo(
            item,
            {
              xPercent: fromLeft ? -22 : 22,
              rotateY: fromLeft ? 18 : -18,
              scale: 0.9,
              opacity: 0,
            },
            {
              xPercent: 0,
              rotateY: 0,
              scale: 1,
              opacity: 1,
              ease: "power3.out",
              scrollTrigger: {
                trigger: item,
                start: "top 88%",
                end: "top 42%",
                scrub: 0.75,
              },
            },
          );

          gsap.fromTo(
            media,
            {
              clipPath: "inset(18% 14% 18% 14% round 30px)",
              z: -130,
              scale: 0.94,
            },
            {
              clipPath: "inset(0% 0% 0% 0% round 30px)",
              z: 0,
              scale: 1,
              ease: "power3.out",
              scrollTrigger: {
                trigger: item,
                start: "top 82%",
                end: "top 45%",
                scrub: 0.9,
              },
            },
          );

          gsap.fromTo(
            media?.querySelector("img") ?? [],
            { scale: 1.16, yPercent: -4 },
            {
              scale: 1.03,
              yPercent: 4,
              ease: "none",
              scrollTrigger: {
                trigger: item,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );

          gsap.from(info, {
            x: fromLeft ? 56 : -56,
            opacity: 0,
            ease: "power3.out",
            scrollTrigger: { trigger: item, start: "top 78%" },
          });

          gsap.to(item, {
            scale: 1.035,
            z: 70,
            ease: "power1.inOut",
            scrollTrigger: {
              trigger: item,
              start: "top 58%",
              end: "bottom 42%",
              scrub: 0.35,
              toggleActions: "play reverse play reverse",
            },
          });
        });

        gsap.utils.toArray<HTMLElement>(".proof-card").forEach((card, i) => {
          gsap.from(card, {
            opacity: 0,
            scale: 0.72,
            rotate: i % 2 ? 7 : -7,
            y: 50,
            ease: "back.out(1.5)",
            scrollTrigger: { trigger: card, start: "top 82%" },
          });

          // Count-up on the headline number — same "0 → 275 / 480 / 600"
          // odometer effect as the reference site's animated stat cards.
          // Parses a leading number (int or decimal) plus a trailing
          // suffix (%, +, or none) and animates a plain counter object,
          // writing the formatted text back on every tick.
          //
          // Reads the original value from `data-value` (set straight from
          // PROOF data), never from the element's live textContent. GSAP
          // renders a scroll-triggered tween's frame-0 state immediately
          // on creation, so the very first thing textContent ever shows is
          // the "0" starting point — if this effect ever ran a second time
          // on an already-mounted card (StrictMode's dev double-invoke,
          // Fast Refresh, etc.), reading textContent back would parse that
          // leftover "0" as the new target and permanently lock the card
          // at zero. data-value is never touched by the animation, so it's
          // always the true source value no matter how many times this runs.
          const valueEl = card.querySelector<HTMLElement>("strong");
          const raw = valueEl?.dataset.value?.trim() ?? "";
          const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
          if (valueEl && match) {
            const target = parseFloat(match[1]);
            const suffix = match[2];
            const decimals = match[1].includes(".")
              ? match[1].split(".")[1].length
              : 0;
            const counter = { val: 0 };
            gsap.to(counter, {
              val: target,
              duration: 1.7,
              ease: "power2.out",
              scrollTrigger: { trigger: card, start: "top 82%" },
              onUpdate: () => {
                valueEl.textContent = counter.val.toFixed(decimals) + suffix;
              },
            });
          }
        });

        gsap.from(".contact-form", {
          rotateX: 12,
          y: 80,
          opacity: 0,
          transformOrigin: "50% 0%",
          ease: "power3.out",
          scrollTrigger: { trigger: "#contact", start: "top 70%" },
        });
      });
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  /* Scroll-driven background colour crossfade
     Deferred behind loadMotion() — see src/shared/motion.ts. */
  useEffect(() => {
    const layer = bgLayerRef.current;
    if (!layer) return;

    const sectionEls = SCROLL_THEME.map((theme) => ({
      theme,
      el: document.getElementById(theme.id),
    })).filter(
      (s): s is { theme: (typeof SCROLL_THEME)[number]; el: HTMLElement } =>
        !!s.el,
    );

    let currentId = "";
    let cancelled = false;
    let st: { kill: () => void } | undefined;
    let apply = () => {};

    const onScroll = () => apply();
    const onResize = () => apply();

    loadMotion().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;
      apply = () => {
        const viewportCenter = window.scrollY + window.innerHeight / 2;
        let match: (typeof sectionEls)[number] | undefined;
        for (const s of sectionEls) {
          const rect = s.el.getBoundingClientRect();
          const top = window.scrollY + rect.top;
          const bottom = top + rect.height;
          if (viewportCenter >= top && viewportCenter < bottom) {
            match = s;
            break;
          }
        }
        if (!match) {
          match =
            viewportCenter <
            (sectionEls[0]?.el.getBoundingClientRect().top ?? 0) +
              window.scrollY
              ? sectionEls[0]
              : sectionEls[sectionEls.length - 1];
        }
        if (!match || match.theme.id === currentId) return;
        currentId = match.theme.id;
        gsap.to(layer, {
          backgroundColor: match.theme.bg,
          duration: 0.6,
          ease: "power2.out",
          overwrite: "auto",
        });
        document.body.setAttribute("data-tone", match.theme.id);
      };

      gsap.set(layer, { backgroundColor: SCROLL_THEME[0].bg });
      apply();
      st = ScrollTrigger.create({ onRefresh: apply });
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      st?.kill();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  /* Scroll progress bar */
  useEffect(() => {
    const bar = scrollBarRef.current;
    if (!bar) return;
    let hideTimer: number | undefined;
    const update = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      bar.style.width = total > 0 ? `${(window.scrollY / total) * 100}%` : "0%";
      document.body.classList.add("is-scrolling");
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        document.body.classList.remove("is-scrolling");
      }, 420);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      if (hideTimer) window.clearTimeout(hideTimer);
      document.body.classList.remove("is-scrolling");
    };
  }, []);

  /* Mobile nav panel — close on Escape, close if the viewport is
     resized back past the desktop breakpoint, and lock page scroll
     while it's open so it reads as a real overlay, not a section. */
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 860) setMobileNavOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileNavOpen]);

  /* Final pinned scene: Contact holds for one more viewport of scroll,
     matching the Hero's sticky feeling before the page reaches its end.
     Deferred behind loadMotion() — see src/shared/motion.ts. */
  useEffect(() => {
    const section = document.getElementById("contact");
    if (!section) return;

    let cancelled = false;
    let media: ReturnType<typeof gsapType.matchMedia> | undefined;

    loadMotion().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return;
      media = gsap.matchMedia();
      media.add(
        "(min-width: 761px) and (prefers-reduced-motion: no-preference)",
        () => {
          const grid = section.querySelector<HTMLElement>(".contact-grid");
          const footer = section.querySelector<HTMLElement>(".site-footer");

          /* Contact reveal frame: the scene arrives as a medium cinematic
           window, then opens to the full viewport as it reaches the pin.
           Clip-path is used instead of scaling the section, so the telephone
           canvas, text, and form stay sharp and the Proof Wall is untouched. */
          const expandTween = gsap.fromTo(
            section,
            {
              clipPath: "inset(12% 17% 12% 17% round 30px)",
              borderRadius: "30px",
            },
            {
              clipPath: "inset(0% 0% 0% 0% round 0px)",
              borderRadius: "0px",
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top 92%",
                end: "top top",
                scrub: 1.1,
                invalidateOnRefresh: true,
              },
            },
          );

          const pin = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: "+=55%",
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          });

          if (grid) {
            gsap.fromTo(
              grid,
              { y: 34, scale: 0.965 },
              {
                y: -10,
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: "top top",
                  end: "+=42%",
                  scrub: 0.75,
                },
              },
            );
          }

          if (footer) {
            gsap.fromTo(
              footer,
              { opacity: 0.45, y: 14 },
              {
                opacity: 1,
                y: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: "top top",
                  end: "+=50%",
                  scrub: 0.75,
                },
              },
            );
          }

          return () => {
            expandTween.scrollTrigger?.kill();
            expandTween.kill();
            pin.kill();
          };
        },
      );
    });

    return () => {
      cancelled = true;
      media?.revert();
    };
  }, []);

  /* Contact entrance — mirrors the Skills section's lively, one-by-one
     cascade (there it's the `.skill-cell` pop-in; here it's every
     piece of contact content) instead of the plain flat fade the
     generic `.reveal` class gives every other section. Targets are
     picked explicitly in DOM/reading order — eyebrow, title, email,
     each social link, then each form field/button — so they cascade
     top-to-bottom exactly like they're written on the page. Runs
     once on scroll-in (no scrub), independent of the outer `.contact
     reveal` fade already on the section wrapper. */
  useEffect(() => {
    const section = document.getElementById("contact");
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;

    loadMotion().then(({ gsap }) => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        const items = gsap.utils.toArray<HTMLElement>(
          ".contact-grid .section-eyebrow, .contact-title, .contact-email, .contact-links > a, .contact-form > *",
          section,
        );
        gsap.set(items, { opacity: 0, y: 30, scale: 0.94 });
        gsap.to(items, {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: "back.out(1.6)",
          duration: 0.7,
          stagger: 0.09,
          scrollTrigger: {
            trigger: ".contact-grid",
            start: "top 80%",
          },
        });
      }, section);
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  /* Contact link scroll-lighting */
  useEffect(() => {
    const COLORS = [
      "#7FE8C8", // skills — forest mint
      "#9C8C7D", // experience — warm editorial gray
      "#B86B2D", // process — champagne copper
      "#7E9C7A", // about — soft sage
      "#E8C988", // work — gallery gold
      "#7C99DD", // proof — midnight platinum
      "#B89874", // contact — warm taupe
    ];
    let hueIndex = 0;
    let ticking = false;
    const links =
      document.querySelectorAll<HTMLAnchorElement>(".contact-links a");
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const contactSection = document.getElementById("contact");
        if (!contactSection) {
          ticking = false;
          return;
        }
        const rect = contactSection.getBoundingClientRect();
        const visibleFrac = Math.max(
          0,
          Math.min(
            1,
            (window.innerHeight - rect.top) /
              (window.innerHeight + rect.height),
          ),
        );
        if (visibleFrac > 0.05) {
          hueIndex =
            Math.floor(visibleFrac * COLORS.length * 2) % COLORS.length;
          links.forEach((link, i) => {
            const c = COLORS[(hueIndex + i) % COLORS.length];
            link.style.setProperty("--link-glow", c);
            link.style.color = c;
            link.style.borderColor = c + "55";
            link.style.boxShadow = `0 0 18px ${c}44, 0 0 6px ${c}33`;
          });
        } else {
          links.forEach((link) => {
            link.style.color = "";
            link.style.borderColor = "";
            link.style.boxShadow = "";
          });
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Scroll-reveal */
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* Custom cursor removed — using the native mouse arrow everywhere. */

  /* Magnetic CTAs
     Deferred behind loadMotion() — see src/shared/motion.ts. */
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    loadMotion().then(({ gsap }) => {
      if (cancelled) return;
      [headerCTARef.current, resumeCTARef.current].forEach((item) => {
        if (!item) return;
        const onMove = (e: MouseEvent) => {
          const r = item.getBoundingClientRect();
          gsap.to(item, {
            x: (e.clientX - r.left - r.width / 2) * 0.35,
            y: (e.clientY - r.top - r.height / 2) * 0.35,
            duration: 0.3,
            ease: "power2.out",
          });
        };
        const onLeave = () =>
          gsap.to(item, {
            x: 0,
            y: 0,
            duration: 0.5,
            ease: "elastic.out(1.1,0.4)",
          });
        item.addEventListener("mousemove", onMove);
        item.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          item.removeEventListener("mousemove", onMove);
          item.removeEventListener("mouseleave", onLeave);
        });
      });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, []);

  /* Contact form */
  const onContactSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name");
    const email = fd.get("email");
    const company = fd.get("company") || "Not provided";
    const message = fd.get("message");
    if (!name || !email || !message) {
      void import("sonner").then(({ toast }) =>
        toast.error("Please fill in name, email, and message."),
      );
      return;
    }
    setMessageSent(true);
    if (messageResetTimerRef.current) {
      window.clearTimeout(messageResetTimerRef.current);
    }
    messageResetTimerRef.current = window.setTimeout(() => {
      setMessageSent(false);
      messageResetTimerRef.current = null;
    }, 2800);
    const text = `*New Contact Form Submission*%0A%0A*Name:* ${name}%0A*Email:* ${email}%0A*Company:* ${company}%0A*Message:* ${message}`;
    window.open(`https://wa.me/916304830339?text=${text}`, "_blank");
    void import("sonner").then(({ toast }) =>
      toast.success("Redirecting you to WhatsApp!"),
    );
  };

  const navigateToSection = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;

    setMobileNavOpen(false);
    setActiveNav(id === "contact" ? null : id);
    window.history.pushState({}, "", `#${id}`);

    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, {
        offset: -88,
        duration: 1.1,
      });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  };

  /* ── JSX ─────────────────────────────────────────────── */
  return (
    <>
      <PortfolioIntro />
      {/* Fixed background — colour crossfades per section on scroll */}
      <div id="bg-layer" ref={bgLayerRef} aria-hidden="true" />

      {/* Scroll progress bar */}
      <div id="scroll-bar" ref={scrollBarRef} aria-hidden="true" />

      {/* HEADER */}
      <header className="site-header">
        <div className="nav-pill">
          <a
            href="#hero"
            className="nav-logo"
            aria-label="Home"
            onClick={(event) => {
              event.preventDefault();
              setActiveNav(null);
              setMobileNavOpen(false);
              window.history.pushState({}, "", "#hero");
              if (lenisRef.current) {
                lenisRef.current.scrollTo(0, { immediate: true });
              } else {
                window.scrollTo({ top: 0, behavior: "auto" });
              }
            }}
          >
            KOTTU SAIKUMAR
          </a>
          <nav
            className="nav-items glass-radio-group"
            aria-label="Primary"
            data-active={activeNav ?? "none"}
          >
            {[
              ["skills", "Skills"],
              ["experience", "Experience"],
              ["process", "Process"],
              ["about", "About"],
              ["work", "Projects"],
              ["proof", "Proof"],
            ].map(([id, label]) => (
              <Fragment key={id}>
                <input
                  type="radio"
                  name="portfolio-nav"
                  id={`glass-nav-${id}`}
                  checked={activeNav === id}
                  onChange={() => setActiveNav(id)}
                />
                <label htmlFor={`glass-nav-${id}`}>
                  <a
                    href={`#${id}`}
                    onClick={(event) => navigateToSection(event, id)}
                  >
                    {label}
                  </a>
                </label>
              </Fragment>
            ))}
            <div className="glass-glider" aria-hidden="true" />
          </nav>
          <a
            href="#contact"
            className="nav-cta"
            ref={headerCTARef}
            onClick={(event) => navigateToSection(event, "contact")}
          >
            Get in touch
          </a>
          <button
            type="button"
            className="nav-toggle"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div
          id="mobile-nav-panel"
          className={`nav-mobile-panel${mobileNavOpen ? " is-open" : ""}`}
          aria-hidden={!mobileNavOpen}
        >
          <nav aria-label="Primary (mobile)">
            <a
              href="#skills"
              onClick={(event) => navigateToSection(event, "skills")}
            >
              Skills
            </a>
            <a
              href="#experience"
              onClick={(event) => navigateToSection(event, "experience")}
            >
              Experience
            </a>
            <a
              href="#process"
              onClick={(event) => navigateToSection(event, "process")}
            >
              Process
            </a>
            <a
              href="#about"
              onClick={(event) => navigateToSection(event, "about")}
            >
              About
            </a>
            <a
              href="#work"
              onClick={(event) => navigateToSection(event, "work")}
            >
              Projects
            </a>
            <a
              href="#proof"
              onClick={(event) => navigateToSection(event, "proof")}
            >
              Proof
            </a>
            <a
              href="#contact"
              className="nav-mobile-cta"
              onClick={(event) => navigateToSection(event, "contact")}
            >
              Get in touch
            </a>
          </nav>
        </div>
        {mobileNavOpen && (
          <div
            className="nav-mobile-scrim"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}
      </header>

      {/* MAIN — everything between the fixed header and the footer.
          Purely a semantic landmark: no styling hooks anywhere target
          this element, so it doesn't affect layout. */}
      <main>
        {/* HERO — ToonHub carousel */}
        <ToonHubHero />

        {/* MARQUEE — continuous drifting ticker of tools/stack, the same
          "trusted-by" infinite-strip motif used on the reference site
          right below its hero. */}
        <div className="lux-marquee" aria-hidden="true">
          <div className="lux-marquee-track">
            {[0, 1].map((dupe) => (
              <ul className="lux-marquee-list" key={dupe}>
                {SKILLS.map((s) => (
                  <li key={`${dupe}-${s.name}`}>
                    <span className="lux-marquee-dot" />
                    {s.name}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

        {/* SKILLS */}
        <section
          className="skills reveal section-world section-world--skills"
          id="skills"
        >
          <div className="section-gateway gateway-skills" aria-hidden="true" />
          <SkillsField
            color="#D8CDBA"
            lightColor="#FFF6E8"
            motif="glass"
            count={9}
          />
          <div className="skills-header">
            <span className="section-eyebrow">/ 01 — CAPABILITIES</span>
            <h2 className="skills-title">
              My <strong>Skills</strong>
            </h2>
          </div>
          <div className="skills-stage">
            <div className="skill-slab" ref={skillsSlabRef}>
              <div className="skill-slab-shine" aria-hidden="true" />
              <div className="skills-grid">
                {SKILLS.map((s) => (
                  <div className="skill-cell" key={s.name} title={s.name}>
                    <div className="skill-cell-icon">{renderSkillIcon(s)}</div>
                    <span className="skill-cell-name">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* EXPERIENCE */}
        <section
          className="experience reveal section-world section-world--experience"
          id="experience"
        >
          <div className="experience-pattern-bg" aria-hidden="true">
            <div className="experience-pattern-fill" />
          </div>
          <div
            className="section-gateway gateway-experience"
            aria-hidden="true"
          />
          <SectionCurtain variant="shutter" color="#1A0B12" />
          <ExperienceField
            color="#005F5D"
            lightColor="#0A9396"
            nodeCount={EXPERIENCE.length}
          />
          <div className="experience-header">
            <span className="section-eyebrow">/ 02 — WORK HISTORY</span>
            <h2 className="experience-title">
              My <strong>Experience</strong>
            </h2>
          </div>
          <div className="experience-list">
            {EXPERIENCE.map((exp, i) => (
              <article className="experience-card" key={i}>
                <div className="experience-card-meta">
                  <div className="experience-card-left">
                    {exp.logo && (
                      <picture>
                        <source
                          srcSet={exp.logo.replace(/\.png$/, ".webp")}
                          type="image/webp"
                        />
                        <img
                          src={exp.logo}
                          alt={exp.company}
                          className="experience-logo"
                          width={32}
                          height={32}
                          loading="lazy"
                        />
                      </picture>
                    )}
                    <span className="experience-company">
                      {exp.role} at {exp.company}
                    </span>
                  </div>
                  <span className="experience-period">{exp.period}</span>
                </div>
                <p className="experience-desc">{exp.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* PROCESS */}
        <section
          className="process reveal section-world section-world--process"
          id="process"
        >
          <div className="process-pattern-bg" aria-hidden="true">
            <div className="process-pattern-fill" />
          </div>
          <div className="section-gateway gateway-process" aria-hidden="true" />
          <SectionCurtain variant="iris" color="#FAF8F4" />
          <div
            className="premium-3d-scene process-circuit-world"
            aria-hidden="true"
          >
            <span className="circuit-node node-a" />
            <span className="circuit-node node-b" />
            <span className="circuit-node node-c" />
            <span className="circuit-node node-d" />
            <span className="circuit-path path-a" />
            <span className="circuit-path path-b" />
          </div>
          <div className="process-header">
            <span className="section-eyebrow">/ 03 — HOW I BUILD</span>
            <h2 className="process-title">
              My <strong>Process</strong>
            </h2>
            <p className="process-intro">
              A premium build should feel directed, not decorated. This section
              turns my workflow into a scroll-driven system map.
            </p>
          </div>
          <div className="process-rail" aria-hidden="true">
            <span className="process-rail-line" />
            <ProcessField
              color="#A97846"
              lightColor="#FFE3B8"
              stepCount={PROCESS.length}
            />
          </div>
          <div className="process-grid">
            {PROCESS.map((item) => (
              <article className="process-card" key={item.step}>
                <span className="process-step">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ABOUT */}
        <section
          className="about reveal section-world section-world--about"
          id="about"
        >
          <div className="section-gateway gateway-about" aria-hidden="true" />
          <SectionCurtain variant="dissolve" color="#0C2E22" />
          <div className="about-inner about-inner--split">
            <div className="about-illustration">
              <div className="about-flip-card">
                <div className="about-flip-content">
                  <div className="about-flip-front">
                    <picture>
                      <source
                        srcSet={withBase(
                          "/images/about/about-portrait-front.webp",
                        )}
                        type="image/webp"
                      />
                      <img
                        src={withBase("/images/about/about-portrait-front.png")}
                        alt="Sai Kumar, AI Engineer"
                        width={1086}
                        height={1448}
                        loading="lazy"
                      />
                    </picture>
                    <div className="about-flip-label">
                      <strong>About Me</strong>
                      <span>Full-Stack AI Developer</span>
                    </div>
                  </div>
                  <div className="about-flip-back">
                    <picture>
                      <source
                        srcSet={withBase(
                          "/images/about/about-portrait-back.webp",
                        )}
                        type="image/webp"
                      />
                      <img
                        src={withBase("/images/about/about-portrait-back.png")}
                        alt="Let's build the future"
                        width={1086}
                        height={1448}
                        loading="lazy"
                      />
                    </picture>
                    <div className="about-flip-back-content">
                      <span aria-hidden="true">&lt;/&gt;</span>
                      <strong>Hover to explore</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="about-copy">
              <span className="section-eyebrow">/ 04 — WHO I AM</span>
              <h2 className="about-title">
                About <strong>Me</strong>
              </h2>
              <p className="about-lede">
                I'm a passionate Full-Stack AI Developer with a strong
                foundation in Python, Machine Learning, and AI Engineering. I
                enjoy combining data-driven intelligence with clean,
                user-friendly interfaces to build impactful and scalable
                applications.
              </p>
              <p className="about-lede">
                My journey began during my engineering studies, where I
                developed a deep interest in Data Science and Artificial
                Intelligence. Since then, I've continuously expanded my skills
                across Machine Learning, Deep Learning, NLP, and full-stack
                development.
              </p>
              <p className="about-lede">
                Beyond coding, I enjoy exploring AI research trends,
                experimenting with ML models, and building practical projects
                that solve real-world problems. I actively maintain my work on
                GitHub and continuously learn from the evolving tech ecosystem.
              </p>
              <IntroAudioPlayer src={withBase("/audio/about-intro.mp3")} />
              <a
                href="https://drive.google.com/file/d/1dinXqMl82nn4RZt2OMEf1ajdir6K6NeH/view?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="about-cta"
                ref={resumeCTARef}
              >
                <span className="about-cta-icon" aria-hidden="true">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 16l4-4h-3V4h-2v8H8l4 4zM5 18v2h14v-2H5z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span className="about-cta-label">Download Resume</span>
                <span className="about-cta-loading" aria-hidden="true" />
                Download Resume ↓
              </a>
            </div>
          </div>
        </section>

        {/* PROJECTS */}
        <section
          className="work section-world section-world--work"
          id="work"
          ref={workSectionRef}
          data-project-view={projectView}
        >
          <div className="work-block-mask curtain-blinds" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <span className="work-mask-column curtain-bar" key={i} />
            ))}
          </div>
          <div className="work-header">
            <span className="section-eyebrow">/ 05 — SELECTED WORK</span>
            <h2 className="work-title">
              My <strong>Projects</strong>
            </h2>
            <div
              className="work-view-controls"
              data-view={projectView}
              data-press={projectViewPress ?? ""}
              aria-label="Project view controls"
            >
              <label
                className="claw-toggle-wrapper project-view-toggle"
                title={`Switch to ${projectView === "ring" ? "slider" : "ring"} view`}
              >
                <input
                  type="checkbox"
                  className="claw-toggle-input"
                  checked={projectView === "slider"}
                  onChange={() =>
                    changeProjectView(
                      projectView === "ring" ? "slider" : "ring",
                    )
                  }
                  aria-label={`Switch to ${projectView === "ring" ? "slider" : "ring"} view`}
                />
                <span className="claw-toggle-track" aria-hidden="true">
                  <span className="claw-toggle-slot">
                    <span className="claw-toggle-slot-fill" />
                  </span>
                  <span className="claw-toggle-core">
                    <span className="claw-toggle-core-gear" />
                    <span className="claw-toggle-core-inner" />
                  </span>
                  <span className="claw-machine-wrapper">
                    <span className="claw-machine-arm" />
                    <span className="claw-machine-joint" />
                  </span>
                </span>
                <small>{projectView === "ring" ? "Slider" : "Ring"}</small>
              </label>
              <span aria-hidden="true">
                {projectView === "ring" ? "⇄" : "↻"}
              </span>
              <span>
                {projectView === "ring" ? "Show slider" : "Show ring"}
              </span>
            </div>
          </div>
          {projectView === "ring" ? (
            <div className="work-viewport">
              <div
                className="work-track"
                ref={workTrackRef}
                style={
                  { "--quantity": projectRingItems.length } as CSSProperties
                }
              >
                {/* Every one of the 5 real projects is rendered twice,
                  back-to-back, so the ring has a fully populated 10-card
                  loop of real project videos (matching the reference
                  animation) instead of text/placeholder tiles. Each
                  project's pair of cards sits exactly opposite one another
                  on the circle — see PROJECT_RING_FRONT_DEPTH above for
                  why that keeps concurrent video playback capped at 5. */}
                {projectRingItems.map((p, i) => (
                  <div
                    className="work-card work-card--glass"
                    aria-label={p.name}
                    data-order={i}
                    key={`${p.id}-${i}`}
                    style={
                      {
                        "--index": i,
                        "--color-card":
                          PROJECT_CARD_COLORS[i % PROJECT_CARD_COLORS.length],
                      } as CSSProperties
                    }
                  >
                    <div className="work-card-media">
                      <LazyProjectVideo src={p.video} label={p.name} />
                    </div>
                    <div className="work-card-body">
                      <div className="work-card-title-row">
                        <span className="work-card-name">{p.name}</span>
                        <a
                          href={p.link}
                          className="work-card-link"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${p.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="work-slider"
              onKeyDown={(event) => {
                if (
                  event.key === "ArrowLeft" ||
                  event.key.toLowerCase() === "a"
                ) {
                  event.preventDefault();
                  moveProjectSlider(-1);
                }
                if (
                  event.key === "ArrowRight" ||
                  event.key.toLowerCase() === "d"
                ) {
                  event.preventDefault();
                  moveProjectSlider(1);
                }
              }}
              style={
                {
                  "--width": "300px",
                  "--height": "430px",
                  "--quantity": PROJECTS.length,
                } as CSSProperties
              }
            >
              <div
                className="work-slider-list"
                role="listbox"
                aria-label="Project carousel"
              >
                {PROJECTS.map((p, i) => {
                  const sourceIndex = i;
                  const accent =
                    PROJECT_CARD_COLORS[
                      sourceIndex % PROJECT_CARD_COLORS.length
                    ];
                  const isOpen = openProjectId === p.id;
                  const sliderOffset = getProjectSliderOffset(i);
                  const isActive = sliderOffset === 0;
                  return (
                    <div
                      className={`work-slider-item${isActive ? " is-active" : ""}`}
                      key={p.id}
                      role="option"
                      aria-selected={isActive}
                      aria-label={p.name}
                      tabIndex={isActive ? 0 : -1}
                      data-offset={sliderOffset}
                      onClick={() => setSliderActiveIndex(i)}
                      style={
                        {
                          "--position": sourceIndex + 1,
                          "--slider-offset": sliderOffset,
                          "--slider-distance": Math.abs(sliderOffset),
                        } as CSSProperties
                      }
                    >
                      <article className="project-card">
                        <div className="project-card-media">
                          <LazyProjectVideo src={p.video} label={p.name} />
                        </div>
                        <div className="project-card-body">
                          <div className="project-card-title-row">
                            <h3 className="project-card-title">{p.name}</h3>
                            <span className="project-card-info-wrap">
                              <button
                                type="button"
                                className="project-card-info-btn"
                                aria-label={
                                  isOpen
                                    ? `Hide description for ${p.name}`
                                    : `Show description for ${p.name}`
                                }
                                aria-expanded={isOpen}
                                onClick={() =>
                                  setOpenProjectId(isOpen ? null : p.id)
                                }
                              >
                                {isOpen ? <X size={13} /> : <Info size={13} />}
                              </button>
                              <span
                                className="project-card-tooltip"
                                role="tooltip"
                              >
                                {isOpen
                                  ? "Click to hide description"
                                  : "Click to view description"}
                              </span>
                            </span>
                          </div>

                          {isOpen ? (
                            <p className="project-card-description">
                              {p.description}
                            </p>
                          ) : (
                            <>
                              <div className="project-card-row">
                                <span className="project-card-label">
                                  Focus
                                </span>
                                <span
                                  className="project-card-value"
                                  style={{ color: `rgb(${accent})` }}
                                >
                                  {p.focus}
                                </span>
                              </div>
                              <div className="project-card-highlight-row">
                                <div className="project-card-highlight-col">
                                  <span className="project-card-label">
                                    Highlight
                                  </span>
                                  <p className="project-card-highlight-text">
                                    {p.highlight}
                                  </p>
                                  <span
                                    className="project-card-underline"
                                    style={{
                                      background: `linear-gradient(90deg, rgb(${accent}), rgba(${accent}, 0.35))`,
                                    }}
                                  />
                                </div>
                                <a
                                  href={p.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="project-card-link project-card-link--animated"
                                  aria-label={`View ${p.name}`}
                                  style={
                                    {
                                      borderColor: `rgba(${accent}, 0.55)`,
                                      color: `rgb(${accent})`,
                                      "--clr": `rgb(${accent})`,
                                    } as CSSProperties
                                  }
                                >
                                  <span className="project-card-link-icon">
                                    <svg viewBox="0 0 14 15" aria-hidden="true">
                                      <path
                                        d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                    <svg
                                      viewBox="0 0 14 15"
                                      aria-hidden="true"
                                      className="project-card-link-icon-copy"
                                    >
                                      <path
                                        d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                  </span>
                                  <span className="project-card-link-label">
                                    View code
                                  </span>
                                </a>
                              </div>
                            </>
                          )}
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
              <div
                className="work-slider-nav"
                aria-label="Project carousel navigation"
              >
                <button
                  type="button"
                  className="work-slider-nav-button work-slider-nav-button--prev"
                  onClick={() => moveProjectSlider(-1)}
                  aria-label="Previous project"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9.586 4 3 10.586a2 2 0 0 0 0 2.828L9.586 20A2 2 0 0 0 13 18.586V16h7a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-7V5.414A2 2 0 0 0 9.586 4Z" />
                  </svg>
                  <span>Prev</span>
                </button>
                <span className="work-slider-counter" aria-live="polite">
                  {String(sliderActiveIndex + 1).padStart(2, "0")} /{" "}
                  {String(PROJECTS.length).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  className="work-slider-nav-button work-slider-nav-button--next"
                  onClick={() => moveProjectSlider(1)}
                  aria-label="Next project"
                >
                  <span>Next</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14.414 4A2 2 0 0 0 11 5.414V8H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h7v2.586A2 2 0 0 0 14.414 20L21 13.414a2 2 0 0 0 0-2.828L14.414 4Z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* PROOF */}
        <section
          className="proof reveal section-world section-world--proof"
          id="proof"
        >
          <div className="section-gateway gateway-proof" aria-hidden="true" />
          <SectionCurtain variant="scanline" color="#120E22" />
          <ProofField
            color="#E8B04B"
            lightColor="#FFE39A"
            nodeCount={PROOF.length}
          />
          <div className="proof-header">
            <span className="section-eyebrow">/ 06 — OUTCOMES</span>
            <h2 className="proof-title">
              Proof <strong>Wall</strong>
            </h2>
          </div>
          <div className="proof-orbit" aria-hidden="true" />
          <div className="proof-grid">
            {PROOF.map((item) => (
              <article className="proof-card" key={item.label}>
                <strong data-value={item.value}>{item.value}</strong>
                <span>{item.label}</span>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CONTACT */}
        <section
          className="contact reveal section-world section-world--contact"
          id="contact"
        >
          <div className="section-gateway gateway-contact" aria-hidden="true" />
          <ContactField />
          <div className="contact-grid">
            <div className="contact-info">
              <span className="section-eyebrow">/ 07 — LET'S CONNECT</span>
              <h2 className="contact-title">
                Get in <strong>Touch</strong>
              </h2>
              <a
                href="mailto:kottusaikumar2003@gmail.com"
                className="contact-email"
              >
                kottusaikumar2003@gmail.com
              </a>
              <div className="contact-links">
                <a
                  className="contact-social-icon contact-social-icon--github"
                  href="https://github.com/kottusaikumar"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                >
                  <span className="contact-social-tooltip" aria-hidden="true">
                    GitHub
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.29-1.69-1.29-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.26 3.38.96.1-.75.41-1.27.74-1.56-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.16 1.18A10.95 10.95 0 0 1 12 6.09c.98 0 1.94.13 2.85.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.41-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.25c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z" />
                  </svg>
                </a>
                <a
                  className="contact-social-icon contact-social-icon--linkedin"
                  href="https://www.linkedin.com/in/sai-kumar-10541b269"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  <span className="contact-social-tooltip" aria-hidden="true">
                    LinkedIn
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5.34 3.5A2.84 2.84 0 1 1 5.33 9.18 2.84 2.84 0 0 1 5.34 3.5ZM2.9 10.95h4.87V21H2.9V10.95Zm7.67 0h4.67v1.38h.07c.65-1.23 2.24-2.53 4.61-2.53 4.93 0 5.84 3.25 5.84 7.47V21h-4.86v-3.31c0-.79-.02-1.8-1.1-1.8-1.1 0-1.27.86-1.27 1.74V21h-4.86V10.95h.9Z"
                      transform="translate(-2)"
                    />
                  </svg>
                </a>
                <a
                  className="contact-social-icon contact-social-icon--x"
                  href="https://x.com/433Saikumar"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X / Twitter"
                >
                  <span className="contact-social-tooltip" aria-hidden="true">
                    X / Twitter
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.26-8.3L2.98 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.72L8.44 4.05H6.6L17.8 19.84Z" />
                  </svg>
                </a>
              </div>
            </div>
            <form className="contact-form" onSubmit={onContactSubmit}>
              <label className="sr-only" htmlFor="contact-name">
                Your name
              </label>
              <input
                id="contact-name"
                type="text"
                name="name"
                placeholder="Your name"
              />
              <label className="sr-only" htmlFor="contact-email">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                name="email"
                placeholder="Email"
              />
              <label className="sr-only" htmlFor="contact-company">
                Company or recruiter
              </label>
              <input
                id="contact-company"
                type="text"
                name="company"
                placeholder="Company / Recruiter (optional)"
              />
              <label className="sr-only" htmlFor="contact-message">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                placeholder="Message regarding job opportunity, role, or collaboration*"
              />
              <button
                type="submit"
                className={`whatsapp-send-button${messageSent ? " is-sent" : ""}`}
                aria-label={
                  messageSent
                    ? "Message sent to WhatsApp"
                    : "Send message via WhatsApp"
                }
              >
                <span className="whatsapp-send-outline" aria-hidden="true" />
                <span className="whatsapp-brand" aria-hidden="true">
                  <span className="whatsapp-brand-sign">
                    <svg viewBox="0 0 16 16">
                      <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                    </svg>
                  </span>
                  <span className="whatsapp-brand-text">WhatsApp</span>
                </span>

                <span
                  className="whatsapp-send-state whatsapp-send-state--default"
                  aria-hidden={messageSent}
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M14.22 21.63c-1.18 0-2.85-.83-4.17-4.8l-.72-2.16-2.16-.72c-3.96-1.32-4.79-2.99-4.79-4.17 0-1.17.83-2.85 4.79-4.18l8.49-2.83c2.12-.71 3.89-.5 4.98.58 1.09 1.08 1.3 2.86.59 4.98l-2.83 8.49c-1.33 3.98-3 4.81-4.18 4.81Z"
                      fill="currentColor"
                    />
                    <path
                      d="m9.58 14.18 4.64-4.65"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="whatsapp-send-letters">
                    {[..."Send Message"].map((letter, index) => (
                      <span
                        key={`${letter}-${index}`}
                        style={{ "--i": index } as CSSProperties}
                      >
                        {letter === " " ? "\u00a0" : letter}
                      </span>
                    ))}
                  </span>
                </span>

                <span
                  className="whatsapp-send-state whatsapp-send-state--sent"
                  aria-hidden={!messageSent}
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 22.25C6.35 22.25 1.75 17.65 1.75 12S6.35 1.75 12 1.75 22.25 6.35 22.25 12 17.65 22.25 12 22.25Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="m7.75 12.05 2.83 2.83 5.67-5.67"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="whatsapp-send-letters">
                    {[..."Sent"].map((letter, index) => (
                      <span
                        key={`${letter}-${index}`}
                        style={{ "--i": index + 4 } as CSSProperties}
                      >
                        {letter}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            </form>
          </div>
          <footer className="site-footer">
            <span>© 2026 Kottu Saikumar</span>
            <span>Built with Three.js &amp; GSAP</span>
          </footer>
        </section>
      </main>

      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </>
  );
}
