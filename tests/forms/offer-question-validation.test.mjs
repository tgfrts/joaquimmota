import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createFormHandler } from '../../functions/api/forms.ts';

const referral = 'Conhece alguém que esteja a vender ou a comprar casa?';
const intent = 'Está a pensar vender ou a comprar casa?';
const answers = (first = 'Não', second = 'Não') => `${referral}: ${first}\n${intent}: ${second}`;
const offers = { 'oferta-perguntas': { title: 'Oferta', startDate: '2026-12-01', endDate: '2026-12-16', confirmationMessage: 'Obrigado, [Nome].' } };
const now = () => new Date('2026-12-05T12:00:00Z');
const request = (route, message) => new Request('https://joaquimmota.pt/api/forms', {
  method: 'POST', headers: { origin: 'https://joaquimmota.pt', 'content-type': 'application/json', 'idempotency-key': 'offer-question-validation' },
  body: JSON.stringify({ formType: 'leadMagnet', route, fields: { name: 'Ana Costa', email: 'ana@example.invalid', phone: '912345678', consent: true, ...(message !== undefined ? { message } : {}) } }),
});

test('Cabaz and native offer selects require explicit choices in the actual component markup', async () => {
  for (const name of ['PublicCampaignPage', 'DynamicOfferPage']) {
    const source = await readFile(new URL(`../../src/components/${name}.astro`, import.meta.url), 'utf8');
    const selects = [...source.matchAll(/<select name="(?:referral|intent)"[\s\S]*?<\/select>/g)].map(match => match[0]);
    assert.equal(selects.length, 2);
    const dom = new JSDOM(`<form>${selects.join('')}</form>`);
    try {
      const form = dom.window.document.querySelector('form');
      const [first, second] = form.querySelectorAll('select');
      assert.equal(first.value, ''); assert.equal(second.value, '');
      assert.equal(first.validity.valueMissing, true); assert.equal(second.validity.valueMissing, true);
      assert.equal(form.checkValidity(), false);
      first.value = 'Não'; assert.equal(form.checkValidity(), false);
      second.value = 'Não'; assert.equal(form.checkValidity(), true);
      assert.deepEqual([...first.options].slice(1).map(option => option.value), ['Não', 'Sim, a comprar', 'Sim, a vender']);
    } finally { dom.window.close(); }
  }
});
test('both offer routes reject missing, placeholder, invalid and duplicated answers before D1 or delivery', async () => {
  const invalid = [undefined, null, '', 'Mensagem sem respostas', `${referral}: Não`, `${intent}: Não`];
  for (const value of ['', ' ', 'null', 'Selecione uma opção', 'Talvez', 'Sim', 'sim, a comprar', 'Não'.normalize('NFD')]) {
    invalid.push(answers(value, 'Não'), answers('Não', value));
  }
  invalid.push(`${answers()}\n${referral}: Não`, `${answers()}\n${intent}: Sim, a comprar`, `${answers()}\n  ${referral.toUpperCase()} : Não`);
  for (const question of [referral, intent]) {
    for (const variant of [question.toLowerCase(), question.replace(' a ', '  a '), question.normalize('NFD')]) {
      invalid.push(answers().replace(question, variant), `${answers()}\n${variant}: Não`);
    }
  }
  for (const route of ['/lp/cabaz-de-natal', '/lp/oferta-perguntas']) {
    let reads = 0, sends = 0;
    const handler = createFormHandler({ async notifyLead() { sends++; assert.fail('Invalid answers must not send'); }, async captureNewsletter() { assert.fail('not newsletter'); } }, { offers, now });
    for (const message of invalid) {
      const response = await handler({ request: request(route, message), env: { get LEADS_DB() { reads++; assert.fail('Invalid answers must not access storage'); } } });
      assert.equal(response.status, 422, `${route}: ${JSON.stringify(message)}`);
    }
    assert.equal(reads, 0); assert.equal(sends, 0);
  }
});
test('all explicit No and positive choices retain their stored message and reach delivery once', async t => {
  const migration = await readFile(new URL('../../migrations/0001_create_leads.sql', import.meta.url), 'utf8');
  for (const route of ['/lp/cabaz-de-natal', '/lp/oferta-perguntas']) {
    for (const first of ['Não', 'Sim, a comprar', 'Sim, a vender']) {
      for (const second of ['Não', 'Sim, a comprar', 'Sim, a vender']) {
        const sqlite = new DatabaseSync(':memory:');
        t.after(() => sqlite.close()); sqlite.exec(migration);
        const message = `${answers(first, second)}\nMorada: Rua A\nCódigo Postal: 4000-001\nConcelho: Porto`;
        const env = { LEADS_DB: { prepare(sql) {
          let values = [];
          return { bind(...next) { values = next; return this; },
            async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
            async first() { return sqlite.prepare(sql).get(...values) ?? null; } };
        } } };
        let sends = 0;
        const handler = createFormHandler({ async notifyLead(submission) {
          sends++;
          assert.equal(submission.fields.message, message);
          assert.equal(sqlite.prepare('SELECT message FROM leads').get().message, message, 'Persisted before mock delivery');
          return { providerId: 'mock-only-receipt' };
        }, async captureNewsletter() { assert.fail('not newsletter'); } }, { offers, now });
        assert.equal((await handler({ request: request(route, message), env })).status, 202);
        assert.equal((await handler({ request: request(route, message), env })).status, 202);
        assert.equal(sends, 1);
      }
    }
  }
});
test('answer whitespace is accepted without rewriting history; other lead magnets remain unchanged', async () => {
  const handler = createFormHandler({ async notifyLead() { assert.fail('Missing DB must stop delivery'); }, async captureNewsletter() { assert.fail('not newsletter'); } }, { offers, now });
  for (const route of ['/lp/cabaz-de-natal', '/lp/oferta-perguntas']) {
    assert.equal((await handler({ request: request(route, answers('  Não  ', ' Sim, a vender ')), env: {} })).status, 503, 'Valid answers reach missing DB gate');
  }
  for (const route of ['/dossier', '/guia-vender-para-comprar', '/lp/guia-de-ferias', '/lp/smillingstreet', '/lp/atualizacao-de-informacao']) {
    assert.equal((await handler({ request: request(route), env: {} })).status, 503, route);
  }
  assert.equal((await handler({ request: request('/lp/not-published', answers()), env: {} })).status, 403);
  for (const date of ['2026-11-30T12:00:00Z', '2026-12-17T12:00:00Z']) {
    const outside = createFormHandler({ async notifyLead() { assert.fail('closed'); }, async captureNewsletter() { assert.fail('closed'); } }, { offers, now: () => new Date(date) });
    assert.equal((await outside({ request: request('/lp/oferta-perguntas', answers()), env: {} })).status, 403);
  }
});
