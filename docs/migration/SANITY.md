# Sanity connection

The site reads published content from the own Sanity project `kaq1vd9b`, dataset `production`, during every build. Astro remains static; this is not SSR. `npm run build` fetches all pages of content before generating routes and form metadata. Drafts and release versions are excluded. Network, invalid data and empty-content failures stop the build instead of silently reusing the migration snapshot.

The 189 validated imported documents were published for this connection: 65 properties, 59 articles, 38 testimonials, 19 pre-listings and 8 process steps. The removed `vinho-e-fado` offer remains unpublished. This publication affects Sanity and the Pages preview only; Webflow and DNS are unchanged.

New properties and articles do not need Webflow IDs. Fill or explicitly generate a slug and publish the document. The build creates the detail page, listing entry where eligible, and form-route metadata. Active and reserved properties appear in listings; sold properties leave them and enter the last-five-sold selection ordered by native Sanity update time. Featured properties exclude reserved and sold.

Imported URLs are protected against changes to `slug.current` relative to `sourceSlug`. Slug generation is explicit for new properties/articles and does not automatically follow title changes. Existing published URLs must remain stable.

## Automatic preview publishing

The final Owner-selected flow is **SSG + webhook**, without polling: Sanity published content → authenticated GitHub Actions workflow dispatch → fresh static build → Cloudflare Pages preview. Code pushes also run the workflow. The workflow is `.github/workflows/sanity-preview.yml` on default branch `codex/migration-foundation`.

Own Sanity webhook `joaquimmota-published-preview`, ID `dSQ8Q448Ax6cSVaF`, is configured for create/update/delete of published property/article/testimonial/preListing/processStep documents in production. Drafts and release versions are excluded. Its payload is only `{"ref":"codex/migration-foundation"}` and its target is the own GitHub workflow dispatch API. Owner authorized activation on 2026-10-05. It is enabled and its published-content event delivery has been tested through a successful preview deployment.

Two dedicated credentials are required. GitHub Actions secret `CLOUDFLARE_API_TOKEN` needs Account / Cloudflare Pages / Edit permission limited to the own Cloudflare account. The Sanity webhook Authorization header needs a fine-grained GitHub token limited to `tgfrts/joaquimmota`, with Actions write permission; GitHub authenticates the trigger. No content or form submissions are sent in the webhook body. No Sanity read secret is needed for the public dataset. Existing broad local OAuth credentials were not copied into either service. Owner saved both credentials on 2026-10-05; secret-name and Authorization-presence checks confirmed configuration without exposing values. Manual workflow run 37325082417 successfully fetched, tested, built and deployed the preview. Owner subsequently authorized activation. A same-content testimonial republication triggered Sanity attempt atm-3KHPDPTsLWYiwLzxKmFgq0x85PK (HTTP200), GitHub run 37326985248 and successful preview deployment https://057048c3.joaquimmota.pages.dev. All 95 tests passed, Astro reported zero diagnostics, and the public metadata confirms 189 documents and 124 preserved route-history entries. Automatic preview refresh is active; no production domain or DNS cutover occurred.

The workflow publishes only to the `joaquimmota` Pages project, branch `migration-preview`. Missing deployment credentials skip code-push builds with a visible warning and reject manual/webhook builds explicitly. No Worker or public unauthenticated endpoint is added for the CMS trigger.

Public `cms-revision.json` records the content revision, document count and public route history for change detection. Routes already deployed under the same document ID cannot change, including newly authored properties and articles; unpublishing does not erase the recorded URL history. No form submissions or credentials appear in this file. The last successfully deployed preview remains available if a later CMS fetch/build/deploy fails.

## Verification

The first connected build generated 249 pages from 189 published documents. All 124 property/article detail paths were independently verified in the build output. The five existing sold selections were preserved. Public Home, property directory, property detail, article detail and revision metadata returned HTTP 200 after deployment. No email or real form submission was sent during this integration.
