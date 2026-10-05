# Emails de formulários — Joaquim Mota

Copy aprovado pelo Owner em 2026-10-05, implementado em `functions/api/email-copy.ts`.

Cada pedido de contacto, avaliação, parceria, campanha ou crédito gera uma notificação interna e uma confirmação ao cliente. Newsletter mantém captura de contacto sem email automático, fora deste âmbito.

- Vamos começar: Comprar/Vender/Outro seleciona copy e assunto interno `Novo contato - …`.
- Avaliações: uma-venda-com-sucesso, lp-flyer-uma-venda-com-sucesso, estudo-de-mercado, quanto-vale-a-sua-casa-hoje partilham confirmação; assunto interno identifica a página. Quanto vale usa formulário completo.
- Sessão gratuita: pedido de agendamento, sem data marcada automaticamente.
- Parcerias: confirmações em português, inglês ou francês; notificação interna em português indica o idioma.
- Smillingstreet: inscrição e contacto posterior para usufruir do desconto; confirmação na própria página.
- Cabaz de Natal: participação e confirmação na própria página, sem redirect para obrigado-oferta.
- Atualização de informação: receção dos dados, sem prometer atualização automática de ficha existente.
- Imóveis: título e referência obtidos no servidor a partir do mesmo snapshot CMS de Astro; link canónico na confirmação.
- Crédito: texto original adaptado e destinatário adicional da@somoscredito.pt apenas em modo live.
- Guia de férias, guia vender para comprar e dossier: link Drive aprovado no email e redirect após aceitação do pedido.

Todas as notificações internas começam por “Olá Mota, tens uma nova lead do site:” e terminam “Cumprimentos, Tiago Freitas”, exceto crédito, que mantém a abertura específica aprovada. Clientes recebem assinatura Joaquim Mota, localizada nas parcerias. Reply-To jrmota@kwportugal.pt e remetente geral@mail.joaquimmota.pt.

## Destinatários e estado

Base, preview e configuração production mantêm `FORMS_DELIVERY_MODE=test`, `FORMS_TEST_RECIPIENT=t@doop.pt`: AMBOS os emails seguem exclusivamente para esse destino, incluindo crédito. Não foi ativado envio para clientes, consultor ou Somos Crédito em produção. Futuro live exige alteração explícita de configuração e FORMS_RECIPIENT=jrmota@kwportugal.pt; não é ativado automaticamente por nome de ambiente.

## Entrega

A notificação e confirmação são enviadas numa chamada Resend /emails/batch com chave idempotente. A API só aceita quando recebe os dois IDs do provider e os persiste na D1, mantendo a proteção de retry existente. HTTP202 confirma aceitação do provider, não entrega final em inbox. HTML escapa campos de utilizador; versões texto incluídas. Links de download são fixos aprovados, nunca URLs fornecidos pelo formulário.

Contrato de provider: https://resend.com/docs/api-reference/emails/send-batch-emails

Verificação deste candidato: testes mock da API/Resend, runtime dos handlers em JSDOM, build e Astro check, revisão independente. Nenhum email real enviado nesta implementação; entrega real não foi confirmada neste candidato.
