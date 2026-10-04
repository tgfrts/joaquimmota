# Joaquim Mota Consultores

Independent Astro foundation for the read-only migration of `joaquimmota.pt`.

## Local commands

```sh
npm install
npm run dev
npm run check
npm run build
```

This branch is an incomplete migration preview. It includes the homepage, CMS sample templates, several static routes and source-empty CMS paths. It is not approved for deployment. All pages carry `noindex, nofollow` during this preview phase; original production SEO must be restored and verified before cutover.

Eleven eligible source samples are stored as drafts in the site's own Sanity project `kaq1vd9b`, dataset `production`. `src/data/sample-content.json` is an ignored local preview cache, never a committed source of content. A clean checkout requires a read-only snapshot of those target drafts before building:

```sh
node scripts/migration/prepare-preview.mjs /absolute/path/target-sample-snapshot.json
```

The snapshot shape is `{ "documents": [...], "routes": [...] }`. Read the 11 draft samples with the Joaquim Mota Sanity connection, using the identities in `docs/migration/sample-data-parity.json`. The preparer rejects missing/extra records, duplicate identities, changed slugs and non-draft targets. It performs no provider writes. Do not substitute another site's dataset or commit raw snapshots.

For the built-site local preview with Pages Functions, use the already installed Wrangler runtime:

```sh
npm run build
wrangler pages dev dist --port 8789 --compatibility-date 2026-09-15
```

The migration validation used Wrangler `4.130.0`. This runs locally and performs no Cloudflare deployment. Original extensionless paths are preserved through Astro file-format output. The public dashboard route serves the locked view with HTTP 401; the unknown route serves HTTP 404.

Forms use a server-side Resend adapter with mocked verification only. Actual credentials and the Owner's recipient are not configured; local Astro development does not execute Cloudflare Pages Functions. No real email or source form submission has been performed.

## Dependency audit

Astro is pinned to `7.3.5`. On 2026-10-03, `npm audit` reported two high findings for the single transitive dependency `http-cache-semantics@4.2.0` through Astro. The advisory range includes version `4.2.0`, which is also the latest version published by npm; no compatible patched release is available. The audit's suggested Astro `2.10.9` downgrade is not applied.

## Source evidence

The implementation was inspected against the live public homepage on 2026-10-03. Its active visual hero uses the source video poster, and all local files in `public/assets/` are public source copies fetched from the Webflow CDN. The source's zero-sized alternate hero DOM block is intentionally excluded; see the migration contract's rule against residual hidden variants.
