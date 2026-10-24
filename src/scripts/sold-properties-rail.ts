/** Keep one complete loop beyond the visible rail, including on ultra-wide screens. */
export function bindSoldPropertiesRail(rail: HTMLElement) {
  const track = rail.querySelector<HTMLElement>('.sold-properties__track');
  const count = Number(rail.dataset.soldCount);
  if (!track || !Number.isInteger(count) || count < 1) return;
  const originals = Array.from(track.children).slice(0, count) as HTMLElement[];
  if (originals.length !== count) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const updateCoverage = () => {
    const first = originals[0].getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const period = (first.width + gap) * count;
    if (period <= 0) return;
    track.style.setProperty('--sold-loop-distance', `${period}px`);
    // The final group has no trailing gap: include it when sizing the track.
    const groups = Math.max(2, Math.ceil((rail.clientWidth + period + gap) / period));
    const required = groups * count;
    while (track.children.length > required) track.lastElementChild?.remove();
    while (track.children.length < required) {
      const clone = originals[track.children.length % count].cloneNode(true) as HTMLElement;
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      track.append(clone);
    }
    Array.from(track.children).slice(count).forEach(element => {
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('inert', '');
    });
  };
  updateCoverage();
  const resize = new ResizeObserver(updateCoverage);
  resize.observe(rail);
  resize.observe(originals[0]);

  const observer = new IntersectionObserver(entries => {
    if (!reduced.matches && entries.some(entry => entry.isIntersecting)) rail.classList.add('is-visible');
  });
  observer.observe(rail);
  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      rail.classList.remove('is-visible');
      return;
    }
    const rect = rail.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) rail.classList.add('is-visible');
  });
}
