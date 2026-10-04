# Status

## Estado atual — 2026-10-04

- Checkout independente `tgfrts/joaquimmota`; PM sem alterações tracked.
- Gates de amostras e payload completo passaram com revisão independente. Importação concluída:190 drafts próprios, zero publicados,1447 posições de imagem/1342 originais referenciados;1343 assets incluem um extra não referenciado de validação. Nenhum draft de origem importado.
- Build250 páginas; Astro check102 ficheiros sem diagnósticos;124/124 testes no candidato D1; ícones posteriores verificados por build/HTML/runtime. Gate de rotas sem caminhos necessários ausentes ou proibidos gerados;264/264 GET locais passaram, incluindo9 drafts404,4 exclusões Owner404 e admin401.
- Comparações documentadas de famílias estáticas, dois exemplos por CMS onde aplicável, interações e desktop/mobile/tablet. Blog completo e flyer fechados nos dois viewports principais; esta evidência é delimitada e não certifica todos os possíveis tamanhos de ecrã.
- Preview local `http://127.0.0.1:8789`, com conteúdo do Sanity próprio; cache de190 documentos ignorada pelo Git. Sem Studio alojado; schema MCP próprio disponível.
- Owner removeu por completo `/lp/oferta-selecao`, `/ofertas/vinho-e-fado` e os dois relatórios DOOP, incluindo forms/handlers/assets exclusivos. URLs devolvem404; inventário histórico/Webflow/Sanity não alterados.
- D1 próprio criado: joaquimmota-leads-production e joaquimmota-leads-preview, EU; schema aplicado e ambas vazias. Backend persiste antes de Resend com chave única/hash, leases e recibos confirmados. Auditoria independente passou. Preview local usa D1 emulada, com2 leads de teste aceites; bases remotas serão usadas apenas no alojamento autorizado.
- Teste real D1/contacto202, retry202 sem duplicação, conflito409 e newsletter202. Plugin Resend confirmou um novo email entregue apenas a `t@doop.pt`; contacto newsletter de teste reutilizado. Remetente `geral@mail.joaquimmota.pt`, Reply-To `jrmota@kwportugal.pt`; todos os testes continuam dirigidos a `t@doop.pt`. Sem envio a clientes. Evidência: d1-leads-validation.json.
- Dashboard mantém a experiência pública protegida/401; painel privado e autenticação interna não foram migrados sem acesso ao conteúdo privado.
- Revisão do preview pelo Owner e ativação de SEO de produção permanecem pendentes. Publicação Sanity, produção, DNS e cutover não autorizados.

As entradas seguintes são um registo histórico; contagens e pendências antigas são substituídas pelo estado atual e pelos relatórios formais mais recentes.

## Registo de evolução

2026-10-03: inventário/plano aceite pelo Owner com exclusão de todos os rascunhos de origem. Checkout independente tgfrts/joaquimmota, branch codex/migration-foundation; nenhuma alteração tracked no checkout PM.

Sanity próprio: Joaquim Mota / kaq1vd9b / production, inicialmente 0 documentos e 0 imagens. Resend próprio: mail.joaquimmota.pt verificado, eu-west-1. Nenhum email ou formulário submetido.

Elegibilidade CMS: 219 elegíveis, 26 excluídos (21 drafts + 5 Pre-Listings sem detalhe de estado atual). Auditoria independente confirmou contagens e regra draft-wins. Gate corrigido para identidade id+locale e 35 rotas estáticas publicadas versus 9 drafts; templates apenas permitem rotas expandidas de itens elegíveis. Os 19 testes de migração passam. Não constitui paridade dos exemplos nem autorização do bulk.

Fundação Astro: primeiro check/build passou; Astro atualizado para 7.3.5; Node atual suportado. Restam duas entradas high do mesmo advisory transitivo http-cache-semantics, sem versão corrigida disponível na verificação; limitação registada no README. Não é candidata aceite nem reprodução completa. Schema MCP próprio default deployed: 6 tipos de documento e 3 objetos de apoio. 11 documentos de exemplo criados, todos destino drafts, com 51 ficheiros de imagem originais; nenhum conteúdo de origem draft. Snapshot destino usado só em cache local ignorada pelo Git. FAQs permanentemente ocultas em Comprar/Vender confirmadas também em mobile e excluídas.

Amostras importadas em 6 coleções necessárias (2 property, 2 article, 2 testimonial, 2 preListing, 1 offer, 2 processStep). Sem bulk, publicação de conteúdo alvo, emails/submissões, produção, cutover ou alterações DNS. Build gera 8 páginas (home + 7 rotas de exemplo). Comparação visual encontrou falhas no template de imóvel; correção em curso, paridade não certificada. Categoria genérica visível nos artigos não liga taxonomia; Open House de imóvel observado é condicionalmente invisível. Auditoria independente retirou a necessidade de importar esses resíduos.

Paridade de 1–2 exemplos por coleção necessária antes do bulk; depois apenas reconciliação agregada de itens/fotos.

2026-10-03 — progresso adicional: comparação independente de dados das 11 amostras passou (54 posições de imagem, 51 ficheiros distintos, referências e ordem exatas, Portable Text conferido); relatório seguro em sample-data-parity.json. Ainda não certifica paridade visual/comportamental. Imóveis apresentam grelhas de 25/19 fotos; oferta e pre-listing receberam correções visuais a partir da experiência pública. 75 caminhos CMS elegíveis cujo original é vazio têm templates vazios próprios; não são importações de conteúdo.

Backend de formulários corrigido para aceitar apenas slugs elegíveis, incluindo vinho-e-fado, limitar a leitura do corpo a 16 KiB e manter idempotência nas tentativas do visitante. Sucesso cliente apenas após 202. Doze testes focados com mocks passam; nenhuma chamada real de envio/captura Resend. Destinatário final continua por confirmar pelo Owner. Assunto nos dois guias é display:none com dimensões zero no browser original e permanece excluído.

Cache de amostras continua privada/ignorada; prepare-preview.mjs valida identidades e slugs antes de a materializar num checkout limpo. Preview marcado noindex/nofollow e proibido para produção. Rotas e superfícies restantes continuam incompletas; gate de rotas ainda não passa. Sem bulk, publicação Sanity, cutover ou DNS.

Correção posterior de autoridade: a opção Webflow 12b19dfc9cb975be3f2f8c2b397c5af7 corresponde a Vender, não Marketing. O exemplo seller permanentemente oculto foi substituído no mesmo draft de validação por 02. Inicie a pesquisa, Comprar (64d73faf12672d652ab57819). Nenhum documento publicado foi alterado. As duas amostras processStep são agora de Comprar. Os quatro destaques Marketing são drafts na origem, apesar de terem versões live antigas, e não entram por duplicação estática. Regressão adicionada para as opções reais.

Auditoria independente confirmou os dados corrigidos: 11 amostras destino draft, 54 posições de imagem e 51 referências únicas. Existe uma imagem de validação anterior sem referência entre os 52 assets; não foi apagada. O relatório de paridade atual é a autoridade para estas contagens. Check sem diagnósticos, build de 91 caminhos de preview e 32 testes passam. Ainda faltam 163 caminhos exigidos pelo gate, além de diferenças visuais/funcionais; isto não certifica bulk nem o site completo. Código próprio já guardado em tgfrts/joaquimmota; nenhum ficheiro tracked PM modificado.


2026-10-03 — preview adicional de /contacto, /sobre e /vamos-comecar (94 rotas geradas). Dados/copys de contacto conferidos; /sobre recebeu os dez testemunhos públicos e dois vídeos abertos por imagem/modal, sem iframe inicial. Teste de abrir/fechar o modal confirmou descarregamento do player; galeria do imóvel confirmou avanço 1→2 de 25 e fecho. Rodapé possui campos email/nome/apelido required e envio para endpoint próprio com idempotência/202; WhatsApp agora traz os estilos no componente nas três páginas consumidoras. Auditoria independente identificou e confirmou a resolução dos estilos ausentes e da cópia exata de sucesso/erro da newsletter.

SEO de preview corrigido para omitir descrições/tipos sociais não existentes na origem, mantendo as descrições vazias explícitas dos dois templates CMS verificados, og:image vazio dos pre-listings e ausência de social metadata na oferta. O noindex/nofollow permanece obrigatório até fase de produção. Vamos Começar mantém a declaração legal dentro do formulário, o assunto visível Comprar/Vender/Outro e exclui o textarea permanentemente oculto. Nenhum envio real foi feito.

Check: 0 diagnósticos; build: 94 páginas; testes: 32/32. Gate de rotas: 160 rotas exigidas ainda ausentes, zero rotas proibidas geradas. A revisão cobre segurança/diff e as correções indicadas, não paridade total. Geometria, animação de blur/scroll dos cabeçalhos Sobre/Contacto, restante composição e páginas ainda precisam de comparação/correção. Amostras CMS continuam sem certificação visual/comportamental completa, bulk continua pendente. Nenhuma importação ou alteração de provider neste avanço; PM Real Estate sem alterações tracked; produção/DNS não autorizados.


Correção adicional de leitura/mobile: o renderizador Portable Text passa a conservar CRLF/LF/CR como quebras, após escaping de HTML. O browser confirmou igualdade literal do parágrafo de distribuição do imóvel, incluindo oito quebras source/target. Auditoria independente confirmou ausência de regressão de escaping. Badges usam os quatro SVGs públicos originais com brightness(2), tamanhos/preço/localização/referência ajustados à fonte. Comparação de kwpt032055 em 390×844 corrigiu cabeçalho 64px, logo, h1 36px/43.2px, preço visível no mobile reservado e cartão; não constitui ainda certificação 100% do template.

Menu mobile light corrigido por comparação direta: painel branco centrado 200×410px, seis links incluindo contacto, abertura/fecho testados sem navegação/submissões. Viewport temporário reposto. Check/build voltaram a passar depois destas alterações. Nenhum dado Sanity/Resend foi escrito, nenhum item adicional importado; pendências e gate bulk anteriores mantêm-se.

2026-10-03 — retomada contínua: schema próprio article recebeu publishedAt e processStep recebeu placement home. Apenas os dois drafts article foram atualizados, com revisão protegida, para createdOn da origem: 28/2/2026 e 10/2/2026. lastPublished não é a data pública. Cache privada rematerializada; comparação estruturada das 11 amostras reexecutada sem divergências, todas destino drafts. Contagens continuam 53 posições de imagem / 50 refs únicas / 51 assets; nenhum item adicional importado.

Home: três VS visíveis confirmados e mapeados por IDs/ordem; consumidor prefere target processStep quando existir no snapshot aprovado e usa cópia pública verificada enquanto bulk não foi autorizado. Cinco Comprar ativos + três Home = oito process steps; sete Seller permanentemente ocultos excluídos, três PS Exclusive sem consumidor público confirmado mantêm-se fora do bulk. Gate exige conteúdo, imagens, URLs, SEO, interação, layout e responsividade; quatro novos testes confirmam fail-closed, exclusão de drafts, visibilidade e paginação. Não se exige uma terceira amostra por placement: continuam duas amostras Comprar nesta coleção, conforme Owner.

Paridade de consumidor registada em process-consumer-parity.json: Home desktop tem as mesmas posições, larguras e alturas dos três blocos; mobile tem alturas exatas e diferença vertical inferior a 0.02px. Comprar usa os dois exemplos Sanity pelos IDs originais; copys/links/tipografia/alturas conferidos. Cabeçalho Home também ajustado às alturas/posição desktop e mobile. Segundo Header incluído e navegação de cada instância tem ID único; menus ligam-se à instância correta. As contagens da amostra permanecem 54 posições / 51 referências únicas / 52 assets carregados; nenhum item adicional foi importado.

Galeria dos imóveis tem modal de ecrã completo, miniaturas, limites sem wrap, navegação por teclado, swipe, Escape/backdrop e retorno do foco. Imagem desktop mede 1053.4375×592.5547 versus 1053.4297×592.5547 na origem. Formulário imobiliário preserva required/consentimento e mensagens exatas, agente/ícones e gradiente originais; altura desktop 630.890625 exata e mobile 555.898 versus 555.891. Sem submissão real. Revisão independente não encontrou bloqueador neste escopo; padrão ARIA das tabs foi completado após finding.

Movimento: especificações públicas extraídas estaticamente do JS fonte, sem executar/copiar runtime Webflow para o target. Código próprio reproduz keyframes contínuos de imagem interior (blur/scale/opacidade/translate), CTA e cabeçalho imobiliário com smoothing 50; reduced motion estabiliza a apresentação. A comparação continua e não constitui paridade total. Artigos corrigidos no corpo/byline/data/newsletter/CTA/rodapé, incluindo letter-spacing original dos h3 mobile.

Novas páginas públicas implementadas em Astro próprio: quatro agradecimentos; parcerias em PT/EN/FR; estudo-de-mercado, sessão-gratuita e crédito; quanto-vale, uma-venda, flyer e oferta-certificado; campanhas cabaz-de-natal, oferta-selecao, smillingstreet e atualização-de-informação. Capturas públicas conferem copy/assets/metadata/campos e contratos do backend. Build observado 111 páginas; screenshots/comparação visual destas novas superfícies ainda pendentes. Não há certificação global de paridade nem abertura do bulk.

Pre-listings: imagem de hero fixa e profile/banner públicos originais recuperados; geometria e apresentação continuam em correção. Blog e superfícies públicas restantes em execução. Provider de envio continua sem teste real e destinatário final por confirmar; não há emails, conteúdo target publicado, produção, DNS ou cutover.

2026-10-03 — avanço de amostras e rotas: a segunda amostra preListing foi substituída no mesmo draft por sc-t4-arcozelo-20260416, para cobrir um hero CMS realmente visível além do fallback estático. Auditoria de 19 páginas públicas confirmou seis heroes ligados ao CMS e treze fallbacks; gallery/type/typology residuais excluídos. Sanity próprio continua com 11 drafts, zero conteúdo publicado, agora 52 assets (51 referenciados, 54 posições). Comparação estruturada das onze amostras sem divergências; nenhuma importação bulk.

Pre-listings agora preservam seleção e ordem dos dez testemunhos por rota; sete correspondências ambíguas conservam os IDs candidatos, sem inventar identidade. Geometria de hero, processo, estatísticas, testemunhos e CTA comparada em desktop/mobile; cartões vendidos excluem contagens permanentemente ocultas e usam divisor/localizações ativos. Barra telefónica permanece abaixo do viewport no original após o hero em desktop/mobile; finding baseado apenas em markup foi retirado pela auditoria. Evidência parcial em public-browser-parity-progress.json; ainda sem certificação global.

Oferta vinho-e-fado tem heading e todos os campos com geometria exata nos viewports 1280×720, 390×844 e 834×1112, incluindo o breakpoint tablet e required/defaults/consentimento; copy/SEO/imagem e contrato de redirect conferidos. Nenhuma submissão ou email real. Blog tem seis cartões por página e query original, com paginação limitada ao conteúdo disponível, sem cartões inventados. Páginas públicas 401/404 implementadas; autenticação e status de hosting continuam gates de integração.

Check: 72 ficheiros sem diagnósticos; testes: 39/39; build: 114 páginas. Gate tem 140 rotas exigidas ausentes (137 CMS aguardam bulk e três superfícies protegidas/DOOP), zero rotas proibidas. Paridade visual completa de amostras e páginas restantes continua em execução; bulk/produção/DNS não autorizados nesta evidência.

Correções funcionais/SEO posteriores: consentimento obrigatório segue no pedido para todos os formulários não-newsletter e o endpoint exige boolean true antes do adapter; revisão independente confirmou ausência de bypass e 14/14 testes de formulários. Newsletter mantém payload sem checkbox. Reviews recupera title original Reviews sem descriptions inexistentes; Guia de Férias recupera a descrição original e omite imagens sociais inexistentes; 401/404 recuperam títulos sociais. Placeholder da morada atualizado conforme fonte.

Nos dois exemplos property, todas as dimensões das secções descrição/características/mapa/galeria/inquérito coincidem nos viewports desktop/mobile; desktop posições exatas, mobile desvio constante 0.5px. Grelhas preservam 19/25 imagens e ordem; badges mobile, localização inline, âncora características, alturas/proporções de galeria e mapa corrigidos. CTA e footer comparados só após carregar as imagens lazy originais: CTA mobile source400.094/target400.086; footer mobile source1150.539/target1150.547, newsletter294 e nota72px exatas. Ainda faltam verificação independente de movimento/tablet, restante site e entrega real; estes avanços não abrem bulk.

Checkpoint de continuidade: revisão independente de scope/segredos/diff/draft gate passou; check72/0 diagnósticos, build114 e testes41/41 após consentimento. PM continua sem alterações tracked. Guardar este checkpoint não constitui aceitação da migração; a execução prossegue nas verificações ainda pendentes.

## Responsive follow-up
- Property tablet 834×1112: measured header, description, characteristics, map, inquiry, closing and fully loaded footer dimensions match the original (gallery rounding <0.05px). Collapsed light-navigation menu matches 200×410 at y72.
- Inquiry opacity curve confirmed against actual public browser observation and reviewed independently.
- Article tablet stack, main-image ratio, header typography and newsletter measured; exact original CTA portrait imported with matching SHA-256. Further sample visual checks remain before bulk acceptance.
- No additional Sanity content writes or real form submissions in this follow-up.

2026-10-03 — continuação: lote de origem completo preparado localmente, 190 documentos elegíveis / 1.447 posições visíveis de imagem / 1.342 originais distintos. Os 1.342 ficheiros foram descarregados e conferidos por SHA-1/tamanho; ainda não há recibos de destino para o lote inteiro nem importação adicional. As 51 imagens referenciadas pelas amostras coincidem byte a byte com metadata Sanity, ver sample-image-original-digests.json. Conversão/renderização dos 59 artigos elegíveis conferida agregadamente, sem perdas semânticas/estruturais, preservando NBSP e marcas nos BR. Dados das 11 amostras não mudaram. Testemunhos Comprar mobile têm as dez alturas exatas; guia e CTA diferem apenas no arredondamento de pixels. Header desktop de artigo/imóvel agora mantém Contacte-nos→/vamos-comecar e menu→/contacto. Quatro testes runtime de reduced motion passam, sem alterar preferências do computador. Revisão final das amostras e rail vendido em curso; gate bulk permanece bloqueado até evidência completa. Nenhuma escrita Sanity/Resend, email real, alteração PM, cutover ou DNS neste avanço.

## Fecho independente das amostras

O gate formal `sample-gate.json` passou para os 11 exemplos das seis coleções, com as oito dimensões documentadas. Os nove contratos de rota não têm diferenças materiais; formulários são testados com respostas simuladas, sem envios reais. Corrigidos o espaçamento original dos formulários e a largura útil do artigo em desktop. Testes completos: 69/69 passaram. O projeto Sanity próprio continua com 11 drafts, 52 imagens e zero conteúdo publicado antes do lote.

A fase seguinte é carregar os 1.291 originais em falta e verificar os 1.342 recibos por SHA-1/tamanho. A criação dos 179 drafts adicionais continua condicionada ao gate separado do payload completo. Não há publicação, email real ou cutover autorizado.

## Continuação da implementação e carregamento de media

O carregamento de originais para o Sanity próprio está em execução com checkpoint privado durável: 299/1.342 referências verificadas por SHA-1 e tamanho no último grupo reconciliado; operações incertas são consultadas no destino antes de qualquer repetição com a mesma identidade. Os 11 drafts de conteúdo das amostras continuam sem importação adicional e sem publicação. O payload completo continua condicionado aos 1.342 recibos; a revisão posterior será agregada por coleção, conforme Owner.

Campanha Smillingstreet: comparação independente desktop1280/mobile390 coincide nas alturas de hero/formulário e posições, incluindo o alinhamento, tracking, imagens locais originais, campos, consentimento e âncora publicados. Secções de evento/countdown permanentemente ocultas foram excluídas. Ecrã público protegido: geometria confirmada, revisão independente e nove testes; função admin responde401/no-store em todos os métodos e /401 permanece200. A autenticação e painel privado não estão implementados.

Os relatórios DOOP são públicos e usam POST nativo para ações externas; isto foi confirmado por análise estática do módulo Forms público, sem executar nem copiar esse runtime no destino. As ações próprias same-origin preservam os campos e têm validação e proxy server-side com configurações vazias. Revisão independente passou; nenhum registo, dado pessoal ou email foi enviado. Calendário e comparação visual completa destes formulários continuam em execução.

Última suite completa antes do calendário:90/90 testes. Build117 páginas, check sem diagnósticos e diff sem whitespace errors. Vender desktop/navigation e páginas protegidas conferidos; Contacto/Sobre e restantes superfícies estáticas continuam a ser fechadas. PM Real Estate mantém tracked checkout sem alterações. Produção, DNS e cutover não autorizados.


2026-10-03 — verificação do runtime local Cloudflare: o build com formato `file` e `trailingSlash: never` preserva caminhos sem redirects de barra final. GET de todas as 117 rotas construídas e de uma rota inexistente passou: públicas 200, admin 401 e desconhecida 404, sem Location. Revisão independente confirmou o handler protegido e o formato de ficheiros; fixture de regressão para `route.html` passou. Suite consolidada: 106/106 testes antes do último ajuste de navegação do calendário; Astro check 99 ficheiros, zero erros/warnings/hints. Calendário tem mais um teste para range relativo e saltos de dez anos; 15/15 testes reports passaram. Contacto conferido em desktop/mobile; Sobre e vídeos continuam em revisão. Carregamento de media permanece em curso; não houve criação bulk de documentos, publicação, deploy, DNS ou envio real.

2026-10-04 — continuidade: build de 117 rotas, 117/117 testes e check de 101 ficheiros sem diagnósticos após fecho independente da proteção de submissões duplicadas nos seis consumidores. Testes usam respostas simuladas; nenhum pedido real de formulário ou email. O retrato final de Sobre em mobile foi restaurado após confirmar que a dimensão zero inicial era anterior ao lazy-load: CTA source501.765625/target501.796875, retrato167.703125/167.6875. Marketing mantém excluídos os quatro VS atualmente em rascunho, apesar das versões antigas ainda públicas. A introdução estática permanece na coluna esquerda; não há importação ou cópia desses drafts. Rail desktop760px, secção de testemunhos1529px e todas as dez alturas de cartões coincidem; mobile difere somente no arredondamento (<0.05px), CTA501.765625/501.796875. Esta evidência é limitada às superfícies medidas e não declara aceitação global.

Sanity próprio: 780 dos 1.342 originais referenciados já conferidos por SHA-1/tamanho (729 novos, 51 reutilizados); lote de imagens continua em execução. Conteúdo permanece 11 drafts, zero publicado; os 179 drafts adicionais ainda dependem dos recibos completos e do gate do payload. Consulta read-only confirmou que ainda não existe Studio alojado neste projeto; schema MCP próprio default mantém seis tipos. PM, Webflow, produção e DNS não foram alterados.

2026-10-04 — estudo de mercado, sessão gratuita e crédito habitação comparados em 1280×720 e 390×844: retângulos de heading, descrição, primeiro campo, botão, nota legal e formulário coincidem em todas as três páginas. Preservados H5, peso strong do crédito e espaço mobile de 25vh. Três fotografias públicas originais ficam locais com tamanho/SHA-256 registados. Feedback próprio testado com respostas simuladas e CSS real; não houve submissão na origem ou envio de email. Tags de heading estáticas, newsletter CMS e rail vendido foram ajustadas à semântica original sem alterar copy.

Verificação consolidada deste candidato: build117 páginas, 121/121 testes e Astro check103 ficheiros sem diagnósticos. Blog continua em ajuste visual e revisão independente; estes resultados não declaram paridade global. Media:977/1.342 originais confirmados no último lote reconciliado; conteúdo permanece11 drafts até ao gate completo.

Blog: header, featured, newsletter e primeiro cartão têm dimensões desktop exatas; em mobile as diferenças medidas são de arredondamento inferior a0.04px. CTA517px desktop/501.796875 mobile, retrato ativo preservado. Dois artigos de amostra; altura total do índice e paginação serão conferidas após59 artigos elegíveis. Revisão independente sem problemas materiais nas alterações semânticas e contratos de feedback;9 testes focados passaram. Não houve submissão real.

2026-10-04 — páginas Vamos começar, Dossier, Guia, certificado energético e as duas campanhas de venda conferidas em desktop/mobile. Fonte e target coincidem nos retângulos medidos; certificado432px/648px de copy, campanha Uma venda treze headings/campos/controles coincidem. Recuperados defaults Apartamento/1, label de localização e linhas completas de código postal/concelho; legal permanentemente oculto dessa campanha excluído. Duas imagens públicas originais adicionais estão locais com hash de evidência. Mensagem de sucesso Seller foi movida para fora do form oculto;123/123 testes passaram, incluindo2 runtime com CSS real e respostas simuladas. Astro check104 ficheiros sem diagnósticos; build117 rotas. Media1.078/1.342 originais confirmados (1.027 novos e51 reutilizados). Importação de documentos bulk continua condicionada aos recibos completos; sem publicação/envio/cutover.

2026-10-04 — continuação das campanhas: Parcerias/PT, Partnerships/EN e Partenariats/FR têm títulos, copy, campos, consentimento, botão e nota legal conferidos em desktop/mobile; os retângulos medidos coincidem. Atualização de informação coincide em desktop/mobile após preservar o letter-spacing original do H5. Guia de férias mobile coincide nos campos e botão. Cabaz e Seleção têm campos/botões conferidos e legais permanentemente ocultos excluídos; corrigido gap residual entre Nome/Apelido desktop. Obrigado e LP/Obrigado coincidem nos retângulos medidos, incluindo o clipping mobile do original. Media de agradecimento e campanhas está local, com hashes em evidência privada.

Consumidores Home/Comprar/Reviews/Pre-listings/rail passam a preferir os campos e imagens do Sanity próprio pela identidade exata de origem. Revisão independente confirmou seleção e ordem elegíveis, sem drafts; Comprar preserva os rótulos Novidade/Novo Preço/Open House/Reservado e Preço sob consulta. O flyer recupera métricas e dez testemunhos; os quatro blocos derivados de VS em rascunho foram removidos. Geometria completa desse flyer ainda em ajuste e imagens/edição CMS em fecho.

Suite consolidada atual:136/136 testes passaram, incluindo runtime simulado de campanhas e validação dos lotes idempotentes. Media:1.193/1.342 originais já reconciliados; os restantes estão em upload/reconciliação. Contadores do checkpoint de planeamento não constituem recibos: o total confirmado deriva dos estados completed/reused-sample. Conteúdo continua11 drafts; criação dos179 adicionais aguarda o gate real completo. Webflow continua read-only; tentativa documentada de refrescar coleções foi rejeitada pela validação do conector antes da execução, sem mutação nem inferência de falta de autorização. Sem envio real, produção, DNS ou alteração PM.

2026-10-04 — importação bulk concluída no Sanity Joaquim Mota:12 pedidos criaram179 drafts sem falhas; somados às11 amostras,190 drafts e zero documentos publicados. Gate e hashes dos ficheiros/pedidos foram revistos independentemente antes da escrita. Depois da importação, comparação agregada por coleção passou: imóveis65/1262 posições de imagem, artigos59/177, testemunhos38/1, ofertas1/1, pre-listings19/6, destaques ativos8/0. Total1447 posições e1342 originais distintos;1343 assets no destino inclui um extra não referenciado das amostras. Sem revisão manual documento a documento; preservado o gate de1–2 amostras por coleção.

Snapshot próprio validado e aplicado ao preview local. Build254 rotas; gate de URLs:35 estáticas,9 drafts estáticos excluídos,10 templates, zero rotas necessárias ausentes e zero proibidas geradas. Runtime Cloudflare local:264/264 GET passaram, incluindo254 rotas,9 drafts404 e uma inexistente404; admin401/no-store, sem redirects de barra final. Suite136/136 testes; check110 ficheiros sem diagnósticos antes do último componente do rail. Evidência formal em bulk-import-validation.json, bulk-import-independent-audit.json e full-local-pages-route-evidence.json.

Flyer agora usa o conteúdo próprio por IDs exatos, rail específico com movimento e ordenação responsive, dez testemunhos, resultados e footer/prémios. Hero, secção vendidos, métricas, testemunhos e CTA/form têm dimensões medidas exatas em1280×720 e390×844; quatro blocos Marketing em rascunho permanecem excluídos. Revisão independente de contrato/código/runtime passou. Blog completo59 preserva featured/ordem/página de seis: geometria desktop coincide, dez páginas no total e última com cinco cartões. Continuação visual e integrações reais em curso. Produção/DNS/cutover/envios reais não executados; PM tracked sem alterações.

2026-10-04 — candidato consolidado:136/136 testes, Astro check111 ficheiros/zero diagnósticos, build254 e264/264 GET locais após as últimas correções. Blog mobile feed2702.75px/newsletter481.28125px coincidem com a fonte; navegação nativa para página2 mostra seis cartões e os dois controlos. Flyer logótipo hero não interativo revisto independentemente; footer lazy mobile498.78125px exato, desktop505.609375 vs fonte505.53125 (<0.08px, original raster). README e estado atual reconciliados com a importação efetiva. Preview Cloudflare home aberto e conferido; sem entrega real, publicação ou cutover.

2026-10-04 — Resend próprio configurado: chave de envio limitada a mail.joaquimmota.pt e chave separada para contactos, guardadas em .dev.vars privado/ignorado. Owner confirmou remetente geral@mail.joaquimmota.pt, Reply-To jrmota@kwportugal.pt e TODOS os testes para t@doop.pt. Contacto202/retry202/newsletter202; provider confirmou exatamente um email entregue e um contacto de teste. Domínio principal preparado antes da seleção final mantém not_started e não é usado; DNS nunca alterado. Produção não ativada.

Validação Resend final:137/137 testes com mocks, check111/zero diagnósticos e auditoria independente passou. Link iPhone mantém o preview; POST de formulários exige a origem local exata e continua dirigido só a t@doop.pt. Retry da rede local202 com a mesma chave; nenhum segredo em ficheiros tracked ou dist.

2026-10-04 — alteração Owner e D1: quatro páginas e todos os relatórios DOOP/forms/handlers removidos. Bases próprias produção/preview criadas em EU, migration aplicada e schema remoto conferido; ambas permanecem vazias. D1 local valida gravação antes de Resend, retry sem duplicação, conflito409 e receipts. Testes124/124, check101/zero diagnósticos, build250,264/264 GET. Auditoria independente passou. Email adicional de teste entregue só a t@doop.pt; nenhum DNS/cutover/deployment, alteração PM, escrita Webflow ou exclusão Sanity.

2026-10-04 — ícones Webflow: favicon PNG32×32 e webclip PNG256×256 copiados byte a byte dos links publicados originais; links presentes nas250 páginas, incluindo layouts de campanhas/utilidades. Build250 e check102/zero diagnósticos. Preview atualizado; nenhuma escrita Webflow ou publicação. Evidência: site-icons-validation.json.

2026-10-04 — navbars home corrigidas após prints Owner: hero sem divisor e menu desktop centrado (fonte597.421875×40 a1280px, target597.421875×40; x difere0.0078125px). Segunda barra sticky com gradient45deg#20457f→#162b4e, logo branco, botão original#e4e2df e sombra original; altura72px desktop/64px mobile, largura90vw. Componente Header comum com variantes overlay/blue/light; páginas interiores mantêm fundo transparente, logo colorido e botão vermelho. Menus mobile abrir/Escape conferidos para as duas variantes home; build250, check102/zero diagnósticos, suite124/124 e revisão independente passaram.

2026-10-04 — tipografia navbar unificada por instrução Owner: base partilhada Roboto500/16px/24px, igual ao hero. Browser confirmou os valores no hero, barra azul e navbar interior Comprar; menus mobile mantêm estilos próprios. Build250 passou; links/variantes/copy não alterados.

2026-10-04 — Home resultados/vendidos corrigidos: fotografia original fixa partilhada, três divisores brancos, heading à esquerda e altura automática sem corte dos cartões (696px a1280;936px a1920). Logo navbar reduzido10% em todas as variantes por instrução Owner. Rail agora exclusivamente CMS: property+sold, _updatedAt descendente, empate _id, limite5; sem fallback de IDs/imagens/copy. Cinco drafts atuais receberam apenas metadado sourceUpdatedAt original, preservando descrição/media e colocando o conjunto no topo da ordem nativa. Mantêm-se190 documentos/65 imóveis/55 vendidos; nenhum publicado. Revisão independente passou e browser confirmou os cinco/heading/fundo/altura. O preview continua dependente de refresh do snapshot e build; publicação automática por edição CMS ainda não configurada. Evidência em home-results-validation.json.

Validação final deste candidato:127/127 testes, Astro check sem diagnósticos e build250. PM tracked inalterado, Webflow só de leitura, sem envio de emails, publicação, deploy ou DNS.

2026-10-04 — CTA final unificado em ClosingCta Astro:10 consumidores/132 rotas geradas, copy e destinos dos botões preservados132/132. Composição Home mantida em1280/834/390; foto camisa branca local partilhada, contain sem cortes de cabeça/ombros. Overheading maiúsculo, botão com texto normal azul. Artigos conservam campos CMS e ausência de botão se label ausente; retirados apenas bindings de movimento antigos do CTA. Revisão independente passou;127 testes, check sem diagnósticos, build250. Evidência shared-cta-validation.json.

2026-10-04 — navbars sticky interiores Comprar/Vender/Sobre/Marketing/Reviews passam a Header blue com a mesma configuração da Home. Browser confirmou em todas gradiente original, logo branco, botão branco azul,72px e links Início/Vender/Comprar/Sobre nós; logo colorido inicial preservado. Reviews scroll top0; mobile390 barra64px, menu abrir/Escape fechar. Check sem diagnósticos e build250 passaram. Evidência interior-sticky-validation.json.

2026-10-04 — Vender resultados por instrução Owner: primeira secção reutiliza apenas os últimos cinco vendidos da Home através de SoldPropertiesSection, com fotografia fixa e heading à esquerda. Segunda secção preserva96%/60 dias/85% e mostra os números a branco; secção posterior duplicada de vendidos removida. Home mantém geometria desktop696px/cartões480px e comportamento responsive/movimento; mobile390 confirma cartões438.75px sem corte, heading à esquerda e margens originais. Revisão independente final passou, incluindo ordem responsive de localização e preferência de movimento reduzido. Check sem diagnósticos, build250 e127/127 testes. Preview local atualizado. Evidência vender-results-validation.json. Sem mutação de providers ou alteração PM.

2026-10-04 — Vender: adicionada promoção do guia entre o último vídeo (Negociação) e testemunhos, com imagem/cartão do guia Comprar, heading solicitado e link existente /guia-vender-para-comprar. Browser1280 confirma ordem/link e copy400; mobile390 confirma cartão351px, coluna única e botão contido. Check105 ficheiros sem diagnósticos; build250; auditoria independente passou após igualar peso da descrição ao Comprar. Preview atualizado; nenhuma mutação de providers. Screenshot /private/tmp/jrmota-vender-guide.jpg.

2026-10-04 — Vender margens uniformizadas por instrução Owner: removidos caps1280/1152 das secções desta página, alinhando copy/vídeos/resultados/guia/testemunhos ao eixo90vw da navbar/vendidos. Browser1920 confirma x96 em todas (antes copy416/outros384);1280 x64;mobile390 x19.5 com coluna única. Seletores explicitamente excluem marketing-page após revisão independente; PASS final. Build250 e diff check passaram. Preview atualizado. Screenshot /private/tmp/jrmota-vender-margins.jpg.

2026-10-04 — auditoria de margens no site completo e correções em Comprar/Sobre/Marketing/Reviews/Contacto: caps externos1152px removidos, preservando padding interno dos cartões e larguras de leitura/forms. Home/Blog e shells de imóveis/artigos já têm alinhamento90vw; pre-listings/campanhas mantêm composições próprias. Browser confirma todos os containers alterados em1920 x96/largura1728 e390 x19.5/largura351. Check105 sem diagnósticos, build250 e auditoria independente passaram. Evidência site-margins-validation.json. Nenhuma mutação de CMS/Webflow/PM.

2026-10-04 — hero InteriorHero partilhado em Vender/Comprar/Sobre, baseado em Vender com copy/imagens/ações preservados. Centrado verticalmente e horizontalmente por instrução Owner; conteúdo z2 acima da imagem z0/blur interno. Browser1280 confirma espaço superior/inferior igual em cada hero e erro horizontal máximo0.004px;mobile390 espaço58.5px simétrico. Imagem16:9 nas três; script único por instância e binds antigos removidos. Check106 sem diagnósticos, build250,127 testes e revisão independente passaram. Evidência shared-hero-validation.json; preview atualizado sem alterações de providers/PM.

2026-10-04 — Header Imóveis corrigido para caminho relativo /comprar#imoveis. Clique real no previewLAN confirmou http://192.168.1.14:8791/comprar#imoveis e âncora existente; mantém origem do site em qualquer ambiente. Build250 passou. Screenshot /private/tmp/jrmota-local-imoveis-link.jpg.

2026-10-04 — centragem dos quatro heroes relativa ao viewport confirmada:1280×720 centro360,390×844 centro422, em Home/Vender/Comprar/Sobre. Header inicial corrigido para72/64px para eliminar offset de88/75px do CSS global. Home reutiliza InteriorHero, vídeo original local e dois destinos preservados; bind motion restringido à imagem do hero para excluir logo slotted. Header suporta apenas light/blue. WhatsApp desktop50px (antes100),mobile70px preservado. Menu mobile ocupa390×844 nas duas variantes, links centrados, X/aria-label/expanded, scroll lock, clique de link/Escape/resize fecham e Tab circula nos controlos. Auditoria independente passou;check106 sem diagnósticos,build250 e127 testes. Evidência viewport-hero-mobile-menu-validation.json. Sem mutação de providers,PM,DNS ou deploy.

2026-10-04 — correção final Home: mesma composição InteriorHero de Vender, dois botões, vídeo no container16:9 da imagem com bindInteriorHero partilhado; removida variante vídeo full-background. Copy/ações/poster/vídeo preservados. Browser confirma centro360 em1280×720 e422 em390×844; ao scroll vídeo em reprodução,opacity1/blur0. Top navbar botão azul#20457f e lower branco#e4e2df; secundário do hero contorno vermelho,rgba0 fill e sem sombra. Check106 sem diagnósticos,build250,127 testes e revisão independente do refactor passaram. Evidência home-shared-video-hero-validation.json. Sem mutação de providers/PM.

2026-10-04 — InteriorHero sem overlay em vídeo/imagens por instrução Owner: blur é o único efeito; opacidade1 e transformnone em Home/Vender/Comprar/Sobre. Browser confirmou zerooverlays nas quatro rotas,blur inicialaprox429px e0px ao scroll; vídeo mantémopacity1. Check106 sem diagnósticos,build250,4 testes de motion e revisão independente passaram. Evidência hero-blur-only-validation.json. Providers/PM inalterados.

2026-10-04 — bloco de textos/botões InteriorHero ajustado para66% por instrução Owner, em todas as instâncias. Browser1280 largura844.796875px;mobile390 largura257.3984375px sem overflow, botões flex-wrap. Build250 passou; screenshot /private/tmp/jrmota-hero-66-percent.jpg.

2026-10-04 — correções finais InteriorHero: overlay azul restaurado apenas nas imagens com fade original; vídeo permanece sem overlay,opacity1/transformnone e blur.66% limitado a desktop;tablet/mobile90vw restaurados. Browser1280 confirma bloco844.796875px/imagemcomoverlay;390 confirma351px;Home vídeo confirma zerooverlay. Build250 passou. Screenshot /private/tmp/jrmota-hero-mobile-width-restored.jpg.

2026-10-04 — overlay das imagens InteriorHero agora desaparece emprogress0.35, o mesmo ponto em que blur500→0 termina, por instrução Owner. Vídeo continua semoverlay. Build250 e4 testes motion passaram. Verificação visual desta alteração indisponível porque CUA retornou browsers[]; não declarada como verificada no browser.

2026-10-04 — fade-in das imagens sincronizado com foco/overlay:opacity0→1 emprogress0→0.35 e permanece1 depois. Branch apenas HTMLImageElement;vídeo continuaopacity1. Reducedmotion mostra imagem imediatamente. Check106 sem diagnósticos,build250 e4 testes motion passaram; preview atualizado. Verificação visual permanece indisponível nesta ligaçãoCUA, sem claim de browser.

2026-10-04 — snap nativo de proximidade no topo da imagem/vídeo InteriorHero em mobile e desktop por instrução Owner. Root limitado às páginas com este componente; menu aberto/reduced-motion desativam snap. Overflow clip mantém o recorte visual sem criar scroller que impediria o snap no viewport. Home/Vender/Comprar/Sobre mantêm copy/media/motion e scroll livre fora da proximidade. Check106 sem diagnósticos, build250,4 testes motion e revisão independente passaram. CUA continua browsers[]; gesto real/Safari iPhone ainda por confirmar, sem claim de validação visual.

2026-10-04 — correção Owner: snap limitado a mobile<=767px; removido de desktop/tablet. Build250 passou, preview atualizado. Sem alteração aos efeitos/media ou aos opt-outs menu/reduced-motion.

2026-10-04 — Owner rejeitou também o snap mobile: removidas todas as regras de snap do InteriorHero, restaurado overflow hidden original. Scroll livre em todos os dispositivos; carrosséis e efeitos hero preservados. Build250 e diff-check passaram; preview atualizado.

2026-10-04 — Home apenas:mobile<=767px mostra imagem de Vender com overlay/fade/blur; desktop/tablet mantém vídeo semoverlay. Prop mobileImage isolada à Home; helper não atribui src nem chama load/play no mobile inicial, descarrega fonte ao resize mobile e retoma no desktop. Check108 sem diagnósticos,build250,6 testes scripts, validação HTML gerado das4 rotas e auditoria independente passaram. Outros heroes permanecem iguais, semsnap; preview atualizado. Gesto/render visual iPhone ainda não confirmado nesta ligação.

2026-10-04 — ReviewsButton comum nas7 superfícies de testemunhos: Home/Vender/Comprar/Sobre/Reviews/Marketing/pre-listings. Azul com texto claro; hidden mobile<=767px. Copy/href/target/rel preservados; outros CTAs não alterados. Ação navbar lower azul passou de branca a vermelha/texto claro por instrução Owner. Check109 sem diagnósticos,build250 e revisão independente dos7 botões passaram; preview atualizado. Render visual ainda não confirmado nesta ligação.

2026-10-04 — três botões das secções com vídeo em Vender passaram a azul/texto claro. Regra limitada a seller-page:not(marketing-page) seller-copy--media. HTML gerado confirma3 ações e destinos /estudo-de-mercado,/marketing,/dossier preservados;build250 e diff-check passaram. Preview atualizado.

2026-10-04 — espaçamento comparado com capturas originais HTML/CSS só de leitura: Vender desktop/mobile correto,tablet tinha+16px/lado (corrigido96px); Comprar process tinha64px padding+64px margem de cauda (reposto112/96/64px e removidas margens extra); Sobre ambos profiles somavam outer64+card64=128px vs source112desktop/96tablet (outer48/32;mobile compensa card5vw para total64). Preservados insets dos cartões e outras secções. Home/Vender resultados-vendidos e Comprar imóveis usam no mobile o mesmo gradient da navbar45deg#20457f→#162b4e,sem fotofixa;desktop/tablet mantêmfoto. ClosingCta comum agora tem motion sourcea55/e194 no card:scale1.25→1+opacity0→1 atéprogress.35,holdafter;reducedmotion none/1. Check109 sem diagnósticos,build250,7 testes scripts e diff-check passaram. Preview atualizado; render visual/gesto ainda não confirmado nesta ligação.

2026-10-04 — Home: eyebrows de processo/testemunhos azuis#20457f e respectivos headings vermelhos#db1430 por instrução Owner. Estilos limitados à Home; copy preservado. Auditoria independente aprovou espaçamento/motion/background; build250 e suite130/130 passaram. O antigo teste de link externo Marketing foi atualizado para verificar href/target/rel no HTML gerado do novo ReviewsButton (comportamento externo preservado). Preview atualizado, sem mutações de providers/PM/DNS/deploy.

2026-10-04 — classes comuns section-eyebrow/section-heading aplicadas Home/process,Vender3media e Comprar/process, tipografia partilhada além das cores. TestimonialsSection único substitui6consumidores (5páginas+template19prelistings), sem variantes isoladas: preservadas exatamente quotes/names/retratos/ordem de240cards em24rotas na comparação antes/depois. Comprar cardsradius0. Owner retirou botão de avaliações e /reviews: ficheiros/estilos/componenteReviewsButton removidos, gates e newsletter allowlist excluemrota;teste403semadaptadorpassou. Heroslinks#testemunhos, navdesktop/#testemunhos. Todos topHeaderslight usam mesmoslinks; Vender+Comprar mobile-only, testemunhos desktop-only. Fullscreenmenusmobile azuis/linksXbrancos, navlowerpage preservada. Check108 sem diagnósticos,build249,130/130testes e auditoria independentePASS;diffchecklimpo. RuntimeLANHome200 e /reviews404. Preview atualizado; não declarada validação visual nesta ligação. Providers/PM/Webflow/DNS/deploy inalterados.

2026-10-04 — Home<=767px tem botão vermelho/texto claro "Vamos começar" após03.Suporte, destino/vamos-comecar;desktop hidden. HTML gerado confirma1botão e posição imediatamente após o3ºarticle, sem alterarcopy/order. Build249 e diffcheckpassaram;preview atualizado.

2026-10-04 — TestimonialsSection comum: shuffle por carregamento,6desktop/3mobile, botão azul Ver mais para revelar próximos6/3 sem novo shuffle; itens/copy/CMS preservados. SoldPropertiesSection sobre-heading UMA VENDA COM SUCESSO. Vender3CTAs apósvídeo sómobile<=767px, desktop/tablet posiçãooriginal; ações duplicadas mutuamenteexclusivas porCSS. Check110 sem diagnósticos, build249, suite135/135 e auditoria independentePASS. Sem confirmação visual de browser nesta ligação; preview local atualizado.

2026-10-04 — Classe comum section-heading reposta azul#20457f por instrução Owner, sem mudar tipografia; build249 passou. HTML gerado confirma3ações mobile depois dos respetivos VideoLightbox e mesmoscopy/href das açõesdesktop. Servidores8789/8791 emescuta; renderbrowser não confirmado.

2026-10-04 — Top navbar comum inclui Início mobile-only href/ acima de Vender. Desktop preservado. Build249 e HTML gerado Home/Vender/Comprar/Sobre/Blog confirmam ordem/classe/href;diffchecklimpo.

2026-10-04 — Comprar apenas: botão vermelho Vamos começar após06.Hora de festejar, href/vamos-comecar, visível sómobile<=767px. Owner retirou pedido para Vender; ficheiroVender inalterado. Build249 e HTML gerado confirmam posição/destino/umaocorrência;diffchecklimpo.

2026-10-04 — Owner repôs vermelho#db1430 nas3ações de vídeo Vender (Agende/Conheça/Descarregue), desktop e mobile, texto claro; posição/copy/href preservados e Marketing excluído. Build249/diffcheckpassaram.

2026-10-04 — TestimonialsSection Ver mais agora outline azul#20457f, fundo transparente/texto azul/sem sombra, em todosconsumidores. Lotes/shuffle/visibilidade/interação preservados. Build249 e diffcheckpassaram.

2026-10-04 — Footer.astro comum: nota de privacidade da newsletter passa de meia largura para100%, igual ao botão Subscrever, desktop/mobile. Copy/formulário preservados. Build249 e diffcheckpassaram.

2026-10-04 — Nomes dos clientes no figcaption do TestimonialsSection comum passam a azul#20457f em todosconsumidores, quotes preservadas. Build249/diffcheckpassaram.

2026-10-04 — Nova /imoveis autorizada, independente do antigo draft: destaque do primeiroimóvel na ordem pública (snapshotmaisrecente), Newsletter CTA adaptado à novidade,9cards disponíveis mesmoPropertyGrid deComprar, BuySellGuide/ClosingCta iguaisComprar/Footer. Sem importação de rascunhos. Gate CLI ownerAddedRoutes exclusivo/imoveis;teste mantémstyle-guide bloqueado. TopHeader normaliza pathname.html, mostraInício desktop, remove rota corrente e mantém testemunhos desktop/mobile; Imóveis aponta nova/imoveis, lowerpageLinks preservados. Comprar cap6/3 CSS +outlinebranco Vermais abre/imoveis. Cards titleclamp2,img3:2cover, factsplainblue;fichaheaderfactsplainblue semfill/sombra/filter. Check115 zero diagnósticos,build250,suite139/139, HTML gerado nav6rotas/cards/CTA e auditoria independentePASS (25testesfocados). Preview local atualizado; sem claimrenderbrowser. DadosCMS/sourceproviders/PM/DNS/deploy inalterados.

2026-10-04 — Owner: badges Novo Preço azul#20457f/textobranco; Reservado branco/textoazul (correçãofinal). Classes explícitas noPropertyGrid comum; demaisbadges mantêmvermelho. Build250/diffcheckpassaram.

2026-10-04 — PropertyGrid comum: removido ícone de localização antes do concelho por instrução Owner; concelho/freguesia/copy preservados em Comprar e /imoveis. Build250 e testesproperty-directory2/2passaram;diffchecklimpo.

2026-10-04 — Preços nos cards e ficha usam formato português com espaços nosmilhares/vírguladecimal e€final (300 000 €), Preço sobconsulta preservado. Card área mostra apenas valor+m², detalhe mantém ÁreaBruta/Útil. NovoPreço agora branco/textovermelho#db1430 porcorreçãoOwner;Reservadobranco/azul preservado. Build250, assertionspreçosPT/HTMLcard/detalhe e diffcheckpassaram.

2026-10-04 — CorreçãofinalOwner: Reservado fundoazul#20457f/textobranco. NovoPreço mantém branco/vermelho. Build250/diffcheckpassaram.

2026-10-04 — Indicadores dos cards PropertyGrid ficam numa linha única (quartos/banhos/garagem/área). Removidos padding/margens dos antigosbadges e min-width173px da área; gap6px/space-between, semfill. Build250/diffcheckpassaram.

2026-10-04 — ID imóvel/reference noscards e detalhe reduzido12px/18px,peso400 semnegrito. Visibilidade/copy preservados. Build250/diffcheckpassaram.

2026-10-04 — Indicadores numéricos de cards e cabeçalhodetalhe só renderizam com valor finito>0; vazio/null/zero/stringzero semicon/bloco. Helpercomum; check118 zero diagnósticos,build250,4testesfocados verificam vazio/zero/positivo e HTMLcard/detalhe. Cards alinhadosàesquerda gap12px emvezspace-between, mantendo linhaúnica porcorreçãoOwner.

2026-10-04 — Gap entre indicadores doscards aumentado12→20px porOwner; alinhamentoesquerda/linhaúnica preservados. Build250/diffcheckpassaram.

2026-10-04 — Destaque maisrecente /imoveis: título reduzido40pxdesktop/32pxmobile, divider apósbotão seguidoindicadores. PropertyFacts comum extraído/reusado peloscards e destaque, mantém gap20/ícone-número6 e omitezeros. Check120 semdiagnósticos,build250,4testesfocados e HTMLsequênciabotão-divider-indicadores passaram;diffchecklimpo.

2026-10-04 — Owner todoslinksImóveis apontam/imoveis: navbar jácorreta; heroComprar e CTA02.Queroverosimóveis atualizados. PreservadaâncoraComprar#imoveis para URLsantigas; payloadCMS/sourceproveniênciainalterado, CTAURL mapeadonarenderização. Build250/HTMLlinks/diffcheckpassaram.

2026-10-04 — Destaque /imoveis mostra preçoPT/concelho/freguesia/ID abaixo título e antesbotão, mesmosdados/classes doscards, ID12pxpeso400, semíconelocalização. Preçosobconsulta preservado. Build250/HTMLsequênciaevalores/diffcheckpassaram.

2026-10-04 — Destaque usa badgevermelhopermanente e seleçãoCMS active maisrecente_updatedAt, excluireserved/sold. Grelhaagora todosactive ordenadosediçãodesc; sold/expiredCancelledexcluídos;reservadomantidonagrelha. Dataimporttimestampdestination também influenciaordem nesta fase; snapshotrenovado/rebuild aplicaediçõesCMS. Própriosdraftsdestino conservadospara preview; sourceeligibilityinalterado. Check121 zero diagnósticos/build250/suite144/144/auditoriaindependentePASS. Newslettercard Blog/Imóveis agora mesmo gradient45deg#20457f→#162b4e da navbar;build250/diffcheckpassaram. Semrenderbrowserconfirmado.

2026-10-04 — Conheçaesteimóvel no destaque passa outlinevermelho#db1430/textovermelho/fundotransparente/semsombra; BlogLermais inalterado. Build250/diffcheckpassaram.

2026-10-04 — Implementadas as correções Owner de Imóveis: destaque entre últimos três elegíveis sorteado no browser em cada carregamento; card mobile comum com badge “Imóvel em destaque”; grelha separada em seis imóveis, guia e restantes. SiteIcon usa @lucide/astro para SVG estático; mantidos logos oficiais, WhatsApp e ilustrações. Galeria 3:2/cover e lightbox contain; mapa, vídeo e visita virtual condicionados a fonte não vazia; características com ícones semânticos. Certificado desktop/mobile, números pretos e ajustes de título/espaçamento mobile aplicados. Nenhuma alteração em Webflow, Sanity, PM Real Estate ou produção. Build 250 páginas e 151 testes passaram; revisão independente detetou pseudo-elementos antigos do menu, neutralizados no Header comum. Não foi possível inspeção visual porque nenhum browser estava disponível para automação.

2026-10-04 — Owner: indicadores de área usam Lucide Scan nos cards e na Área Bruta da ficha; Área Útil usa Scan Square. Revisão do destaque mobile corrigiu heading para H1 com a mesma apresentação do card comum; seleção aleatória define imagens de candidatos ocultos como lazy.

2026-10-04 — Fecho destas correções: Astro check 127 ficheiros sem diagnósticos, build 250 páginas, suite 151/151, diff-check limpo e revisão independente PASS após correções de H1 mobile e pseudo-elementos do menu. Preview /imoveis respondeu HTTP 200 em 8791. Verificação visual por browser continua indisponível.

2026-10-04 — Correção final Owner: secção do imóvel em destaque oculta no mobile (até 767px), desktop preservado. Mobile começa na newsletter, seguida de seis imóveis, guia e restantes imóveis.

2026-10-04 — Owner: imagem do card de destaque desktop volta a preencher toda a altura disponível até às margens interiores verticais, com cover e sem proporção fixa. Cards da grelha mantêm 3:2; destaque continua oculto no mobile.

2026-10-04 — Reposto divisor do cabeçalho da ficha no mobile: a linha antes dos indicadores estava definida apenas a partir de 768px. Agora também aparece até 767px, largura completa e mesma cor desktop.

2026-10-04 — Indicadores no cabeçalho mobile da ficha: removido padding residual dos antigos badges; gap entre características 20px, igual ao card comum. Intervalo ícone/valor de 6px preservado.

2026-10-04 — Cabeçalho mobile da ficha: padding inferior reduzido de calc(64px + 5vw) para 5vw, alinhado às restantes margens interiores.

2026-10-04 — Owner: título mobile da ficha 24px/28.8px; capa abre a galeria partilhada no desktop e mobile, selecionando a própria capa no lightbox (sem duplicar se já existe). Navegação/fecho/restauro de foco preservados. Indicadores nos cards usam peso 300, igual ao header, sem negrito.

2026-10-04 — Corrigida formatação efetiva da galeria: frame do botão 3:2 com overflow hidden; img absoluto 100% largura/altura e cover, sobrepondo altura intrínseca dos atributos HTML. Removidas proporções legadas 100/66 e padding inferior 6.5px. Lightbox mantém contain/proporção original. Índices das miniaturas são posicionais, preservando ocorrências repetidas.

2026-10-04 — Owner: fotografia do agente no formulário de contacto do imóvel substituída pela mesma imagem de camisa branca usada no ClosingCta (/assets/closing-jm.png), no componente CmsPropertyInquiry comum.

2026-10-04 — Owner: galeria na ficha começa com seis fotos mobile / nove desktop; botão “Ver mais fotos” outline azul revela todas as restantes. Lightbox mantém todas as imagens desde o início, artigos não recebem limite. Botão aparece apenas quando há fotos adicionais no respetivo viewport.

2026-10-04 — Complemento Owner: o controlo da galeria alterna “Ver mais fotos” / “Ver menos fotos” e permite recolher novamente para seis/nove, mantendo estilo outline azul e aria-expanded.

2026-10-04 — Owner: consentimento comercial no CmsPropertyInquiry corrigido para “Joaquim Mota Consultor Imobiliário”. Pesquisa nos componentes, páginas, dados CMS e handler dos formulários não encontrou outras referências a PS Real Estate Team; identidade legal Somos Real Estate preservada.

2026-10-04 — Owner: ao recolher a galeria, scroll automático ao topo da grelha, com margem de 80px para a navbar; smooth por defeito e sem animação quando prefere movimento reduzido.

2026-10-04 — Owner: galeria movida para antes da descrição na ficha de imóvel (correção final Owner).

2026-10-04 — Correção final Owner: secção Fotografias volta para imediatamente depois da descrição; âncora #galeria preservada e título/label público passa a “Fotografias”.

2026-10-04 — Vídeos: 28 links YouTube responderam oEmbed 200; corrigida renderização de watch/youtu.be/shorts/live para /embed preservando start e linkCMS original, também em artigos. Visitas: 20 Matterport consultados (18 HTTP410, 1 HTTP404, 1 HTTP200); 1 Webobook excedeu timeout. Owner determina preservar todos os links Matterport. Mapas: 53 HTTP200; iframe kwpt013603 comparado com Webflow e URL idêntica. Antecipado carregamento na ficha com eager/preconnect Google; navegação real/tempos no browser não verificados por indisponibilidade de browser. Fotografias fica depois de Descrição.

2026-10-04 — Labels CE / Certificado Energético passam a font-weight 500 para equilíbrio com o traço dos ícones, mantendo azul e valor do certificado com peso atual.

2026-10-04 — Owner: link “O que dizem os nossos clientes” oculto em todos os menus mobile abertos, mantendo desktop. Regra no Header comum aplicada a todas as variantes.

2026-10-04 — Blog Owner: títulos dos cards azuis. Primeiro destaque com título 40px desktop/32px mobile, subtítulo CMS e início do artigo com truncagem responsiva. No mobile imagem após subtítulo, seguida de excerto e ação. CSS limitado ao Blog não altera destaque de Imóveis.

2026-10-04 — Cards Blog alinham espaçamento aos imóveis: padding interno 32px; grelha desktop 48px/32px, tablet 5vw/32px e mobile 45px/26px. Removida margem extra de 7px após a imagem.

- Blog: excertos nos cards normais limitados a duas linhas apenas no desktop; no artigo em destaque, duas linhas em mobile e espaço disponível até ao padding no desktop.

2026-10-04 — Blog desktop: ação Ler mais alinhada ao fundo de cada card, com o corpo a ocupar a altura disponível na grelha.

2026-10-04 — Correção Owner: excerto do último artigo limitado a três linhas no desktop e duas no mobile, mantendo Ler mais no fundo em desktop.

2026-10-04 — Blog: artigo mais recente exclusivo do destaque, grelha a partir do penúltimo com paginação ajustada. No desktop, imagem a toda a largura com painel branco sobreposto no canto inferior esquerdo; mobile mantém composição existente.

2026-10-04 — Owner: destaque Blog desktop regressa a duas colunas 50/50, conteúdo à esquerda centrado verticalmente e imagem à direita; sem sobreposição. Mobile mantém imagem 3:2 e composição atual.

2026-10-04 — Detalhe de artigo: removido o ancestral de scroll criado por overflow:hidden (substituído por clip) para a newsletter sticky acompanhar o viewport no desktop e terminar na grelha do artigo. Mobile/tablet mantêm posição estática.

2026-10-04 — Contacto do imóvel desktop em coluna lateral desde o header até antes do CTA, sticky com top 80px e gap inferior 64px. Entrada sincronizada com a opacidade do header. Newsletter do artigo e contacto do imóvel usam o gradiente azul da navbar. Mobile mantém formulário após conteúdo.
