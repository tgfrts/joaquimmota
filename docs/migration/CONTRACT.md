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

The Owner authorized a 10% visual reduction of all navbar logos, overriding source logo size. Home results and sold properties retain the shared original fixed background, metric dividers and left-aligned sold heading. The sold rail selects only the five sold properties with the most recent native Sanity `_updatedAt`, with `_id` as deterministic tie-breaker. The current five remain the initial set; future status/content edits affect selection after CMS snapshot refresh and rebuild. No artificial sale date or description rewrite is used.

Owner CTA change 2026-10-04: all existing final portrait CTAs use one Astro component with the approved Home composition and responsive photo position. Use the existing white-shirt portrait (`/assets/closing-jm.png`) in every instance, including Home. Preserve each page's existing copy and action destination, including article copy from Sanity; no per-page layout/image variants. This explicitly overrides differing original final-CTA presentation.

Final CTA detail: white-shirt portrait must be contained without clipping the head/shoulders. The overheading is uppercase; the button retains normal case and blue text. Existing interior scroll/sticky navbars use the same blue/white Header variant and navigation as Home; initial transparent headers remain unchanged.

Owner Vender change 2026-10-04: first results block is the Home sold-properties subsection only, reusing its latest-five CMS selection, cards and fixed photograph. Keep the second results block's values96%/60 dias/85% and show numbers white. Remove the later duplicate sold-properties block from Vender. This overrides original duplication/presentation only on that page.
