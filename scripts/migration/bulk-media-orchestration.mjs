import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SANITY = { projectId: 'kaq1vd9b', dataset: 'production', linkId: 'link_6ac104868dc881919babf0aac7618ecb' };
export const EXPECTED = { documents: 190, slots: 1447, uniqueAssets: 1342, sampleAssets: 51, pendingAssets: 1291 };
export const MAX_STATUS_BATCH = 20;
export const DEFAULT_CHECKPOINT = '/private/tmp/jrmota-bulk-media-upload-checkpoint.json';
const UUID_NAMESPACE = 'cb36a531-4a3f-5ef4-8a65-2eaab64c23ac';
const UUID_NS_BYTES = Buffer.from(UUID_NAMESPACE.replaceAll('-', ''), 'hex');
const PRIVATE_ROOT = '/private/tmp/';

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function stableRequestKey({ fileId, url, sha1, bytes, attempt = 0 }) {
  if (!fileId || !url || !/^[a-f0-9]{40}$/i.test(sha1 ?? '') || !Number.isSafeInteger(bytes) || bytes < 1 || !Number.isInteger(attempt) || attempt < 0) {
    throw new Error('Stable upload identity requires file ID, exact URL, SHA-1, positive byte size, and nonnegative attempt.');
  }
  const name = Buffer.from(stableJson({ fileId, url, sha1: sha1.toLowerCase(), bytes, attempt }));
  const digest = crypto.createHash('sha1').update(UUID_NS_BYTES).update(name).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validSampleReceipt(record, sourceAsset) {
  if (!record || record.sourceURL !== sourceAsset.url || record.originalDigestMatches !== true || record.originalSizeMatches !== true) return false;
  if (!/^[a-f0-9]{40}$/i.test(record.sourceSHA1 ?? '') || record.sourceSHA1.toLowerCase() !== sourceAsset.sourceSHA1.toLowerCase()) return false;
  if (!/^[a-f0-9]{40}$/i.test(record.targetOriginalSHA1 ?? '') || record.targetOriginalSHA1.toLowerCase() !== sourceAsset.sourceSHA1.toLowerCase()) return false;
  if (record.sourceBytes !== sourceAsset.sourceBytes || record.targetOriginalBytes !== sourceAsset.sourceBytes) return false;
  const refHash = record.targetAssetRef?.match(/^image-([a-f0-9]{40})-/i)?.[1];
  return Boolean(refHash && refHash.toLowerCase() === sourceAsset.sourceSHA1.toLowerCase());
}

function sourceFilename(url) {
  const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? 'original-image';
  try { return decodeURIComponent(segment); } catch { return segment; }
}

export function createUploadPlan(mediaManifest, sampleDigestReport, destinationMetadata, { now = new Date().toISOString(), expected = EXPECTED } = {}) {
  const counts = mediaManifest?.inventoryCounts;
  if (mediaManifest?.status !== 'ready' || mediaManifest?.failures?.length !== 0
    || counts?.documents !== expected.documents || counts?.slots !== expected.slots || counts?.uniqueAssets !== expected.uniqueAssets
    || mediaManifest.assets?.length !== expected.uniqueAssets) {
    throw new Error('Source media manifest is incomplete or its inventory counts changed; refusing upload plan.');
  }
  const assetsById = new Map();
  for (const asset of mediaManifest.assets) {
    if (!asset?.fileId || !asset.url || !/^https:\/\//.test(asset.url) || !/^[a-f0-9]{40}$/i.test(asset.sourceSHA1 ?? '')
      || !Number.isSafeInteger(asset.sourceBytes) || asset.sourceBytes < 1 || assetsById.has(asset.fileId)) {
      throw new Error('Source manifest contains an invalid or duplicate asset identity.');
    }
    assetsById.set(asset.fileId, asset);
  }
  const sampleRecords = sampleDigestReport?.records;
  if (!Array.isArray(sampleRecords) || sampleRecords.length !== expected.sampleAssets) throw new Error('Expected exactly 51 validated sample-image receipts.');
  if (!Array.isArray(destinationMetadata)) throw new Error('Destination imageAsset metadata query array is required to validate existing sample refs.');
  const metadataById = new Map();
  for (const record of destinationMetadata) {
    if (typeof record?._id !== 'string' || typeof record?.sha1hash !== 'string' || !Number.isSafeInteger(record?.size)) throw new Error('Destination metadata rows must include _id, sha1hash, and byte size.');
    if (metadataById.has(record._id)) throw new Error('Destination metadata contains duplicate asset IDs.');
    metadataById.set(record._id, record);
  }
  const sampleById = new Map(sampleRecords.map((record) => [record.fileId, record]));
  if (sampleById.size !== expected.sampleAssets) throw new Error('Sample image receipts contain duplicate source file IDs.');
  const entries = [...assetsById.values()].sort((a, b) => a.fileId.localeCompare(b.fileId)).map((asset) => {
    const sample = sampleById.get(asset.fileId);
    if (sample && !validSampleReceipt(sample, asset)) throw new Error(`Existing sample asset receipt is not exact for source file ${asset.fileId}.`);
    if (sample) {
      const destination = metadataById.get(sample.targetAssetRef);
      if (!destination || destination.sha1hash.toLowerCase() !== asset.sourceSHA1.toLowerCase() || destination.size !== asset.sourceBytes) {
        throw new Error(`Destination metadata does not verify existing sample asset ${asset.fileId}.`);
      }
    }
    return {
      fileId: asset.fileId,
      sourceURL: asset.url,
      sourceSHA1: asset.sourceSHA1.toLowerCase(),
      sourceBytes: asset.sourceBytes,
      filename: sourceFilename(asset.url),
      occurrences: asset.occurrences,
      status: sample ? 'reused-sample' : 'planned',
      attempt: 0,
      requestKey: stableRequestKey({ fileId: asset.fileId, url: asset.url, sha1: asset.sourceSHA1, bytes: asset.sourceBytes }),
      ...(sample ? { assetRef: sample.targetAssetRef, destinationSHA1: sample.targetOriginalSHA1.toLowerCase(), destinationBytes: sample.targetOriginalBytes, receiptSource: 'validated existing sample original digest and size' } : {}),
    };
  });
  if ([...sampleById.keys()].some((fileId) => !assetsById.has(fileId))) throw new Error('A sample receipt references a source file outside the complete eligible media inventory.');
  const sampleCount = entries.filter((entry) => entry.status === 'reused-sample').length;
  const pendingCount = entries.filter((entry) => entry.status === 'planned').length;
  if (sampleCount !== expected.sampleAssets || pendingCount !== expected.pendingAssets) throw new Error('Sample overlap or pending upload count changed from the approved 51/1,291 plan.');
  const planIdentity = entries.map(({ fileId, sourceURL, sourceSHA1, sourceBytes, occurrences, status, assetRef }) => ({ fileId, sourceURL, sourceSHA1, sourceBytes, occurrences, status, assetRef }));
  return {
    version: 1,
    checkpointId: crypto.createHash('sha256').update(stableJson(planIdentity)).digest('hex'),
    createdAt: now,
    project: SANITY,
    counts: { ...expected, reusedSampleAssets: sampleCount, validatedSampleMetadata: sampleCount, extraUnreferencedDestinationMetadata: metadataById.size - sampleCount, pendingUploads: pendingCount },
    status: 'prepared-no-uploads-started',
    assets: entries,
    metadataQueries: [],
    safety: { sourceCmsWrites: false, destinationCmsWrites: false, assetUploadsStarted: false, documentsCreated: false, published: false },
  };
}

export function createUploadRequest(entry) {
  if (!entry || !['planned', 'retry-authorized'].includes(entry.status)) throw new Error('Only a planned or reconciled upload can be started.');
  return {
    tool: 'mcp__codex_apps__sanity_dataset_assets_upload_from_url',
    args: {
      projectId: SANITY.projectId,
      dataset: SANITY.dataset,
      link_id: SANITY.linkId,
      assetType: 'image',
      url: entry.sourceURL,
      filename: entry.filename,
      requestKey: entry.requestKey,
      source: { name: 'Webflow', id: entry.fileId, url: entry.sourceURL },
    },
  };
}

export function pendingUploadIds(checkpoint, limit = 10) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Pending upload batches must contain 1 to 20 IDs.');
  return checkpoint.assets.filter((entry) => ['planned', 'retry-authorized'].includes(entry.status))
    .slice(0, limit).map((entry) => ({ fileId: entry.fileId, status: entry.status }));
}

export function claimUpload(checkpoint, fileId, at = new Date().toISOString()) {
  const entry = checkpoint.assets.find((asset) => asset.fileId === fileId);
  if (!entry) throw new Error('Unknown source file ID.');
  if (!['planned', 'retry-authorized'].includes(entry.status)) throw new Error(`Cannot claim upload in state ${entry.status}.`);
  const request = createUploadRequest(entry);
  entry.status = 'submitting';
  entry.claimedAt = at;
  checkpoint.safety.assetUploadsStarted = true;
  checkpoint.status = 'uploads-in-progress';
  return request;
}

export function recordSubmission(checkpoint, fileId, result, at = new Date().toISOString()) {
  const entry = checkpoint.assets.find((asset) => asset.fileId === fileId);
  if (!entry || entry.status !== 'submitting') throw new Error('Submission receipt requires a previously checkpointed submitting state.');
  let response = result?.structuredContent ?? result;
  const responseText = result?.content?.find?.((item) => item.type === 'text')?.text;
  if (!result?.structuredContent && responseText) {
    try { response = JSON.parse(responseText); } catch { /* Missing structured receipt becomes unknown and forces metadata reconciliation. */ }
  }
  const operationId = response?.operationId ?? response?.operations?.[0]?.operationId;
  const status = response?.status ?? response?.operations?.[0]?.status;
  if (!operationId || !['running', 'completed', 'failed', 'unknown'].includes(status)) {
    entry.status = 'unknown';
    entry.unknownAt = at;
    entry.lastProblem = 'Upload call outcome did not contain an operation ID and recognized state; destination metadata query is mandatory before retry.';
    return;
  }
  entry.operationId = operationId;
  entry.submittedAt = at;
  entry.status = status === 'completed' ? 'awaiting-metadata' : status === 'unknown' ? 'unknown' : status;
  const err = response?.error ?? response?.operations?.[0]?.error;
  if (err) entry.lastProblem = { code: err.code ?? null, message: err.message ?? null };
}

export function authorizeFailedRetry(checkpoint, fileId) {
  const entry = checkpoint.assets.find((asset) => asset.fileId === fileId);
  if (!entry || entry.status !== 'failed') throw new Error('Only an explicitly failed upload may receive a new attempt.');
  entry.attempt += 1;
  entry.requestKey = stableRequestKey({ fileId: entry.fileId, url: entry.sourceURL, sha1: entry.sourceSHA1, bytes: entry.sourceBytes, attempt: entry.attempt });
  entry.status = 'retry-authorized';
  delete entry.operationId;
  return createUploadRequest(entry);
}

export function recoverInterruptedSubmissions(checkpoint, at = new Date().toISOString()) {
  let recovered = 0;
  for (const entry of checkpoint.assets) {
    if (entry.status === 'submitting') {
      entry.status = 'unknown';
      entry.unknownAt = at;
      entry.lastProblem = 'Process resumed while request was in flight; destination metadata reconciliation is required before retry.';
      recovered += 1;
    }
  }
  return recovered;
}

export function statusBatches(checkpoint, maxSize = MAX_STATUS_BATCH) {
  if (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > MAX_STATUS_BATCH) throw new Error('Status batches must contain 1 to 20 operation IDs.');
  const pending = checkpoint.assets.filter((entry) => entry.status === 'running' && entry.operationId).sort((a, b) => a.fileId.localeCompare(b.fileId));
  const batches = [];
  for (let index = 0; index < pending.length; index += maxSize) {
    const assets = pending.slice(index, index + maxSize);
    batches.push({ assetFileIds: assets.map((entry) => entry.fileId), operationIds: assets.map((entry) => entry.operationId) });
  }
  return batches;
}

function operationArray(payload) {
  const contentText = payload?.content?.find?.((entry) => entry.type === 'text')?.text;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.operations)) return payload.operations;
  if (Array.isArray(payload?.structuredContent?.operations)) return payload.structuredContent.operations;
  if (contentText) {
    try { return operationArray(JSON.parse(contentText)); } catch { /* Caller receives a validation failure. */ }
    const embedded = contentText.match(/<operations?>([\s\S]*?)<\/operations?>/i)?.[1];
    if (embedded) { try { return operationArray(JSON.parse(embedded)); } catch { /* Caller receives a validation failure. */ } }
  }
  throw new Error('Status response does not contain an operations array.');
}

export function applyStatusResults(checkpoint, payload, at = new Date().toISOString()) {
  const operations = operationArray(payload);
  if (operations.length > MAX_STATUS_BATCH) throw new Error('A status response cannot contain more than 20 operation IDs.');
  const byOperationId = new Map(checkpoint.assets.filter((entry) => entry.operationId).map((entry) => [entry.operationId, entry]));
  for (const result of operations) {
    const entry = byOperationId.get(result.operationId);
    if (!entry) throw new Error(`Status response has an unknown operation ID: ${result.operationId ?? '(missing)'}.`);
    if (!['running', 'completed', 'failed', 'unknown'].includes(result.status)) throw new Error('Status response contains an unsupported state.');
    entry.lastStatusAt = at;
    if (result.status === 'completed') {
      entry.status = 'awaiting-metadata';
      const assetId = result.result?.assetId ?? result.result?._id ?? result.result?.asset?._id;
      if (typeof assetId === 'string') entry.reportedAssetId = assetId;
    } else if (result.status === 'unknown') {
      entry.status = 'unknown';
      entry.unknownAt = at;
    } else entry.status = result.status;
    if (result.error) entry.lastProblem = { code: result.error.code ?? null, message: result.error.message ?? null };
  }
  return operations.length;
}

function shaKey(sha1, bytes) { return `${sha1.toLowerCase()}:${bytes}`; }

export function createMetadataQueryBatches(checkpoint, maxHashes = MAX_STATUS_BATCH) {
  if (!Number.isInteger(maxHashes) || maxHashes < 1 || maxHashes > MAX_STATUS_BATCH) throw new Error('Metadata query batches must contain 1 to 20 SHA-1 hashes.');
  const eligible = checkpoint.assets.filter((entry) => ['unknown', 'awaiting-metadata'].includes(entry.status));
  const groups = new Map();
  for (const entry of eligible) {
    const key = shaKey(entry.sourceSHA1, entry.sourceBytes);
    if (!groups.has(key)) groups.set(key, { sha1: entry.sourceSHA1, bytes: entry.sourceBytes, fileIds: [] });
    groups.get(key).fileIds.push(entry.fileId);
  }
  const entries = [...groups.values()].sort((a, b) => a.sha1.localeCompare(b.sha1) || a.bytes - b.bytes);
  const batches = [];
  for (let index = 0; index < entries.length; index += maxHashes) {
    const group = entries.slice(index, index + maxHashes);
    const hashes = [...new Set(group.map((entry) => entry.sha1))].sort();
    const fileIds = group.flatMap((entry) => entry.fileIds).sort();
    const queryId = crypto.createHash('sha256').update(stableJson({ checkpointId: checkpoint.checkpointId, hashes, fileIds })).digest('hex').slice(0, 24);
    batches.push({
      queryId,
      fileIds,
      hashes,
      query: '*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id, url, sha1hash, size}',
      params: { hashes },
      dataset: SANITY.dataset,
      projectId: SANITY.projectId,
      link_id: SANITY.linkId,
      perspective: 'published',
    });
  }
  return batches;
}

function documentArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.documents)) return payload.documents;
  if (Array.isArray(payload?.assets)) return payload.assets;
  if (typeof payload?._id === 'string') return [payload];
  if (Array.isArray(payload?.structuredContent?.result)) return payload.structuredContent.result;
  if (Array.isArray(payload?.structuredContent?.documents)) return payload.structuredContent.documents;
  if (Array.isArray(payload?.structuredContent?.assets)) return payload.structuredContent.assets;
  if (typeof payload?.structuredContent?._id === 'string') return [payload.structuredContent];
  const text = payload?.content?.find?.((entry) => entry.type === 'text')?.text;
  if (text) {
    try { return documentArray(JSON.parse(text)); } catch { /* Try Sanity tool's XML-like document envelope below. */ }
    const embedded = text.match(/<documents>([\s\S]*?)<\/documents>/i)?.[1];
    if (embedded) { try { return documentArray(JSON.parse(embedded)); } catch { /* Invalid query export fails closed. */ } }
  }
  throw new Error('Metadata query response must contain a documents array, including for a confirmed empty result.');
}

export function reconcileMetadataQuery(checkpoint, queryId, payload, at = new Date().toISOString()) {
  const query = createMetadataQueryBatches(checkpoint).find((batch) => batch.queryId === queryId);
  if (!query) throw new Error('Unknown or stale metadata query ID; regenerate the query batch from the current checkpoint.');
  const docs = documentArray(payload);
  const queriedHashes = new Set(query.hashes.map((hash) => hash.toLowerCase()));
  if (!docs.every((doc) => typeof doc?._id === 'string' && typeof doc?.sha1hash === 'string'
    && Number.isSafeInteger(doc?.size) && queriedHashes.has(doc.sha1hash.toLowerCase()))) {
    throw new Error('Metadata query returned malformed or unexpected rows; no retry authorization was recorded.');
  }
  const batchAssets = checkpoint.assets.filter((entry) => query.fileIds.includes(entry.fileId));
  for (const entry of batchAssets) {
    const sameHash = docs.filter((doc) => doc.sha1hash.toLowerCase() === entry.sourceSHA1);
    const candidates = sameHash.filter((doc) => doc.size === entry.sourceBytes);
    const ids = [...new Set(candidates.map((doc) => doc._id))];
    if (ids.length === 1) {
      const doc = candidates.find((candidate) => candidate._id === ids[0]);
      entry.assetRef = doc._id;
      entry.destinationSHA1 = doc.sha1hash.toLowerCase();
      entry.destinationBytes = doc.size;
      entry.metadataVerifiedAt = at;
      entry.receiptSource = 'Sanity published imageAsset metadata query by exact source SHA-1 and byte size';
      entry.status = 'completed';
      delete entry.lastProblem;
    } else if (ids.length > 1) {
      entry.status = 'ambiguous-metadata';
      entry.lastProblem = { code: 'multiple_destination_assets', message: 'More than one destination asset has the exact source SHA-1 and byte size; no mapping was chosen.' };
    } else if (sameHash.length > 0) {
      entry.status = 'metadata-mismatch';
      entry.lastProblem = { code: 'destination_size_mismatch', message: 'A destination asset has the source SHA-1 but a different byte size; no retry or mapping was authorized.' };
    } else if (entry.status === 'unknown') {
      entry.status = 'retry-authorized';
      entry.reconciledAt = at;
      entry.lastProblem = { code: 'destination_asset_not_found', message: 'A successful destination metadata query found no exact SHA-1/byte-size match; the original stable requestKey may be retried.' };
    } else {
      entry.status = 'metadata-missing';
      entry.lastProblem = { code: 'completed_asset_not_found', message: 'Upload status completed, but destination metadata has no exact SHA-1/byte-size match.' };
    }
  }
  return { queryId, queriedFileIds: query.fileIds.length, returnedDocuments: docs.length, exactMatches: batchAssets.filter((entry) => entry.status === 'completed' && entry.metadataVerifiedAt === at).length };
}

export function makeReceiptArtifacts(checkpoint) {
  const incomplete = checkpoint.assets.filter((entry) => !['completed', 'reused-sample'].includes(entry.status)
    || !entry.assetRef || !/^[a-f0-9]{40}$/i.test(entry.destinationSHA1 ?? '')
    || entry.destinationSHA1.toLowerCase() !== entry.sourceSHA1 || entry.destinationBytes !== entry.sourceBytes);
  if (incomplete.length) throw new Error(`Cannot produce full asset receipts: ${incomplete.length} assets lack an exact SHA-1/size-confirmed destination receipt.`);
  const byFileId = {};
  const sourceByFileId = {};
  const destinationByRef = {};
  for (const entry of checkpoint.assets) {
    byFileId[entry.fileId] = entry.assetRef;
    sourceByFileId[entry.fileId] = { url: entry.sourceURL, sourceSHA1: entry.sourceSHA1, sourceBytes: entry.sourceBytes };
    const previous = destinationByRef[entry.assetRef];
    const destination = { sha1: entry.destinationSHA1, size: entry.destinationBytes };
    if (previous && (previous.sha1 !== destination.sha1 || previous.size !== destination.size)) throw new Error('One destination asset ref has conflicting verified metadata.');
    destinationByRef[entry.assetRef] = destination;
  }
  return {
    assetMap: { byFileId },
    assetEvidence: { sourceByFileId, destinationByRef },
  };
}

export async function writeCheckpoint(checkpointPath, checkpoint) {
  const absolute = path.resolve(checkpointPath);
  if (!absolute.startsWith(PRIVATE_ROOT)) throw new Error('Upload checkpoint must remain under /private/tmp/.');
  await fs.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  const temporary = `${absolute}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const handle = await fs.open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally { await handle.close(); }
  await fs.rename(temporary, absolute);
  await fs.chmod(absolute, 0o600);
}

async function readJson(filePath) { return JSON.parse(await fs.readFile(filePath, 'utf8')); }

async function cli() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'plan') {
    const [manifestPath, samplePath, metadataPath, checkpointPath = DEFAULT_CHECKPOINT] = args;
    if (!manifestPath || !samplePath || !metadataPath) throw new Error('Usage: plan <private-source-manifest.json> <sample-image-original-digests.json> <private-sample-asset-metadata.json> [private-checkpoint.json]');
    const metadataJson = await readJson(metadataPath);
    const destinationMetadata = Array.isArray(metadataJson) ? metadataJson : metadataJson.result ?? metadataJson.documents;
    const checkpoint = createUploadPlan(await readJson(manifestPath), await readJson(samplePath), destinationMetadata);
    await writeCheckpoint(checkpointPath, checkpoint);
    console.log(JSON.stringify({ checkpointPath, checkpointId: checkpoint.checkpointId, status: checkpoint.status, counts: checkpoint.counts }));
    return;
  }
  const checkpointPath = args[0] ?? DEFAULT_CHECKPOINT;
  const checkpoint = await readJson(checkpointPath);
  if (command === 'batch') {
    const limit = Number(args[1] ?? 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('batch size must be 1 to 20; each upload call is submitted individually.');
    console.log(JSON.stringify(pendingUploadIds(checkpoint, limit), null, 2));
    return;
  }
  if (command === 'claim') {
    const request = claimUpload(checkpoint, args[1]);
    await writeCheckpoint(checkpointPath, checkpoint);
    console.log(JSON.stringify({ checkpointPath, ...request }, null, 2));
    return;
  }
  if (command === 'record-submission') {
    if (!args[1] || !args[2]) throw new Error('Usage: record-submission <checkpoint.json> <fileId> <upload-response.json>');
    recordSubmission(checkpoint, args[1], await readJson(args[2]));
    await writeCheckpoint(checkpointPath, checkpoint);
    console.log(JSON.stringify({ checkpointPath, fileId: args[1], state: checkpoint.assets.find((entry) => entry.fileId === args[1])?.status }));
    return;
  }
  if (command === 'retry-failed') {
    const request = authorizeFailedRetry(checkpoint, args[1]);
    await writeCheckpoint(checkpointPath, checkpoint);
    console.log(JSON.stringify({ checkpointPath, fileId: args[1], ...request }, null, 2));
    return;
  }
  if (command === 'recover') {
    const count = recoverInterruptedSubmissions(checkpoint);
    await writeCheckpoint(checkpointPath, checkpoint);
    console.log(JSON.stringify({ checkpointPath, recoveredUnknown: count, retryRequiresMetadataQuery: true }));
    return;
  }
  if (command === 'status-batches') {
    console.log(JSON.stringify(statusBatches(checkpoint, Number(args[1] ?? MAX_STATUS_BATCH)), null, 2));
    return;
  }
  if (command === 'query-batches') {
    console.log(JSON.stringify(createMetadataQueryBatches(checkpoint, Number(args[1] ?? MAX_STATUS_BATCH)), null, 2));
    return;
  }
  if (command === 'apply-status') {
    if (!args[1]) throw new Error('Usage: apply-status <checkpoint.json> <status-response.json>');
    const count = applyStatusResults(checkpoint, await readJson(args[1]));
    await writeCheckpoint(checkpointPath, checkpoint);
    console.log(JSON.stringify({ checkpointPath, statusRecordsApplied: count }));
    return;
  }
  if (command === 'reconcile-query') {
    if (!args[1] || !args[2]) throw new Error('Usage: reconcile-query <checkpoint.json> <query-id> <metadata-response.json>');
    const result = reconcileMetadataQuery(checkpoint, args[1], await readJson(args[2]));
    await writeCheckpoint(checkpointPath, checkpoint);
    console.log(JSON.stringify({ checkpointPath, ...result }));
    return;
  }
  if (command === 'receipt-artifacts') {
    const [assetMapPath, evidencePath] = args.slice(1);
    if (!assetMapPath || !evidencePath) throw new Error('Usage: receipt-artifacts <checkpoint.json> <asset-map.json> <asset-evidence.json>');
    const artifacts = makeReceiptArtifacts(checkpoint);
    for (const output of [assetMapPath, evidencePath]) if (!path.resolve(output).startsWith(PRIVATE_ROOT)) throw new Error('Receipt artifacts must be written under /private/tmp/.');
    await writeCheckpoint(assetMapPath, artifacts.assetMap);
    await writeCheckpoint(evidencePath, artifacts.assetEvidence);
    console.log(JSON.stringify({ assetMapPath, evidencePath, fileIds: Object.keys(artifacts.assetMap.byFileId).length, destinationRefs: Object.keys(artifacts.assetEvidence.destinationByRef).length }));
    return;
  }
  throw new Error('Commands: plan, batch, claim, record-submission, retry-failed, recover, status-batches, apply-status, query-batches, reconcile-query, receipt-artifacts.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
