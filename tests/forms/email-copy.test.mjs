import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLeadEmails } from '../../functions/api/email-copy.ts';

function lead(route, fields = {}) { return { formType: 'contact', route, idempotencyKey: 'copy-test', fields: { name: 'Ana Silva', email: 'ana@example.test', phone: '910000000', consent: true, ...fields } }; }
const subjects = {
  '/vamos-comecar': 'Novo contato - Outro',
  '/uma-venda-com-sucesso': 'Novo pedido de avaliação - Uma venda com sucesso',
  '/lp-flyer-uma-venda-com-sucesso': 'Novo pedido de avaliação - Uma venda com sucesso',
  '/quanto-vale-a-sua-casa-hoje': 'Novo pedido de avaliação - Quanto vale a sua casa hoje',
  '/estudo-de-mercado': 'Novo pedido de avaliação - Estudo de mercado',
  '/sessao-gratuita': 'Novo pedido de sessão gratuita',
  '/parcerias': 'Novo pedido de parceria - Português',
  '/partnerships': 'Novo pedido de parceria - Inglês',
  '/partenariats': 'Novo pedido de parceria - Francês',
  '/lp/smillingstreet': 'Nova inscrição - Smillingstreet',
  '/lp/cabaz-de-natal': 'Nova participação - Cabaz de Natal',
  '/lp/atualizacao-de-informacao': 'Atualização de informação - Ana Silva',
  '/credito-habitacao': 'Nova lead de crédito habitação — Joaquim Mota',
  '/lp/guia-de-ferias': 'Novo pedido de guia - Guia de férias',
  '/guia-vender-para-comprar': 'Novo pedido de guia - Vender para comprar',
  '/dossier': 'Novo pedido - Dossier',
  '/imoveis/kwpt013603': 'Novo contacto sobre imóvel - KWPT013603',
};
for (const [route, subject] of Object.entries(subjects)) test(`approved email copy: ${route}`, () => {
  const result = buildLeadEmails(lead(route));
  assert.equal(result.consultant.subject, subject);
  assert.ok(result.consultant.text.startsWith(route === '/credito-habitacao' ? 'Olá,\n\nTens uma nova lead para crédito habitação do Joaquim Mota:' : 'Olá Mota, tens uma nova lead do site:'));
  assert.ok(result.consultant.text.endsWith('Cumprimentos,\nTiago Freitas'));
  assert.ok(result.customer.text.includes('Ana'));
  assert.ok(result.customer.text.includes('Joaquim Mota'));
  assert.ok(!result.customer.text.includes('Obrigado por contactar'));
  for (const item of Object.values(result)) {
    assert.ok(item.subject);
    assert.ok(item.text);
    assert.ok(item.html.includes('<html lang='));
  }
});

test('contact intent supports structured selection and the historical message', () => {
  for (const intent of ['Comprar', 'Vender', 'Outro']) {
    assert.equal(buildLeadEmails(lead('/vamos-comecar', { contactSubject: intent })).consultant.subject, `Novo contato - ${intent}`);
    assert.equal(buildLeadEmails(lead('/vamos-comecar', { message: `Assunto do contacto: ${intent}` })).consultant.subject, `Novo contato - ${intent}`);
  }
  assert.ok(buildLeadEmails(lead('/vamos-comecar', { contactSubject: 'Vender' })).customer.text.includes('conhecer os seus objetivos e ajudá-lo nos próximos passos.'));
});

test('all four valuation routes use the same approved customer body', () => {
  const routes = ['/uma-venda-com-sucesso', '/lp-flyer-uma-venda-com-sucesso', '/estudo-de-mercado', '/quanto-vale-a-sua-casa-hoje'];
  assert.equal(new Set(routes.map((route) => buildLeadEmails(lead(route)).customer.text)).size, 1);
});

test('partner copy retains Portugal only in English and French without Northern or nord', () => {
  const pt = buildLeadEmails(lead('/parcerias')).customer;
  assert.ok(pt.text.includes('Recebemos o teu pedido de parceria. Entraremos em contacto contigo para conhecer os seus objetivos e combinar os próximos passos.'));
  assert.ok(!pt.text.includes('Portugal'));
  const en = buildLeadEmails(lead('/partnerships')).customer;
  const fr = buildLeadEmails(lead('/partenariats')).customer;
  assert.ok(en.text.includes('in Portugal.'));
  assert.ok(fr.text.includes('au Portugal.'));
  assert.ok(!en.text.includes('Northern'));
  assert.ok(!fr.text.includes('nord'));
  assert.ok(en.html.includes('lang="en"'));
  assert.ok(fr.html.includes('lang="fr"'));
});

test('download email links exactly match the three approved Drive documents', () => {
  for (const [route, id] of [['/lp/guia-de-ferias', '1Cy4G9-0rLHbO8CG0AlEbvaxPhql1yl4L'], ['/guia-vender-para-comprar', '1_AqC5yAUDz8l3xWBaTYLC5OA3EfRF0kF'], ['/dossier', '1wi6qHnQzGuJOpk2uK1WyfFUzRGUcAndF']]) {
    const url = `https://drive.google.com/file/d/${id}/view?usp=sharing`;
    const customer = buildLeadEmails(lead(route)).customer;
    assert.ok(customer.text.includes(url));
    assert.ok(customer.html.includes(`href="${url}"`));
  }
});

test('all user text and authoritative property context are HTML escaped', () => {
  const result = buildLeadEmails(lead('/imoveis/kwpt013603', { name: '<script>Ana</script>', message: '<img src=x onerror="alert(1)">', address: 'Rua & Cia', bedrooms: '2' }), { title: '<svg onload="alert(1)">', reference: 'KW&013603' });
  for (const item of Object.values(result)) {
    assert.ok(!item.html.includes('<script>'));
    assert.ok(!item.html.includes('<svg onload'));
    assert.ok(!item.html.includes('<img src=x'));
  }
  assert.ok(result.consultant.html.includes('Rua &amp; Cia'));
  assert.ok(result.consultant.text.includes('Morada: Rua & Cia'));
  assert.ok(result.consultant.text.includes('Quartos: 2'));
  assert.ok(result.customer.text.includes('https://joaquimmota.pt/imoveis/kwpt013603'));
});

test('credit consultant notification matches approved content and separate name labels', () => {
  const result = buildLeadEmails(lead('/credito-habitacao', { firstName: 'Ana Maria', lastName: 'Silva' })).consultant;
  assert.equal(result.text, 'Olá,\n\nTens uma nova lead para crédito habitação do Joaquim Mota:\n\nNome: Ana Maria\nApelido: Silva\nEmail: ana@example.test\nTelefone: 910000000\n\nCumprimentos,\nTiago Freitas');
});

test('unknown and newsletter routes have no implicit lead email', () => {
  assert.throws(() => buildLeadEmails(lead('/blog')), /No approved/);
  assert.throws(() => buildLeadEmails(lead('/unknown')), /No approved/);
});
