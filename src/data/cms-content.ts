/**
 * Consumer-side selection for the local migration snapshot.
 * A record may replace a public fallback only when its Webflow identity matches.
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

/** Public-source eligible snapshot; target Sanity drafts remain available in migration preview. */
export function selectAvailableProperties(records: CmsRecord[]): CmsRecord[] {
  return records
    .filter(record => record._type === 'property' && record.listingStatus === 'active')
    .slice()
    .sort((left, right) => String(right._updatedAt ?? '').localeCompare(String(left._updatedAt ?? ''))
      || String(left._id ?? '').localeCompare(String(right._id ?? '')));
}

/** Featured listing follows the latest available edit, excluding reservations. */
export function selectFeaturedProperties(records: CmsRecord[], limit = 3): CmsRecord[] {
  return selectAvailableProperties(records).filter(record => record.marketBanner !== 'reserved').slice(0, limit);
}

export function selectFeaturedProperty(records: CmsRecord[]): CmsRecord | undefined {
  return selectFeaturedProperties(records, 1)[0];
}
