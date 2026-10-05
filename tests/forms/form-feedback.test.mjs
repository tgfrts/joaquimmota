import assert from 'node:assert/strict';
import test from 'node:test';
import { formSuccessMessage } from '../../src/scripts/form-feedback.ts';

test('approved feedback distinguishes valuation, session, mortgage, campaign and property requests', () => {
  const valuation = 'Obrigado, Ana! Recebemos o seu pedido de avaliação. Entraremos em contacto consigo para confirmar os detalhes do imóvel.';
  for (const route of ['/uma-venda-com-sucesso', '/quanto-vale-a-sua-casa-hoje', '/lp-flyer-uma-venda-com-sucesso', '/estudo-de-mercado']) assert.equal(formSuccessMessage(route, ' Ana '), valuation);
  assert.equal(formSuccessMessage('/vamos-comecar', 'Ana'), 'Obrigado, Ana! Recebemos o seu contacto. Entraremos em contacto consigo em breve.');
  assert.equal(formSuccessMessage('/sessao-gratuita', 'Ana'), 'Obrigado, Ana! Recebemos o seu pedido. Entraremos em contacto consigo para combinar o dia e horário.');
  assert.match(formSuccessMessage('/credito-habitacao', 'Ana'), /A equipa da Somos Crédito entrará em contacto/);
  assert.match(formSuccessMessage('/lp/smillingstreet', 'Ana'), /Recebemos a sua inscrição.*usufruir do desconto/);
  assert.equal(formSuccessMessage('/lp/atualizacao-de-informacao', 'Ana'), 'Obrigado, Ana! Recebemos a atualização dos seus dados.');
  assert.match(formSuccessMessage('/imoveis/kwpt026529', 'Ana'), /esclarecer as suas questões ou combinar uma visita/);
});

test('partnership feedback follows the page language and Portuguese personal address', () => {
  assert.equal(formSuccessMessage('/parcerias', 'Ana'), 'Obrigado, Ana! Recebemos o teu pedido de parceria. Entraremos em contacto contigo em breve.');
  assert.equal(formSuccessMessage('/partnerships', 'Ana'), 'Thank you, Ana! We’ve received your partnership request. We’ll contact you shortly.');
  assert.equal(formSuccessMessage('/partenariats', 'Ana'), 'Merci, Ana ! Nous avons reçu votre demande de partenariat. Nous vous contacterons prochainement.');
});
