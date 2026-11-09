export const CABAZ_END_DATE = '2026-12-18';
export function cabazHasEnded(now = new Date()) { return lisbonDay(now) > CABAZ_END_DATE; }
// Site-local content contract shared by the static build, browser and form server.
export const RESERVED_OFFER_SLUGS = new Set([
  'cabaz-de-natal', 'guia-de-ferias', 'smillingstreet', 'atualizacao-de-informacao',
  'oferta-selecao', 'vinho-e-fado',
]);
export function validOfferSlug(slug) {
  return typeof slug === 'string' && slug.length <= 160
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    && !RESERVED_OFFER_SLUGS.has(slug) && !slug.startsWith('obrigado');
}
export function validOfferDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function lisbonDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function offerWindowState(offer, now = new Date()) {
  if (!validOfferDate(offer.startDate) || !validOfferDate(offer.endDate) || offer.startDate > offer.endDate) return 'invalid';
  const today = lisbonDay(now);
  return today < offer.startDate ? 'upcoming' : today > offer.endDate ? 'ended' : 'active';
}
export const OFFER_UPCOMING = 'As participações nesta campanha ainda não começaram.';
export const OFFER_ENDED = 'As participações nesta campanha já terminaram.';
export function offerHeading(offer, state) {
  return state === 'active' ? offer.heading : state === 'upcoming' ? OFFER_UPCOMING : OFFER_ENDED;
}
export function offerImageUrl(value, width = 1600) {
  const ref = value?.asset?._ref;
  const match = typeof ref === 'string' && ref.match(/^image-([a-zA-Z0-9]+)-(\d+)x(\d+)-(jpg|jpeg|png|webp|gif|avif)$/);
  if (!match || Number(match[2]) < 1 || Number(match[3]) < 1) throw new Error('Invalid offer image reference.');
  return `https://cdn.sanity.io/images/kaq1vd9b/production/${match[1]}-${match[2]}x${match[3]}.${match[4]}?w=${width}&fit=max&auto=format`;
}
export function validateOffer(offer) {
  if (!validOfferSlug(offer.slug?.current)) throw new Error('Invalid or reserved public offer slug.');
  if (offer.sourceSlug && offer.sourceSlug !== offer.slug.current) throw new Error('Published offer changed its protected source slug.');
  for (const [field, limit] of [['title', 200], ['heading', 2000], ['confirmationMessage', 4000]]) {
    if (typeof offer[field] !== 'string' || !offer[field].trim() || offer[field].length > limit) throw new Error(`Invalid offer ${field}.`);
  }
  if (/[\r\n]/.test(offer.title)) throw new Error('Invalid offer title.');
  if (!validOfferDate(offer.startDate) || !validOfferDate(offer.endDate) || offer.startDate > offer.endDate) throw new Error('Invalid offer date window.');
  offerImageUrl(offer.image);
  offerImageUrl(offer.ogImage, 1200);
  return offer;
}
export function publishedOffers(content) {
  const records = Array.isArray(content) ? content : content?.documents ?? [];
  const seen = new Set();
  return records.filter(record => record._type === 'offer' && typeof record._id === 'string'
    && !/^(drafts|versions)\./.test(record._id)).map(record => {
    validateOffer(record);
    const slug = record.slug.current;
    if (seen.has(slug)) throw new Error(`Duplicate published offer slug: ${slug}`);
    seen.add(slug);
    return record;
  });
}
export function offerMetadata(content) {
  return Object.fromEntries(publishedOffers(content).map(offer => [offer.slug.current, {
    title: offer.title, startDate: offer.startDate, endDate: offer.endDate,
    confirmationMessage: offer.confirmationMessage,
  }]));
}
