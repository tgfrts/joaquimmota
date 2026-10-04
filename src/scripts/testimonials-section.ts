/** Randomize once per page load; subsequent batches keep that same order. */
export function bindTestimonialsSection(section: HTMLElement, onVisible: (card: HTMLElement) => void = () => {}, random = Math.random) {
  const grid = section.querySelector<HTMLElement>('.testimonials-section__grid');
  const button = section.querySelector<HTMLButtonElement>('.testimonials-section__more');
  if (!grid || !button) return;
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.testimonials-section__card'));
  for (let index = cards.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  grid.append(...cards);
  const mobile = window.matchMedia('(max-width: 767px)');
  let batches = 1;
  const update = () => {
    const visible = batches * (mobile.matches ? 3 : 6);
    cards.forEach((card, index) => {
      card.hidden = index >= visible;
      if (!card.hidden) onVisible(card);
    });
    button.hidden = visible >= cards.length;
    grid.classList.add('is-ready');
  };
  button.addEventListener('click', () => { batches++; update(); });
  mobile.addEventListener('change', update);
  update();
}
