import fs from 'node:fs';
import path from 'node:path';

const hasBoolean = (value) => typeof value === 'boolean';

function fieldSlug(item) {
  const slug = item?.fieldData?.slug;
  return typeof slug === 'string' && slug.trim().length ? slug : null;
}

function publicSlug(item) {
  return typeof item?.slug === 'string' && item.slug.trim().length ? item.slug : null;
}

function identityKey(item) {
  const locale = typeof item?.cmsLocaleId === 'string' ? item.cmsLocaleId : '<invalid-locale>';
  return `${item?.id ?? '<missing-id>'}\0${locale}`;
}

function snapshotIsComplete(snapshot, items) {
  const total = snapshot?.pagination?.total;
  return Array.isArray(snapshot?.items) && Number.isInteger(total) && total >= 0 && items.length === total;
}

function imageSlots(item, schemaFields = []) {
  const data = item?.fieldData ?? {};
  let photoReferences = 0;
  let gallerySlots = 0;
  const imageFields = schemaFields.filter((field) => field.type === 'Image' || field.type === 'MultiImage');
  for (const field of imageFields) {
    const value = data[field.slug];
    if (field.type === 'Image') {
      if (value && typeof value === 'object' && typeof value.fileId === 'string') photoReferences += 1;
      continue;
    }
    if (Array.isArray(value)) {
      const slots = value.filter((entry) => entry && typeof entry === 'object' && typeof entry.fileId === 'string').length;
      photoReferences += slots;
      gallerySlots += slots;
    }
  }
  return { photoReferences, gallerySlots };
}

function inventoryMap(inventory) {
  const byCollection = new Map();
  for (const collection of inventory?.collections ?? []) {
    byCollection.set(collection.slug, collection);
  }
  return byCollection;
}

export function buildEligibilityReport(source, inventory = { collections: [] }) {
  if (!Array.isArray(source.collections) || source.collections.length === 0) {
    throw new Error('Source snapshot has no collections.');
  }
  for (const collection of source.collections) {
    const stagedItems = Array.isArray(collection.staged?.items) ? collection.staged.items : [];
    const liveItems = Array.isArray(collection.live?.items) ? collection.live.items : [];
    if (!snapshotIsComplete(collection.staged, stagedItems) || !snapshotIsComplete(collection.live, liveItems)) {
      throw new Error(`Incomplete or invalid staged/live pagination snapshot for collection ${collection.slug ?? '(unknown)'}.`);
    }
  }
  const inventoryByCollection = inventoryMap(inventory);
  const collections = (source.collections ?? []).map((collection) => {
    const staged = Array.isArray(collection.staged?.items) ? collection.staged.items : [];
    const live = Array.isArray(collection.live?.items) ? collection.live.items : [];
    const stagedByIdLocale = new Map(staged.map((item) => [identityKey(item), item]));
    const liveByIdLocale = new Map(live.map((item) => [identityKey(item), item]));
    const liveById = new Map();
    for (const item of live) {
      const matches = liveById.get(item.id) ?? [];
      matches.push(item);
      liveById.set(item.id, matches);
    }
    const candidates = new Map();
    for (const item of [...staged, ...live]) {
      if (item?.id) candidates.set(identityKey(item), item);
    }
    for (const row of inventoryByCollection.get(collection.slug)?.live ?? []) {
      if (row?.id && ![...candidates.values()].some((candidate) => candidate?.id === row.id)) {
        candidates.set(`${row.id}\0<inventory-locale>`, row);
      }
    }

    const eligible = [];
    const excluded = [];
    for (const [identity, fallback] of candidates) {
      const id = fallback?.id;
      const current = stagedByIdLocale.get(identity);
      const item = current ?? fallback;
      const slug = fieldSlug(item);
      const sameLocaleLive = liveByIdLocale.get(identity);
      const idLive = liveById.get(id) ?? [];
      const liveSlug = publicSlug(sameLocaleLive ?? (idLive.length === 1 ? idLive[0] : null) ?? fallback);
      const reasons = [];
      if (typeof id !== 'string' || !id.trim()) reasons.push('missing-or-invalid-source-id');
      if (!current) reasons.push('missing-current-staged-record');
      else {
        if (!hasBoolean(current.isDraft)) reasons.push('unknown-draft-state');
        else if (current.isDraft) reasons.push('source-draft');
        if (!hasBoolean(current.isArchived)) reasons.push('unknown-archive-state');
        else if (current.isArchived) reasons.push('source-archived');
      }
      if (current && (typeof current.cmsLocaleId !== 'string' || !current.cmsLocaleId.trim())) reasons.push('missing-or-invalid-staged-locale');
      const liveMatch = current && typeof current.cmsLocaleId === 'string' && current.cmsLocaleId.trim()
        ? liveByIdLocale.get(identity)
        : null;
      if (!liveMatch) reasons.push('missing-live-id-locale-match');
      if (current && !slug) reasons.push('missing-or-invalid-staged-slug');
      if (current && liveMatch && !publicSlug(liveMatch)) reasons.push('missing-or-invalid-live-slug');
      if (current && liveMatch && slug && publicSlug(liveMatch) && slug !== publicSlug(liveMatch)) reasons.push('staged-live-slug-mismatch');
      if (reasons.length) {
        excluded.push({ sourceId: id ?? null, sourceLocaleId: current?.cmsLocaleId ?? fallback?.cmsLocaleId ?? null, sourceSlug: slug, liveSlug, reasons });
        continue;
      }
      const counts = imageSlots(current, collection.schema?.fields);
      eligible.push({ sourceId: id, sourceLocaleId: current.cmsLocaleId, sourceSlug: liveSlug, ...counts });
    }

    const sampleSize = Math.min(2, eligible.length);
    const samples = eligible.slice(0, sampleSize).map(({ sourceId, sourceLocaleId, sourceSlug, photoReferences, gallerySlots }) => ({
      sourceId, sourceLocaleId, sourceSlug, photoReferences, gallerySlots,
    }));
    const totals = eligible.reduce((sum, item) => ({
      items: sum.items + 1,
      photoReferences: sum.photoReferences + item.photoReferences,
      gallerySlots: sum.gallerySlots + item.gallerySlots,
    }), { items: 0, photoReferences: 0, gallerySlots: 0 });
    return {
      collection: { id: collection.id, name: collection.name, slug: collection.slug },
      pagination: {
        stagedReceived: staged.length,
        stagedReported: collection.staged?.pagination?.total ?? null,
        stagedComplete: snapshotIsComplete(collection.staged, staged),
        liveReceived: live.length,
        liveReported: collection.live?.pagination?.total ?? null,
        liveComplete: snapshotIsComplete(collection.live, live),
      },
      eligibleCount: eligible.length,
      eligible,
      excluded,
      eligibleTotals: totals,
      sampleManifest: { status: 'awaiting-sample-parity', items: samples },
    };
  });
  return {
    sourceSiteId: source.siteId ?? null,
    capturedAt: source.capturedAt ?? null,
    generatedAt: new Date().toISOString(),
    collections,
  };
}

export function buildCountComparison(report, targetCounts) {
  const targets = new Map((targetCounts?.collections ?? []).map((item) => [item.slug, item]));
  return {
    generatedAt: new Date().toISOString(),
    note: 'Aggregate reconciliation only; source counts count image references and gallery slots, not deduplicated assets.',
    collections: report.collections.map((collection) => {
      const expected = collection.eligibleTotals;
      const actual = targets.get(collection.collection.slug);
      const sampleIds = collection.sampleManifest.items.map((sample) => sample.sourceId).sort();
      const parity = actual?.sampleParity;
      const parityIds = Array.isArray(parity?.sourceIds) ? [...parity.sourceIds].sort() : [];
      if (!actual || parity?.status !== 'passed' || typeof parity.evidence !== 'string' || !parity.evidence.trim()
        || JSON.stringify(parityIds) !== JSON.stringify(sampleIds)) {
        throw new Error(`Count comparison requires passed parity evidence naming this collection's exact sample source IDs: ${collection.collection.slug}.`);
      }
      const target = {
        items: actual.items,
        photoReferences: actual.photoReferences,
        gallerySlots: actual.gallerySlots,
      };
      const matches = ['items', 'photoReferences', 'gallerySlots'].every((key) => Number.isInteger(target[key]) && target[key] === expected[key]);
      return { slug: collection.collection.slug, source: expected, target, status: matches ? 'match' : 'mismatch' };
    }),
  };
}

function usage() {
  console.error('Usage: node scripts/migration/eligibility.mjs <source.json> <inventory.json> <output-dir> [--target-counts counts.json]');
}

function writeJson(filepath, value) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, `${JSON.stringify(value, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [sourcePath, inventoryPath, outputDir, ...rest] = process.argv.slice(2);
  if (!sourcePath || !inventoryPath || !outputDir) {
    usage();
    process.exitCode = 2;
  } else {
    const optionIndex = rest.indexOf('--target-counts');
    const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const report = buildEligibilityReport(source, inventory);
    writeJson(path.join(outputDir, 'eligibility-report.json'), report);
    writeJson(path.join(outputDir, 'sample-manifest.json'), {
      generatedAt: report.generatedAt,
      collections: report.collections.map(({ collection, sampleManifest }) => ({ collection, ...sampleManifest })),
    });
    if (optionIndex >= 0) {
      const countsPath = rest[optionIndex + 1];
      if (!countsPath) throw new Error('--target-counts requires a JSON path');
      const comparison = buildCountComparison(report, JSON.parse(fs.readFileSync(countsPath, 'utf8')));
      writeJson(path.join(outputDir, 'count-comparison.json'), comparison);
    }
    console.log(`Wrote metadata-only migration reports for ${report.collections.length} collections to ${outputDir}`);
  }
}
