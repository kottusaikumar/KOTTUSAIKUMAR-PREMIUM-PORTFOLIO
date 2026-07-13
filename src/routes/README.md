# Routes

TanStack Router uses **file-based routing**, rendered entirely client-side
(no SSR — `src/main.tsx` mounts the router into the static `index.html`
shell). Every `.tsx` file in this directory defines a route. Do **not**
create `src/pages/`, `src/routes/_app/index.tsx`, or `app/layout.tsx` —
those are Next.js / Remix conventions. The only root layout is
`src/routes/__root.tsx`.

## Conventions

| File                     | URL                                                     |
| ------------------------ | ------------------------------------------------------- |
| `index.tsx`              | `/`                                                     |
| `about.tsx`              | `/about`                                                |
| `users/index.tsx`        | `/users`                                                |
| `users/$id.tsx`          | `/users/:id` (dynamic — bare `$`, no curly braces)      |
| `posts/{-$category}.tsx` | `/posts/:category?` (optional segment)                  |
| `files/$.tsx`            | `/files/*` (splat — read via `_splat` param, never `*`) |
| `_layout.tsx`            | layout route (renders children via `<Outlet />`)        |
| `__root.tsx`             | app shell — wraps every page; preserve `<Outlet />`     |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

## This project's routes

- `index.tsx` (`/`) is intentionally thin — it only imports and renders
  `PortfolioPage` from `src/components/layout/PortfolioPage.tsx`. The
  actual page content, data, styles, and animated backgrounds live
  outside this folder; see the root `README.md` for the full map.
- `__root.tsx` is the app shell: `<html>`/`<head>`, font links, and the
  global stylesheet link. It wraps every route.
