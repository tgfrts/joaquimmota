# Joaquim Mota — inventário e plano aceite

Data: 3 de outubro de 2026. Estado: inventário/plano aceite pelo Owner; fundação autorizada com exclusão obrigatória de TODOS os rascunhos da origem.

## Autoridade e isolamento

- Origem: https://joaquimmota.pt, Webflow ID 63638f133928eb2761a4ecfb, estritamente em leitura.
- Destino indicado pelo Owner: tgfrts/joaquimmota; pasta sites/jrmota, agora checkout Git independente ligado ao destino.
- PM Real Estate permanece em standby. Não transferir as decisões editoriais, schemas, credenciais, conteúdo, tokens ou identidade desse site.
- Preservar layout, copy, imagens, comportamento, SEO, rotas, slugs, campanhas e âncoras da experiência publicada.
- Excluir variantes permanentemente ocultas e resíduos do DOM. Incluir elementos revelados por menus, galerias, formulários e outros estados de interação.
- GPT-6 Luna para tarefas delimitadas e mecânicas, conforme correção do Owner.
- Cutover, DNS e desativação de Webflow continuam sujeitos a autorização explícita.

## Ligações confirmadas

Resend apresenta três ligações: PM Real Estate, Joaquim Mota e doop. A seleção real usa link_id explícito. Só Joaquim Mota foi consultado: mail.joaquimmota.pt verificado, envio ativo, eu-west-1.

Sanity: Joaquim Mota, geral@joaquimmota.pt, provider sanity, OAuth. Projeto próprio Joaquim Mota Site, kaq1vd9b; dataset production público.

Nenhum recurso foi criado/alterado e nenhum email foi enviado.

## Páginas e publicação

Webflow: 54 páginas/templates, sendo 9 rascunhos excluídos, 35 páginas não rascunho e 10 templates CMS. draft:false isoladamente não foi tratado como prova de publicação.

GET das 35 rotas não rascunho: 34 respostas 200 e /admin/dashboard com 401. /401 e /404 respondem 200 com os respetivos templates de sistema. As nove rotas estáticas em rascunho respondem 404, incluindo /imoveis. A preservação destes comportamentos será testada na candidata.

- /admin/dashboard
- /quanto-vale-a-sua-casa-hoje
- /uma-venda-com-sucesso
- /lp-flyer-uma-venda-com-sucesso
- /lp/guia-de-ferias
- /guia-vender-para-comprar
- /lp/obrigado-evento
- /lp/smillingstreet
- /partnerships
- /partenariats
- /parcerias
- /credito-habitacao
- /lp/cabaz-de-natal
- /lp/atualizacao-de-informacao
- /lp/obrigado-oferta
- /lp/oferta-selecao
- /doop/relatorios-de-atividades
- /doop/relatorios-de-visita
- /obrigado
- /lp/obrigado
- /oferta-certificado-energetico
- /contacto
- /dossier
- /sessao-gratuita
- /estudo-de-mercado
- /vamos-comecar
- /vender
- /comprar
- /sobre
- /blog
- /marketing
- /reviews
- /
- /404
- /401

Rascunhos estáticos excluídos:

- /lp/evento-smillingstreet
- /lp/oferta-cruzeiro-pontes
- /lp/cabaz-pascoa
- /lp/obrigado-barbara-tinoco
- /lp/oferta-barbara-tinoco
- /imoveis
- /somos-credito
- /estudo-de-mercadob
- /style-guide

## Coleções CMS

A listagem de edição e a listagem explicitamente live foram consultadas em lote. Todos os 229 caminhos CMS live foram verificados por GET, sem submeter formulários.

| Coleção/caminho | Itens na edição | Rascunhos na edição | Itens live |
| --- | ---: | ---: | ---: |
| vouvender | 19 | 0 | 24 |
| ofertas | 1 | 0 | 1 |
| open-house | 3 | 0 | 3 |
| consultores | 1 | 0 | 1 |
| blog-categories | 4 | 0 | 4 |
| post | 67 | 8 | 60 |
| faq | 11 | 0 | 11 |
| vs-destaques | 22 | 4 | 22 |
| imoveis | 74 | 9 | 65 |
| testemunhos | 38 | 0 | 38 |

Os 229 caminhos responderam 200, sem redirecionamento HTTP. 149 têm conteúdo próprio (24 Pre-Listings, 60 artigos, 65 imóveis), 1 tem conteúdo de oferta e 79 têm um shell genérico. Um representante de cada uma das seis coleções com estes shells foi confirmado no browser: página branca, sem conteúdo visível, sem redirecionamento nem conteúdo tardio. Resposta 200 não foi usada para inventar conteúdo nos templates vazios.

### Divergências de edição/publicação

- Pre-Listings: 24 live versus 19 na edição; cinco URLs publicadas não têm registo correspondente na listagem de edição.
- Blog: oito rascunhos na edição; um deles mantém uma versão live em /post/como-garantir-uma-mudanca-de-casa-rapida-neste-verao.
- VS Destaques: quatro rascunhos na edição mantêm versões live: video-e-matterport, marketing-nas-redes-sociais, uma-base-de-dados-com-clientes-compradores-qualificados e fotografia-profissional.
- Nas restantes coleções, os totais live reconciliam com os itens não rascunho na edição.

DECISÃO DO OWNER: não importar nenhuma página, imóvel ou artigo em rascunho; a exclusão de rascunhos aplica-se à seleção CMS inteira. O artigo live cujo registo de edição é rascunho fica excluído. As quatro versões de destaques em rascunho também não entram na seleção de importação. As URLs históricas excluídas continuam registadas para disposição explícita, sem redirects inventados. Os cinco Pre-Listings sem estado de edição confirmado ficam pendentes e não serão escritos por inferência. Templates vazios devem preservar a experiência existente, sem criar páginas editoriais novas. Este tratamento não implica copiar os blocos ocultos desses itens.

### Modelação proposta

Conteúdo estruturado local a este projeto; apresentação e composição em Astro.

- Imóveis: identidade/slug, descrição, estado, preço, características, áreas, certificado energético, localização, fotografias, vídeo/Matterport/mapa e referência Open House quando efetivamente usados.
- Artigos: slug, título, resumo/subtítulo, conteúdo, categorias, leitura, imagens e CTA/vídeo/galeria quando usados.
- Pre-Listings: slug, localização, tipologia, imagem/galeria e copy efetivamente publicada; respeitar a dependência de tracking.
- Ofertas: copy e imagem da oferta.
- Open Houses: dados do evento ligados a imóveis; não criar uma nova experiência de página.
- Consultores, categorias, FAQs, destaques e testemunhos: somente os campos utilizados na experiência visível; manter as URLs publicadas mesmo que os templates sejam vazios.
- Nenhum campo de page builder ou abstração entre sites.

## Imagens — contagem de referência da origem

Contagens de campos Image/MultiImage na edição, intersectadas com os IDs live. Ainda são referências de origem, não uma afirmação de que cada imagem esteja visível. Não incluem imagens de layout/CSS/embeds ou conteúdo rich text; falta fonte de edição para cinco Pre-Listings.

| Coleção | Referências de imagem | Referências em galerias | URLs de imagem distintas |
| --- | ---: | ---: | ---: |
| vouvender | 6 | 0 | 6 |
| ofertas | 1 | 0 | 1 |
| open-house | 0 | 0 | 0 |
| consultores | 1 | 0 | 1 |
| blog-categories | 0 | 0 | 0 |
| post | 180 | 0 | 142 |
| faq | 0 | 0 | 0 |
| vs-destaques | 5 | 0 | 4 |
| imoveis | 1262 | 1198 | 1194 |
| testemunhos | 1 | 0 | 1 |

Imóveis: 65 live, 64 fotografias de destaque e 1.198 posições de galeria. Não inventar a imagem de destaque em falta nem normalizar a origem silenciosamente. A deduplicação de ficheiros não pode diminuir as posições de galeria ou mudar a ordenação.

A seleção final de imagens será estabelecida pela paridade dos itens de teste e pelos papéis efetivamente visíveis. Preservar qualidade da origem e usar entrega responsiva; o código Webflow não será usado como implementação alvo.

## Formulários e integrações

Foram lidos 129 registos de definições de formulários em duas páginas, sem ler submissões. Removendo duplicados de página/elemento, há 43 ocorrências candidatas: 33 em páginas/templates não rascunho, 8 em rascunhos e 2 sem correspondência à listagem atual. Esta é uma contagem do CMS/API, não de formulários visíveis aceites.

A inspeção no browser já confirmou:
- Newsletter do footer com email, nome e apelido; newsletter email-only distinta em /blog.
- Captação/contacto e downloads; campos contextuais e seletores variam por campanha.
- Relatórios de atividades e visitas, com campos próprios e links Google Sheets; nenhum registo foi aberto.
- Menu mobile a 390 × 844, carrosséis, lightbox YouTube em /vender e seletores nativos.
- Não foram observadas FAQs/disclosures nas páginas principais auditadas. Não copiar FAQs só por existirem na coleção.
- Algumas consent boxes aparecem inicialmente marcadas na origem. Não aplicar por herança as alterações editoriais do PM Real Estate.

Dependências observadas em HTML publicado e/ou browser:
- Make em /uma-venda-com-sucesso, /lp/atualizacao-de-informacao e nos dois relatórios.
- Google Drive nos fluxos de guias/downloads e entrevista; Google Sheets nos relatórios.
- Calendly em /sessao-gratuita; mapa Google em /contacto; YouTube nos lightboxes.
- Facebook Pixel no código do site.
- Pre-Listings: código lê o parâmetro t e o slug, e condiciona um POST de tracking a doop-tools.pages.dev/api/track. Não foi fornecido t nem feito esse POST de teste.

A configuração de edição do Webflow contém redirects que não coincidem sempre com o HTML publicado. Por exemplo, /dossier tem um ficheiro Drive publicado diferente do redirect devolvido na definição de formulário da API. Para o alvo, a experiência publicada é a referência. Nenhum envio, integração de backend ou email foi testado; entrega, persistência e automatismos posteriores são pontos a reconciliar antes de implementar esses fluxos.

## URLs e SEO

- Preservar as 35 rotas estáticas publicadas. O ledger de 229 caminhos CMS live não é uma autorização de importação: rascunhos de origem e cinco Pre-Listings sem estado confirmado ficam excluídos. Preservar os caminhos elegíveis mesmo fora da navegação; não criar páginas nos caminhos base dos templates.
- Tratar campanhas, flyers, guias, agradecimentos e Pre-Listings como URLs protegidas candidatas.
- Preservar as âncoras publicadas; inventário automático de anchors/links contém candidatos do DOM que devem ser filtrados pela experiência visível. A paginação publicada do blog usa ?51fb55cf_page=2; preservar a semântica da query e a experiência de paginação.
- Apex e www respondem diretamente, sem normalização por redirect no GET observado.
- /sitemap.xml responde 404 em ambos os hosts; /robots.txt responde 200 com corpo vazio.
- Não foram encontrados canonical links nos documentos GET auditados.
- Consultores, FAQs, VS Destaques e Testemunhos têm NOINDEX, NOFOLLOW no código de edição; categorias têm noindex. Reconciliar com os metadados publicados.
- Preservar títulos, descriptions, OG e robots publicados. Não adicionar uma mudança SEO ao abrigo da migração.

## Plano de execução após validação

1. Constituir projeto Git independente em sites/jrmota ligado exclusivamente a tgfrts/joaquimmota; criar documentação/estado próprios, sem alterar o checkout PM Real Estate.
2. Implementar Astro e o conjunto mínimo de schemas estruturados no Sanity próprio, derivados dos campos e usos reais. Static output por defeito; JavaScript apenas para as interações necessárias.
3. Para cada uma das dez coleções, selecionar um ou dois itens reais representativos (ou o único disponível) e provar paridade completa de copy, campos visíveis, imagens/ordem, URL, SEO e interação no template/contexto público correspondente.
4. Importar o restante conteúdo autorizado em lote. Depois dos exemplos 100% replicados, reconciliar somente contagens de itens e fotografias por coleção; não abrir os restantes itens Sanity um a um. Separar referências/posições de galeria de ficheiros únicos.
5. Reproduzir as páginas estáticas e os templates publicados, com identidade/design locais, preservando os fluxos existentes e usando a conta Resend própria onde aplicável. Server execution apenas onde necessário.
6. Build e testes pertinentes; verificar rotas/anchors/SEO e comportamento em mobile/tablet/desktop, com revisão independente da candidata. A verificação de rotas em lote não é revisão individual de itens no Sanity.
7. Apresentar preview e diferenças/exceções para aceitação. Preparar cutover/rollback sem alterar produção. DNS/cutover só mediante autorização explícita.

## Evidência e limites

Artefactos de descoberta ficam temporariamente em /private/tmp para não modificar PM Real Estate nem iniciar o projeto antes do checkpoint:
- joaquimmota-inventory-manifest.json: IDs, rotas e slugs live por coleção.
- joaquimmota-discovery-baseline.json: metadados, schemas, formulários candidatos e contagens.
- joaquimmota-live-cms-http-audit.json: GET de todas as 229 URLs CMS.
- joaquimmota-public-dependencies.json: metadados, anchors, dependências e formulários HTML candidatos.
- joaquimmota-draft-static-http-audit.json: GET das nove rotas estáticas em rascunho, todas 404.

Limite da inspeção visual desta sessão: /, /vender, /comprar, /blog, /marketing, /reviews, /vamos-comecar, /dossier, /lp/guia-de-ferias, /lp/smillingstreet e os dois relatórios foram auditados em browser, além dos seis representantes de templates vazios. As restantes páginas estáticas têm verificação HTTP/HTML/metadados, mas ainda não uma inspeção visual completa. A paginação, todos os lightboxes, galerias e fluxos pós-submissão ainda não foram certificados. Esses limites ficam registados para a execução/paridade; não são afirmações de aceitação funcional.

O inventário de publicação está fechado para esta captura. O Owner aceitou o âmbito com exclusão obrigatória dos rascunhos de origem; os campos realmente usados e a seleção de media serão reconciliados nos exemplos de teste, sem importar resíduos apenas por existirem na API. A fundação Astro está em implementação e tem um primeiro build; a reprodução completa e a paridade dos exemplos ainda não estão demonstradas. A aprovação deste inventário não autoriza DNS, produção ou desativação Webflow.


## Evidência visual adicional — 2026-10-03

Comprar e Vender: a secção `section-faq2` tem `display:none` e dimensões zero no navegador, tanto em desktop como a 390×844. FAQs são resíduos permanentemente ocultos, excluídos do conteúdo alvo. Esta verificação não exclui disclosures ativos noutras páginas.
