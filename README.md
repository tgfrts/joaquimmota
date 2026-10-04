# Joaquim Mota Consultores

Independent Astro preview for the read-only migration of `joaquimmota.pt`.

## Local commands

```sh
npm install
npm run dev
npm run check
npm run build
```

The current preview builds 254 original paths, including eligible static pages, CMS templates and source-empty CMS paths. Source drafts are excluded. It is not approved for production deployment. Pages carry `noindex, nofollow` during this preview phase; original production SEO must be restored and verified before cutover.

The site's own Sanity project `kaq1vd9b`, dataset `production`, holds 190 eligible documents as target drafts. The sample gate passed before the remaining179 were imported. Aggregate verification confirms1447 visible image positions referencing1342 distinct originals. `src/data/sample-content.json` is an ignored local preview cache, never a committed source of content. A clean checkout requires a read-only snapshot of the target drafts and the approved private migration inputs before building:

```sh
node scripts/migration/prepare-preview.mjs /absolute/path/target-bulk-snapshot.json --bulk --source /absolute/path/staged-cms-source.json --manifest /absolute/path/bulk-manifest.json --full-payload /absolute/path/bulk-payload.json
```

The snapshot shape is `{ "documents": [...] }`. Read the190 drafts with the Joaquim Mota Sanity connection, in small paginated responses to respect the connector response limit. The preparer verifies the approved bulk gate, eligible identities, original slugs, draft state and per-collection item/photo counts. It performs no provider writes. Do not substitute another site's dataset or commit raw snapshots. Sample-only preparation remains available without `--bulk` for the original11-sample snapshot.

For the built-site local preview with Pages Functions, use the already installed Wrangler runtime:

```sh
npm run build
wrangler pages dev dist --port 8789 --compatibility-date 2026-09-15
```

The migration validation used Wrangler `4.130.0`. This runs locally and performs no Cloudflare deployment. Original extensionless paths are preserved through Astro file-format output. The public dashboard route serves the locked view with HTTP 401; the unknown route serves HTTP 404.

Forms use a server-side Resend adapter. Own credentials are configured locally in private ignored `.dev.vars`; local Astro development does not execute Cloudflare Pages Functions. Owner-authorized tests confirmed one delivered notification to `t@doop.pt`, idempotent retry without duplicates and one test newsletter contact. All notification tests still route to `t@doop.pt`. Production recipient activation, hosting secrets and DOOP destinations remain pending; no customer send, source form submission or DNS change occurred.

## Dependency audit

Astro is pinned to `7.3.5`. On 2026-10-03, `npm audit` reported two high findings for the single transitive dependency `http-cache-semantics@4.2.0` through Astro. The advisory range includes version `4.2.0`, which is also the latest version published by npm; no compatible patched release is available. The audit's suggested Astro `2.10.9` downgrade is not applied.

## Source evidence

The implementation was inspected against the live public homepage on 2026-10-03. Its active visual hero uses the source video poster, and all local files in `public/assets/` are public source copies fetched from the Webflow CDN. The source's zero-sized alternate hero DOM block is intentionally excluded; see the migration contract's rule against residual hidden variants.
