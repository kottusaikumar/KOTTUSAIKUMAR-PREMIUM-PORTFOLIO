// The 4 rotating hero-carousel slides (character art + role label)
// shown at the top of the page, before the user starts scrolling.
//
// Each slide's artwork lives locally at
// `public/images/hero/<id>-<width>w.<ext>` as a set of responsive
// AVIF/WebP/PNG variants (see public/images/hero — generated from the
// original 2160x2880 source art). `id` + `HERO_IMAGE_WIDTHS` below are
// enough for Hero.tsx to build the full srcset for each format; there
// is no external (Figma-hosted) URL left anywhere in this data.
export const HERO_IMAGE_WIDTHS = [480, 900, 1350, 1800] as const;

// Intrinsic pixel size of the original source art all variants were
// downscaled from — used to give the rendered <img> correct width/
// height attributes (aspect-ratio 0.75) so the browser can reserve
// its box before any bytes arrive, preventing layout shift.
export const HERO_IMAGE_NATURAL_SIZE = { width: 2160, height: 2880 };

export const TOON_IMAGES = [
  {
    id: "full-stack-ai-developer",
    bg: "#F4845F",
    label: "Full-Stack AI Developer",
  },
  {
    id: "data-scientist",
    bg: "#6BBF7A",
    label: "Data Scientist",
  },
  {
    id: "data-analyst",
    bg: "#E882B4",
    label: "Data Analyst",
  },
  {
    id: "ai-ml-engineer",
    bg: "#6EB5FF",
    label: "AI/ML Engineer",
  },
];

// Subtle film-grain noise texture painted over the hero as a data URI
// (keeps it a single dependency-free asset instead of an image file).
export const GRAIN_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E`;
