import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createFormHandler } from '../../functions/api/forms.ts';
import { LeadStore } from '../../functions/api/leads.ts';

const migration = await readFile(new URL('../../migrations/0001_create_leads.sql', import.meta.url), 'utf8');
const key = 'lead-d1-test-key-20261004';
const payload = { formType: 'contact', route: '/contacto', fields: { name: 'Ana', email: 'ana@doop.test', message: 'Olá', consent: true } };

function sqliteD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migration);
  return {
    sqlite,
    d1: {
      prepare(sql) {
        let values = [];
        return {
          bind(...next) { values = next; return this; },
          async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; },
          async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        };
      },
    },
  };
}

function request(body = payload, idempotencyKey = key) {
  return new Request('https://www.joaquimmota.pt/api/forms', {
    method: 'POST',
    headers: { origin: 'https://www.joaquimmota.pt', 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(body),
  });
}

function setup() {
  const { sqlite, d1 } = sqliteD1();
  const calls = [];
  const adapter = {
    async captureNewsletter(submission) { calls.push(['newsletter', submission]); return { providerId: 'contact-1' }; },
    async notifyLead(submission) { calls.push(['lead', submission]); return { providerId: 'email-1' }; },
  };
  return { sqlite, calls, handler: createFormHandler(adapter), env: { LEADS_DB: d1 } };
}

test('D1-compatible leads schema persists every validated field before delivery and stores provider state', async () => {
  const { sqlite, calls, handler, env } = setup();
  assert.equal((await handler({ request: request(), env })).status, 202);
  assert.equal(calls.length, 1);
  const lead = sqlite.prepare('SELECT form_type, route, property_reference, name, email, message, consent, delivery_status, provider_id, safe_error FROM leads').get();
  assert.deepEqual({ ...lead }, { form_type: 'contact', route: '/contacto', property_reference: null, name: 'Ana', email: 'ana@doop.test', message: 'Olá', consent: 1, delivery_status: 'accepted', provider_id: 'email-1', safe_error: null });
});

test('a validated property route is persisted as its source-stable property reference', async () => {
  const { sqlite, handler, env } = setup();
  const propertyPayload = { ...payload, route: '/imoveis/kwpt036155' };
  assert.equal((await handler({ request: request(propertyPayload, 'lead-d1-property-20261004'), env })).status, 202);
  assert.equal(sqlite.prepare('SELECT property_reference FROM leads').get().property_reference, 'kwpt036155');
});

test('a same-key retry does not add a row or repeat delivery, while a changed payload is rejected', async () => {
  const { sqlite, calls, handler, env } = setup();
  assert.equal((await handler({ request: request(), env })).status, 202);
  assert.equal((await handler({ request: request(), env })).status, 202);
  const changed = { ...payload, fields: { ...payload.fields, name: 'Maria' } };
  assert.equal((await handler({ request: request(changed), env })).status, 409);
  assert.equal(calls.length, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM leads').get().count, 1);
});

test('concurrent same-key submissions claim only one delivery', async () => {
  const { sqlite, env } = setup();
  let release;
  let calls = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const slowHandler = createFormHandler({
    async captureNewsletter() { return { providerId: 'contact-concurrent' }; },
    async notifyLead() { calls += 1; await gate; return { providerId: 'email-concurrent' }; },
  });
  const first = slowHandler({ request: request(), env });
  await new Promise((resolve) => setImmediate(resolve));
  const second = await slowHandler({ request: request(), env });
  release();
  assert.equal((await first).status, 202);
  assert.equal(second.status, 503);
  assert.equal(calls, 1);
  assert.equal(sqlite.prepare('SELECT delivery_status FROM leads').get().delivery_status, 'accepted');
});

test('a provider response without a nonempty acceptance id is never a false success', async () => {
  const { sqlite, env } = setup();
  const handler = createFormHandler({ async captureNewsletter() { return {}; }, async notifyLead() { return {}; } });
  assert.equal((await handler({ request: request(), env })).status, 503);
  assert.deepEqual({ ...sqlite.prepare('SELECT delivery_status, provider_id, safe_error FROM leads').get() }, { delivery_status: 'failed', provider_id: null, safe_error: 'delivery_failed' });
});

test('a stale lease under 23 hours can recover, while an older ambiguous attempt remains manual', async () => {
  const recover = setup();
  assert.equal((await recover.handler({ request: request(), env: recover.env })).status, 202);
  recover.sqlite.prepare("UPDATE leads SET delivery_status = 'failed', updated_at = datetime('now', '-61 seconds')").run();
  assert.equal((await recover.handler({ request: request(), env: recover.env })).status, 202);
  assert.equal(recover.calls.length, 2);

  const manual = setup();
  assert.equal((await manual.handler({ request: request(), env: manual.env })).status, 202);
  manual.sqlite.prepare("UPDATE leads SET delivery_status = 'failed', created_at = datetime('now', '-23 hours', '-1 second'), updated_at = datetime('now', '-61 seconds')").run();
  assert.equal((await manual.handler({ request: request(), env: manual.env })).status, 503);
  assert.equal(manual.calls.length, 1);

  const oldPending = setup();
  oldPending.sqlite.prepare("INSERT INTO leads (idempotency_key, payload_hash, form_type, route, email, consent, fields_json, created_at, updated_at) VALUES (?, ?, 'contact', '/contacto', 'ana@doop.test', 1, ?, datetime('now', '-23 hours', '-1 second'), datetime('now', '-23 hours', '-1 second'))").run('lead-d1-test-key-20261004', (await (async () => { const bytes = new TextEncoder().encode(JSON.stringify({ formType: 'contact', route: '/contacto', fields: { email: 'ana@doop.test', consent: true, name: 'Ana', message: 'Olá' } })); const d = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join(''); })()), JSON.stringify({ formType: 'contact', route: '/contacto', fields: { email: 'ana@doop.test', consent: true, name: 'Ana', message: 'Olá' } }));
  assert.equal((await oldPending.handler({ request: request(), env: oldPending.env })).status, 503);
  assert.equal(oldPending.calls.length, 0);
});

test('new idempotency keys create separate canonical payload records', async () => {
  const { sqlite, calls, handler, env } = setup();
  assert.equal((await handler({ request: request(), env })).status, 202);
  assert.equal((await handler({ request: request(payload, 'lead-d1-new-key-20261004'), env })).status, 202);
  assert.equal(calls.length, 2);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM leads').get().count, 2);
});

test('a late worker cannot finalize a recovered claim owned by another request', async () => {
  const { sqlite, d1 } = sqliteD1();
  const store = new LeadStore(d1);
  const submission = { ...payload, idempotencyKey: 'lead-d1-lease-token-20261004' };
  const first = await store.reserveAndClaim(submission);
  assert.equal(first.kind, 'claimed');
  sqlite.prepare("UPDATE leads SET delivery_status = 'failed', updated_at = datetime('now', '-61 seconds')").run();
  const second = await store.reserveAndClaim(submission);
  assert.equal(second.kind, 'claimed');
  await assert.rejects(store.markAccepted(submission.idempotencyKey, first.claimToken, 'late-receipt'));
  await store.markAccepted(submission.idempotencyKey, second.claimToken, 'current-receipt');
  assert.deepEqual({ ...sqlite.prepare('SELECT delivery_status, provider_id FROM leads').get() }, { delivery_status: 'accepted', provider_id: 'current-receipt' });
});

test('an implausibly large provider acceptance id is rejected and retained as a safe failure', async () => {
  const { sqlite, env } = setup();
  const handler = createFormHandler({ async captureNewsletter() { return { providerId: 'x'.repeat(201) }; }, async notifyLead() { return { providerId: 'x'.repeat(201) }; } });
  assert.equal((await handler({ request: request(), env })).status, 503);
  assert.deepEqual({ ...sqlite.prepare('SELECT delivery_status, provider_id, safe_error FROM leads').get() }, { delivery_status: 'failed', provider_id: null, safe_error: 'delivery_failed' });
});

test('missing D1 never accepts a form and delivery failures are retained as safe failures', async () => {
  const adapter = { async captureNewsletter() { return { providerId: 'contact-concurrent' }; }, async notifyLead() { throw new Error('provider unavailable'); } };
  const noDb = await createFormHandler(adapter)({ request: request(), env: {} });
  assert.equal(noDb.status, 503);

  const { sqlite, env } = setup();
  const failing = createFormHandler(adapter);
  assert.equal((await failing({ request: request(), env })).status, 503);
  assert.deepEqual({ ...sqlite.prepare('SELECT delivery_status, safe_error FROM leads').get() }, { delivery_status: 'failed', safe_error: 'delivery_failed' });
});
