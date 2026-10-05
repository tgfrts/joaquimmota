import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createFormHandler, createResendAdapter } from '../../functions/api/forms.ts';

const key = 'submission-20261003-001';
const migration = await readFile(new URL('../../migrations/0001_create_leads.sql', import.meta.url), 'utf8');
function formEnv(overrides = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migration);
  return { LEADS_DB: { prepare(sql) {
    let values = [];
    return {
      bind(...next) { values = next; return this; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    };
  } }, ...overrides };
}
const leadPayload = {
  formType: 'contact',
  route: '/vamos-comecar',
  fields: { name: 'Ana', email: 'ANA@example.test', message: 'Olá\n<script>alert(1)</script>', consent: true },
};

function request(payload, headers = {}) {
  return new Request('https://www.joaquimmota.pt/api/forms', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://www.joaquimmota.pt', 'idempotency-key': key, ...headers },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

function mockAdapter() {
  const calls = [];
  return {
    calls,
    async captureNewsletter(submission) { calls.push(['newsletter', submission]); return { providerId: 'contact-mock' }; },
    async notifyLead(submission) { calls.push(['lead', submission]); return { providerId: 'email-mock' }; },
  };
}

test('allows newsletter capture only on an approved public route', async () => {
  const adapter = mockAdapter();
  const response = await createFormHandler(adapter)({
    request: request({ formType: 'newsletter', route: '/blog', fields: { email: 'visitor@example.test' } }),
    env: formEnv(),
  });

  assert.equal(response.status, 202);
  assert.equal(adapter.calls.length, 1);
  assert.equal(adapter.calls[0][0], 'newsletter');
  assert.equal(adapter.calls[0][1].fields.email, 'visitor@example.test');
  assert.equal('consent' in adapter.calls[0][1].fields, false);
});

test('rejects routes outside the server allowlist before invoking an adapter', async () => {
  const adapter = mockAdapter();
  const response = await createFormHandler(adapter)({
    request: request({ formType: 'newsletter', route: '/doop/relatorios-private', fields: { email: 'visitor@example.test' } }),
    env: formEnv(),
  });

  assert.equal(response.status, 403);
  assert.equal(adapter.calls.length, 0);
});

test('allows only eligibility-gated CMS property and article routes', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const property = await handler({ request: request({ ...leadPayload, route: '/imoveis/kwpt036155' }), env: formEnv() });
  const article = await handler({ request: request({ formType: 'newsletter', route: '/post/a-proposta-mais-alta-pode-nao-ser-a-melhor', fields: { email: 'visitor@example.test', firstName: 'Ana', lastName: 'Silva' } }), env: formEnv() });
  const eligibleNearMatch = await handler({ request: request({ formType: 'newsletter', route: '/post/como-garantir-uma-mudanca-de-casa-rapida-neste-verao-2024', fields: { email: 'visitor@example.test' } }), env: formEnv() });
  const excludedNearMatch = await handler({ request: request({ formType: 'newsletter', route: '/post/como-garantir-uma-mudanca-de-casa-rapida-neste-verao', fields: { email: 'visitor@example.test' } }), env: formEnv() });

  assert.equal(property.status, 202);
  assert.equal(article.status, 202);
  assert.equal(eligibleNearMatch.status, 202);
  assert.equal(excludedNearMatch.status, 403);
  assert.deepEqual(adapter.calls[1][1].fields, { email: 'visitor@example.test', firstName: 'Ana', lastName: 'Silva' });
});

test('rejects removed offer and reviews routes before invoking an adapter', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const removedOffer = { ...leadPayload, formType: 'leadMagnet', route: '/ofertas/vinho-e-fado' };
  const removedCampaign = { ...leadPayload, formType: 'leadMagnet', route: '/lp/oferta-selecao' };
  const removedReviews = { formType: 'newsletter', route: '/reviews', fields: { email: 'visitor@example.test' } };
  assert.equal((await handler({ request: request(removedOffer), env: formEnv() })).status, 403);
  assert.equal((await handler({ request: request(removedCampaign), env: formEnv() })).status, 403);
  assert.equal((await handler({ request: request(removedReviews), env: formEnv() })).status, 403);
  assert.equal(adapter.calls.length, 0);
});

test('rejects a cross-site origin before handling a submission', async () => {
  const adapter = mockAdapter();
  const response = await createFormHandler(adapter)({ request: request(leadPayload, { origin: 'https://attacker.example' }), env: formEnv() });

  assert.equal(response.status, 403);
  assert.equal(adapter.calls.length, 0);
});

for (const origin of ['http://localhost:8789', 'http://127.0.0.1:8789']) {
  test(`allows the Cloudflare Pages local-preview origin ${origin}`, async () => {
    const adapter = mockAdapter();
    const response = await createFormHandler(adapter)({ request: request(leadPayload, { origin }), env: formEnv() });

    assert.equal(response.status, 202);
    assert.equal(adapter.calls.length, 1);
  });
}

test('rejects malformed fields and missing idempotency keys', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const unsupported = await handler({
    request: request({ ...leadPayload, fields: { ...leadPayload.fields, recipient: 'attacker@example.test' } }),
    env: formEnv(),
  });
  const noKey = await handler({
    request: request(leadPayload, { 'idempotency-key': '' }),
    env: formEnv(),
  });

  assert.equal(unsupported.status, 422);
  assert.equal(noKey.status, 400);
  assert.equal(adapter.calls.length, 0);
});

test('requires explicit true consent for every non-newsletter submission before invoking an adapter', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const missingFields = { ...leadPayload.fields };
  delete missingFields.consent;
  const missing = await handler({ request: request({ ...leadPayload, fields: missingFields }), env: formEnv() });
  const unchecked = await handler({ request: request({ ...leadPayload, fields: { ...leadPayload.fields, consent: false } }), env: formEnv() });
  const wrongType = await handler({ request: request({ ...leadPayload, fields: { ...leadPayload.fields, consent: 'true' } }), env: formEnv() });

  assert.equal(missing.status, 422);
  assert.equal(unchecked.status, 422);
  assert.equal(wrongType.status, 422);
  assert.equal(adapter.calls.length, 0);
});

test('rejects malformed JSON without handing it to an adapter', async () => {
  const adapter = mockAdapter();
  const response = await createFormHandler(adapter)({ request: request('{not json'), env: formEnv() });

  assert.equal(response.status, 400);
  assert.equal(adapter.calls.length, 0);
});

test('stops reading oversized requests and preserves the 413 response', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const oversized = await handler({ request: request('a'.repeat(16_385)), env: formEnv() });
  const declared = await handler({ request: request('{}', { 'content-length': '17000' }), env: formEnv() });
  assert.equal(oversized.status, 413);
  assert.equal(declared.status, 413);
  assert.equal(adapter.calls.length, 0);
});

test('normalizes the visitor reply-to address without permitting header injection', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const accepted = await handler({ request: request(leadPayload), env: formEnv() });
  const injected = await handler({
    request: request({ ...leadPayload, fields: { ...leadPayload.fields, email: 'visitor@example.test\r\nBcc: attacker@example.test' } }),
    env: formEnv(),
  });

  assert.equal(accepted.status, 202);
  assert.equal(adapter.calls[0][1].fields.email, 'ana@example.test');
  assert.equal(adapter.calls[0][1].fields.consent, true);
  assert.equal(injected.status, 422);
});

test('the Resend adapter uses configured recipient only and escapes lead HTML', async () => {
  const calls = [];
  const adapter = createResendAdapter(async (url, init) => {
    calls.push({ url, init });
    return new Response('{"id":"mock-id"}', { status: 200 });
  });
  const response = await createFormHandler(adapter)({
    request: request(leadPayload),
    env: formEnv({
      RESEND_SEND_API_KEY: 'send-key',
      RESEND_FROM: 'Joaquim Mota <noreply@mail.joaquimmota.pt>',
      FORMS_RECIPIENT: 'owner@example.test',
    }),
  });
  const body = JSON.parse(calls[0].init.body);

  assert.equal(response.status, 202);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.deepEqual(body.to, ['owner@example.test']);
  assert.equal(body.reply_to, 'ana@example.test');
  assert.match(body.html, /<th scope="row">consent<\/th><td>true<\/td>/u);
  assert.match(body.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.doesNotMatch(body.html, /<script>/u);
  assert.equal(calls[0].init.headers['idempotency-key'], key);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.equal(calls[0].init.signal.aborted, false);
});

test('configured reply address and server-side test recipient override visitor routing', async () => {
  const calls = [];
  const handler = createFormHandler(createResendAdapter(async (url, init) => {
    calls.push({ url, init });
    return new Response('{"id":"mock-email"}', { status: 200 });
  }));
  const env = formEnv({ RESEND_SEND_API_KEY: 'test-key', RESEND_FROM: 'Joaquim Mota Consultores <geral@mail.joaquimmota.pt>', RESEND_REPLY_TO: 'jrmota@kwportugal.pt', FORMS_RECIPIENT: 't@doop.pt' });
  assert.equal((await handler({ request: request(leadPayload), env })).status, 202);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.from, env.RESEND_FROM);
  assert.deepEqual(body.to, ['t@doop.pt']);
  assert.equal(body.reply_to, 'jrmota@kwportugal.pt');
  assert.equal((await handler({ request: request(leadPayload, { 'idempotency-key': 'submission-20261003-002' }), env: formEnv({ ...env, RESEND_REPLY_TO: 'bad\r\nheader' }) })).status, 503);
  assert.equal(calls.length, 1);
});

test('missing configuration and retryable provider failures never return false success', async () => {
  const adapter = createResendAdapter(async () => new Response('{}', { status: 503, headers: { 'retry-after': '47' } }));
  const handler = createFormHandler(adapter);
  const missingConfig = await handler({ request: request(leadPayload), env: formEnv() });
  const providerFailure = await handler({
    request: request(leadPayload),
    env: formEnv({ RESEND_SEND_API_KEY: 'send-key', RESEND_FROM: 'Joaquim <noreply@mail.joaquimmota.pt>', FORMS_RECIPIENT: 'owner@example.test' }),
  });

  assert.equal(missingConfig.status, 503);
  assert.equal(providerFailure.status, 503);
  assert.equal(providerFailure.headers.get('retry-after'), '47');
});

test('new property directory accepts its newsletter with the existing capture adapter', async () => {
 const adapter=mockAdapter();const response=await createFormHandler(adapter)({request:request({formType:'newsletter',route:'/imoveis',fields:{email:'visitor@example.test'}}),env:formEnv()});assert.equal(response.status,202);assert.equal(adapter.calls[0][1].route,'/imoveis');
});

for (const host of ['192.168.1.14:8791', '127.0.0.1:8791']) {
  test(`accepts same-origin local preview submissions on ${host}`, async () => {
    const adapter = mockAdapter();
    const makeRequest = origin => new Request(`http://${host}/api/forms`, { method: 'POST', headers: { 'content-type': 'application/json', origin, 'idempotency-key': key }, body: JSON.stringify(leadPayload) });
    const handler = createFormHandler(adapter);
    assert.equal((await handler({ request: makeRequest(`http://${host}`), env: formEnv() })).status, 202);
    assert.equal((await handler({ request: makeRequest('https://attacker.example'), env: formEnv() })).status, 403);
  });
}
test('does not accept arbitrary same-origin public hosts as preview origins', async () => {
  const adapter = mockAdapter();
  const request = new Request('http://unknown.example/api/forms', { method: 'POST', headers: { origin: 'http://unknown.example', 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(leadPayload) });
  assert.equal((await createFormHandler(adapter)({ request, env: formEnv() })).status, 403);
});
