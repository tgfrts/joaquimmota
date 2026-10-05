import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const CONTENT_TYPES = ['property', 'article', 'testimonial', 'offer', 'preListing', 'processStep'];
export const PROJECT_ID = 'kaq1vd9b';
export const DATASET = 'production';
export const API_VERSION = '2026-10-05';

/** Fetch uncached published content; complete documents preserve Portable Text and image references. */
export async function fetchPublishedContent({ fetchImpl = fetch, pageSize = 100 } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('Invalid CMS page size.');
  const documents = [];
  let after = '';
  while (true) {
    const query = `*[_type in $types && !(_id in path("drafts.**")) && !(_id in path("versions.**")) && _id > $after] | order(_id asc)[0...${pageSize}]`;
    const url = new URL(`https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`);
    url.searchParams.set('query', query);
    url.searchParams.set('$types', JSON.stringify(CONTENT_TYPES));
    url.searchParams.set('$after', JSON.stringify(after));
    url.searchParams.set('perspective', 'published');
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Sanity content fetch failed (HTTP ${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload.result) || payload.result.length > pageSize) throw new Error('Invalid Sanity query result.');
    for (const document of payload.result) {
      if (!document || typeof document._id !== 'string' || document._id <= after
        || /^(drafts|versions)\./.test(document._id) || !CONTENT_TYPES.includes(document._type)) {
        throw new Error('Sanity result contains an invalid, unpublished or unordered document.');
      }
      after = document._id;
      documents.push(document);
    }
    if (payload.result.length < pageSize) break;
  }
  // An empty CMS is an activation/configuration failure for this populated site.
  if (documents.length === 0) throw new Error('Sanity has no published site content; refusing to build a stale or empty site.');
  const routes = new Set();
  for (const document of documents.filter(document => ['property', 'article'].includes(document._type))) {
    const slug = document.slug?.current;
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid public ${document._type} slug.`);
    if (document.sourceSlug && document.sourceSlug !== slug) throw new Error(`Published ${document._type} changed its protected source slug.`);
    const route = `${document._type}/${slug}`;
    if (routes.has(route)) throw new Error(`Duplicate published ${document._type} slug.`);
    routes.add(route);
  }
  return { documents };
}

export async function writeContentSnapshot(snapshot, output = new URL('../../src/data/sample-content.json', import.meta.url)) {
  const target = fileURLToPath(output);
  const temporary = `${target}.${process.pid}.tmp`;
  await mkdir(new URL('.', output), { recursive: true });
  try {
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = await fetchPublishedContent();
  await writeContentSnapshot(snapshot);
  const counts = Object.fromEntries(CONTENT_TYPES.map(type => [type, snapshot.documents.filter(document => document._type === type).length]));
  console.log(`Fetched ${snapshot.documents.length} published Sanity documents: ${JSON.stringify(counts)}`);
}
