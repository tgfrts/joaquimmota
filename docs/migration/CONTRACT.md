# Migration contract — Joaquim Mota
Owner accepted the inventory/plan on 2026-10-03 with source-draft exclusion overriding the earlier proposal to retain old live draft versions.
- Source Webflow only read; scope original public experience, not redesign.
- Every source draft is ineligible for import, including live older article/highlight versions. Keep excluded historic URLs in the URL disposition inventory; do not silently choose replacement/redirect behavior.
- Missing current staged source state is unresolved, not eligible by inference.
- Preserve published copy, visible images/quality/order, layout/behavior, SEO and eligible URLs/anchors/query semantics.
- No hidden residual blocks or unused presentation encoded in CMS.
- Independent Astro checkout and site-local design/content; own Sanity and Resend only.
- Import tests: one/two fully faithful eligible samples per CMS; then remaining content in bulk after parity and aggregate item/photo counts only.
- Target drafts are safe validation artifacts, not source-draft imports. No target publication, real emails/submissions, DNS/cutover or source modification in this foundation phase.
- Verify build, routes, migration invariants and independent review; no acceptance claims from build alone.

## Owner scope changes — 2026-10-04
The Owner explicitly removed `/lp/oferta-selecao`, `/ofertas/vinho-e-fado`, `/doop/relatorios-de-atividades` and `/doop/relatorios-de-visita`, including their forms/handlers. They must not render and return404; this overrides default URL preservation only for these four paths. Source inventories remain historical evidence. No Webflow or Sanity records are deleted by this target route removal.

The Owner authorized own Cloudflare D1 lead storage and real Resend tests only to `t@doop.pt`. Production and preview databases must be separate from each other and from PM Real Estate. Store validated leads before contacting Resend, keep secrets server-side and record provider acceptance without equating it to inbox delivery. This authorization does not permit production deployment, recipient activation, DNS or cutover.
