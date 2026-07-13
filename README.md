# Kottu Saikumar — Portfolio

A single-page, scroll-driven portfolio site (static React SPA, built with
Vite + TanStack Router + Three.js + GSAP). This README is a map of the
project — start here if you're new to the codebase and want to know
**where to make a change**.

> **Static site.** This project builds to a pure static bundle
> (`npm run build` → `dist/`: HTML, CSS, JS, and assets only) with no
> Node.js server, SSR, or serverless functions involved at runtime. It can
> be deployed to any static host (GitHub Pages, Netlify, S3/CloudFront,
> etc.) by uploading the contents of `dist/`.

## Quick orientation

| I want to...                                          | Go to                                              |
| ------------------------------------------------------- | ----------------------------------------------------- |
| Edit one section's text, links, or stats                 | `src/features/<section>/*.data.ts`                     |
| Change a section's colors or layout                      | `src/styles/portfolio/` (see styles/README.md)         |
| Change the nav, hero, or how sections are assembled      | `src/components/layout/PortfolioPage.tsx`              |
| Change one section's animated 3D/particle background     | `src/features/<section>/`                              |
| Add/replace a video, image, or other static file          | `public/` (see public/README.md)                       |
| Change the page shell / route composition                | `src/routes/`                                          |
| Change `<head>` tags (title, meta, favicons, fonts)       | `index.html`                                           |

## Folder structure

```
portfolio/
├── index.html                       Static HTML shell: <head> meta/og/twitter tags, favicons,
│                                       font preconnects, and the <script> that loads main.tsx
├── public/                          Static files served as-is (see public/README.md)
│   ├── images/about/                 About section portrait (front/back)
│   ├── images/branding/              Company logo used in Experience cards
│   ├── media/contact-phone-scrub/    Contact section's scroll-scrubbed image sequence
│   ├── projects/videos/              The 5 project demo clips shown in "My Projects"
│   ├── audio/                        "Listen to My Introduction" clip
│   └── favicon.ico, favicon.png, apple-touch-icon.png
│
├── src/
│   ├── main.tsx                       Client entry point: mounts the router into
│   │                                   index.html's #root — the whole app renders in
│   │                                   the browser, there is no server render pass
│   ├── routes/                       TanStack Router file-based routes (see routes/README.md)
│   │   ├── __root.tsx                  App shell component: <Outlet/>, 404/error boundaries
│   │   └── index.tsx                   Route "/" — wires up PortfolioPage
│   ├── router.tsx,
│   │   routeTree.gen.ts (generated) Client-side router wiring — file-based routing requires
│   │                                   these to stay at the src root; not touched by this reorg
│   │
│   ├── features/                     One folder per portfolio section — see src/README.md
│   │   ├── hero/          skills/     experience/   process/
│   │   └── about/         projects/   proof/        contact/
│   │       Each holds that section's Three.js background scene (if it
│   │       has one), its content data, and any section-specific UI.
│   │
│   ├── components/
│   │   ├── layout/                   Cross-section chrome, used by every section:
│   │   │   ├── PortfolioPage.tsx       Nav + all 7 sections + shared scroll/animation logic
│   │   │   ├── SectionCurtain.tsx      The section-open transition wipe
│   │   │   └── PortfolioIntro.tsx      First-load intro overlay
│   │   └── ui/                       Generic shadcn/ui primitives — just `sonner` (toasts) is
│   │                                   actually used; see ui/README.md
│   │
│   ├── shared/
│   │   └── scrollTheme.ts            Per-section background color the page crossfades to —
│   │                                   the one piece of content genuinely shared by every section
│   │
│   ├── styles/
│   │   ├── portfolio/                All portfolio-specific CSS, split into ordered partials
│   │   │   └── index.css               (see styles/README.md for why it's split this way)
│   │   └── README.md
│   │
│   ├── lib/                          App-wide infra, not portfolio-specific
│   │   ├── utils.ts                    shadcn's `cn()` class-merge helper
│   │   └── lovable-error-reporting.ts  Client-side error reporting (React error boundary)
│   │
│   ├── types/
│   │   └── portfolio-scenes.d.ts     Ambient types for the plain-.js Three.js scene modules
│   │
│   └── styles.css                    Tailwind/shadcn base stylesheet (framework-level scaffold,
│                                        unrelated to this site's actual design)
│
├── package.json, vite.config.ts, tsconfig.json, components.json, etc.   Build tooling config
```

See `src/README.md` for a closer look at how a `features/<section>` folder
is put together, and a list of the dead code removed while reorganizing.

## Running the project

```
npm install
npm run dev       # local dev server
npm run build     # static production build → dist/
npm run preview   # serve the dist/ build locally to sanity-check it
```

## Deploying (static hosting)

`npm run build` produces a self-contained static site in `dist/` — plain
HTML, CSS, JS, and copied assets, no Node.js runtime required to serve it.
Upload the contents of `dist/` to any static host:

- **GitHub Pages**: push `dist/` to the `gh-pages` branch (or a repo
  configured to publish from `docs/`/`dist/`), e.g. via the
  `peaceiris/actions-gh-pages` GitHub Action.
- **Netlify / Vercel (static) / S3 / Cloudflare Pages**: point the build
  command at `npm run build` and the publish directory at `dist/`.

If deploying under a sub-path (e.g. `https://user.github.io/repo-name/`),
set `base: "/repo-name/"` in `vite.config.ts` before building.
