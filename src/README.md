# src

Feature-folder layout: each of the portfolio's 7 sections owns one folder
under `features/`, containing everything specific to that section (its
animated background "scene", its content data, and any bespoke UI it
needs). Code shared *across* every section lives outside `features/`.

```
src/
├── features/            One folder per portfolio section
│   ├── hero/
│   ├── skills/
│   ├── experience/
│   ├── process/
│   ├── about/
│   ├── projects/
│   ├── proof/
│   └── contact/
├── components/
│   ├── layout/           Cross-section chrome: the page itself, the
│   │                      section-transition curtain, the first-load intro
│   └── ui/                Generic shadcn/ui primitives (just `sonner`
│                           toast — see ui/README.md for why the rest
│                           of the shadcn scaffold was removed)
├── shared/                State genuinely shared by every section
│                           (currently just the scroll-driven background
│                           colour theme)
├── styles/                Global CSS, split into ordered partials —
│                           see styles/README.md
├── lib/                   App-wide infra: the `cn()` class-merge helper,
│                           client-side error reporting (React error boundary)
├── types/                 Ambient TypeScript module declarations
├── main.tsx               Client entry point — mounts the router into
│                           index.html's #root. There is no server render
│                           pass; the whole app renders in the browser.
├── routes/, router.tsx,   TanStack Router's file-based routing. Framework
│   routeTree.gen.ts       convention — left at the src root and untouched
│   (generated)            by this reorg.
└── styles.css             Tailwind/shadcn base stylesheet from the
                            project scaffold (unrelated to the portfolio's
                            actual design — see styles/README.md)
```

## Anatomy of a `features/<section>` folder

Using `features/experience/` as an example:

| File                        | What it is                                                              |
| ---------------------------- | -------------------------------------------------------------------------- |
| `ExperienceField.tsx`        | React wrapper that mounts the section's Three.js background on a `<canvas>` and wires its scroll progress to GSAP `ScrollTrigger`. |
| `experienceTimeline.js`      | The actual Three.js scene implementation (plain `.js`, not React) that `ExperienceField.tsx` lazy-loads. |
| `experience.data.ts`         | The section's content — edit this to change copy without touching any component or CSS. |

Not every section has all three — e.g. `about/` only has
`IntroAudioPlayer.tsx` (its 3D scene was retired when the section became a
hover-flip photo card instead; see below), and `projects/` has
`AutoplayVideo.tsx` (a `<video>` autoplay helper, not a 3D scene) instead
of a Three.js pair.

## What actually renders each section

`components/layout/PortfolioPage.tsx` is the single file that composes
every section's JSX in order and owns the shared GSAP/Lenis/ScrollTrigger
orchestration (smooth scroll, the background colour crossfade, curtain
transitions, magnetic buttons, the contact form). It's intentionally
*not* split into one-component-per-section — see the comment at the top
of that file for why — but it only imports from `features/*`, so a
change to one section's content or background never requires touching
another section's code.

## Dead code removed during this reorg

A few files existed but were never actually imported by anything (found
by grepping every import across `src/`):

- `AboutField.tsx` + `aboutOrbit.js` — the About section's original 3D
  orbit scene, superseded by the current hover-flip portrait card.
- `heroScene.js` — an earlier 3D hero, superseded by the current 2D
  character carousel (`features/hero/Hero.tsx`).
- `tunnelShader.js` — a GLSL shader pair only that old hero scene used.
- `workGallery.js` — an earlier 3D "museum vitrine" scene for Projects,
  superseded by the current video-card ring/slider gallery.
- ~40 unused shadcn/ui primitives (button, dialog, card, table, etc.)
  that were scaffolded but never imported anywhere — see
  `components/ui/README.md`.
- 10 unused trailing frames in the Contact section's scroll-scrubbed
  image sequence (`public/media/contact-phone-scrub/` — the scene only
  ever requested frames 001-150).

None of this changes any rendered UI or animation — it's exclusively
files that had zero references anywhere in the codebase.
