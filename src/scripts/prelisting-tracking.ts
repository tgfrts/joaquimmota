/** Preserve the original Doop Tools contract: only a shared link with `t` records a view. */
export function trackPrelistingView(location: Pick<Location, 'search' | 'pathname'>, fetchImpl: typeof fetch = fetch): void {
  const token = new URLSearchParams(location.search).get('t');
  if (!token) return;
  const slug = location.pathname.split('/').filter(Boolean).pop();
  if (!slug) return;

  // Analytics must never prevent a presentation from opening, including offline.
  try {
    void fetchImpl('https://doop-tools.pages.dev/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, token }),
    }).catch(() => {});
  } catch {
    // Some embedded browsers can reject the request synchronously.
  }
}
