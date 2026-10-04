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

Owner Vender addition2026-10-04: add a guide promotion between the final Negociação video and testimonials, using the existing Comprar guide visual/copy and /guia-vender-para-comprar destination. Heading uses Owner wording: Precisa de vender antes de comprar?

Owner site-wide margin correction2026-10-04: align main outer sections of Comprar/Sobre/Marketing/Reviews/Contacto to90vw like Vender/navbar. Preserve intentional inner card padding and readable article/form/campaign widths.

Owner hero change2026-10-04: Vender/Comprar/Sobre use one InteriorHero component based on approved Vender. Only image/copy/action vary. Center copy vertically and horizontally; positioned copy/button must stack above image/blur. This explicitly replaces original Comprar/Sobre hero presentation.

Owner hero/navbar/menu changes2026-10-04: center hero copy relative the full viewport (not a fixed-height copy panel), desktop and mobile. Home uses the common hero with original video background/copy/two CTAs. Only top light and lower blue navbar visual variants remain, with navigation configurable. Mobile menus fill the viewport with centered links and an X replacing the hamburger. Desktop WhatsApp launcher diameter is halved; mobile unchanged.

Final Owner Home correction2026-10-04 supersedes the full-viewport video background: Home uses precisely the same InteriorHero content/media layout as Vender, with two actions and video instead of image, including the same blur/scroll effect. Heading blue, primary red, secondary red outline with transparent fill/no shadow. Top navbar action is blue; lower navbar action stays white.

Final Owner common-hero effect change2026-10-04: remove overlay on both video and image media in InteriorHero. Keep only blur; opacity stays1 and no animated scale/translation. Applies to Home/Vender/Comprar/Sobre and overrides the prior shared overlay/motion contract.

Owner common hero width2026-10-04: text/actions container is66% of hero width, centered; actions may wrap to stay inside this container on narrow screens.

Owner final media/width correction2026-10-04: image heroes retain the original blue overlay and its scroll fade; video has no overlay and keeps blur-only motion. The66% text/actions width applies only to desktop>=992px; tablet/mobile retain90vw. Media itself stays opacity1/no transform.

Owner image overlay timing2026-10-04: fade the image overlay to0 by scroll progress0.35, exactly when the media blur reaches0. Video remains overlay-free.

Owner image fade-in timing2026-10-04: image opacity goes0→1 over progress0→0.35, synchronized with blur500→0 and overlay1→0. It remains fully visible afterwards; reduced motion shows it immediately. Video opacity stays1.

Owner hero scroll alignment2026-10-04: mobile and desktop use native vertical proximity snap at the top of the shared hero image/video. Keep normal scrolling elsewhere; never use mandatory page snapping. Disable snap while the fullscreen menu is open and for reduced motion. Hero overflow uses clip so it does not become a separate scroll container. Browser decides the proximity threshold; no scripted scroll interception.

Owner snap correction2026-10-04: restrict hero proximity snap to mobile<=767px. Desktop/tablet use normal page scrolling; menu/reduced-motion opt-outs remain.

Owner final snap removal2026-10-04: remove hero snapping entirely, including mobile. Restore unrestricted native page scrolling and original hero overflow clipping. This supersedes both prior snap directives; media blur/fade/overlay behavior stays unchanged.

Owner Home mobile media2026-10-04: Home only replaces video with Vender's /assets/reviews-hero.png at<=767px, with the shared image overlay/fade/blur. Desktop/tablet retain video without overlay. Other hero consumers remain unchanged. Do not attach/download Home video source on initial mobile rendering; pause/unload when resizing to mobile and resume on returning to desktop.

Owner review/navbar buttons2026-10-04: all "Leia as nossas avaliações" testimonial CTAs use blue background/border and light text; hide them on mobile<=767px. Preserve labels and destinations, including Google/Facebook variants. Lower blue navbar's "Vamos começar" action uses red background/border with light text, replacing white. Top navbar remains blue-action variant.

Owner Vender video-section buttons2026-10-04: blue background/border and light text for the three media-section actions: market study, marketing plan and owner's guide. Preserve destinations and labels; scope to Vender, excluding Marketing page.

Source section spacing verification2026-10-04: Vender layout2 uses112/96/64px vertical wrapper inset (desktop/tablet/mobile); correct tablet seller-copy to96. Comprar layout19 process uses the same scale, without target-only intro/steps trailing margins. Sobre's two about-header profile sections use the same scale; retain card64px desktop/tablet and5vw mobile inset, compensate outer48/32/(64px-5vw) to avoid extra nested content offset. Other CTA/card/testimonial wrappers retain their own spacing.

Owner mobile results background2026-10-04: at<=767px replace the fixed photographs behind Home results/sold, Vender results/sold and Comprar properties with precisely the scroll-navbar blue gradient:45deg,#20457f→#162b4e. Desktop/tablet photographs remain.

Owner final CTA motion2026-10-04: restore original sourcea-55 on the shared final ClosingCta card (source target29d885fc-64db-3f2e-80ac-c4cbb7c158ef,e-194): continuous scroll progress,smoothing50,startsEntering=true,startsExiting=false,no offsets; scale1.25/opacity0 at0 toscale1/opacity1 at35%,then hold. Allbreakpoints; reduced motion uses no transform/opacity1. Guide promotions remain separate.

Owner Home section colors2026-10-04: process/testimonial eyebrows are blue#20457f ("Como o fazemos", "O que dizem os nossos clientes"); their headings are red#db1430 ("Espere mais do seu consultor", "Os nossos clientes são os nossos maiores fãs"). Apply through Home-specific semantic classes, preserving other pages' colors/copy.

Owner shared type/components2026-10-04: use the same section-eyebrow and section-heading classes for Home process, Vender's Preço/Marketing/Negociação media sections and Comprar's Uma compra tranquila/Como funciona. Shared typography/colors live in section-type.css; drop conflicting legacy eyebrow classes. All remaining testimonial surfaces use one TestimonialsSection component and the Home masonry composition, with common markup/styles/motion. Callers retain their source/CMS item selection, order, exact quotes/names and optional portraits; the component must not query, sort or deduplicate content. Comprar property cards have radius0.

Owner final reviews removal2026-10-04: remove the testimonial action button everywhere and remove /reviews entirely. No redirect/new page is requested. Keep historical source inventory, but exclude this route from target gates and form allowlists. Hero review actions target the local #testemunhos section. Source Webflow remains untouched.

Owner final top navigation2026-10-04: every light/top Header uses the same Home link set. Desktop shows Imóveis(/comprar#imoveis), testimonials(/#testemunhos),Blog,Sobre nós; Vender/Comprar are hidden. At the hamburger breakpoint<=991px show Vender,Comprar,Imóveis,Blog,Sobre nós, hiding testimonials. Preserve the existing contact action. Lower blue navigation retains its page links. Every fullscreen mobile menu uses the blue navbar gradient, white links and white close control, with existing focus/scroll-lock/close behavior.

Owner Home mobile process action2026-10-04: add a red/light-text "Vamos começar" button after03.Suporte, targeting/vamos-comecar. Only visible<=767px onHome; processcopy/order and desktoplayout remain.

2026-10-04 — Owner: TestimonialsSection apresenta seleção aleatória por carregamento, inicialmente6 desktop/3 mobile<=767px; botão azul “Ver mais” revela lotes seguintes na mesma ordem. Copy e itens CMS preservados. SoldPropertiesSection usa sobre-heading “UMA VENDA COM SUCESSO”. Em Vender, três ações das secções vídeo aparecem depois do respetivo vídeo apenas mobile<=767px; desktop/tablet mantêm posição original.

2026-10-04 — Correção Owner: toda a classe partilhada section-heading volta a azul#20457f, mantendo tipografia e aplicação aos títulos Home/process, Vender/media, Comprar/process e TestimonialsSection.

2026-10-04 — Owner autoriza nova página /imoveis, construída de raiz sem importar o rascunho Webflow homónimo. Estrutura semelhante ao Blog: destaque do imóvel mais recente na ordem pública, CTA newsletter “Não perca nenhuma novidade!”, lista completa dos imóveis disponíveis, mesmo BuySellGuide e ClosingCta de Comprar, Footer comum. Imóveis na top navbar passa a /imoveis. Top navbar inclui Início também desktop, oculta a rota corrente e mantém testemunhos em todas as páginas/dispositivos; lower navbar preservada. Comprar apresenta primeiros6desktop/3mobile, Ver mais outline branco/semfill abre /imoveis. Cards comuns: títulos truncados em2linhas, imagens3:2cover e indicadores semfill; detalhe imóvel também indicadores semfill. Newsletter da nova página usa o fluxo próprio existente.

2026-10-04 — Owner destaque /imoveis: badge permanente vermelho “Destaque”; imóvel active mais recentemente alterado (_updatedAt destino), semreserved/sold. Grelha Imóveis/Comprar: active por_updatedAtdesc, reservas podem constar grelha, sold/cancelledexcluídos; desempate_idestável. Preview continua com própriosdraftsSanity provenientes de itensWebflow públicos/elegíveis; não confundir draftdestino para validação com draftWebflowexcluído. Newsletter Blog/Imóveis usa gradient45deg#20457f→#162b4e, igualnavbarblue.

2026-10-04 — Correções Owner para Imóveis: destaque aleatório em cada carregamento entre os três imóveis active mais recentemente alterados, excluindo reservado/vendido; badge permanente “Imóvel em destaque”. Imagem desktop 3:2 cover; mobile reutiliza o card comum com esse badge. Diretório: destaque, newsletter, seis imóveis, BuySellGuide, restantes imóveis, CTA final. Ícones de interface Lucide; logos oficiais sociais e WhatsApp permanecem. Números dos indicadores pretos e ícones azuis; certificado com “Certificado Energético” desktop e “CE” mobile, ambos a azul. Galeria 3:2 cover nas miniaturas e proporção original no lightbox. Ficha não renderiza mapa/vídeo/visita virtual sem endereço preenchido; características usam ícones correspondentes. Mobile: título da ficha 28px e intervalo de 12px entre características, sem alterar o intervalo ícone/valor.

2026-10-04 — Owner: indicadores de área usam Lucide Scan nos cards e na Área Bruta da ficha; Área Útil usa Scan Square. Revisão do destaque mobile corrigiu heading para H1 com a mesma apresentação do card comum; seleção aleatória define imagens de candidatos ocultos como lazy.
