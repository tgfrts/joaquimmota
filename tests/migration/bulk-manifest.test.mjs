import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

function addExactResidualDispositions(data) {
  const records = [
    ['Open Houses', 'open-house', [
      ['662758ff2a1007398583fb2e', '1202-3313'], ['64d73faf12672d652ab57862', '1202-2325'], ['64d73faf12672d652ab5773c', '1202-2299'],
    ]],
    ['FAQs', 'faq', [
      ['64d73faf12672d652ab5776e', 'referenciar-algum-cliente'], ['64d73faf12672d652ab57710', 'ser-cliente-da-ps-real-estate-team'], ['64d73faf12672d652ab57813', 'how-do-i-get-my-home-ready-to-sell'], ['64d73faf12672d652ab5773b', 'how-fast-will-my-home-sell'], ['64d73faf12672d652ab5773a', 'how-is-your-calculation-different-from-zillow'], ['64d73faf12672d652ab577e7', 'how-do-you-calculate-my-homes-value'], ['64d73faf12672d652ab57754', 'how-much-is-my-home-worth'], ['64d73faf12672d652ab57739', 'how-long-does-the-buying-process-typically-take'], ['64d73faf12672d652ab57809', 'do-i-need-to-be-pre-approved-if-so-how-do-i-get-pre-approved'], ['64d73faf12672d652ab57711', 'how-do-i-write-an-offer-that-will-get-accepted'], ['64d73faf12672d652ab57788', 'how-can-i-be-the-first-to-see-new-homes-for-sale'],
    ]],
    ['Blog categories', 'blog-categories', [
      ['64d73faf12672d652ab577a3', 'dicas'], ['64d73faf12672d652ab577cd', 'mercado'], ['64d73faf12672d652ab577b9', 'vendedores'], ['64d73faf12672d652ab57812', 'compradores'],
    ]],
    ['Consultores', 'consultores', [['64d73faf12672d652ab5783a', 'paulo-soares']]],
  ];
  for (const [name, slug, identities] of records) {
    const items = identities.map(([id, itemSlug]) => makeItem(id, itemSlug));
    data.source.collections.push({
      name, slug, schema: { fields: [] },
      staged: { items, pagination: { total: items.length } },
      live: { items: items.map((item) => ({ id: item.id, cmsLocaleId: item.cmsLocaleId, slug: item.fieldData.slug })), pagination: { total: items.length } },
    });
    data.blankRoutes.routes.push(...items.map((item) => ({ sourceId: item.id, path: `${slug}/${item.fieldData.slug}` })));
  }

  const exclusive = [
    ['64d73faf12672d652ab5781e', '01-acesso-a-eventos-exclusivos'],
    ['64d73faf12672d652ab5781b', '02-ofertas-exclusivas'],
    ['64d73faf12672d652ab5781f', '03-outras-vantagens-exclusivas'],
  ];
  const steps = data.source.collections.find((entry) => entry.name === 'VS Destaques');
  steps.staged.items = steps.staged.items.filter((item) => item.fieldData.page !== pageIds.exclusive)
    .concat(exclusive.map(([id, slug]) => makeItem(id, slug, { page: pageIds.exclusive })));
  steps.live.items = steps.staged.items.map((item) => ({ id: item.id, cmsLocaleId: item.cmsLocaleId, slug: item.fieldData.slug }));
  steps.staged.pagination.total = steps.staged.items.length;
  steps.live.pagination.total = steps.live.items.length;
  const reportSteps = data.report.collections.find((entry) => entry.collection.slug === 'vs-destaques');
  reportSteps.eligible = steps.staged.items.map((item) => ({ sourceId: item.id, photoReferences: 0, gallerySlots: 0 }));
  data.blankRoutes.routes.push(...exclusive.map(([id, slug]) => ({ sourceId: id, path: `vs-destaques/${slug}` })));
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

test('recorded complete evidence stays blocked while source-eligible visibility remains unresolved', () => {
  const data = fixtures();
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  assert.equal(manifest.bulkGate.status, 'blocked');
  assert.equal(manifest.bulkGate.bulkWritesPermitted, false);
  assert.match(manifest.bulkGate.reason, /unresolved public visibility/);

  data.sampleGate.collections.find((entry) => entry.slug === 'post').sourceIds.push('unreviewed-id');
  const wrongSamples = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  assert.equal(wrongSamples.bulkGate.status, 'blocked');
});

test('complete exact residual dispositions and an all-passed sample gate still require full payload and media coverage', () => {
  const data = fixtures();
  addExactResidualDispositions(data);
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  assert.equal(manifest.resolvedVisibilityDispositions.length, 5);
  assert.deepEqual(manifest.unresolvedVisibilityCases, []);
  assert.equal(manifest.bulkGate.status, 'blocked');
  assert.equal(manifest.bulkGate.bulkWritesPermitted, false);
  assert.match(manifest.bulkGate.reason, /full 190-document payload, complete asset map, and source\/destination asset metadata are required/);
  assert.equal(manifest.bulkGate.fullPayload.expectedDocuments, 190);
  assert.equal(manifest.bulkGate.fullPayload.expectedVisibleAssetSlots, 1447);
});

test('a sample-only asset map cannot satisfy full visible-media coverage', () => {
  const data = fixtures();
  addExactResidualDispositions(data);
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate,
    { documents: data.samplePayload.documents }, { assets: {} });
  assert.equal(manifest.bulkGate.bulkWritesPermitted, false);
  assert.match(manifest.bulkGate.fullPayload.reason, /source\/destination asset metadata are required/);
});

test('exact full eligible identities and ordered visible image refs satisfy the payload coverage subgate', () => {
  const data = fixtures();
  addExactResidualDispositions(data);
  const byName = (name) => data.source.collections.find((entry) => entry.name === name);
  const appendEligible = (name, count, prefix) => {
    const c = byName(name);
    for (let i = 0; i < count; i += 1) c.staged.items.push(makeItem(`${prefix}-${i}`, `${prefix}-${i}`));
    c.live.items = c.staged.items.map((item) => ({ id: item.id, cmsLocaleId: item.cmsLocaleId, slug: item.fieldData.slug }));
    c.staged.pagination.total = c.staged.items.length;
    c.live.pagination.total = c.live.items.length;
    const report = data.report.collections.find((entry) => entry.collection.slug === c.slug);
    report.eligible = c.staged.items.filter((item) => item.isDraft === false && item.isArchived === false)
      .map((item) => ({ sourceId: item.id, photoReferences: 0, gallerySlots: 0 }));
  };
  appendEligible('Imóveis', 63, 'property-full');
  appendEligible('Blog Posts', 57, 'article-full');
  appendEligible('Testemunhos', 36, 'testimonial-full');

  const articles = byName('Blog Posts');
  const uniqueArticleAssets = Array.from({ length: 1336 }, (_, index) => ({ fileId: `article-asset-${index}`, url: `https://source.invalid/${index}.jpg` }));
  const articleAssets = [...uniqueArticleAssets, ...uniqueArticleAssets.slice(0, 105)];
  articles.schema.fields = [{ slug: 'galeria', type: 'MultiImage' }];
  articles.staged.items.filter((item) => item.isDraft === false).forEach((item, index) => {
    item.fieldData.galeria = index === 0 ? articleAssets : [];
  });
  const articleReport = data.report.collections.find((entry) => entry.collection.slug === 'post');
  articleReport.eligible.forEach((row) => {
    row.photoReferences = 0;
    row.gallerySlots = 0;
    if (row.sourceId === articles.staged.items[0].id) row.photoReferences = row.gallerySlots = articleAssets.length;
  });

  const assetMap = { assets: {} };
  const assetEvidence = { sourceByFileId: {}, destinationByRef: {} };
  const putAsset = (asset) => { assetMap.assets[asset.fileId] = `image-${asset.fileId}-1200x800-jpg`; };
  articleAssets.forEach(putAsset);
  const preListings = byName('Pre-Listings').staged.items;
  preListings.slice(0, 6).forEach((item) => {
    item.fieldData['hero-image-2'].url = `https://source.invalid/prelisting-${item.id}.jpg`;
    putAsset(item.fieldData['hero-image-2']);
  });
  const addReceipt = (asset) => {
    const sha1 = createHash('sha1').update(`fixture:${asset.fileId}`).digest('hex');
    const bytes = Buffer.byteLength(`fixture-bytes:${asset.fileId}`);
    assetEvidence.sourceByFileId[asset.fileId] = { url: asset.url, sourceSHA1: sha1, sourceBytes: bytes };
    assetEvidence.destinationByRef[assetMap.assets[asset.fileId]] = { sha1, size: bytes };
  };
  [...uniqueArticleAssets, ...preListings.slice(0, 6).map((item) => item.fieldData['hero-image-2'])].forEach(addReceipt);
  const eligibleByType = [
    ['property', 'Imóveis'], ['article', 'Blog Posts'], ['testimonial', 'Testemunhos'],
    ['offer', 'Ofertas'], ['preListing', 'Pre-Listings'], ['processStep', 'VS Destaques'],
  ];
  const fullDocuments = eligibleByType.flatMap(([type, name]) => byName(name).staged.items
    .filter((item) => item.isDraft === false && (type !== 'processStep' || [pageIds.buy, pageIds.home].includes(item.fieldData.page)))
    .map((item) => {
      const slug = item.fieldData.slug;
      const doc = { _type: type, legacyId: item.id, locale: item.cmsLocaleId, sourceSlug: slug, slug: { current: slug } };
      if (type === 'article' && Array.isArray(item.fieldData.galeria) && item.fieldData.galeria.length) {
        doc.gallery = item.fieldData.galeria.map((asset) => ({ asset: { _ref: assetMap.assets[asset.fileId] } }));
      }
      if (type === 'preListing' && item.fieldData['hero-image-2']) {
        doc.heroImage = { asset: { _ref: assetMap.assets[item.fieldData['hero-image-2'].fileId] } };
      }
      return doc;
    }));
  assert.equal(fullDocuments.length, 190);
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate,
    { documents: fullDocuments }, assetMap, assetEvidence);
  assert.equal(manifest.bulkGate.fullPayload.passed, true);
  assert.equal(manifest.bulkGate.fullPayload.mappedVisibleAssetSlots, 1447);
  assert.equal(manifest.bulkGate.fullPayload.uniqueVisibleSourceAssets, 1342);
  assert.equal(manifest.bulkGate.fullPayload.assetMetadataChecks, 1447);
  assert.equal(manifest.bulkGate.status, 'passed');

  const withoutDuplicatePositions = structuredClone(fullDocuments);
  const firstArticle = withoutDuplicatePositions.find((document) => document._type === 'article' && document.gallery?.length);
  firstArticle.gallery = firstArticle.gallery.slice(0, 1336);
  const missingPositions = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate,
    { documents: withoutDuplicatePositions }, assetMap, assetEvidence);
  assert.equal(missingPositions.bulkGate.fullPayload.uniqueVisibleSourceAssets, 1342);
  assert.equal(missingPositions.bulkGate.fullPayload.passed, false);
  assert.match(missingPositions.bulkGate.fullPayload.reason, /coverage\/order/);

  const mismatchedEvidence = structuredClone(assetEvidence);
  const firstReceipt = Object.keys(mismatchedEvidence.destinationByRef)[0];
  mismatchedEvidence.destinationByRef[firstReceipt].size += 1;
  const mismatch = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate,
    { documents: fullDocuments }, assetMap, mismatchedEvidence);
  assert.equal(mismatch.bulkGate.fullPayload.passed, false);
  assert.match(mismatch.bulkGate.fullPayload.reason, /digest-and-size receipts/);

  const mismatchedDigest = structuredClone(assetEvidence);
  mismatchedDigest.destinationByRef[firstReceipt].sha1 = '0'.repeat(40);
  const digestMismatch = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate,
    { documents: fullDocuments }, assetMap, mismatchedDigest);
  assert.equal(digestMismatch.bulkGate.fullPayload.passed, false);

  const nonexistentReferenceMap = structuredClone(assetMap);
  const firstMappedFile = Object.keys(nonexistentReferenceMap.assets)[0];
  nonexistentReferenceMap.assets[firstMappedFile] = 'image-reference-without-receipt';
  const nonexistentReference = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate,
    { documents: fullDocuments }, nonexistentReferenceMap, assetEvidence);
  assert.equal(nonexistentReference.bulkGate.fullPayload.passed, false);
  assert.match(nonexistentReference.bulkGate.fullPayload.reason, /coverage\/order or source\/destination digest-and-size receipts/);

  const sampleSizedMap = { assets: Object.fromEntries(Object.entries(assetMap.assets).slice(0, 52)) };
  const partial = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate,
    { documents: fullDocuments }, sampleSizedMap, assetEvidence);
  assert.equal(partial.bulkGate.fullPayload.passed, false);
  assert.equal(partial.bulkGate.bulkWritesPermitted, false);
  assert.match(partial.bulkGate.fullPayload.reason, /asset coverage\/order/);
});

test('one exact residual blank-route mismatch blocks the otherwise complete manifest', () => {
  const data = fixtures();
  addExactResidualDispositions(data);
  const route = data.blankRoutes.routes.find((entry) => entry.sourceId === '64d73faf12672d652ab5783a');
  route.path = 'consultores/not-paulo-soares';
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  assert.equal(manifest.bulkGate.status, 'blocked');
  assert.equal(manifest.bulkGate.bulkWritesPermitted, false);
  const consultant = manifest.unresolvedVisibilityCases.find((entry) => entry.sourceCollection === 'Consultores');
  assert.deepEqual(consultant.missingBlankRouteSourceIds, ['64d73faf12672d652ab5783a']);
});

test('a recorded disposition fails closed if one of its source identities disappears', () => {
  const data = fixtures();
  const steps = data.source.collections.find((entry) => entry.name === 'VS Destaques');
  steps.staged.items = steps.staged.items.filter((item) => item.fieldData.page !== pageIds.exclusive);
  steps.live.items = steps.live.items.filter((item) => !item.id.startsWith('exclusive-'));
  steps.staged.pagination.total = steps.staged.items.length;
  steps.live.pagination.total = steps.live.items.length;
  const reportSteps = data.report.collections.find((entry) => entry.collection.slug === 'vs-destaques');
  reportSteps.eligible = reportSteps.eligible.filter((item) => !item.sourceId.startsWith('exclusive-'));
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  assert.equal(manifest.bulkGate.status, 'blocked');
  assert.equal(manifest.bulkGate.bulkWritesPermitted, false);
  assert.ok(manifest.unresolvedVisibilityCases.some((entry) => entry.sourceCollection === 'VS Destaques'));
});

test('an unknown residual collection record stays unresolved instead of inheriting a disposition', () => {
  const data = fixtures();
  const item = makeItem('unexpected-open-house', 'unexpected-open-house');
  data.source.collections.push({
    name: 'Open Houses', slug: 'open-house', schema: { fields: [] },
    staged: { items: [item], pagination: { total: 1 } },
    live: { items: [{ id: item.id, cmsLocaleId: item.cmsLocaleId, slug: item.fieldData.slug }], pagination: { total: 1 } },
  });
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  const unresolved = manifest.unresolvedVisibilityCases.find((entry) => entry.sourceCollection === 'Open Houses');
  assert.deepEqual(unresolved.sourceIds, ['unexpected-open-house']);
  assert.deepEqual(unresolved.expectedSourceIds, ['64d73faf12672d652ab5773c', '64d73faf12672d652ab57862', '662758ff2a1007398583fb2e']);
  assert.equal(manifest.bulkGate.bulkWritesPermitted, false);
});

test('a residual disposition without complete staged and live pagination stays unresolved', () => {
  const data = fixtures();
  data.source.collections.push({
    name: 'Consultores', slug: 'consultores', schema: { fields: [] },
    staged: { items: [], pagination: { total: 1 } },
    live: { items: [], pagination: { total: 0 } },
  });
  const manifest = buildBulkManifest(data.source, data.report, data.samplePayload, data.blankRoutes, data.sampleGate);
  const unresolved = manifest.unresolvedVisibilityCases.find((entry) => entry.sourceCollection === 'Consultores');
  assert.match(unresolved.reason, /complete staged\/live source snapshot/);
  assert.equal(manifest.bulkGate.bulkWritesPermitted, false);
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
  const psExclusive = manifest.unresolvedVisibilityCases.find((entry) => entry.sourceCollection === 'VS Destaques');
  assert.deepEqual(psExclusive.sourceIds, ['exclusive-1', 'exclusive-2', 'exclusive-3']);
  assert.deepEqual(psExclusive.expectedSourceIds, ['64d73faf12672d652ab5781b', '64d73faf12672d652ab5781e', '64d73faf12672d652ab5781f']);
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
