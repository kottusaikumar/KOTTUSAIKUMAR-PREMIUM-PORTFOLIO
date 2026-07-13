// The Projects ring intentionally renders every project's video twice
// (two cards, opposite sides of the ring — see PROJECT_RING_FRONT_DEPTH
// in PortfolioPage.tsx), and the slider renders a third copy of the same
// five clips. Without coordination that means each unique .mp4 could be
// requested from the network 2-3 times.
//
// This module keys an in-flight/resolved fetch by the clip's URL, so no
// matter how many <video> elements point at the same src, exactly one
// network request is made per unique clip. Every consumer awaits the same
// promise and gets back an object URL backed by one shared Blob.
const sharedVideoRequests = new Map<string, Promise<string>>();

export function getSharedVideoSrc(originalSrc: string): Promise<string> {
  const existing = sharedVideoRequests.get(originalSrc);
  if (existing) return existing;

  const request = fetch(originalSrc)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch video: ${originalSrc}`);
      return res.blob();
    })
    .then((blob) => URL.createObjectURL(blob))
    .catch(() => {
      // Network/CORS failure: fall back to the original URL so the
      // <video> tag can still attempt to load it directly rather than
      // rendering nothing.
      return originalSrc;
    });

  sharedVideoRequests.set(originalSrc, request);
  return request;
}
