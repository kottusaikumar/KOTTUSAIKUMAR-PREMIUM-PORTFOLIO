import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Vite's `base` (see vite.config.ts / VITE_BASE_PATH) prefixes every
    // built asset URL, but the router doesn't know about it on its own —
    // without this, in-app <Link> navigation (e.g. the 404 page's "Go
    // home" link) would resolve to the domain root instead of this
    // subpath on a GitHub Pages project page deployment.
    basepath: import.meta.env.BASE_URL,
  });

  return router;
};
