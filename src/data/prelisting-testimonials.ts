import { ownRecordByLegacyId, type CmsRecord } from './cms-content.ts';

type TestimonialEntry = { candidateLegacyIds: string[] };
type TestimonialOrder = { preListingLegacyId: string; testimonials: TestimonialEntry[] };

/** Preserve migrated page order; new presentations use published CMS testimonials. */
export function selectPreListingTestimonials(
  records: CmsRecord[],
  preListing: CmsRecord,
  orders: TestimonialOrder[],
  sourceTestimonials: CmsRecord[],
): CmsRecord[] {
  if (preListing.legacyId) {
    const ordered = orders.find(route => route.preListingLegacyId === preListing.legacyId)?.testimonials;
    if (!ordered) throw new Error('Missing verified public pre-listing testimonial order.');
    return ordered.map(entry => {
      const own = entry.candidateLegacyIds.map(id => ownRecordByLegacyId(records, 'testimonial', id)).find(Boolean);
      const fallback = sourceTestimonials.find(item => entry.candidateLegacyIds.includes(item.legacyId ?? ''));
      if (!own && !fallback) throw new Error('Missing eligible pre-listing testimonial content.');
      return own ?? fallback!;
    });
  }
  return records
    .filter(item => item._type === 'testimonial'
      && typeof item._id === 'string' && !/^(drafts|versions)\./.test(item._id)
      && typeof item.clientName === 'string' && item.clientName.trim()
      && typeof item.quote === 'string' && item.quote.trim())
    .slice()
    .sort((left, right) => String(left._id).localeCompare(String(right._id)))
    .slice(0, 10);
}
