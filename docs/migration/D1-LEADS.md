# Joaquim Mota leads — Cloudflare D1

Owner authorized on2026-10-04. Own account e23a1ecc3719f496e47f56f20e6da716; own production and preview databases, both EU jurisdiction. No PM data, schema, credentials or binding reused.

| Environment | Database | ID |
| --- | --- | --- |
| Production | joaquimmota-leads-production | 18572d19-56cc-44aa-9a72-18f5acd67737 |
| Preview | joaquimmota-leads-preview | c63b0ebb-80bd-495a-b34e-068626208b26 |

`wrangler.jsonc` binds `LEADS_DB`; the default local configuration uses the preview identity. Both remote databases have migration `0001_create_leads.sql` applied and zero leads. This resource preparation does not deploy the site. Local Pages uses local emulated D1 under `/private/tmp/jrmota-pages-local-state`; it cannot demonstrate remote persistence. Deploy-time production/preview bindings are separate.

## Data flow

`/api/forms` validates origin, route, type, body size, allowed fields and source consent. It inserts the normalized fields, route, property reference where applicable, idempotency key/hash and timestamps before calling Resend. Storage unavailable means503 and no send. No additional UI fields or tracking were introduced.

The unique key prevents duplicate leads; a changed normalized payload under the same key returns409. Conditional60-second claims with tokens prevent overlapping workers from finalizing each other's work. Recovery is restricted to23 hours, inside the provider's24-hour idempotency window; older records require reconciliation. A20-second provider timeout prevents a stuck call from holding the claim indefinitely. API202 requires a bounded nonempty provider ID and one confirmed acceptance update. Stored `accepted` records provider acceptance, not inbox delivery. Failures retain only a generic error code; validated lead fields remain server-side.

## Verification

Remote schema/index/migration checks passed separately for both own databases. Local live contact202, two duplicate retries202 including the iPhone proxy, changed payload409, and newsletter202 produced exactly two local rows with receipts. The contact produced one test email, confirmed delivered by the own Resend plugin. Newsletter reused the existing authorized test contact. The four removed pages and both old report APIs return404; removed campaign form routes are rejected403 before storage/send.

Full suite124/124; Astro check101 files with zero diagnostics; build250 pages;264/264 GET route checks. Independent backend review passed after the crash/lease/receipt regressions were tested. See [d1-leads-validation.json](d1-leads-validation.json).

All test notifications go to `t@doop.pt`, from `geral@mail.joaquimmota.pt`, Reply-To `jrmota@kwportugal.pt`. Production recipient activation, hosting secrets, production SEO and deployment require the remaining Owner decisions. Secrets are private ignored `.dev.vars`, never in this configuration or evidence.
