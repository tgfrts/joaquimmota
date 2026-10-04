import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Prepares exact, metadata-auditable Sanity tool requests. This module never calls a provider.
// It trusts the authoritative full manifest's real-source/ref checks; callers must build that
// manifest against this same payload and upload receipt evidence before using the private plan.
export const PROJECT_ID = 'kaq1vd9b';
export const DATASET = 'production';
export const LINK_ID = 'link_6ac104868dc881919babf0aac7618ecb';
export const MAX_REQUEST_BYTES = 90 * 1024;
export const EXPECTED_REMAINING = { property: 63, article: 57, testimonial: 36, preListing: 17, processStep: 6, offer: 0 };
const IMAGE_FIELDS = {
  property: ['featuredImage', 'gallery'],
  article: ['mainImage', 'thumbnailImage', 'openGraphImage', 'gallery'],
  testimonial: ['portrait'], offer: ['image'], preListing: ['heroImage'], processStep: ['image', 'thumbnail'],
};
const IMAGE_REF = /^image-[a-f0-9]{40}-[1-9]\d*x[1-9]\d*-[a-z0-9]+$/i;
const EXPECTED_FULL = { documents: 190, expectedDocuments: 190, expectedVisibleAssetSlots: 1447, mappedVisibleAssetSlots: 1447, uniqueVisibleSourceAssets: 1342, expectedUniqueVisibleSourceAssets: 1342, assetMetadataChecks: 1447 };
const EXPECTED_FULL_COUNTS = { property: 65, article: 59, testimonial: 38, offer: 1, preListing: 19, processStep: 8 };

function assert(condition, message) { if (!condition) throw new Error(message); }
function identity(doc) {
  assert(doc && typeof doc._type === 'string' && doc._type.trim(), 'Document has no _type.');
  assert(typeof doc.legacyId === 'string' && doc.legacyId.trim(), 'Document has no legacyId.');
  assert(typeof doc.locale === 'string' && doc.locale.trim(), 'Document has no locale.');
  return `${doc._type}\0${doc.legacyId}\0${doc.locale}`;
}
function stableId(doc) {
  const id = `jm-${doc._type}-${doc.legacyId}-${doc.locale}`;
  assert(id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(id), `Identity cannot form a stable Sanity ID: ${identity(doc).replaceAll('\0', '/')}`);
  return id;
}
function toolArgs(documents) {
  return {
    projectId: PROJECT_ID,
    dataset: DATASET,
    link_id: LINK_ID,
    documents: documents.map((doc) => {
      const { _type, ...content } = doc;
      return { type: _type, content: { ...content, _id: stableId(doc) } };
    }),
  };
}
function requestBytes(args) { return Buffer.byteLength(JSON.stringify(args), 'utf8'); }
function validateSampleParity(parity, manifest, payload) {
  const flags = ['all11IdentityMatched', 'structuredContentExact', 'sourceSlugPreserved', 'routesExact', 'allSampleDocsTargetDraft', 'imagesPass', 'semanticPortableTextPass'];
  assert(flags.every((key) => parity?.overall?.[key] === true), 'Sample parity evidence is incomplete or not passed.');
  const counts = parity.documentCount;
  assert(counts && counts.payload === 11 && counts.target === 11 && counts.identityMatches === 11
    && counts.targetOnlyCount === 0 && Array.isArray(counts.exactStructuredMismatches) && counts.exactStructuredMismatches.length === 0
    && Array.isArray(parity.samples) && parity.samples.length === 11, 'Expected exact 11/11 sample identity and structured-content parity evidence.');
  const payloadIds = new Set(payload.documents.map(identity));
  const samplesByType = new Map();
  for (const sample of parity.samples) {
    const key = identity({ _type: sample.identity?.type, legacyId: sample.identity?.legacyId, locale: sample.identity?.locale });
    assert(payloadIds.has(key), `Sample parity identity is absent from full payload: ${key.replaceAll('\0', '/')}`);
    const list = samplesByType.get(sample.identity.type) ?? [];
    list.push(sample.identity.legacyId);
    samplesByType.set(sample.identity.type, list);
  }
  for (const entry of manifest.collections ?? []) {
    const actual = [...(samplesByType.get(entry.type) ?? [])].sort();
    const expected = [...(entry.sampleSourceIds ?? [])].sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected), `Sample manifest mismatch for ${entry.type}.`);
  }
  return new Set(parity.samples.map((sample) => identity({ _type: sample.identity.type, legacyId: sample.identity.legacyId, locale: sample.identity.locale })));
}
function validateFullManifest(manifest) {
  assert(manifest?.bulkGate?.status === 'passed' && manifest.bulkGate.bulkWritesPermitted === true, 'Full bulk manifest gate is not passed.');
  const full = manifest.bulkGate.fullPayload;
  assert(full?.passed === true, 'Full payload/media verification is not passed.');
  for (const [key, value] of Object.entries(EXPECTED_FULL)) assert(full[key] === value, `Full manifest ${key} must be ${value}.`);
  assert(Array.isArray(manifest.collections) && manifest.collections.length === Object.keys(EXPECTED_REMAINING).length, 'Manifest must include all six CMS collections.');
  for (const [type, remaining] of Object.entries(EXPECTED_REMAINING)) {
    const entry = manifest.collections.find((item) => item.type === type);
    assert(entry && Number.isInteger(entry.sourceEligibleItems) && entry.sourceEligibleItems - (entry.sampleSourceIds?.length ?? 0) === remaining,
      `Manifest eligible/sample counts do not establish ${remaining} remaining ${type} documents.`);
  }
}
function validatePayload(payload, manifest) {
  assert(Array.isArray(payload?.documents) && payload.documents.length === 190, 'Expected a complete 190-document payload.');
  const seen = new Set();
  const counts = Object.fromEntries(Object.keys(EXPECTED_REMAINING).map((type) => [type, 0]));
  const slots = Object.fromEntries(Object.keys(EXPECTED_REMAINING).map((type) => [type, 0]));
  const refs = new Set();
  for (const doc of payload.documents) {
    const key = identity(doc);
    assert(!seen.has(key), `Duplicate full-payload identity: ${key.replaceAll('\0', '/')}`);
    seen.add(key);
    assert(Object.hasOwn(counts, doc._type), `Unexpected CMS type: ${doc._type}`);
    counts[doc._type]++;
    assert(typeof doc.sourceSlug === 'string' && doc.sourceSlug.trim() && doc.slug?.current === doc.sourceSlug, `Source slug mismatch for ${key.replaceAll('\0', '/')}.`);
    for (const field of IMAGE_FIELDS[doc._type]) {
      const value = doc[field];
      const images = Array.isArray(value) ? value : value == null ? [] : [value];
      for (const image of images) {
        const ref = image?._type === 'image' ? image.asset?._ref : image?.asset?._ref;
        assert(typeof ref === 'string' && IMAGE_REF.test(ref), `Missing or non-real image reference in ${doc._type}.${field}.`);
        slots[doc._type]++;
        refs.add(ref);
      }
    }
  }
  assert(Object.values(counts).reduce((sum, n) => sum + n, 0) === 190, 'Payload count mismatch.');
  for (const [type, expected] of Object.entries(EXPECTED_FULL_COUNTS)) assert(counts[type] === expected, `Full payload must contain ${expected} ${type} documents.`);
  const expectedSlots = Object.fromEntries(manifest.collections.map((entry) => [entry.type, entry.sourcePhotoSlots]));
  for (const type of Object.keys(counts)) assert(Number.isInteger(expectedSlots[type]) && slots[type] === expectedSlots[type], `Full image slot count mismatch for ${type}.`);
  assert(Object.values(slots).reduce((sum, n) => sum + n, 0) === 1447 && refs.size === 1342, 'Full payload visible image totals do not match verified manifest.');
}

export function buildCreateBatches(payload, manifest, parity, { maxBytes = MAX_REQUEST_BYTES } = {}) {
  assert(Number.isInteger(maxBytes) && maxBytes > 0 && maxBytes <= MAX_REQUEST_BYTES, `maxBytes must be between 1 and ${MAX_REQUEST_BYTES}.`);
  validateFullManifest(manifest);
  validatePayload(payload, manifest);
  const excluded = validateSampleParity(parity, manifest, payload);
  const remaining = payload.documents.filter((doc) => !excluded.has(identity(doc)));
  const actualCounts = Object.fromEntries(Object.keys(EXPECTED_REMAINING).map((type) => [type, remaining.filter((doc) => doc._type === type).length]));
  assert(JSON.stringify(actualCounts) === JSON.stringify(EXPECTED_REMAINING), `Remaining per-type counts mismatch: ${JSON.stringify(actualCounts)}.`);
  const batches = [];
  let current = [];
  for (const doc of remaining) {
    const candidate = [...current, doc];
    const size = requestBytes(toolArgs(candidate));
    if (size > maxBytes && current.length === 0) throw new Error(`Single document ${identity(doc).replaceAll('\0', '/')} exceeds request limit (${size} > ${maxBytes} bytes).`);
    if (size > maxBytes) { batches.push(current); current = [doc]; }
    else current = candidate;
  }
  if (current.length) batches.push(current);
  return batches.map((docs, index) => {
    const args = toolArgs(docs);
    const bytes = requestBytes(args);
    assert(bytes <= maxBytes, `Internal request-size overflow in batch ${index + 1}.`);
    return {
      batchNumber: index + 1,
      requestBytes: bytes,
      args,
      expectedDrafts: docs.map((doc) => ({ type: doc._type, legacyId: doc.legacyId, locale: doc.locale, sourceSlug: doc.sourceSlug, draftId: `drafts.${stableId(doc)}` })),
    };
  });
}

// Pure reconciliation helper for a caller that queried Sanity after an unknown tool outcome.
export function reconcileUnknownBatch(batch, observedDocuments, { maxBytes = MAX_REQUEST_BYTES } = {}) {
  assert(Array.isArray(batch?.args?.documents) && Array.isArray(observedDocuments), 'Batch args and observed documents are required.');
  const expected = batch.args.documents;
  const observedByIdentity = new Map();
  for (const doc of observedDocuments) {
    const key = identity(doc);
    if (expected.some((entry) => `drafts.${entry.content._id}` === doc._id
      && !(entry.type === doc._type && entry.content.legacyId === doc.legacyId && entry.content.locale === doc.locale))) {
      return { status: 'blocked', reason: 'stable draft ID is attached to a different source identity', retryArgs: null, completeCount: 0, missingCount: 0 };
    }
    if (!expected.some((entry) => entry.type === doc._type && entry.content.legacyId === doc.legacyId && entry.content.locale === doc.locale)) continue;
    const list = observedByIdentity.get(key) ?? [];
    list.push(doc);
    observedByIdentity.set(key, list);
  }
  const missing = [];
  for (const entry of expected) {
    const expectedContent = entry.content;
    const key = identity({ _type: entry.type, legacyId: expectedContent.legacyId, locale: expectedContent.locale });
    const matches = observedByIdentity.get(key) ?? [];
    if (matches.length > 1) return { status: 'blocked', reason: 'duplicate target documents for an expected source identity', retryArgs: null, completeCount: 0, missingCount: 0 };
    if (matches.length === 0) { missing.push(entry); continue; }
    const observed = matches[0];
    if (observed._id !== `drafts.${expectedContent._id}`
      || observed.sourceSlug !== expectedContent.sourceSlug
      || observed.slug?.current !== expectedContent.slug?.current) {
      return { status: 'blocked', reason: 'target identity, stable draft ID, or preserved source slug mismatch', retryArgs: null, completeCount: 0, missingCount: 0 };
    }
    const expectedDocument = { ...expectedContent, _id: `drafts.${expectedContent._id}`, _type: entry.type };
    if (canonicalContent(observed) !== canonicalContent(expectedDocument)) {
      return { status: 'blocked', reason: 'target structured content differs from the requested document', retryArgs: null, completeCount: 0, missingCount: 0 };
    }
  }
  const completeCount = expected.length - missing.length;
  if (!missing.length) return { status: 'complete', retryArgs: null, completeCount, missingCount: 0 };
  const retryArgs = { ...batch.args, documents: missing };
  const bytes = requestBytes(retryArgs);
  if (bytes > maxBytes) return { status: 'blocked', reason: `retry request exceeds ${maxBytes} bytes`, retryArgs: null, completeCount, missingCount: missing.length };
  return { status: 'retry-missing-only', retryArgs, retryBytes: bytes, completeCount, missingCount: missing.length };
}

const SANITY_METADATA = new Set(['_id', '_type', '_rev', '_createdAt', '_updatedAt']);
function canonicalContent(value, topLevel = true) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalContent(item, false)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([key]) => !(topLevel && SANITY_METADATA.has(key)))
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalContent(item, false)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function usage() {
  console.error('Usage: node scripts/migration/bulk-create-batches.mjs <190-payload.json> <bulk-manifest.json> <sample-data-parity.json> <new-private-output-dir> [max-bytes]');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [payloadPath, manifestPath, parityPath, outputDir, maxBytesArg] = process.argv.slice(2);
    if (!payloadPath || !manifestPath || !parityPath || !outputDir) { usage(); process.exitCode = 2; }
    else {
      const absoluteOutput = path.resolve(outputDir);
      assert(absoluteOutput.startsWith('/private/tmp/'), 'Output directory must be under /private/tmp/.');
      assert(!fs.existsSync(absoluteOutput), 'Output directory already exists; refusing to overwrite.');
      const maxBytes = maxBytesArg === undefined ? MAX_REQUEST_BYTES : Number(maxBytesArg);
      const batches = buildCreateBatches(readJson(payloadPath), readJson(manifestPath), readJson(parityPath), { maxBytes });
      fs.mkdirSync(absoluteOutput, { recursive: true, mode: 0o700 });
      for (const batch of batches) fs.writeFileSync(path.join(absoluteOutput, `batch-${String(batch.batchNumber).padStart(3, '0')}.json`), `${JSON.stringify(batch, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      fs.writeFileSync(path.join(absoluteOutput, 'summary.json'), `${JSON.stringify({ tool: 'mcp__codex_apps__sanity_create_documents', batchCount: batches.length, documentCount: batches.reduce((sum, batch) => sum + batch.args.documents.length, 0), requestBytes: batches.map((batch) => batch.requestBytes), maxRequestBytes: maxBytes, sourcePayloadPath: path.basename(payloadPath), manifestPath: path.basename(manifestPath), parityEvidencePath: path.basename(parityPath) }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      console.log(`Prepared ${batches.length} metadata-gated request batches for 179 documents; no provider calls were made.`);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
