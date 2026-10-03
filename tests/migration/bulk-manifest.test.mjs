import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBulkManifest } from '../../scripts/migration/bulk-manifest.mjs';

const definitions = [
  ['property', 'Imóveis', 'imoveis'],
  ['article', 'Blog Posts', 'post'],
  ['testimonial', 'Testemunhos', 'testemunhos'],
  ['offer', 'Ofertas', 'ofertas'],
  ['preListing', 'Pre-Listings', 'vouvender'],
  ['processStep', 'VS Destaques', 'vs-destaques'],
];
const pageIds = {
  home: '663132020846a392d304a25e78392a84',
  buy: '61e1b999e018031966a98c78f8548d5d',
  seller: '12b19dfc9cb975be3f2f8c2b397c5af7',
  exclusive: '476ae63fed50f2fc5dcf2605b91221c0',
};
const homeIds = [
  '64d73faf12672d652ab57816',
  '64d73faf12672d652ab57821',
  '64d73faf12672d652ab57825',
];
const buySampleIds = ['64d73faf12672d652ab57824', '64d73faf12672d652ab57819'];

function makeItem(id, slug, { draft = false, page } = {}) {
  return {
    id,
    cmsLocaleId: 'locale-pt',
    isDraft: draft,
    isArchived: false,
    fieldData: { slug, ...(page ? { page } : {}) },
  };
}

function fixtures() {
  const sampleIdsByType = {
    property: ['property-1', 'property-2'],
    article: ['article-1', 'article-2'],
    testimonial: ['testimonial-1', 'testimonial-2'],
    offer: ['offer-1'],
    preListing: ['prelisting-1', 'prelisting-2'],
    processStep: buySampleIds,
  };
  const collections = definitions.map(([type, name, slug]) => {
    let staged = (sampleIdsByType[type] ?? []).map((id, index) => makeItem(id, `${type}-${index + 1}`));
    if (type === 'preListing') {
      staged.push(...Array.from({ length: 17 }, (_, index) => makeItem(`prelisting-extra-${index}`, `prelisting-extra-${index}`)));
      staged.slice(0, 6).forEach((item, index) => {
        item.fieldData['hero-image-2'] = { fileId: `prelisting-residual-image-${index}` };
      });
    }
    if (type === 'article') {
      // A current source draft with a matching live version remains ineligible.
      staged.push(makeItem('article-source-draft', 'article-source-draft', { draft: true }));
    }
    if (type === 'offer') staged[0] = makeItem('offer-1', 'offer-1');
    if (type === 'processStep') {
      staged = [
        ...buySampleIds.map((id, index) => makeItem(id, `buy-${index}`, { page: pageIds.buy })),
        ...['64d73faf12672d652ab57814', '64d73faf12672d652ab57818', '64d73faf12672d652ab5781d'].map((id, index) => makeItem(id, `buy-extra-${index}`, { page: pageIds.buy })),
        ...homeIds.map((id, index) => makeItem(id, `home-${index}`, { page: pageIds.home })),
        ...Array.from({ length: 7 }, (_, index) => makeItem(`seller-${index}`, `seller-${index}`, { page: pageIds.seller })),
        ...['exclusive-1', 'exclusive-2', 'exclusive-3'].map((id) => makeItem(id, id, { page: pageIds.exclusive })),
      ];
    }
    const live = staged.map((item) => ({
      id: item.id,
      cmsLocaleId: item.cmsLocaleId,
      slug: item.fieldData.slug,
    }));
    return {
      id: `collection-${slug}`,
      name,
      slug,
      schema: {
        fields: type === 'preListing'
          ? [{ slug: 'hero-image-2', type: 'Image' }, { slug: 'galeria-2', type: 'MultiImage' }]
          : [],
      },
      staged: { items: staged, pagination: { total: staged.length } },
      live: { items: live, pagination: { total: live.length } },
    };
  });
  const source = { siteId: 'source-site', capturedAt: '2026-10-03', collections };
  const reportCollections = collections.map((entry) => {
    const eligible = entry.staged.items.filter((item) => item.isDraft === false).map((item) => {
      const imageCount = (value) => (Array.isArray(value) ? value : [value])
        .filter((asset) => typeof asset?.fileId === 'string').length;
      return {
        sourceId: item.id,
        photoReferences: imageCount(item.fieldData?.['hero-image-2']) + imageCount(item.fieldData?.['galeria-2']),
        gallerySlots: imageCount(item.fieldData?.['galeria-2']),
      };
    });
    return {
      collection: { slug: entry.slug },
      pagination: { stagedComplete: true, liveComplete: true },
      eligible,
    };
  });
  const report = { collections: reportCollections };
  const documents = definitions.flatMap(([type]) => (sampleIdsByType[type] ?? []).map((legacyId) => ({ _type: type, legacyId })));
  const samplePayload = { documents };
  const blankRoutes = { routes: Array.from({ length: 75 }, (_, index) => ({ path: `/blank-${index}` })) };
  const sampleGate = {
    status: 'passed',
    collections: definitions.map(([type, , slug]) => ({
      slug,
      status: 'passed',
      sourceIds: sampleIdsByType[type],
      evidence: `independent ${type} parity evidence`,
      parity: {
        content: true,
        visibleImages: true,
        order: true,
        layout: true,
        responsive: true,
        urls: true,
        seo: true,
        behavior: true,
      },
    })),
  };
  return { source, report, samplePayload, blankRoutes, sampleGate };
}

test('bulk gate stays blocked without complete recorded sample evidence', () => {
  const data = fixtures();
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes);
  assert.equal(manifest.bulkGate.status, 'blocked');
  assert.equal(manifest.bulkGate.bulkWritesPermitted, false);

  data.sampleGate.collections[0].parity.responsive = false;
  const incomplete = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  assert.equal(incomplete.bulkGate.status, 'blocked');
  assert.equal(incomplete.bulkGate.bulkWritesPermitted, false);
});

test('recorded complete evidence opens the gate only for the exact current sample IDs', () => {
  const data = fixtures();
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  assert.equal(manifest.bulkGate.status, 'passed');
  assert.equal(manifest.bulkGate.bulkWritesPermitted, true);

  data.sampleGate.collections.find((entry) => entry.slug === 'post').sourceIds.push('unreviewed-id');
  const wrongSamples = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  assert.equal(wrongSamples.bulkGate.status, 'blocked');
});

test('current drafts stay excluded and process-step totals follow verified page visibility', () => {
  const data = fixtures();
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  const articles = manifest.collections.find((entry) => entry.type === 'article');
  assert.equal(articles.sourceEligibleItems, 2);
  assert.equal(articles.samplesRemainingAfterValidation, 0);

  const steps = manifest.collections.find((entry) => entry.type === 'processStep');
  assert.equal(steps.sourceEligibleItems, 8);
  assert.equal(steps.samplesRemainingAfterValidation, 6);
  assert.deepEqual(steps.sampleSourceIds, [...buySampleIds].sort());
  assert.equal(steps.visibility.includedPlacements.find((entry) => entry.name === 'Home').eligibleItems, 3);
  assert.equal(steps.visibility.excludedPlacements.find((entry) => entry.name === 'Vender').eligibleItems, 7);
  assert.deepEqual(steps.visibility.unresolvedCases, ['exclusive-1', 'exclusive-2', 'exclusive-3']);
  assert.equal(manifest.blankCmsOriginalRoutes.count, 75);
  assert.equal(manifest.blankCmsOriginalRoutes.contentRequired, false);
  assert.equal(manifest.unresolvedVisibilityCases.find((entry) => entry.placement === 'PS Exclusive').sourceIds.length, 3);
});

test('pre-listing keeps all records, excludes empty unbound gallery, and retains hero asset inventory', () => {
  const data = fixtures();
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  const preListings = manifest.collections.find((entry) => entry.type === 'preListing');
  assert.equal(preListings.sourceEligibleItems, 19);
  assert.equal(preListings.sourcePhotoSlots, 6);
  assert.equal(preListings.sourceGallerySlots, 0);
  assert.equal(preListings.uniqueOriginalAssets, 6);
  assert.deepEqual(preListings.excludedSourceImageFields.map(({ slug, type, rawSourcePhotoSlots }) => ({ slug, type, rawSourcePhotoSlots })), [
    { slug: 'galeria-2', type: 'MultiImage', rawSourcePhotoSlots: 0 },
  ]);

  const first = data.source.collections.find((entry) => entry.name === 'Pre-Listings').staged.items[0];
  first.fieldData['galeria-2'] = [{ fileId: 'unexpected-gallery-image' }];
  const preListingReport = data.report.collections.find((entry) => entry.collection.slug === 'vouvender');
  preListingReport.eligible[0].photoReferences += 1;
  preListingReport.eligible[0].gallerySlots += 1;
  assert.throws(
    () => buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate),
    /Pre-listing gallery binding evidence is stale/,
  );
});

test('incomplete source pagination fails closed', () => {
  const data = fixtures();
  const property = data.source.collections.find((entry) => entry.slug === 'imoveis');
  property.staged.pagination.total += 1;
  assert.throws(
    () => buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate),
    /Incomplete staged\/live source pagination/,
  );
});
