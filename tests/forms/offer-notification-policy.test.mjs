import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createFormHandler, createResendAdapter } from '../../functions/api/forms.ts';
import { LeadStore } from '../../functions/api/leads.ts';
import { leadSchemaSql } from './lead-migrations.mjs';

const referral = 'Conhece alguém que esteja a vender ou a comprar casa?';
const intent = 'Está a pensar vender ou a comprar casa?';
const answers = (first = 'Não', second = 'Não') => `${referral}: ${first}\n${intent}: ${second}`;
const now = () => new Date('2026-11-09T12:00:00Z');
const catalog = () => ({ 'oferta-teste': { title: 'Campanha confiável', startDate: '2026-11-01', endDate: '2026-12-16', confirmationMessage: 'Recebemos a sua participação, [Nome], na [Campanha].' } });
const config = { RESEND_SEND_API_KEY: 'mock-send-key', RESEND_FROM: 'Joaquim Mota <geral@mail.joaquimmota.pt>', RESEND_REPLY_TO: 'jrmota@kwportugal.pt', FORMS_RECIPIENT: 'jrmota@kwportugal.pt', FORMS_DELIVERY_MODE: 'live' };
function payload(route = '/lp/cabaz-de-natal', message = answers()) {
  return { formType: 'leadMagnet', route, fields: { firstName: 'Ana', lastName: 'Costa', name: 'Ana Costa', email: 'ana@example.invalid', phone: '912345678', message, consent: true } };
}
function request(body, key = 'offer-notification-policy-test') {
  return new Request('https://joaquimmota.pt/api/forms', { method: 'POST', headers: { origin: 'https://joaquimmota.pt', 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body) });
}
function database(t, schema = leadSchemaSql) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close()); sqlite.exec(schema);
  const d1 = { prepare(sql) {
    let values = [];
    return { bind(...next) { values = next; return this; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; } };
  } };
  return { sqlite, d1 };
}
function delivery(offers, failureCount = 0) {
  const calls = [];
  const adapter = createResendAdapter(async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, headers: init.headers, body });
    if (failureCount-- > 0) return new Response('{}', { status: 503 });
    return new Response(JSON.stringify({ data: body.map((_item, index) => ({ id: `mock-receipt-${index}` })) }), { status: 200 });
  }, { offers });
  return { calls, adapter };
}
function setup(t, { offers = catalog(), failureCount = 0 } = {}) {
  const { sqlite, d1 } = database(t);
  const transport = delivery(offers, failureCount);
  return { sqlite, offers, ...transport, env: { ...config, LEADS_DB: d1 }, handler: createFormHandler(transport.adapter, { offers, now }) };
}

test('new nonlead offers persist daily policy/title and send only immediate customer confirmation', async t => {
  for (const [route, title] of [['/lp/cabaz-de-natal', 'Cabaz de Natal 2026'], ['/lp/oferta-teste', 'Campanha confiável']]) {
    const r = setup(t);
    assert.equal((await r.handler({ request: request(payload(route)), env: r.env })).status, 202);
    assert.equal(r.calls.length, 1); assert.equal(r.calls[0].body.length, 1);
    assert.deepEqual(r.calls[0].body[0].to, ['ana@example.invalid']);
    assert.equal(r.calls[0].headers['idempotency-key'], 'offer-notification-policy-test');
    const row = r.sqlite.prepare('SELECT * FROM leads').get();
    assert.equal(row.consultant_notification_mode, 'daily'); assert.equal(row.offer_campaign_title, title);
    assert.equal(row.message, answers()); assert.equal(row.delivery_status, 'accepted');
    assert.equal(row.provider_id, 'mock-receipt-0');
    assert.equal((await r.handler({ request: request(payload(route)), env: r.env })).status, 202);
    assert.equal(r.calls.length, 1); assert.equal(r.sqlite.prepare('SELECT count(*) AS count FROM leads').get().count, 1);
    if (route === '/lp/cabaz-de-natal') assert.match(r.calls[0].body[0].text, /Recebemos a sua participação no sorteio do nosso cabaz de Natal/);
  }
});
test('either referral or own-intent positive answer sends consultant plus customer and opts into digest', async t => {
  for (const route of ['/lp/cabaz-de-natal', '/lp/oferta-teste']) {
    for (const positive of ['Sim, a comprar', 'Sim, a vender']) {
      for (const message of [answers(positive, 'Não'), answers('Não', positive), answers(positive, positive)]) {
        const r = setup(t);
        assert.equal((await r.handler({ request: request(payload(route, message)), env: r.env })).status, 202);
        assert.equal(r.calls[0].body.length, 2);
        assert.deepEqual(r.calls[0].body[0].to, ['jrmota@kwportugal.pt']);
        assert.deepEqual(r.calls[0].body[1].to, ['ana@example.invalid']);
        assert.equal(r.sqlite.prepare('SELECT consultant_notification_mode FROM leads').get().consultant_notification_mode, 'immediate-and-daily');
      }
    }
  }
});
test('non-offer leads keep individual two-message routing and existing mortgage recipients', async t => {
  for (const [formType, route] of [['contact', '/vamos-comecar'], ['valuation', '/uma-venda-com-sucesso'], ['mortgage', '/credito-habitacao'], ['partnership', '/parcerias'], ['leadMagnet', '/dossier']]) {
    const r = setup(t);
    const body = { ...payload(route, answers('Sim, a comprar', 'Não')), formType };
    assert.equal((await r.handler({ request: request(body), env: r.env })).status, 202);
    assert.equal(r.calls[0].body.length, 2);
    assert.deepEqual(r.calls[0].body[0].to, formType === 'mortgage' ? ['jrmota@kwportugal.pt', 'da@somoscredito.pt'] : ['jrmota@kwportugal.pt']);
    assert.deepEqual({ ...r.sqlite.prepare('SELECT consultant_notification_mode, offer_campaign_title FROM leads').get() }, { consultant_notification_mode: 'individual', offer_campaign_title: null });
  }
});
test('mode/title cannot be chosen by browser fields or top-level policy properties', async t => {
  const r = setup(t);
  for (const field of ['consultantNotificationMode', 'consultant_notification_mode', 'offerCampaignTitle', 'offer_campaign_title']) {
    const body = payload(); body.fields[field] = 'individual';
    assert.equal((await r.handler({ request: request(body), env: r.env })).status, 422);
  }
  assert.equal(r.calls.length, 0); assert.equal(r.sqlite.prepare('SELECT count(*) AS count FROM leads').get().count, 0);
  const body = { ...payload(), notificationPolicy: { consultantNotificationMode: 'individual', offerCampaignTitle: 'Forged' } };
  assert.equal((await r.handler({ request: request(body), env: r.env })).status, 202);
  assert.equal(r.calls[0].body.length, 1);
  assert.equal(r.sqlite.prepare('SELECT offer_campaign_title FROM leads').get().offer_campaign_title, 'Cabaz de Natal 2026');
});
test('failed native delivery retries with the persisted title, one-message payload and same provider key', async t => {
  const r = setup(t, { failureCount: 1 });
  const body = payload('/lp/oferta-teste');
  assert.equal((await r.handler({ request: request(body), env: r.env })).status, 503);
  r.sqlite.prepare("UPDATE leads SET updated_at = datetime('now', '-61 seconds')").run();
  r.offers['oferta-teste'].title = 'Título editado depois';
  assert.equal((await r.handler({ request: request(body), env: r.env })).status, 202);
  assert.equal(r.calls.length, 2); assert.deepEqual(r.calls[0], r.calls[1]);
  assert.match(r.calls[1].body[0].text, /Campanha confiável/); assert.doesNotMatch(r.calls[1].body[0].text, /Título editado/);
  assert.deepEqual({ ...r.sqlite.prepare('SELECT consultant_notification_mode, offer_campaign_title FROM leads').get() }, { consultant_notification_mode: 'daily', offer_campaign_title: 'Campanha confiável' });
});
test('migration preserves existing inflight nonlead offer as individual and keeps its original two-message retry', async t => {
  const originalSchema = await readFile(new URL('../../migrations/0001_create_leads.sql', import.meta.url), 'utf8');
  const policyMigration = await readFile(new URL('../../migrations/0002_offer_notification_policy.sql', import.meta.url), 'utf8');
  for (const route of ['/lp/cabaz-de-natal', '/lp/oferta-teste']) {
    const { sqlite, d1 } = database(t, originalSchema);
    const body = payload(route);
    const normalized = { formType: body.formType, route: body.route, fields: { email: body.fields.email, consent: true, firstName: 'Ana', lastName: 'Costa', name: body.fields.name, phone: body.fields.phone, message: body.fields.message } };
    const serialized = JSON.stringify(normalized);
    const key = 'legacy-inflight-offer-policy';
    const submission = { ...normalized, idempotencyKey: key };
    const originalDelivery = delivery(catalog());
    await originalDelivery.adapter.notifyLead(submission, config); // Existing default is the original two-email batch.
    sqlite.prepare("INSERT INTO leads (idempotency_key, payload_hash, form_type, route, email, fields_json, delivery_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'failed', datetime('now', '-61 seconds'))").run(key, createHash('sha256').update(serialized).digest('hex'), body.formType, body.route, body.fields.email, serialized);
    sqlite.exec(policyMigration);
    assert.deepEqual({ ...sqlite.prepare('SELECT consultant_notification_mode, offer_campaign_title FROM leads').get() }, { consultant_notification_mode: 'individual', offer_campaign_title: null });
    const transport = delivery(catalog());
    const handler = createFormHandler(transport.adapter, { offers: catalog(), now });
    const env = { ...config, LEADS_DB: d1 };
    assert.equal((await handler({ request: request(body, key), env })).status, 202);
    assert.equal(transport.calls[0].body.length, 2);
    assert.deepEqual(transport.calls, originalDelivery.calls);
    assert.equal((await handler({ request: request(body, key), env })).status, 202);
    assert.equal(transport.calls.length, 1);
    assert.equal(sqlite.prepare("SELECT count(*) AS count FROM leads WHERE consultant_notification_mode IN ('daily', 'immediate-and-daily')").get().count, 0, 'Historical rows never enter the new digest');
  }
});
test('LeadStore returns persisted routing policy when a retry proposes another mode/title', async t => {
  const { sqlite, d1 } = database(t);
  const store = new LeadStore(d1);
  const submission = { ...payload(), idempotencyKey: 'persisted-policy-store' };
  const original = { consultantNotificationMode: 'daily', offerCampaignTitle: 'Título original' };
  const first = await store.reserveAndClaim(submission, original);
  assert.equal(first.kind, 'claimed'); assert.deepEqual(first.notificationPolicy, original);
  await store.markFailed(submission.idempotencyKey, first.claimToken);
  sqlite.prepare("UPDATE leads SET updated_at = datetime('now', '-61 seconds')").run();
  const retried = await store.reserveAndClaim(submission, { consultantNotificationMode: 'individual', offerCampaignTitle: 'Outra' });
  assert.equal(retried.kind, 'claimed'); assert.deepEqual(retried.notificationPolicy, original);
});
test('customer-only batches retain test routing and require exactly one accepted receipt', async () => {
  const policy = { consultantNotificationMode: 'daily', offerCampaignTitle: 'Cabaz de Natal 2026' };
  const submission = { ...payload(), idempotencyKey: 'single-receipt-policy' };
  for (const receipt of [{ data: [] }, { data: [{ id: 'one' }, { id: 'two' }] }]) {
    const adapter = createResendAdapter(async () => new Response(JSON.stringify(receipt), { status: 200 }));
    await assert.rejects(adapter.notifyLead(submission, config, policy), /Incomplete email receipt/);
  }
  const transport = delivery(catalog());
  await transport.adapter.notifyLead(submission, { ...config, FORMS_DELIVERY_MODE: 'test', FORMS_TEST_RECIPIENT: 'test@example.invalid' }, policy);
  assert.equal(transport.calls[0].body.length, 1); assert.deepEqual(transport.calls[0].body[0].to, ['test@example.invalid']);
  const { FORMS_RECIPIENT: _unused, ...customerConfig } = config;
  await transport.adapter.notifyLead(submission, customerConfig, policy);
  assert.deepEqual(transport.calls[1].body[0].to, ['ana@example.invalid']);
});
