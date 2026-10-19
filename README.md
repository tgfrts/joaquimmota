# Joaquim Mota Consultores

Independent Astro site for `joaquimmota.pt`, migrated from Webflow. Astro owns presentation and static page generation; this site's Sanity project `kaq1vd9b`, dataset `production`, owns structured editable content. Webflow remains strictly read-only.

## Local commands

```sh
npm ci
npm run dev
npm run check
npm run build
node --test scripts/cms/*.test.mjs tests/forms/*.test.mjs
```

`npm run build` fetches current published Sanity content, generates property email metadata and builds Astro. For development before the first build, run `npm run cms:fetch`. The ignored `src/data/sample-content.json` is a generated local cache, not a committed source of content. Fetching is paginated and uncached; empty or invalid content fails the build. Destination drafts and releases are excluded. Historical migration preparation scripts are not the routine publishing workflow.

Property and article pages use published slugs. Imported `sourceSlug` values and deployed CMS route history protect existing URLs, including documents temporarily unpublished. Source drafts remain excluded from migration. Newly published properties, including KWPT039444, KWPT030872, KWPT037992, KWPT037996 and JRM001, use the same content/build flow; no template edits are required for each listing.

## Preview and production publishing

`.github/workflows/sanity-preview.yml` checks, tests, builds and deploys the `migration-preview` branch of the own Cloudflare Pages project `joaquimmota`. Code pushes on the trusted `codex/migration-foundation` branch run its preview job. Its existing manual/authenticated webhook dispatch entry point now calls the reusable production workflow, preserving the Sanity webhook URL and authentication. Historical automatic preview delivery was certified; the new production event path still requires end-to-end verification.

`.github/workflows/production.yml` accepts direct manual dispatch and reusable calls from the Sanity entry point on that same trusted branch, serializes production releases and deploys Pages branch `main`. It validates production SEO and checks the combined production/preview URL histories before writing revision metadata. Missing, malformed or conflicting production URL history stops deployment. Both flows read published Sanity content at build time; neither needs a public runtime CMS token.

The Owner authorized immediate association of `joaquimmota.pt` and `www.joaquimmota.pt`, DNS cutover and retargeting the Sanity webhook to production on 2026-10-19. This authorization does not establish completion: consult `docs/migration/STATUS.md` for execution evidence and outstanding verification. Existing email DNS must be preserved. Webflow must remain available as reference/rollback; no additional decommission action is authorized.

Production eligible pages use apex canonicals and the generated sitemap. Preview and Pages deployment hostnames remain `noindex, nofollow`; private, utility, blank and thank-you pages are excluded from indexing and the sitemap. Final domain behavior requires post-cutover checks.

## Local Pages Functions and lead delivery

For a built-site local preview with Pages Functions:

```sh
npm run build
npx --yes wrangler@4.130.0 d1 migrations apply joaquimmota-leads-preview --local --persist-to /private/tmp/jrmota-pages-local-state
npx --yes wrangler@4.130.0 pages dev dist --ip 127.0.0.1 --port 8789 --persist-to /private/tmp/jrmota-pages-local-state
```

This uses local emulated storage and does not deploy. Astro development alone does not execute Pages Functions. Original extensionless paths use Astro file-format output; the locked dashboard returns HTTP 401 and unknown routes return HTTP 404.

Forms persist validated leads in the own `LEADS_DB` D1 binding before calling Resend server-side. Production and preview use separate EU databases, `joaquimmota-leads-production` and `joaquimmota-leads-preview`. Bindings are in `wrangler.jsonc`; schema migrations are in `migrations/`. Same-key retries reuse the stored result, while a changed payload with the same key returns HTTP 409. Provider acceptance does not prove inbox delivery. See `docs/migration/D1-LEADS.md` and `EMAILS.md` for details.

Base/local configuration routes test notifications exclusively to `t@doop.pt`. Deployed preview and production configuration uses Owner-approved live routing: consultant `jrmota@kwportugal.pt`, customer at the submitted address, and mortgage requests additionally to `da@somoscredito.pt`. Sender is `geral@mail.joaquimmota.pt`, with Reply-To `jrmota@kwportugal.pt`. Real test submissions/emails require authorization.

Keep private local credentials in ignored `.dev.vars`, runtime secrets in Cloudflare and deployment credentials in GitHub Actions secrets. Secrets remain server-side and outside Git; do not substitute another site's accounts or datasets.

## Migration evidence and dependencies

Read `docs/migration/CONTRACT.md`, `ACCEPTANCE.md` and `STATUS.md` before migration or cutover work. Historical source inventories remain evidence; Owner-authorized removals and presentation changes are recorded in the contract. Removed routes must retain their approved HTTP 404/redirect behavior.

Home sold properties come from the published snapshot: sold status, newest native Sanity `_updatedAt` first, deterministic `_id` tie-break, maximum five. CMS edits change this selection after the next successful build/deployment; `sourceUpdatedAt` is not used for ordering.

Astro is pinned to `7.3.5`. Commit `bebd161` updated the locked transitive `http-cache-semantics` dependency from `4.2.0` to `4.3.0` on 2026-10-19. The former README's unresolved-vulnerability statement is obsolete; run a fresh dependency audit when assessing current advisory status.
