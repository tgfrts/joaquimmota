import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  applyStatusResults,
  authorizeFailedRetry,
  claimUpload,
  createMetadataQueryBatches,
  createUploadPlan,
  makeReceiptArtifacts,
  pendingUploadIds,
  reconcileMetadataQuery,
  recoverInterruptedSubmissions,
  recordSubmission,
  stableRequestKey,
  statusBatches,
} from '../../scripts/migration/bulk-media-orchestration.mjs';

const sha = (value) => createHash('sha1').update(value).digest('hex');
const a = { fileId: 'source-a', url: 'https://uploads-ssl.webflow.com/site/a.jpg', sourceSHA1: sha('a'), sourceBytes: 10, occurrences: 2 };
const b = { fileId: 'source-b', url: 'https://cdn.prod.website-files.com/site/b.jpg', sourceSHA1: sha('b'), sourceBytes: 20, occurrences: 1 };
const sampleRef = `image-${a.sourceSHA1}-100x100-jpg`;
const expected = { documents: 1, slots: 3, uniqueAssets: 2, sampleAssets: 1, pendingAssets: 1 };

function fixture() {
  return createUploadPlan({
    status: 'ready', inventoryCounts: { documents: 1, slots: 3, uniqueAssets: 2 }, failures: [], assets: [a, b],
  }, { records: [{ fileId: a.fileId, sourceURL: a.url, sourceSHA1: a.sourceSHA1, sourceBytes: a.sourceBytes, targetOriginalSHA1: a.sourceSHA1, targetOriginalBytes: a.sourceBytes, targetAssetRef: sampleRef, originalDigestMatches: true, originalSizeMatches: true }] }, [
    { _id: sampleRef, sha1hash: a.sourceSHA1, size: a.sourceBytes },
    { _id: 'image-unrelated-asset', sha1hash: sha('extra'), size: 99 },
  ], { expected, now: '2026-10-03T00:00:00.000Z' });
}

test('prepared plan reuses only the 51-style exact sample receipt and has stable UUIDv5 request keys', () => {
  const first = fixture();
  const second = fixture();
  assert.equal(first.assets.filter((entry) => entry.status === 'reused-sample').length, 1);
  assert.equal(first.assets.filter((entry) => entry.status === 'planned').length, 1);
  assert.equal(first.counts.extraUnreferencedDestinationMetadata, 1);
  assert.equal(first.assets.find((entry) => entry.fileId === a.fileId).assetRef, sampleRef);
  assert.equal(first.assets.find((entry) => entry.fileId === b.fileId).requestKey, second.assets.find((entry) => entry.fileId === b.fileId).requestKey);
  assert.match(first.assets.find((entry) => entry.fileId === b.fileId).requestKey, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('plan fails closed for changed inventory or sample destination metadata', () => {
  const manifest = { status: 'ready', inventoryCounts: { documents: 1, slots: 3, uniqueAssets: 2 }, failures: [], assets: [a, b] };
  const samples = { records: [{ fileId: a.fileId, sourceURL: a.url, sourceSHA1: a.sourceSHA1, sourceBytes: a.sourceBytes, targetOriginalSHA1: a.sourceSHA1, targetOriginalBytes: a.sourceBytes, targetAssetRef: sampleRef, originalDigestMatches: true, originalSizeMatches: true }] };
  assert.throws(() => createUploadPlan(manifest, samples, [{ _id: sampleRef, sha1hash: sha('wrong'), size: a.sourceBytes }], { expected }), /does not verify/);
  assert.throws(() => createUploadPlan({ ...manifest, inventoryCounts: { ...manifest.inventoryCounts, slots: 4 } }, samples, [{ _id: sampleRef, sha1hash: a.sourceSHA1, size: a.sourceBytes }], { expected }), /counts changed/);
});

test('claim checkpoints before upload; recovered unknown outcome requires query and retains request key', () => {
  const checkpoint = fixture();
  const entry = checkpoint.assets.find((asset) => asset.fileId === b.fileId);
  const key = entry.requestKey;
  const request = claimUpload(checkpoint, b.fileId, '2026-10-03T01:00:00.000Z');
  assert.equal(request.args.requestKey, key);
  assert.equal(checkpoint.safety.assetUploadsStarted, true);
  assert.equal(recoverInterruptedSubmissions(checkpoint, '2026-10-03T01:01:00.000Z'), 1);
  assert.equal(entry.status, 'unknown');
  const [query] = createMetadataQueryBatches(checkpoint);
  assert.deepEqual(query.hashes, [b.sourceSHA1]);
  assert.deepEqual(reconcileMetadataQuery(checkpoint, query.queryId, [], '2026-10-03T01:02:00.000Z'), { queryId: query.queryId, queriedFileIds: 1, returnedDocuments: 0, exactMatches: 0 });
  assert.equal(entry.status, 'retry-authorized');
  assert.equal(entry.requestKey, key);
  assert.equal(claimUpload(checkpoint, b.fileId).args.requestKey, key);
});

test('pending batch is identifiers-only; only durable claim emits upload arguments', () => {
  const checkpoint = fixture();
  const batch = pendingUploadIds(checkpoint, 1);
  assert.deepEqual(batch, [{ fileId: b.fileId, status: 'planned' }]);
  assert.equal('args' in batch[0], false);
  const request = claimUpload(checkpoint, b.fileId);
  assert.equal(request.tool, 'mcp__codex_apps__sanity_dataset_assets_upload_from_url');
  assert.equal(request.args.requestKey, checkpoint.assets.find((entry) => entry.fileId === b.fileId).requestKey);
});

test('status calls are bounded to 20 operation IDs and completed operations await exact metadata', () => {
  const checkpoint = fixture();
  for (let index = 0; index < 21; index += 1) checkpoint.assets.push({ ...b, fileId: `f-${index}`, status: 'running', operationId: `op-${index}` });
  const batches = statusBatches(checkpoint);
  assert.deepEqual(batches.map((batch) => batch.operationIds.length), [20, 1]);
  assert.throws(() => statusBatches(checkpoint, 21), /1 to 20/);

  const small = fixture();
  const entry = small.assets.find((asset) => asset.fileId === b.fileId);
  claimUpload(small, b.fileId);
  recordSubmission(small, b.fileId, { operationId: 'op-b', status: 'running' });
  applyStatusResults(small, { operations: [{ operationId: 'op-b', status: 'completed', result: { assetId: `image-${b.sourceSHA1}-300x200-jpg` } }] });
  assert.equal(entry.status, 'awaiting-metadata');
  const [batch] = createMetadataQueryBatches(small);
  const ref = `image-${b.sourceSHA1}-300x200-jpg`;
  reconcileMetadataQuery(small, batch.queryId, [{ _id: ref, sha1hash: b.sourceSHA1, size: b.sourceBytes }]);
  assert.equal(entry.status, 'completed');
  assert.equal(entry.assetRef, ref);
  const receipt = makeReceiptArtifacts(small);
  assert.equal(receipt.assetMap.byFileId[b.fileId], ref);
  assert.deepEqual(receipt.assetEvidence.destinationByRef[ref], { sha1: b.sourceSHA1, size: b.sourceBytes });
});

test('ambiguous destination matches and failed uploads block implicit retry', () => {
  const checkpoint = fixture();
  const entry = checkpoint.assets.find((asset) => asset.fileId === b.fileId);
  claimUpload(checkpoint, b.fileId);
  recordSubmission(checkpoint, b.fileId, { operationId: 'op-fail', status: 'failed', error: { code: 'fetch_failed', message: 'failed' } });
  assert.equal(entry.status, 'failed');
  assert.equal(authorizeFailedRetry(checkpoint, b.fileId).args.requestKey, stableRequestKey({ fileId: b.fileId, url: b.url, sha1: b.sourceSHA1, bytes: b.sourceBytes, attempt: 1 }));
  assert.throws(() => makeReceiptArtifacts(checkpoint), /lack an exact/);

  entry.status = 'unknown';
  const [batch] = createMetadataQueryBatches(checkpoint);
  reconcileMetadataQuery(checkpoint, batch.queryId, [
    { _id: `image-${b.sourceSHA1}-100x100-jpg`, sha1hash: b.sourceSHA1, size: b.sourceBytes },
    { _id: `image-${b.sourceSHA1}-200x200-jpg`, sha1hash: b.sourceSHA1, size: b.sourceBytes },
  ]);
  assert.equal(entry.status, 'ambiguous-metadata');
  assert.throws(() => claimUpload(checkpoint, b.fileId), /Cannot claim/);
});

test('malformed query rows and SHA-1 matches with the wrong size never authorize retry', () => {
  const checkpoint = fixture();
  const entry = checkpoint.assets.find((asset) => asset.fileId === b.fileId);
  entry.status = 'unknown';
  const [batch] = createMetadataQueryBatches(checkpoint);
  assert.throws(() => reconcileMetadataQuery(checkpoint, batch.queryId, [{ _id: 'image-bad' }]), /malformed or unexpected/);
  assert.equal(entry.status, 'unknown');
  const [freshBatch] = createMetadataQueryBatches(checkpoint);
  reconcileMetadataQuery(checkpoint, freshBatch.queryId, [{ _id: `image-${b.sourceSHA1}-wrongsize`, sha1hash: b.sourceSHA1, size: b.sourceBytes + 1 }]);
  assert.equal(entry.status, 'metadata-mismatch');
  assert.throws(() => claimUpload(checkpoint, b.fileId), /Cannot claim/);
});
