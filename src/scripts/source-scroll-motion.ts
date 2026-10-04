// Public-source motion: continuous in-view progress, smoothing 50,
// startsEntering=true / startsExiting=false. Values are presentation only.
const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function interpolate(progress: number, points: Array<[number, number]>): number {
  if (progress <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index++) {
    const [end, value] = points[index];
    const [start, previous] = points[index - 1];
    if (progress <= end) return previous + (value - previous) * (progress - start) / (end - start);
  }
  return points[points.length - 1][1];
}
export function bindSourceScrollMotion(element: HTMLElement, render: (progress: number, reduced: boolean) => void) {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let progress = 0, frame = 0;
  const update = () => {
    frame = 0;
    const rect = element.getBoundingClientRect();
    const span = Math.min(innerHeight + rect.height, document.documentElement.scrollHeight);
    const target = span > 0 ? clamp((innerHeight - rect.top) / span) : 0;
    progress += (target - progress) * .5;
    render(progress, preference.matches);
    if (Math.abs(target - progress) > .00001) frame = requestAnimationFrame(update);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  preference.addEventListener('change', schedule);
  element.querySelectorAll('img').forEach(image => image.addEventListener('load', schedule, { once: true }));
  schedule();
}
export function bindInteriorHero(image: HTMLImageElement, overlay?: HTMLElement | null) {
  bindSourceScrollMotion(image, (progress, reduced) => {
    image.style.transform = reduced ? 'none' : `translateY(${interpolate(progress, [[0, 10], [.75, 0]])}vh) scale(${interpolate(progress, [[0, 1], [.35, 1.25], [.65, 1.25], [1, 1]])})`;
    image.style.filter = reduced ? 'none' : `blur(${interpolate(progress, [[0, 500], [.35, 0]])}px)`;
    image.style.opacity = reduced ? '1' : String(interpolate(progress, [[0, 0], [.25, 1], [.65, 1], [1, .25]]));
    if (overlay) { overlay.style.opacity = reduced ? '0' : String(interpolate(progress, [[0, 1], [.65, .25], [1, 0]])); overlay.style.filter = reduced ? 'none' : 'blur(100px)'; }
  });
}

// Source a-59: opacity .25/1/1/.25 at 0/25/50/100%; the exit segment uses outQuad.
export function bindTestimonialMotion(element: HTMLElement) {
  bindSourceScrollMotion(element, (progress, reduced) => {
    const eased = progress <= .5 ? progress : .5 + .5 * (1 - (1 - (progress - .5) * 2) ** 2);
    element.style.opacity = reduced ? '1' : String(interpolate(eased, [[0, .25], [.25, 1], [.5, 1], [1, .25]]));
  });
}
