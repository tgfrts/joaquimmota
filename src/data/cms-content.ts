/**
 * Consumer-side selection for the published Sanity snapshot.
 * Legacy identity only locates optional migration media fallbacks.
 */
export type CmsRecord = { _type?: string; legacyId?: string; [key: string]: any };

export function recordsFromContent(content: unknown): CmsRecord[] {
  if (Array.isArray(content)) return content as CmsRecord[];
  if (content && typeof content === 'object' && Array.isArray((content as { documents?: unknown[] }).documents)) {
    return (content as { documents: CmsRecord[] }).documents;
  }
  return [];
}

export function ownRecordByLegacyId(records: CmsRecord[], type: string, legacyId: string): CmsRecord | undefined {
  return records.find((record) => record._type === type && record.legacyId === legacyId);
}

/** The Home sold rail is a current CMS projection, not a curated fallback list. */
export function selectRecentSoldProperties(records: CmsRecord[], limit = 5): CmsRecord[] {
  return records
    .filter((record) => record._type === 'property' && record.listingStatus === 'sold')
    .slice()
    .sort((left, right) => {
      const byUpdatedAt = String(right._updatedAt ?? '').localeCompare(String(left._updatedAt ?? ''));
      return byUpdatedAt || String(left._id ?? '').localeCompare(String(right._id ?? ''));
    })
    .slice(0, limit);
}

/** Public listings include reservations, but never sold or cancelled listings. */
export function selectAvailableProperties(records: CmsRecord[]): CmsRecord[] {
  return records
    .filter(record => record._type === 'property' && ['active', 'reserved'].includes(record.listingStatus))
    .slice()
    .sort((left, right) => String(right._updatedAt ?? '').localeCompare(String(left._updatedAt ?? ''))
      || String(left._id ?? '').localeCompare(String(right._id ?? '')));
}

/** Featured listing follows the latest available edit, excluding reservations. */
export function selectFeaturedProperties(records: CmsRecord[], limit = 3): CmsRecord[] {
  return selectAvailableProperties(records).filter(record => record.listingStatus === 'active' && record.marketBanner !== 'reserved').slice(0, limit);
}

export function selectFeaturedProperty(records: CmsRecord[]): CmsRecord | undefined {
  return selectFeaturedProperties(records, 1)[0];
}
