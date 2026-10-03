import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCountComparison, buildEligibilityReport } from '../../scripts/migration/eligibility.mjs';

const locale = 'locale-1';
const fields = [
  { slug: 'hero', type: 'Image' },
  { slug: 'gallery', type: 'MultiImage' },
];

function item(id, overrides = {}) {
  return {
    id,
    cmsLocaleId: locale,
    isDraft: false,
    isArchived: false,
    fieldData: { slug: `slug-${id}`, hero: null, gallery: [], ...overrides.fieldData },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'fieldData')),
  };
}

function source(stagedItems, liveItems = stagedItems) {
  return {
    siteId: 'source-site',
    capturedAt: '2026-10-03T00:00:00.000Z',
    collections: [{
      id: 'collection-1', name: 'Listings', slug: 'listings', schema: { fields },
      staged: { items: stagedItems, pagination: { total: stagedItems.length } },
      live: { items: liveItems.map(({ id, cmsLocaleId, fieldData, slug }) => ({ id, cmsLocaleId, slug: slug ?? fieldData?.slug })), pagination: { total: liveItems.length } },
    }],
  };
}

function collectionReport(input) {
  return buildEligibilityReport(input).collections[0];
}

test('source draft remains excluded even when an older live published version exists', () => {
  const draft = item('draft-with-live', { isDraft: true });
  const report = collectionReport(source([draft], [draft]));
  assert.equal(report.eligibleCount, 0);
  assert.deepEqual(report.excluded[0].reasons, ['source-draft']);
});

test('live inventory item without a current staged record is excluded as unresolved', () => {
  const report = collectionReport(source([], []));
  // An inventory-only live item is included in the candidate set and cannot be presumed eligible.
  const withInventory = buildEligibilityReport(source([], []), {
    collections: [{ slug: 'listings', live: [{ id: 'missing-stage', slug: 'kept-slug' }] }],
  }).collections[0];
  assert.equal(report.eligibleCount, 0);
  assert.deepEqual(withInventory.excluded[0], {
    sourceId: 'missing-stage', sourceLocaleId: null, sourceSlug: null, liveSlug: 'kept-slug', reasons: ['missing-current-staged-record', 'missing-live-id-locale-match'],
  });
});

test('missing or nonboolean draft and archive flags are unknown and excluded', () => {
  const missingDraft = item('missing-draft');
  delete missingDraft.isDraft;
  const unknownArchive = item('unknown-archive', { isArchived: null });
  const report = collectionReport(source([missingDraft, unknownArchive]));
  assert.equal(report.eligibleCount, 0);
  assert.deepEqual(report.excluded.map((entry) => entry.reasons), [
    ['unknown-draft-state'],
    ['unknown-archive-state'],
  ]);
});

test('live eligibility requires exact source ID and locale match', () => {
  const staged = item('id-1');
  const mismatched = [{ id: 'id-1', cmsLocaleId: 'another-locale' }];
  const report = collectionReport(source([staged], mismatched));
  assert.deepEqual(report.excluded[0].reasons, ['missing-live-id-locale-match']);
});

test('source records sharing an ID across locales stay distinct, and blank locales are rejected', () => {
  const draft = item('shared-id', { cmsLocaleId: 'pt-PT', isDraft: true });
  const published = item('shared-id', { cmsLocaleId: 'en-US', fieldData: { slug: 'shared-en' } });
  const missingLocale = item('no-locale', { cmsLocaleId: '   ' });
  const report = collectionReport(source([draft, published, missingLocale]));
  assert.deepEqual(report.eligible.map(({ sourceId, sourceLocaleId, sourceSlug }) => ({ sourceId, sourceLocaleId, sourceSlug })), [
    { sourceId: 'shared-id', sourceLocaleId: 'en-US', sourceSlug: 'shared-en' },
  ]);
  assert.deepEqual(report.excluded.map(({ sourceId, sourceLocaleId, reasons }) => ({ sourceId, sourceLocaleId, reasons })), [
    { sourceId: 'shared-id', sourceLocaleId: 'pt-PT', reasons: ['source-draft'] },
    { sourceId: 'no-locale', sourceLocaleId: '   ', reasons: ['missing-or-invalid-staged-locale', 'missing-live-id-locale-match'] },
  ]);
});

test('image order and identities are not compared; each duplicate gallery reference counts as a slot', () => {
  const first = item('one', { fieldData: {
    hero: { fileId: 'hero-a' },
    gallery: [{ fileId: 'same' }, { fileId: 'same' }, { fileId: 'other' }],
  } });
  const second = item('two', { fieldData: {
    hero: { fileId: 'different-hero' },
    gallery: [{ fileId: 'reordered-other' }, { fileId: 'reordered-same' }, { fileId: 'reordered-same' }],
  } });
  const report = buildEligibilityReport(source([first, second]));
  assert.deepEqual(report.collections[0].eligible.map(({ photoReferences, gallerySlots }) => ({ photoReferences, gallerySlots })), [
    { photoReferences: 4, gallerySlots: 3 },
    { photoReferences: 4, gallerySlots: 3 },
  ]);
  const comparison = buildCountComparison(report, {
    collections: [{
      slug: 'listings', items: 2, photoReferences: 8, gallerySlots: 6,
      sampleParity: { status: 'passed', evidence: 'sample review record', sourceIds: ['one', 'two'] },
    }],
  });
  assert.equal(comparison.collections[0].status, 'match');
});

test('aggregate comparison is gated on recorded sample parity evidence', () => {
  const report = buildEligibilityReport(source([item('one')]));
  assert.throws(() => buildCountComparison(report, { collections: [{
    slug: 'listings', items: 1, photoReferences: 0, gallerySlots: 0,
    sampleParity: { status: 'passed', evidence: 'global assertion only', sourceIds: ['unrelated-id'] },
  }] }), /exact sample source IDs/);
});

test('each collection needs parity evidence tied to its own sample IDs', () => {
  const input = source([item('one')]);
  const second = structuredClone(input.collections[0]);
  second.id = 'collection-2';
  second.name = 'Articles';
  second.slug = 'articles';
  second.staged.items[0].id = 'article-1';
  second.staged.items[0].fieldData.slug = 'article-route';
  second.live.items[0].id = 'article-1';
  second.live.items[0].slug = 'article-route';
  input.collections.push(second);
  const report = buildEligibilityReport(input);
  assert.throws(() => buildCountComparison(report, { collections: [{
    slug: 'listings', items: 1, photoReferences: 0, gallerySlots: 0,
    sampleParity: { status: 'passed', evidence: 'listing sample reviewed', sourceIds: ['one'] },
  }] }), /exact sample source IDs: articles/);
});

test('incomplete snapshots are rejected for missing, invalid, and partial pagination totals', () => {
  for (const total of [undefined, -1, 1.5, 2]) {
    const input = source([item('one')]);
    if (total === undefined) delete input.collections[0].staged.pagination.total;
    else input.collections[0].staged.pagination.total = total;
    assert.throws(() => buildEligibilityReport(input), /Incomplete or invalid staged\/live pagination snapshot/);
  }
  const absentItems = source([]);
  delete absentItems.collections[0].staged.items;
  assert.throws(() => buildEligibilityReport(absentItems), /Incomplete or invalid staged\/live pagination snapshot/);
});

test('staged and live slugs must be present, valid, and identical to preserve the public route', () => {
  const missingStaged = item('missing-slug');
  delete missingStaged.fieldData.slug;
  const mismatch = item('different-slug');
  const missingLive = item('missing-live-slug');
  const live = [
    { id: 'missing-slug', cmsLocaleId: locale, slug: 'public-missing-staged' },
    { id: 'different-slug', cmsLocaleId: locale, slug: 'route-ledger-slug' },
    { id: 'missing-live-slug', cmsLocaleId: locale, slug: null },
  ];
  const report = collectionReport(source([missingStaged, mismatch, missingLive], live));
  assert.deepEqual(report.excluded.map(({ sourceId, sourceSlug, liveSlug, reasons }) => ({ sourceId, sourceSlug, liveSlug, reasons })), [
    { sourceId: 'missing-slug', sourceSlug: null, liveSlug: 'public-missing-staged', reasons: ['missing-or-invalid-staged-slug'] },
    { sourceId: 'different-slug', sourceSlug: 'slug-different-slug', liveSlug: 'route-ledger-slug', reasons: ['staged-live-slug-mismatch'] },
    { sourceId: 'missing-live-slug', sourceSlug: 'slug-missing-live-slug', liveSlug: null, reasons: ['missing-or-invalid-live-slug'] },
  ]);
});

test('sample manifest carries only source identifiers, slugs, and photo counts', () => {
  const report = buildEligibilityReport(source([item('one'), item('two'), item('three')]));
  assert.deepEqual(report.collections[0].sampleManifest.items, [
    { sourceId: 'one', sourceLocaleId: 'locale-1', sourceSlug: 'slug-one', photoReferences: 0, gallerySlots: 0 },
    { sourceId: 'two', sourceLocaleId: 'locale-1', sourceSlug: 'slug-two', photoReferences: 0, gallerySlots: 0 },
  ]);
  assert.equal(JSON.stringify(report.collections[0].sampleManifest).includes('fieldData'), false);
});
