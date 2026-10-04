import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateBatches, reconcileUnknownBatch, MAX_REQUEST_BYTES } from '../../scripts/migration/bulk-create-batches.mjs';

const typeCounts = { property: 65, article: 59, testimonial: 38, preListing: 19, processStep: 8, offer: 1 };
const photoSlots = { property: 1262, article: 177, testimonial: 1, preListing: 6, processStep: 0, offer: 1 };
const sampleCounts = { property: 2, article: 2, testimonial: 2, preListing: 2, processStep: 2, offer: 1 };
const remaining = { property: 63, article: 57, testimonial: 36, preListing: 17, processStep: 6, offer: 0 };
const collections = Object.entries(typeCounts).map(([type, count]) => ({
  type, sourceEligibleItems: count, sampleSourceIds: Array.from({ length: sampleCounts[type] }, (_, i) => `${type}-id-${i}`), sourcePhotoSlots: photoSlots[type],
}));
const manifest = {
  bulkGate: { status: 'passed', bulkWritesPermitted: true, fullPayload: { passed: true, documents: 190, expectedDocuments: 190, expectedVisibleAssetSlots: 1447, mappedVisibleAssetSlots: 1447, uniqueVisibleSourceAssets: 1342, expectedUniqueVisibleSourceAssets: 1342, assetMetadataChecks: 1447 } },
  collections,
};

function fixture() {
  const docs = [];
  let globalSlot = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    const perDocSlots = Array(count).fill(0);
    for (let i = 0; i < photoSlots[type]; i++) perDocSlots[i % count]++;
    for (let i = 0; i < count; i++) {
      const doc = { _type: type, legacyId: `${type}-id-${i}`, locale: 'locale-pt', sourceSlug: `${type}-slug-${i}`, slug: { _type: 'slug', current: `${type}-slug-${i}` }, title: `Title ${i}`, body: [{ _type: 'block', _key: 'p1', children: [{ _type: 'span', _key: 's1', text: `Body ${i}`, marks: [] }], markDefs: [], style: 'normal' }] };
      for (let slot = 0; slot < perDocSlots[i]; slot++) {
        const image = { _type: 'image', asset: { _type: 'reference', _ref: `image-${(globalSlot < 1342 ? globalSlot : globalSlot - 1342).toString(16).padStart(40, '0')}-100x100-webp` } };
        const field = type === 'property' || type === 'article' ? 'gallery' : type === 'testimonial' ? 'portrait' : type === 'preListing' ? 'heroImage' : 'image';
        if (field === 'gallery') doc[field] ??= [];
        if (Array.isArray(doc[field])) doc[field].push(image); else doc[field] = image;
        globalSlot++;
      }
      docs.push(doc);
    }
  }
  const sampleEntries = [];
  for (const [type, n] of Object.entries(sampleCounts)) {
    for (let i = 0; i < n; i++) {
      const doc = docs.find((item) => item._type === type && item.legacyId === `${type}-id-${i}`);
      sampleEntries.push({ identity: { type, legacyId: doc.legacyId, locale: doc.locale }, sourceSlug: doc.sourceSlug, targetDraft: true });
    }
  }
  return {
    payload: { documents: docs },
    parity: { documentCount: { payload: 11, target: 11, identityMatches: 11, exactStructuredMismatches: [], targetOnlyCount: 0 }, samples: sampleEntries, overall: { all11IdentityMatched: true, structuredContentExact: true, sourceSlugPreserved: true, routesExact: true, allSampleDocsTargetDraft: true, imagesPass: true, semanticPortableTextPass: true } },
  };
}

test('excludes only the exact validated composite sample identities and creates stable draft args', () => {
  const { payload, parity } = fixture();
  const altered = structuredClone(payload);
  // A source ID represented in another locale is not accidentally excluded by the sample identity.
  const replacement = altered.documents.find((doc) => doc._type === 'property' && doc.legacyId === 'property-id-2');
  replacement.legacyId = 'property-id-0';
  replacement.locale = 'locale-fr';
  const batches = buildCreateBatches(altered, manifest, parity, { maxBytes: MAX_REQUEST_BYTES });
  assert.equal(batches.reduce((sum, batch) => sum + batch.args.documents.length, 0), 179);
  const counts = Object.fromEntries(Object.keys(remaining).map((type) => [type, batches.flatMap((batch) => batch.args.documents).filter((doc) => doc.type === type).length]));
  assert.deepEqual(counts, remaining);
  const first = batches[0].args.documents[0];
  assert.match(first.content._id, /^jm-/);
  assert.equal(first.content.slug.current, first.content.sourceSlug);
  assert.ok(batches.flatMap((batch) => batch.args.documents).some((doc) => doc.type === 'property' && doc.content.legacyId === 'property-id-0' && doc.content.locale === 'locale-fr'));
  assert.deepEqual(Object.keys(batches[0].args).sort(), ['dataset', 'documents', 'link_id', 'projectId']);
  for (const batch of batches) assert.equal(Buffer.byteLength(JSON.stringify(batch.args), 'utf8'), batch.requestBytes);
});

test('splits on exact whole-request UTF-8 size and rejects a single oversized document', () => {
  const { payload, parity } = fixture();
  const batches = buildCreateBatches(payload, manifest, parity, { maxBytes: 12_000 });
  assert.ok(batches.length > 1);
  assert.ok(batches.every((batch) => batch.requestBytes <= 12_000));
  assert.throws(() => buildCreateBatches(payload, manifest, parity, { maxBytes: 300 }), /exceeds request limit/);
});

test('blocks absent or invalid full gate and altered sample identities', () => {
  const { payload, parity } = fixture();
  assert.throws(() => buildCreateBatches(payload, { ...manifest, bulkGate: { ...manifest.bulkGate, status: 'blocked' } }, parity), /not passed/);
  const wrongParity = structuredClone(parity);
  wrongParity.samples[0].identity.locale = '';
  assert.throws(() => buildCreateBatches(payload, manifest, wrongParity), /locale/);
  const incompleteCounts = structuredClone(parity);
  incompleteCounts.documentCount.exactStructuredMismatches.push({ type: 'article' });
  assert.throws(() => buildCreateBatches(payload, manifest, incompleteCounts), /exact 11\/11 sample identity and structured-content parity/);
});

test('unknown outcome retries only absent stable IDs; duplicate or slug mismatch blocks', () => {
  const { payload, parity } = fixture();
  const firstBatch = buildCreateBatches(payload, manifest, parity, { maxBytes: MAX_REQUEST_BYTES })[0];
  const batch = { ...firstBatch, args: { ...firstBatch.args, documents: firstBatch.args.documents.slice(0, 2) } };
  const [present, absent] = batch.args.documents;
  const observed = { ...structuredClone(present.content), _id: `drafts.${present.content._id}`, _type: present.type, _rev: 'server-revision', _createdAt: '2026-01-01T00:00:00Z', _updatedAt: '2026-01-02T00:00:00Z' };
  const reconciled = reconcileUnknownBatch(batch, [observed]);
  assert.equal(reconciled.status, 'retry-missing-only');
  assert.deepEqual(reconciled.retryArgs.documents, [absent]);
  assert.equal(reconcileUnknownBatch(batch, [observed, observed]).status, 'blocked');
  assert.equal(reconcileUnknownBatch(batch, [{ ...structuredClone(observed), slug: { current: 'changed' } }]).status, 'blocked');
  assert.equal(reconcileUnknownBatch(batch, [{ ...structuredClone(observed), title: 'Changed title' }]).status, 'blocked');
  const changedImage = structuredClone(observed);
  changedImage.gallery[0].asset._ref = 'image-ffffffffffffffffffffffffffffffffffffffff-100x100-webp';
  assert.equal(reconcileUnknownBatch(batch, [changedImage]).status, 'blocked');
  const changedPortableText = structuredClone(observed);
  changedPortableText.body[0].children[0].text = 'Changed body';
  assert.equal(reconcileUnknownBatch(batch, [changedPortableText]).status, 'blocked');
  const complete = batch.args.documents.map((entry) => ({ ...structuredClone(entry.content), _id: `drafts.${entry.content._id}`, _type: entry.type, _rev: 'server-revision' }));
  assert.equal(reconcileUnknownBatch(batch, complete).status, 'complete');
});
