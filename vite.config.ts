import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// Pure static build: no SSR, no server runtime, no serverless functions.
// `vite build` emits plain HTML/CSS/JS/assets into dist/, deployable as-is
// to any static host (GitHub Pages, Netlify, S3, etc). `tanstackRouter` here
// only runs its file-based route codegen (routeTree.gen.ts); with no
// `target: "react-start"` it does not wire up any server entry.
export default defineConfig({
  // GitHub Pages *project* pages (e.g. username.github.io/repo-name/)
  // serve the site from a subpath, not the domain root — every
  // absolute asset URL the build emits needs to be prefixed with that
  // subpath, or every JS/CSS/image request 404s. GitHub Pages *user/org*
  // pages (username.github.io) and custom domains serve from the root
  // and need base: "/".
  //
  // This was previously hardcoded to "/" with no way to override it,
  // which is only correct for a root deployment. Set VITE_BASE_PATH at
  // build time to override it, e.g. for this repo,
  // "KOTTUSAIKUMAR-PREMIUM-PORTFOLIO", deployed as a GitHub Pages
  // project page:
  //   VITE_BASE_PATH=/KOTTUSAIKUMAR-PREMIUM-PORTFOLIO/ npm run build
  // Left unset, it defaults to "/" — i.e. today's behavior is
  // unchanged unless this is explicitly set.
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    tsConfigPaths(),
    // This app only ever has one route ("/"), so per-route lazy chunking
    // buys nothing (the component is needed on first paint, always) while
    // adding an extra network round-trip before the hero can render.
    // autoCodeSplitting stays off; route code is bundled with the entry.
    tanstackRouter({ autoCodeSplitting: false }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
    // Matches the dedupe list the original SSR build's Lovable config
    // applied. Without it, a stray nested copy of react/react-dom pulled
    // in by any dependency can end up bundled twice — larger JS payload
    // and, for react-dom, a real risk of "Invalid hook call" at runtime.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  css: {
    // The original SSR build ran Lightning CSS at build time (see its
    // vite-tanstack-config wrapper). This build was using Vite's default
    // (no dedicated vendor-prefixing step at all), so any hand-written
    // -webkit-backdrop-filter fallback that a theme file *forgot* to pair
    // with the unprefixed property ships un-prefixed and simply doesn't
    // render the frosted-glass blur on Safari/iOS. Lightning CSS adds the
    // correct vendor prefixes for the browserslist target automatically,
    // consistently, for every rule, and produces smaller/faster-parsing
    // minified CSS than the default pipeline.
    transformer: "lightningcss",
  },
  build: {
    outDir: "dist",
    // No IE/legacy targets to support here; a modern baseline target
    // avoids emitting legacy-syntax transpilation/polyfill helpers that
    // this audience's browsers never execute, and unlocks smaller output
    // (native classes, native async/await, etc).
    target: "es2020",
    cssMinify: "lightningcss",
    modulePreload: {
      // Vite's default behaviour adds a <link rel="modulepreload"> for
      // every chunk reachable from the entry module graph, including
      // ones only ever reached through a dynamic import() (see
      // src/shared/motion.ts). That's normally a helpful prefetch hint,
      // but motion-vendor (GSAP + ScrollTrigger + Lenis, ~50KB gzip) is
      // intentionally not needed until after first paint — on a
      // throttled mobile connection, preloading it anyway means it
      // competes for bandwidth against react-vendor/tanstack-vendor/
      // vendor, the chunks the initial render actually is blocked on.
      // Filtering it out of the injected list lets the browser fetch it
      // lazily, on its own schedule, once the dynamic import actually
      // runs post-mount.
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !dep.includes("motion-vendor")),
    },
    // three.js alone is ~185kB gzipped; splitting it (and the other big,
    // rarely-changing vendor libs) into their own chunks means a content
    // change in app code doesn't bust the cache for vendor code the
    // browser already has, and lets the browser fetch them in parallel
    // instead of one monolithic bundle.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/three/")) return "three-vendor";
          if (id.includes("/gsap/") || id.includes("/lenis/"))
            return "motion-vendor";
          if (
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("/@tanstack/")) return "tanstack-vendor";
          return "vendor";
        },
      },
    },
  },
});
