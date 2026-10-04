/** Draw once in the browser, so a cached static page changes selection on each load. */
export function bindFeaturedProperties(section: HTMLElement, random = Math.random): void {
  const candidates = Array.from(section.querySelectorAll<HTMLElement>('[data-featured-card]'));
  if (!candidates.length) return;
  const chosen = Math.floor(random() * candidates.length);
  candidates.forEach((card, index) => {
    card.hidden = index !== chosen;
    card.querySelectorAll<HTMLImageElement>('img').forEach(image => { image.loading = card.hidden ? 'lazy' : 'eager'; });
  });
}
