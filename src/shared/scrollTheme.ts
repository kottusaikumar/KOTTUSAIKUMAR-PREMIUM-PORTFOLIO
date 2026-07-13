// Background colour each section crossfades the page into as the
// user scrolls past it — read by the scroll-driven background
// layer effect in components/layout/PortfolioPage.tsx. Shared
// across every section (not owned by one feature folder), so it
// lives in src/shared rather than under src/features/*.
export const SCROLL_THEME = [
  { id: "skills", bg: "#071311" },
  { id: "experience", bg: "#1A0B12" }, // Oxblood & Brass — cinematic deep red strata
  { id: "process", bg: "#EFE0C7" }, // Champagne circuit machine
  { id: "about", bg: "#0C2E22" }, // Emerald & Gold — deep forest
  { id: "work", bg: "#101010" }, // Dark glass-card carousel
  { id: "proof", bg: "#B57CA8" }, // midtone of the teal → peach → purple gradient
  { id: "contact", bg: "#050505" }, // Vintage rotary telephone close
];
