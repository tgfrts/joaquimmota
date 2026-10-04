# Bulk image upload orchestration

This runbook prepares and resumes the 1,342 eligible visible original images. It does not create or patch CMS documents, publish content, or write to Webflow. Upload tool calls are initiated by the coordinator separately after the sample gate is accepted.

## Prepared inventory

The private source manifest is `/private/tmp/jrmota-bulk-media-source-manifest.json`. The private destination sample metadata query is `/private/tmp/jrmota-sample-asset-metadata.json`; 51 rows match the approved sample digest receipts exactly, and one unrelated row is intentionally not mapped. The private durable checkpoint is `/private/tmp/jrmota-bulk-media-upload-checkpoint.json`.

Expected checkpoint counts: 1,342 distinct original assets, 51 already validated sample assets, 1,291 pending uploads. The public source images have already been downloaded and validated against source SHA-1 and byte size. The checkpoint contains identifiers, public asset URLs, checksums, byte counts, operation IDs and asset references; keep it under `/private/tmp` and out of Git.

## Submit and record one upload

`batch` emits source file IDs only; it never emits callable uploads. Always durably claim an asset before calling MCP. `claim` stores state `submitting` first, then prints the exact tool name and arguments:

```sh
node scripts/migration/bulk-media-orchestration.mjs batch /private/tmp/jrmota-bulk-media-upload-checkpoint.json 1
node scripts/migration/bulk-media-orchestration.mjs claim /private/tmp/jrmota-bulk-media-upload-checkpoint.json <source-file-id>
```

Call `mcp__codex_apps__sanity_dataset_assets_upload_from_url` once for that asset using the emitted arguments unchanged. The destination must be project `kaq1vd9b`, dataset `production`, account `link_6ac104868dc881919babf0aac7618ecb`. Do not use a PM Real Estate account. Save the tool response to a private JSON file and record it:

```sh
node scripts/migration/bulk-media-orchestration.mjs record-submission /private/tmp/jrmota-bulk-media-upload-checkpoint.json <source-file-id> /private/tmp/one-upload-response.json
```

The request key is stable UUIDv5 over the exact source identity, URL, SHA-1, and byte size. Reuse the same key and identical upload arguments to recover an interrupted request. Do not invent a replacement key for an unknown result.

## Poll and reconcile

Poll only `running` operation IDs. `status-batches` emits no more than 20 per batch; call `mcp__codex_apps__sanity_assets_upload_status` with `includeMetadata: true`, honor its `pollAfterMs` and any HTTP retry delay, save the response privately, then apply it:

```sh
node scripts/migration/bulk-media-orchestration.mjs status-batches /private/tmp/jrmota-bulk-media-upload-checkpoint.json 20
node scripts/migration/bulk-media-orchestration.mjs apply-status /private/tmp/jrmota-bulk-media-upload-checkpoint.json /private/tmp/upload-status-response.json
```

If a process resumes with state `submitting`, first mark in-flight entries unknown and query the destination. Never retry an unknown upload until a successful published-asset metadata query has returned no exact match:

```sh
node scripts/migration/bulk-media-orchestration.mjs recover /private/tmp/jrmota-bulk-media-upload-checkpoint.json
node scripts/migration/bulk-media-orchestration.mjs query-batches /private/tmp/jrmota-bulk-media-upload-checkpoint.json 20
```

For each returned batch, call `mcp__codex_apps__sanity_query_documents` with the emitted project, dataset, account, perspective, GROQ, and params. The query checks `sanity.imageAsset` documents by root-level `sha1hash`, returning `_id`, `url`, `sha1hash`, and `size`. Save the complete response privately, normalize its `<documents>` payload to an array if the result is a single object, then reconcile using the emitted query ID:

```sh
node scripts/migration/bulk-media-orchestration.mjs reconcile-query /private/tmp/jrmota-bulk-media-upload-checkpoint.json <query-id> /private/tmp/asset-metadata-response.json
```

An exact single `_id`/SHA-1/byte-size match records the receipt. A valid empty result for an unknown request authorizes retry with the same request key. Malformed/unexpected rows, same-SHA-1 rows with different sizes, and multiple destination assets with the same exact metadata remain blocked. A completed operation without a matching metadata row remains `metadata-missing`, never retry-authorized. A confirmed failed upload needs explicit `retry-failed` to create a new deterministic attempt key.

## Full receipt artifacts

After all 1,342 files are complete and metadata-verified, create private artifacts consumed by the bulk manifest validator:

```sh
node scripts/migration/bulk-media-orchestration.mjs receipt-artifacts /private/tmp/jrmota-bulk-media-upload-checkpoint.json /private/tmp/jrmota-bulk-full-asset-map.json /private/tmp/jrmota-bulk-full-asset-evidence.json
```

This command fails unless every source ID maps to a Sanity image ref whose recorded destination SHA-1 and byte count match the source. It writes `assetMap.byFileId`, `assetEvidence.sourceByFileId`, and `assetEvidence.destinationByRef` in the formats expected by `bulk-manifest.mjs`. That coverage alone does not pass the formal bulk gate; rerun its read-only validator with the full 190-document payload and approved sample gate, then obtain the required independent review. No CMS content-document import or publication is part of this orchestration.
