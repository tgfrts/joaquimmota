import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetRef, buildPayload } from './sample-payloads.mjs';

const REQUIRED = [
  { type: 'property', sourceName: 'Imóveis', slug: 'imoveis' },
  { type: 'article', sourceName: 'Blog Posts', slug: 'post' },
  { type: 'testimonial', sourceName: 'Testemunhos', slug: 'testemunhos' },
  { type: 'offer', sourceName: 'Ofertas', slug: 'ofertas' },
  { type: 'preListing', sourceName: 'Pre-Listings', slug: 'vouvender' },
  { type: 'processStep', sourceName: 'VS Destaques', slug: 'vs-destaques' },
];
const BUY_PAGE_ID = '61e1b999e018031966a98c78f8548d5d';
const HOME_PAGE_ID = '663132020846a392d304a25e78392a84';
const SELL_PAGE_ID = '12b19dfc9cb975be3f2f8c2b397c5af7';
const PS_EXCLUSIVE_PAGE_ID = '476ae63fed50f2fc5dcf2605b91221c0';
const HOME_VISIBILITY_EVIDENCE = {
  source: 'Owner browser inspection at 1280px; all three Home headings have visible w-dyn-item ancestors and non-zero rectangles',
  viewportWidth: 1280,
  headingNames: ['01. Simples e fácil', '02. Consultoria', '03. Suporte'],
  headingRectHeight: 116.398,
  containingSectionHeight: 541,
  sourceIds: ['64d73faf12672d652ab57816', '64d73faf12672d652ab57821', '64d73faf12672d652ab57825'],
};
const SELL_HIDDEN_EVIDENCE = {
  source: 'Owner verified all seven Vender steps permanently hidden on desktop and mobile',
};
const IMAGE_TYPES = new Set(['Image', 'MultiImage']);
const IMAGE_FIELD_TARGETS = {
  property: { 'fotografia-de-destaque': 'featuredImage', 'outras-fotografias': 'gallery' },
  article: { 'imagem-principal': 'mainImage', 'imagem-miniatura': 'thumbnailImage', 'opengraph-image': 'openGraphImage', galeria: 'gallery' },
  testimonial: { 'foto-de-perfil': 'portrait' },
  offer: { imagem: 'image' },
  preListing: { 'hero-image-2': 'heroImage' },
  processStep: { image: 'image', thumbnail: 'thumbnail' },
};
const RESIDUAL_DISPOSITIONS = [
  {
    sourceCollection: 'Open Houses',
    sourceSlug: 'open-house',
    sourceIds: ['662758ff2a1007398583fb2e', '64d73faf12672d652ab57862', '64d73faf12672d652ab5773c'],
    evidence: 'docs/migration/visibility-dispositions.json#open-houses',
  },
  {
    sourceCollection: 'FAQs',
    sourceSlug: 'faq',
    sourceIds: ['64d73faf12672d652ab5776e', '64d73faf12672d652ab57710', '64d73faf12672d652ab57813', '64d73faf12672d652ab5773b', '64d73faf12672d652ab5773a', '64d73faf12672d652ab577e7', '64d73faf12672d652ab57754', '64d73faf12672d652ab57739', '64d73faf12672d652ab57809', '64d73faf12672d652ab57711', '64d73faf12672d652ab57788'],
    evidence: 'docs/migration/visibility-dispositions.json#faqs',
  },
  {
    sourceCollection: 'Blog categories',
    sourceSlug: 'blog-categories',
    sourceIds: ['64d73faf12672d652ab577a3', '64d73faf12672d652ab577cd', '64d73faf12672d652ab577b9', '64d73faf12672d652ab57812'],
    evidence: 'docs/migration/visibility-dispositions.json#blog-categories',
  },
  {
    sourceCollection: 'Consultores',
    sourceSlug: 'consultores',
    sourceIds: ['64d73faf12672d652ab5783a'],
    evidence: 'docs/migration/visibility-dispositions.json#consultants',
  },
  {
    sourceCollection: 'VS Destaques',
    sourceSlug: 'vs-destaques',
    sourceIds: ['64d73faf12672d652ab5781e', '64d73faf12672d652ab5781b', '64d73faf12672d652ab5781f'],
    matches: (item) => item.fieldData?.page === PS_EXCLUSIVE_PAGE_ID,
    evidence: 'docs/migration/visibility-dispositions.json#ps-exclusive-process-steps',
  },
];
const PRELISTING_IMAGE_EXCLUSIONS = [
  { slug: 'galeria-2', type: 'MultiImage' },
];
const PRELISTING_BINDING_EVIDENCE = '/private/tmp/joaquimmota-prelisting-public-binding-audit.md';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collection(snapshot, name) {
  const result = snapshot.collections?.find((candidate) => candidate.name === name);
  if (!result || !Array.isArray(result.staged?.items) || !Array.isArray(result.live?.items)) {
    throw new Error(`Missing complete staged/live source collection: ${name}`);
  }
  if (result.staged.items.length !== result.staged.pagination?.total
    || result.live.items.length !== result.live.pagination?.total) {
    throw new Error(`Incomplete staged/live source pagination: ${name}`);
  }
  return result;
}

function imageInventory(item, fields) {
  let photoSlots = 0;
  let gallerySlots = 0;
  const originalFileIds = new Set();
  for (const field of fields.filter((entry) => IMAGE_TYPES.has(entry.type))) {
    const value = item.fieldData?.[field.slug];
    const values = Array.isArray(value) ? value : [value];
    for (const asset of values) {
      if (!asset || typeof asset.fileId !== 'string' || !asset.fileId.trim()) continue;
      photoSlots += 1;
      originalFileIds.add(asset.fileId);
      if (field.type === 'MultiImage') gallerySlots += 1;
    }
  }
  return { photoSlots, gallerySlots, originalFileIds };
}

function isEligible(item, collectionData) {
  if (!item || item.isDraft !== false || item.isArchived !== false) return false;
  if (typeof item.id !== 'string' || !item.id.trim() || typeof item.cmsLocaleId !== 'string' || !item.cmsLocaleId.trim()) return false;
  const slug = item.fieldData?.slug;
  if (typeof slug !== 'string' || !slug.trim()) return false;
  return collectionData.live.items.some((live) => live.id === item.id
    && live.cmsLocaleId === item.cmsLocaleId && live.slug === slug);
}

function exactGate(gate, sampleIdsBySlug) {
  if (gate?.status !== 'passed' || !Array.isArray(gate.collections)) return false;
  return REQUIRED.every(({ slug }) => {
    const entry = gate.collections.find((candidate) => candidate.slug === slug);
    const expectedIds = sampleIdsBySlug[slug] ?? [];
    const providedIds = Array.isArray(entry?.sourceIds) ? [...entry.sourceIds].sort() : [];
    const requiredEvidence = ['content', 'visibleImages', 'order', 'layout', 'responsive', 'urls', 'seo', 'behavior'];
    return entry?.status === 'passed'
      && typeof entry.evidence === 'string' && entry.evidence.trim().length > 0
      && JSON.stringify(providedIds) === JSON.stringify([...expectedIds].sort())
      && requiredEvidence.every((key) => entry.parity?.[key] === true);
  });
}

function sameIds(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function resolveResidualDispositions(source, blankRoutes) {
  const resolved = [];
  const unresolved = [];
  const routes = Array.isArray(blankRoutes?.routes) ? blankRoutes.routes : [];
  for (const disposition of RESIDUAL_DISPOSITIONS) {
    const sourceCollection = source.collections?.find((candidate) => candidate.name === disposition.sourceCollection);
    if (!sourceCollection
      || !Array.isArray(sourceCollection.staged?.items)
      || !Array.isArray(sourceCollection.live?.items)
      || sourceCollection.staged.items.length !== sourceCollection.staged.pagination?.total
      || sourceCollection.live.items.length !== sourceCollection.live.pagination?.total) {
      unresolved.push({
        sourceCollection: disposition.sourceCollection,
        sourceIds: [],
        expectedSourceIds: [...disposition.sourceIds].sort(),
        missingBlankRouteSourceIds: [],
        reason: 'recorded residual disposition has no complete staged/live source snapshot',
      });
      continue;
    }
    const eligibleItems = sourceCollection.staged?.items
      ?.filter((item) => isEligible(item, sourceCollection) && (!disposition.matches || disposition.matches(item))) ?? [];
    const eligibleIds = eligibleItems.map((item) => item.id);
    const missingRoutes = eligibleItems.filter((item) => !routes.some((route) => route.sourceId === item.id
      && route.path === `${disposition.sourceSlug}/${item.fieldData.slug}`)).map((item) => item.id);
    if (!sameIds(eligibleIds, disposition.sourceIds) || missingRoutes.length > 0) {
      unresolved.push({
        sourceCollection: disposition.sourceCollection,
        sourceIds: eligibleIds.sort(),
        expectedSourceIds: [...disposition.sourceIds].sort(),
        missingBlankRouteSourceIds: missingRoutes.sort(),
        reason: 'recorded residual disposition no longer matches current eligible source identities or exact blank routes',
      });
      continue;
    }
    resolved.push({
      sourceCollection: disposition.sourceCollection,
      sourceIds: eligibleIds.sort(),
      blankRoutes: eligibleItems.map((item) => `/${disposition.sourceSlug}/${item.fieldData.slug}`).sort(),
      action: 'preserve blank route; do not import source content',
      evidence: disposition.evidence,
    });
  }
  return { resolved, unresolved };
}

function expectedBulkIdentity(type, item) {
  const slug = item.fieldData.slug;
  return `${type}\u0000${item.id}\u0000${item.cmsLocaleId}\u0000${slug}`;
}

function validSha1(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function fullPayloadCheck(source, cmsCollections, payload, assetMap, assetEvidence) {
  if (!Array.isArray(payload?.documents) || !assetMap || !assetEvidence?.sourceByFileId || !assetEvidence?.destinationByRef) {
    return { passed: false, reason: 'full 190-document payload, complete asset map, and source/destination asset metadata are required', documents: payload?.documents?.length ?? 0, expectedDocuments: 190, expectedVisibleAssetSlots: 1447, mappedVisibleAssetSlots: 0, uniqueVisibleSourceAssets: 0, expectedUniqueVisibleSourceAssets: 1342, assetMetadataChecks: 0 };
  }
  const expected = new Map();
  const docByIdentity = new Map();
  for (const { type, sourceName } of REQUIRED) {
    const c = collection(source, sourceName);
    const items = c.staged.items.filter((item) => isEligible(item, c)
      && (type !== 'processStep' || [BUY_PAGE_ID, HOME_PAGE_ID].includes(item.fieldData?.page)));
    for (const item of items) expected.set(expectedBulkIdentity(type, item), { type, item, c });
  }
  let invalidIdentity = false;
  for (const doc of payload.documents) {
    const identityKey = `${doc?._type}\u0000${doc?.legacyId}\u0000${doc?.locale}\u0000${doc?.sourceSlug}`;
    if (doc?.slug?.current !== doc?.sourceSlug || !expected.has(identityKey) || docByIdentity.has(identityKey)) invalidIdentity = true;
    docByIdentity.set(identityKey, doc);
  }
  if (docByIdentity.size !== expected.size || [...expected.keys()].some((key) => !docByIdentity.has(key))) invalidIdentity = true;
  let slots = 0;
  const uniqueIds = new Set();
  let assetMismatch = false;
  let assetMetadataChecks = 0;
  for (const [key, entry] of expected) {
    const doc = docByIdentity.get(key);
    if (!doc) continue;
    const excluded = entry.type === 'preListing' ? new Set(PRELISTING_IMAGE_EXCLUSIONS.map((field) => field.slug)) : new Set();
    for (const field of (entry.c.schema?.fields ?? []).filter((candidate) => IMAGE_TYPES.has(candidate.type) && !excluded.has(candidate.slug))) {
      const raw = entry.item.fieldData?.[field.slug];
      const sourceAssets = raw == null ? [] : (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
      const targetField = IMAGE_FIELD_TARGETS[entry.type]?.[field.slug];
      if (!targetField) { if (sourceAssets.length) assetMismatch = true; continue; }
      slots += sourceAssets.length;
      sourceAssets.forEach((asset) => { if (asset?.fileId) uniqueIds.add(asset.fileId); });
      let expectedRefs;
      try {
        expectedRefs = sourceAssets.map((asset, index) => assetRef(assetMap, asset, `${entry.type} image ${index}`)?.asset?._ref);
      } catch {
        assetMismatch = true;
        continue;
      }
      sourceAssets.forEach((sourceAsset, index) => {
        const fileId = sourceAsset?.fileId;
        const sourceMeta = assetEvidence.sourceByFileId[fileId];
        const destinationMeta = assetEvidence.destinationByRef[expectedRefs[index]];
        const sourceSha1 = sourceMeta?.sourceSHA1;
        const destinationSha1 = destinationMeta?.sha1;
        const sourceBytes = sourceMeta?.sourceBytes;
        const destinationBytes = destinationMeta?.size;
        assetMetadataChecks += 1;
        if (sourceMeta?.url !== sourceAsset?.url || !validSha1(sourceSha1)
          || !Number.isSafeInteger(sourceBytes) || sourceBytes <= 0
          || !validSha1(destinationSha1) || destinationSha1.toLowerCase() !== sourceSha1.toLowerCase()
          || destinationBytes !== sourceBytes) assetMismatch = true;
      });
      const targetValue = doc[targetField];
      const actualRefs = field.type === 'MultiImage'
        ? (Array.isArray(targetValue) ? targetValue.map((image) => image?.asset?._ref) : [])
        : (targetValue?.asset?._ref ? [targetValue.asset._ref] : []);
      if (JSON.stringify(expectedRefs) !== JSON.stringify(actualRefs)) assetMismatch = true;
    }
  }
  const required = cmsCollections.reduce((sum, entry) => sum + entry.sourcePhotoSlots, 0);
  const passed = !invalidIdentity && !assetMismatch && docByIdentity.size === 190
    && slots === 1447 && required === 1447 && uniqueIds.size === 1342;
  return {
    passed,
    reason: passed ? 'all eligible identities and ordered visible image references match the complete source inventory' : invalidIdentity
      ? 'full payload identities, locales, slugs, or document count do not exactly match the eligible source inventory'
      : assetMismatch || slots !== 1447 || required !== 1447 || uniqueIds.size !== 1342
        ? 'full payload visible asset coverage/order or source/destination digest-and-size receipts differ from the 1,447-slot, 1,342-unique source inventory'
        : 'full payload does not contain the required 190 eligible documents',
    documents: docByIdentity.size,
    expectedDocuments: 190,
    expectedVisibleAssetSlots: 1447,
    mappedVisibleAssetSlots: slots,
    uniqueVisibleSourceAssets: uniqueIds.size,
    expectedUniqueVisibleSourceAssets: 1342,
    assetMetadataChecks,
    expectedAssetMetadataChecks: 1447,
  };
}

export function buildBulkManifest(source, eligibilityReport, samplePayload, blankRoutes, sampleGate = null, fullPayload = null, fullAssetMap = null, fullAssetEvidence = null) {
  if (!Array.isArray(samplePayload?.documents) || !Array.isArray(eligibilityReport?.collections)) {
    throw new Error('Sample payload and eligibility report are required.');
  }
  const sampleIdsBySlug = Object.fromEntries(REQUIRED.map(({ slug }) => [slug, []]));
  for (const document of samplePayload.documents) {
    const config = REQUIRED.find((entry) => entry.type === document._type);
    if (!config || !sampleIdsBySlug[config.slug]) throw new Error(`Unexpected generated sample type: ${document._type}`);
    sampleIdsBySlug[config.slug].push(document.legacyId);
  }

  const cmsCollections = REQUIRED.map(({ type, sourceName, slug }) => {
    const sourceCollection = collection(source, sourceName);
    const reportCollection = eligibilityReport.collections.find((entry) => entry.collection?.slug === slug);
    if (!reportCollection || reportCollection.pagination?.stagedComplete !== true || reportCollection.pagination?.liveComplete !== true) {
      throw new Error(`Eligibility report is missing complete evidence for ${slug}.`);
    }
    const stagedEligible = sourceCollection.staged.items.filter((item) => isEligible(item, sourceCollection));
    if (type === 'processStep') {
      const homeIds = stagedEligible.filter((item) => item.fieldData?.page === HOME_PAGE_ID).map((item) => item.id).sort();
      const expectedHomeIds = [...HOME_VISIBILITY_EVIDENCE.sourceIds].sort();
      const sellerCount = stagedEligible.filter((item) => item.fieldData?.page === SELL_PAGE_ID).length;
      if (JSON.stringify(homeIds) !== JSON.stringify(expectedHomeIds) || sellerCount !== 7) {
        throw new Error('Process-step source identities/counts disagree with recorded Home/Vender visibility evidence.');
      }
    }
    const eligibleItems = type === 'processStep'
      ? stagedEligible.filter((item) => [BUY_PAGE_ID, HOME_PAGE_ID].includes(item.fieldData?.page))
      : stagedEligible;
    const sourceImageFields = sourceCollection.schema?.fields ?? [];
    const excludedSourceImageFields = type === 'preListing'
      ? PRELISTING_IMAGE_EXCLUSIONS.map((excluded) => {
        const field = sourceImageFields.find((entry) => entry.slug === excluded.slug);
        if (!field || field.type !== excluded.type) {
          throw new Error(`Pre-listing image exclusion evidence no longer matches source field ${excluded.slug}.`);
        }
        return {
          slug: field.slug,
          type: field.type,
          rawSourcePhotoSlots: eligibleItems.reduce((sum, item) => sum + imageInventory(item, [field]).photoSlots, 0),
          evidence: PRELISTING_BINDING_EVIDENCE,
          reason: 'no rendered cms-gallery consumer found across 19 audited public routes; field has no source values',
        };
      })
      : [];
    if (type === 'preListing'
      && (eligibleItems.length !== 19
        || excludedSourceImageFields.some((field) => field.rawSourcePhotoSlots !== 0))) {
      throw new Error('Pre-listing gallery binding evidence is stale: expected 19 eligible records and no values in excluded galeria-2.');
    }
    const excludedSlugs = new Set(excludedSourceImageFields.map((field) => field.slug));
    const migratedImageFields = sourceImageFields.filter((field) => !excludedSlugs.has(field.slug));
    const eligibleIds = new Set(eligibleItems.map((item) => item.id));
    const sampleIds = sampleIdsBySlug[slug];
    if (sampleIds.length === 0 || sampleIds.some((id) => !eligibleIds.has(id))) {
      throw new Error(`Current sample generator has missing/ineligible samples for required collection ${slug}.`);
    }
    let photoSlots = 0;
    let gallerySlots = 0;
    const uniqueOriginalAssets = new Set();
    for (const item of eligibleItems) {
      const inventory = imageInventory(item, migratedImageFields);
      photoSlots += inventory.photoSlots;
      gallerySlots += inventory.gallerySlots;
      for (const id of inventory.originalFileIds) uniqueOriginalAssets.add(id);
    }
    const sourceReport = reportCollection.eligible ?? [];
    const sourceReportIds = [...sourceReport.map((item) => item.sourceId)].sort();
    const currentEligibleIds = [...stagedEligible.map((item) => item.id)].sort();
    if (JSON.stringify(currentEligibleIds) !== JSON.stringify(sourceReportIds)) {
      throw new Error(`Eligibility report identities differ from the complete staged source for ${slug} (${sourceReportIds.length} reported, ${currentEligibleIds.length} eligible).`);
    }
    const reportedSlots = sourceReport.reduce((sum, item) => sum + (item.photoReferences ?? 0), 0);
    const reportedGallerySlots = sourceReport.reduce((sum, item) => sum + (item.gallerySlots ?? 0), 0);
    const allSourceAssets = stagedEligible.reduce((sum, item) => sum + imageInventory(item, sourceCollection.schema?.fields ?? []).photoSlots, 0);
    if (sourceReport.length !== stagedEligible.length || reportedSlots !== allSourceAssets
      || reportedGallerySlots !== stagedEligible.reduce((sum, item) => sum + imageInventory(item, sourceCollection.schema?.fields ?? []).gallerySlots, 0)) {
      throw new Error(`Eligibility report image totals differ from the complete staged source for ${slug}.`);
    }
    return {
      type,
      slug,
      sourceCollection: sourceName,
      sourceEligibleItems: eligibleItems.length,
      sourcePhotoSlots: photoSlots,
      sourceGallerySlots: gallerySlots,
      uniqueOriginalAssets: uniqueOriginalAssets.size,
      ...(type === 'preListing' ? { excludedSourceImageFields } : {}),
      sampleSourceIds: [...sampleIds].sort(),
      samplesRemainingAfterValidation: Math.max(eligibleItems.length - sampleIds.length, 0),
      visibility: type === 'processStep'
        ? {
          basis: 'source enum ids plus recorded page visibility evidence',
          includedPlacements: [
            { name: 'Comprar', enumId: BUY_PAGE_ID, eligibleItems: stagedEligible.filter((item) => item.fieldData?.page === BUY_PAGE_ID).length },
            { name: 'Home', enumId: HOME_PAGE_ID, eligibleItems: stagedEligible.filter((item) => item.fieldData?.page === HOME_PAGE_ID).length, evidence: HOME_VISIBILITY_EVIDENCE },
          ],
          excludedPlacements: [
            { name: 'Vender', enumId: SELL_PAGE_ID, eligibleItems: stagedEligible.filter((item) => item.fieldData?.page === SELL_PAGE_ID).length, evidence: SELL_HIDDEN_EVIDENCE },
          ],
          unresolvedCases: stagedEligible.filter((item) => item.fieldData?.page === PS_EXCLUSIVE_PAGE_ID).map((item) => item.id).sort(),
        }
        : { basis: 'required collection in accepted migration scope', unresolvedCases: 0 },
    };
  });

  const { resolved: resolvedVisibilityDispositions, unresolved } = resolveResidualDispositions(source, blankRoutes);

  // A recorded six-collection sample review is insufficient when the same
  // snapshot still contains source-eligible records whose public disposition
  // is unknown. Keep the manifest preparatory until those cases are resolved.
  const sampleGatePassed = exactGate(sampleGate, sampleIdsBySlug);
  const fullCheck = fullPayloadCheck(source, cmsCollections, fullPayload, fullAssetMap, fullAssetEvidence);
  const bulkReady = sampleGatePassed && unresolved.length === 0 && fullCheck.passed;
  const bulkReason = !sampleGatePassed
    ? 'recorded 100% content/image/order/layout/responsive/URL/SEO/behavior sample evidence is absent or incomplete'
    : unresolved.length > 0
      ? 'source-eligible records have unresolved public visibility or template disposition'
      : !fullCheck.passed ? fullCheck.reason
        : 'all required collection samples have recorded complete parity evidence, no source-eligible visibility cases remain unresolved, and full payload/media coverage is exact';
  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only-preparation',
    sourceSiteId: source.siteId ?? null,
    sourceCapturedAt: source.capturedAt ?? null,
    sourceDraftPolicy: 'exclude every staged source draft regardless of older live version',
    collections: cmsCollections,
    blankCmsOriginalRoutes: {
      count: Array.isArray(blankRoutes?.routes) ? blankRoutes.routes.length : null,
      contentRequired: false,
      basis: 'docs/migration/blank-template-routes.json',
    },
    resolvedVisibilityDispositions,
    unresolvedVisibilityCases: unresolved,
    bulkGate: {
      status: bulkReady ? 'passed' : 'blocked',
      reason: bulkReason,
      bulkWritesPermitted: bulkReady,
      fullPayload: fullCheck,
    },
    safety: { sourceCmsWrites: false, destinationCmsWrites: false, sourcePayloadOrPersonalContentIncluded: false },
  };
}

function usage() {
  console.error('Usage: node scripts/migration/bulk-manifest.mjs <source.json> <eligibility-report.json> <sample-asset-map.json> <blank-routes.json> <output.json> [--sample-gate gate.json] [--full-payload payload.json --full-asset-map asset-map.json --full-asset-evidence evidence.json] [--require-bulk-ready]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [sourcePath, reportPath, assetMapPath, blankRoutesPath, outputPath] = args;
  const gateIndex = args.indexOf('--sample-gate');
  const fullPayloadIndex = args.indexOf('--full-payload');
  const fullAssetMapIndex = args.indexOf('--full-asset-map');
  const fullAssetEvidenceIndex = args.indexOf('--full-asset-evidence');
  const requireReady = args.includes('--require-bulk-ready');
  if (!sourcePath || !reportPath || !assetMapPath || !blankRoutesPath || !outputPath) {
    usage();
    process.exitCode = 2;
  } else {
    const source = readJson(sourcePath);
    const report = readJson(reportPath);
    const assets = readJson(assetMapPath);
    const blankRoutes = readJson(blankRoutesPath);
    const samplePayload = buildPayload(source, assets);
    const gate = gateIndex >= 0 ? readJson(args[gateIndex + 1]) : null;
    const fullPayload = fullPayloadIndex >= 0 ? readJson(args[fullPayloadIndex + 1]) : null;
    const fullAssetMap = fullAssetMapIndex >= 0 ? readJson(args[fullAssetMapIndex + 1]) : null;
    const fullAssetEvidence = fullAssetEvidenceIndex >= 0 ? readJson(args[fullAssetEvidenceIndex + 1]) : null;
    if ((fullPayloadIndex >= 0 || fullAssetMapIndex >= 0 || fullAssetEvidenceIndex >= 0)
      && (fullPayloadIndex < 0 || fullAssetMapIndex < 0 || fullAssetEvidenceIndex < 0)) {
      throw new Error('--full-payload, --full-asset-map, and --full-asset-evidence are required together.');
    }
    const manifest = buildBulkManifest(source, report, samplePayload, blankRoutes, gate, fullPayload, fullAssetMap, fullAssetEvidence);
    if (requireReady && !manifest.bulkGate.bulkWritesPermitted) {
      throw new Error(`Bulk gate ${manifest.bulkGate.status}: ${manifest.bulkGate.reason}`);
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Wrote read-only manifest for ${manifest.collections.length} required CMS collections; bulk gate ${manifest.bulkGate.status}.`);
  }
}
