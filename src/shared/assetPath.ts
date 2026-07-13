// Assets referenced by a plain string path (video/image/audio src
// values, mostly in *.data.ts files) point at files in `public/` and
// are NOT run through Vite's module resolution — so unlike imported
// assets, Vite's `base` config (see vite.config.ts) does not
// automatically prefix them. A hardcoded "/images/foo.png" always
// resolves against the domain root, which is wrong the moment this
// site is deployed under a subpath (e.g. a GitHub Pages project page
// at username.github.io/repo-name/).
//
// `withBase` prepends whatever base path Vite was actually built with
// (import.meta.env.BASE_URL — "/" by default, or e.g.
// "/repo-name/" when VITE_BASE_PATH is set) to a root-relative public
// asset path, so these references stay correct under any base.
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const trimmedBase = base.endsWith("/") ? base : `${base}/`;
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${trimmedBase}${trimmedPath}`;
}
