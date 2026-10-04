import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const identity = document => [document._type, document.legacyId, document.locale].join(':');
export function validateSamplePreview(snapshot, evidence) {
  const expected = new Map(evidence.samples.map(sample => [[sample.identity.type, sample.identity.legacyId, sample.identity.locale].join(':'), sample.sourceSlug]));
  if (!Array.isArray(snapshot.documents) || snapshot.documents.length !== expected.size || expected.size !== 11) throw new Error('Preview requires exactly the 11 authorized samples.');
  const seen = new Set();
  for (const document of snapshot.documents) {
    const key = identity(document);
    if (!expected.has(key) || seen.has(key) || !document._id?.startsWith('drafts.') || document.sourceSlug !== expected.get(key) || document.slug?.current !== expected.get(key)) throw new Error('Snapshot identity, draft status or original slug does not match the approved sample evidence.');
    seen.add(key);
  }
  return seen.size;
}

const collections = { property: 'Imóveis', article: 'Blog Posts', testimonial: 'Testemunhos', offer: 'Ofertas', preListing: 'Pre-Listings', processStep: 'VS Destaques' };
const imageFields = { property: ['featuredImage','gallery'], article: ['mainImage','thumbnailImage','openGraphImage','gallery'], testimonial: ['portrait'], offer: ['image'], preListing: ['heroImage'], processStep: ['image','thumbnail'] };
function refs(document) {
  return imageFields[document._type].flatMap(field => {
    const value = document[field];
    return (Array.isArray(value) ? value : value ? [value] : []).map(image => image.asset?._ref);
  });
}
export function validateBulkPreview(snapshot, source, manifest, fullPayload) {
  if (manifest?.bulkGate?.status !== 'passed' || manifest.bulkGate.bulkWritesPermitted !== true || manifest.bulkGate.fullPayload?.passed !== true || manifest.unresolvedVisibilityCases?.length !== 0 || manifest.sourceSiteId !== source.siteId) throw new Error('Bulk preview requires a passed full bulk manifest for the exact source site.');
  const expected = new Map();
  for (const [type, name] of Object.entries(collections)) {
    const collection = source.collections?.find(entry => entry.name === name);
    if (!collection || collection.staged?.items?.length !== collection.staged?.pagination?.total || collection.live?.items?.length !== collection.live?.pagination?.total) throw new Error('Incomplete source pagination.');
    for (const item of collection.staged.items) {
      if (item.isDraft !== false || item.isArchived !== false) continue;
      if (type === 'processStep' && !['61e1b999e018031966a98c78f8548d5d','663132020846a392d304a25e78392a84'].includes(item.fieldData?.page)) continue;
      const slug = item.fieldData?.slug;
      if (!item.id || !item.cmsLocaleId || !slug || !collection.live.items.some(live => live.id === item.id && live.cmsLocaleId === item.cmsLocaleId && live.slug === slug)) throw new Error('Eligible source identity has no exact live identity and slug.');
      const key = identity({ _type: type, legacyId: item.id, locale: item.cmsLocaleId });
      if (expected.has(key)) throw new Error('Duplicate source identity.');
      expected.set(key, slug);
    }
  }
  if (expected.size !== 190 || snapshot?.documents?.length !== 190 || fullPayload?.documents?.length !== 190) throw new Error('Bulk preview requires exactly 190 source eligible documents, approved payload documents and target drafts.');
  const approved = new Map();
  for (const document of fullPayload.documents) {
    const key = identity(document);
    if (!expected.has(key) || approved.has(key) || document.sourceSlug !== expected.get(key) || document.slug?.current !== expected.get(key)) throw new Error('Approved full payload identity or original route differs from source.');
    approved.set(key, document);
  }
  const seen = new Set();
  const targetIds = new Set();
  let slots = 0;
  const uniqueRefs = new Set();
  for (const document of snapshot.documents) {
    const key = identity(document);
    if (!expected.has(key) || seen.has(key) || typeof document._id !== 'string' || !document._id.startsWith('drafts.') || targetIds.has(document._id) || document.sourceSlug !== expected.get(key) || document.slug?.current !== expected.get(key)) throw new Error('Target bulk identity, draft status or original route differs from source.');
    seen.add(key); targetIds.add(document._id);
    const targetRefs = refs(document);
    for (const ref of targetRefs) {
      if (typeof ref !== 'string' || !/^image-[a-f0-9]{40}-[1-9]\d*x[1-9]\d*-[a-z0-9]+$/i.test(ref)) throw new Error('Bulk preview refuses missing, synthetic or invalid image references.');
      slots++; uniqueRefs.add(ref);
    }
  }
  if (slots !== 1447 || uniqueRefs.size !== 1342) throw new Error('Bulk target aggregate photo counts differ from 1447 slots / 1342 assets.');
  for (const entry of manifest.collections ?? []) {
    const count = snapshot.documents.filter(document => document._type === entry.type).length;
    const photos = snapshot.documents.filter(document => document._type === entry.type).reduce((total, document) => total + refs(document).length, 0);
    if (count !== entry.sourceEligibleItems || photos !== entry.sourcePhotoSlots) throw new Error('Bulk target aggregate collection item/photo counts differ from approved manifest.');
  }
  if (manifest.collections?.length !== 6 || new Set(manifest.collections.map(entry => entry.type)).size !== 6 || manifest.collections.some(entry => !Object.hasOwn(collections, entry.type))) throw new Error('Manifest must cover all six required CMS collections.');
  return { documents: seen.size, imageSlots: slots, uniqueAssets: uniqueRefs.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const bulk = args.includes('--bulk');
  const snapshotPath = args[0];
  if (!snapshotPath || snapshotPath.startsWith('--')) throw new Error('Pass the read-only target Sanity snapshot path.');
  const json = async path => JSON.parse(await readFile(resolve(path), 'utf8'));
  const snapshot = await json(snapshotPath);
  if (bulk) {
    const option = name => { const index = args.indexOf(name); if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Bulk preview requires ${name}.`); return args[index + 1]; };
    validateBulkPreview(snapshot, await json(option('--source')), await json(option('--manifest')), await json(option('--full-payload')));
  } else {
    if (args.length !== 1) throw new Error('Sample preview accepts only the snapshot path; use explicit --bulk for full preview.');
    validateSamplePreview(snapshot, JSON.parse(await readFile(new URL('../../docs/migration/sample-data-parity.json', import.meta.url), 'utf8')));
  }
  await mkdir(new URL('../../src/data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../../src/data/sample-content.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Prepared ${snapshot.documents.length} verified target-draft ${bulk ? 'bulk documents' : 'samples'} for local preview; no provider mutation or publication.`);
}
