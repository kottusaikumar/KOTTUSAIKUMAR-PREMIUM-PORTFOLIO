# public

Static files served as-is at the site root (e.g. `public/audio/about-intro.mp3`
is served at `/audio/about-intro.mp3`).

| Path                             | Used by                                    | Referenced from                                            |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `images/about/*.png`              | The About section's flip portrait card      | `components/layout/PortfolioPage.tsx`                       |
| `images/branding/vajra-logo.png`  | The company logo on Experience cards        | `features/experience/experience.data.ts` → each entry's `logo` |
| `media/contact-phone-scrub/*.jpg` | The Contact section's scroll-scrubbed rotary phone sequence (frames 001-150) | `features/contact/contactScrubber.js` |
| `projects/videos/*.mp4`           | The 5 "My Projects" cards                   | `features/projects/projects.data.ts` → each entry's `video`  |
| `audio/about-intro.mp3`           | The "Listen to My Introduction" player      | `components/layout/PortfolioPage.tsx`                       |
| `favicon.ico`, `favicon.png`, `apple-touch-icon.png` | Browser tab / home-screen icons | Linked from `index.html` — left at the root since browsers/crawlers conventionally request `/favicon.ico` directly |

When adding a new project video: drop the `.mp4` into `projects/videos/`,
then point a `video` field at it in `src/features/projects/projects.data.ts`.
