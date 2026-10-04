import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REQUIRED = [
  ['property', 'Imóveis'], ['article', 'Blog Posts'], ['testimonial', 'Testemunhos'],
  ['offer', 'Ofertas'], ['preListing', 'Pre-Listings'], ['processStep', 'VS Destaques'],
];
const BUY_PAGE_ID = '61e1b999e018031966a98c78f8548d5d';
const HOME_PAGE_ID = '663132020846a392d304a25e78392a84';
const SELL_PAGE_ID = '12b19dfc9cb975be3f2f8c2b397c5af7';
const PS_EXCLUSIVE_PAGE_ID = '476ae63fed50f2fc5dcf2605b91221c0';
const EXCLUDED_FIELDS = new Set(['Pre-Listings\0galeria-2']);
const EXPECTED = { documents: 190, slots: 1447, unique: 1342 };
const PRIVATE_ROOT = '/private/tmp';
const DEFAULT_CACHE = '/private/tmp/jrmota-full-original-media';
const DEFAULT_VALIDATED_CACHE = '/private/tmp/jrmota-original-sample-media';
const ALLOWED_HOSTS = ['webflow.com', 'website-files.com'];
const MAX_BYTES = 100 * 1024 * 1024;

function readJson(filepath) {
  return JSON.parse(fsSync.readFileSync(filepath, 'utf8'));
}

function collection(source, name) {
  const entry = source.collections?.find((item) => item.name === name);
  for (const key of ['staged', 'live']) {
    const snapshot = entry?.[key];
    if (!Array.isArray(snapshot?.items) || snapshot.items.length !== snapshot.pagination?.total) {
      throw new Error(`Incomplete ${key} pagination for ${name}.`);
    }
  }
  return entry;
}

function eligible(item, sourceCollection) {
  if (item?.isDraft !== false || item?.isArchived !== false) return false;
  const { id, cmsLocaleId, fieldData } = item;
  if (![id, cmsLocaleId, fieldData?.slug].every((value) => typeof value === 'string' && value.trim())) return false;
  return sourceCollection.live.items.some((candidate) => candidate.id === id
    && candidate.cmsLocaleId === cmsLocaleId && candidate.slug === fieldData.slug);
}

function publicSourceItem(type, item) {
  if (type !== 'processStep') return true;
  return [BUY_PAGE_ID, HOME_PAGE_ID].includes(item.fieldData?.page);
}

function assertSourceUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Source image has an invalid public URL.'); }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error('Source image URL is outside the approved public Webflow asset hosts.');
  }
  return url.toString();
}

export function collectVisibleAssets(source) {
  const slots = [];
  const documents = [];
  for (const [type, sourceName] of REQUIRED) {
    const c = collection(source, sourceName);
    const items = c.staged.items.filter((item) => eligible(item, c) && publicSourceItem(type, item));
    if (type === 'processStep') {
      const seller = c.staged.items.filter((item) => eligible(item, c) && item.fieldData?.page === SELL_PAGE_ID).length;
      if (seller !== 7) throw new Error('Recorded hidden Seller-step inventory changed; refresh visibility evidence.');
      const exclusive = c.staged.items.filter((item) => eligible(item, c) && item.fieldData?.page === PS_EXCLUSIVE_PAGE_ID).length;
      if (exclusive !== 3) throw new Error('Recorded out-of-scope PS Exclusive inventory changed; refresh visibility evidence.');
    }
    const fields = c.schema?.fields ?? [];
    for (const item of items) {
      documents.push({ type, legacyId: item.id, locale: item.cmsLocaleId, sourceSlug: item.fieldData.slug });
      for (const field of fields) {
        if (field.type !== 'Image' && field.type !== 'MultiImage') continue;
        if (EXCLUDED_FIELDS.has(`${sourceName}\0${field.slug}`)) continue;
        const raw = item.fieldData?.[field.slug];
        const values = field.type === 'MultiImage' ? (Array.isArray(raw) ? raw : []) : (raw ? [raw] : []);
        values.forEach((asset, fieldIndex) => {
          if (!asset || typeof asset.fileId !== 'string' || !asset.fileId.trim()) throw new Error(`Invalid visible image reference in ${sourceName}.${field.slug}.`);
          const url = assertSourceUrl(asset.url);
          slots.push({ position: slots.length, type, legacyId: item.id, locale: item.cmsLocaleId, sourceSlug: item.fieldData.slug, sourceCollection: sourceName, sourceField: field.slug, fieldIndex, fileId: asset.fileId, url });
        });
      }
    }
  }
  const unique = new Map();
  for (const slot of slots) {
    const existing = unique.get(slot.fileId);
    if (existing && existing.url !== slot.url) throw new Error('One source file ID resolves to multiple URLs.');
    if (!existing) unique.set(slot.fileId, { fileId: slot.fileId, url: slot.url, occurrences: 0 });
    unique.get(slot.fileId).occurrences += 1;
  }
  return { documents, slots, assets: [...unique.values()] };
}

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

async function readCachedReceipt(asset, cacheDir, validatedCacheDir, validatedSources) {
  const receipt = validatedSources.get(asset.fileId);
  if (!receipt || receipt.sourceURL !== asset.url || receipt.originalDigestMatches !== true
    || receipt.originalSizeMatches !== true || !/^[a-f0-9]{40}$/i.test(receipt.sourceSHA1 ?? '')
    || !Number.isSafeInteger(receipt.sourceBytes) || receipt.sourceBytes <= 0) return null;
  for (const localPath of [path.join(cacheDir, asset.fileId), path.join(validatedCacheDir, asset.fileId)]) {
    try {
      const bytes = await fs.readFile(localPath);
      if (bytes.length !== receipt.sourceBytes || sha1(bytes) !== receipt.sourceSHA1.toLowerCase()) continue;
      const destinationPath = path.join(cacheDir, asset.fileId);
      if (localPath !== destinationPath) await fs.writeFile(destinationPath, bytes);
      return { sourceSHA1: receipt.sourceSHA1.toLowerCase(), sourceBytes: bytes.length, cachePath: destinationPath, reusedValidated: true };
    } catch { /* Try the next private cache location. */ }
  }
  return null;
}

async function downloadAsset(asset, cacheDir) {
  let response;
  try {
    response = await fetch(asset.url, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
  } catch {
    throw new Error('Public GET failed.');
  }
  if (!response.ok) throw new Error(`Public GET returned HTTP ${response.status}.`);
  const finalUrl = assertSourceUrl(response.url);
  if (finalUrl !== asset.url) throw new Error('Public GET redirected to a different source URL.');
  const announcedLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(announcedLength) && announcedLength > MAX_BYTES) throw new Error('Source image exceeds the 100 MiB preparation limit.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_BYTES) throw new Error('Downloaded source image has an invalid size.');
  const cachePath = path.join(cacheDir, asset.fileId);
  await fs.writeFile(cachePath, buffer);
  return { sourceSHA1: sha1(buffer), sourceBytes: buffer.length, cachePath, reusedValidated: false };
}

async function mapLimit(items, concurrency, callback) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await callback(items[index], index);
    }
  });
  await Promise.all(workers);
}

export async function prepareMedia(source, validatedSources, { cacheDir = DEFAULT_CACHE, validatedCacheDir = DEFAULT_VALIDATED_CACHE, concurrency = 6, progress = () => {} } = {}) {
  if (!path.resolve(cacheDir).startsWith(`${PRIVATE_ROOT}/`)) throw new Error('Original media cache must be under /private/tmp/.');
  if (!path.resolve(validatedCacheDir).startsWith(`${PRIVATE_ROOT}/`)) throw new Error('Validated source cache must be under /private/tmp/.');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Download concurrency must be between 1 and 8.');
  const inventory = collectVisibleAssets(source);
  const digestRecords = Array.isArray(validatedSources?.records) ? validatedSources.records : [];
  const validatedById = new Map(digestRecords.map((record) => [record.fileId, record]));
  await fs.mkdir(cacheDir, { recursive: true });
  const checkpointPath = path.join(cacheDir, 'source-digest-checkpoint.json');
  let priorCheckpoint = { records: [] };
  try { priorCheckpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf8')); } catch { /* First run or incomplete prior checkpoint. */ }
  const checkpointRecords = new Map((Array.isArray(priorCheckpoint.records) ? priorCheckpoint.records : [])
    .map((record) => [record.fileId, record]));
  const trustedRecords = new Map();
  for (const [fileId, record] of validatedById) {
    if (record.sourceURL && record.originalDigestMatches === true && record.originalSizeMatches === true) trustedRecords.set(fileId, record);
  }
  for (const [fileId, record] of checkpointRecords) {
    if (record.sourceURL && record.downloadedAndHashed === true) trustedRecords.set(fileId, record);
  }
  const evidence = [];
  const failures = [];
  let completed = 0;
  let checkpointWrite = Promise.resolve();
  await mapLimit(inventory.assets, concurrency, async (asset) => {
    try {
      const existing = await readCachedReceipt(asset, cacheDir, validatedCacheDir, trustedRecords);
      const result = existing ?? await downloadAsset(asset, cacheDir);
      evidence.push({ fileId: asset.fileId, url: asset.url, sourceSHA1: result.sourceSHA1, sourceBytes: result.sourceBytes, occurrences: asset.occurrences, cachePath: result.cachePath, reusedValidated: result.reusedValidated });
      checkpointRecords.set(asset.fileId, {
        fileId: asset.fileId, sourceURL: asset.url, sourceSHA1: result.sourceSHA1,
        sourceBytes: result.sourceBytes, downloadedAndHashed: true,
      });
      const checkpointSnapshot = { records: [...checkpointRecords.values()].sort((a, b) => a.fileId.localeCompare(b.fileId)) };
      checkpointWrite = checkpointWrite.then(async () => {
        const temporaryPath = `${checkpointPath}.tmp`;
        await fs.writeFile(temporaryPath, `${JSON.stringify(checkpointSnapshot)}\n`);
        await fs.rename(temporaryPath, checkpointPath);
      });
      await checkpointWrite;
    } catch (error) {
      failures.push({ fileId: asset.fileId, url: asset.url, reason: error.message });
    }
    completed += 1;
    if (completed % 100 === 0 || completed === inventory.assets.length) progress({ completed, total: inventory.assets.length, failures: failures.length });
  });
  evidence.sort((a, b) => a.fileId.localeCompare(b.fileId));
  failures.sort((a, b) => a.fileId.localeCompare(b.fileId));
  const status = failures.length === 0 && inventory.documents.length === EXPECTED.documents
    && inventory.slots.length === EXPECTED.slots && inventory.assets.length === EXPECTED.unique ? 'ready' : 'blocked';
  return {
    status,
    inventoryCounts: { documents: inventory.documents.length, slots: inventory.slots.length, uniqueAssets: inventory.assets.length },
    expectedCounts: EXPECTED,
    slots: inventory.slots,
    assets: evidence,
    failures,
    safety: { sourceCmsWrites: false, destinationCmsWrites: false, sourcePayloadOrPersonalContentIncluded: false },
  };
}

async function main() {
  const [sourcePath, validatedPath, outputPath = '/private/tmp/jrmota-bulk-media-source-manifest.json', concurrencyArg] = process.argv.slice(2);
  if (!sourcePath || !validatedPath) throw new Error('Usage: node scripts/migration/prepare-bulk-media.mjs <staged-source.json> <validated-source-digests.json> [output.json] [concurrency 1-8]');
  if (!path.resolve(outputPath).startsWith(`${PRIVATE_ROOT}/`)) throw new Error('Preparation manifest output must be under /private/tmp/.');
  const result = await prepareMedia(readJson(sourcePath), readJson(validatedPath), {
    concurrency: concurrencyArg ? Number(concurrencyArg) : 6,
    progress: ({ completed, total, failures }) => console.log(`Prepared ${completed}/${total} unique originals; ${failures} failures.`),
  });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote ${result.status} source media manifest: ${result.inventoryCounts.documents} docs, ${result.inventoryCounts.slots} visible slots, ${result.inventoryCounts.uniqueAssets} unique originals; ${result.failures.length} failures.`);
  if (result.status !== 'ready') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
