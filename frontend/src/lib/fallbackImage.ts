/* source.unsplash.com was the fallback everywhere in this app and was
 * discontinued — it now answers 503, so every "missing image" placeholder was
 * itself a broken image. The backend already serves a real cover photo or its
 * own SVG from /place-photo/:id, so this is only the last resort when even
 * that URL is absent. Inline, so it cannot 503 either. */
export const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="No photo available">
      <rect width="400" height="300" fill="#f1f5f9"/>
      <g fill="none" stroke="#94a3b8" stroke-width="6" stroke-linecap="round">
        <path d="M150 130v60M150 130a14 14 0 0 1 28 0v22a14 14 0 0 1-28 0z"/>
        <path d="M232 190v-60c14 0 22 10 22 24s-8 18-22 18"/>
      </g>
      <text x="200" y="232" font-family="system-ui,sans-serif" font-size="15" fill="#94a3b8" text-anchor="middle">No photo yet</text>
    </svg>`
  );
