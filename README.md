# Joaquim Mota Consultores

Independent Astro preview for the read-only migration of `joaquimmota.pt`.

## Local commands

```sh
npm install
npm run dev
npm run check
npm run build
```

The current preview builds 250 paths, including eligible static pages, CMS templates and source-empty CMS paths. Source drafts and the four routes explicitly removed by the Owner on 2026-10-04 are excluded. It is not approved for production deployment. Pages carry `noindex, nofollow` during this preview phase; original production SEO must be restored and verified before cutover.

The site's own Sanity project `kaq1vd9b`, dataset `production`, holds 190 eligible documents as target drafts. The sample gate passed before the remaining179 were imported. Aggregate verification confirms1447 visible image positions referencing1342 distinct originals. `src/data/sample-content.json` is an ignored local preview cache, never a committed source of content. A clean checkout requires a read-only snapshot of the target drafts and the approved private migration inputs before building:

```sh
node scripts/migration/prepare-preview.mjs /absolute/path/target-bulk-snapshot.json --bulk --source /absolute/path/staged-cms-source.json --manifest /absolute/path/bulk-manifest.json --full-payload /absolute/path/bulk-payload.json
```

The snapshot shape is `{ "documents": [...] }`. Read the190 drafts with the Joaquim Mota Sanity connection, in small paginated responses to respect the connector response limit. The preparer verifies the approved bulk gate, eligible identities, original slugs, draft state and per-collection item/photo counts. It performs no provider writes. Do not substitute another site's dataset or commit raw snapshots. Sample-only preparation remains available without `--bulk` for the original11-sample snapshot.

For the built-site local preview with Pages Functions, use the already installed Wrangler runtime:

```sh
npm run build
wrangler d1 migrations apply joaquimmota-leads-preview --local --persist-to /private/tmp/jrmota-pages-local-state
wrangler pages dev dist --ip 127.0.0.1 --port 8789 --persist-to /private/tmp/jrmota-pages-local-state
```

The migration validation used Wrangler `4.130.0`. This runs locally and performs no Cloudflare deployment. Original extensionless paths are preserved through Astro file-format output. The public dashboard route serves the locked view with HTTP 401; the unknown route serves HTTP 404.

Forms persist validated leads in the own `LEADS_DB` D1 binding before the server-side Resend call. Production and preview databases are independent: `joaquimmota-leads-production` and `joaquimmota-leads-preview`, created in the EU jurisdiction. `wrangler.jsonc` configures these bindings; migrations live in `migrations/`. Same-key retries reuse the stored result; a different payload under the same key returns409. The stored `accepted` status confirms provider acceptance, not delivery to an inbox.

Own credentials are configured locally in private ignored `.dev.vars`; Astro development does not execute Pages Functions. Local Pages uses an emulated local D1 database; remote bindings take effect when deployed. No production deployment is authorized. All test notifications still route to `t@doop.pt`; sender is `geral@mail.joaquimmota.pt` and Reply-To is `jrmota@kwportugal.pt`. Hosting secrets and production recipient activation remain pending. See `docs/migration/D1-LEADS.md` for persistence and validation.

The Owner removed `/lp/oferta-selecao`, `/ofertas/vinho-e-fado`, `/doop/relatorios-de-atividades` and `/doop/relatorios-de-visita`, including their forms and report handlers. These URLs return404 in the target. The Webflow source and historical source inventory remain untouched.

## Dependency audit

Astro is pinned to `7.3.5`. On 2026-10-03, `npm audit` reported two high findings for the single transitive dependency `http-cache-semantics@4.2.0` through Astro. The advisory range includes version `4.2.0`, which is also the latest version published by npm; no compatible patched release is available. The audit's suggested Astro `2.10.9` downgrade is not applied.

## Source evidence

The implementation was inspected against the live public homepage on 2026-10-03. Its active visual hero uses the source video poster, and all local files in `public/assets/` are public source copies fetched from the Webflow CDN. The source's zero-sized alternate hero DOM block is intentionally excluded; see the migration contract's rule against residual hidden variants.
