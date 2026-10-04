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
