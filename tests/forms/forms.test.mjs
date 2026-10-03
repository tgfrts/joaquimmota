import assert from 'node:assert/strict';
import test from 'node:test';
import { createFormHandler, createResendAdapter } from '../../functions/api/forms.ts';

const key = 'submission-20261003-001';
const leadPayload = {
  formType: 'contact',
  route: '/contacto',
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
    async captureNewsletter(submission) { calls.push(['newsletter', submission]); },
    async notifyLead(submission) { calls.push(['lead', submission]); },
  };
}

test('allows newsletter capture only on an approved public route', async () => {
  const adapter = mockAdapter();
  const response = await createFormHandler(adapter)({
    request: request({ formType: 'newsletter', route: '/blog', fields: { email: 'visitor@example.test' } }),
    env: {},
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
    env: {},
  });

  assert.equal(response.status, 403);
  assert.equal(adapter.calls.length, 0);
});

test('allows only eligibility-gated CMS property and article routes', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const property = await handler({ request: request({ ...leadPayload, route: '/imoveis/kwpt036155' }), env: {} });
  const article = await handler({ request: request({ formType: 'newsletter', route: '/post/a-proposta-mais-alta-pode-nao-ser-a-melhor', fields: { email: 'visitor@example.test', firstName: 'Ana', lastName: 'Silva' } }), env: {} });
  const eligibleNearMatch = await handler({ request: request({ formType: 'newsletter', route: '/post/como-garantir-uma-mudanca-de-casa-rapida-neste-verao-2024', fields: { email: 'visitor@example.test' } }), env: {} });
  const excludedNearMatch = await handler({ request: request({ formType: 'newsletter', route: '/post/como-garantir-uma-mudanca-de-casa-rapida-neste-verao', fields: { email: 'visitor@example.test' } }), env: {} });

  assert.equal(property.status, 202);
  assert.equal(article.status, 202);
  assert.equal(eligibleNearMatch.status, 202);
  assert.equal(excludedNearMatch.status, 403);
  assert.deepEqual(adapter.calls[1][1].fields, { email: 'visitor@example.test', firstName: 'Ana', lastName: 'Silva' });
});

test('accepts the eligible offer route and rejects invented offer slugs', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const payload = { ...leadPayload, formType: 'leadMagnet', route: '/ofertas/vinho-e-fado' };
  assert.equal((await handler({ request: request(payload), env: {} })).status, 202);
  assert.equal((await handler({ request: request({ ...payload, route: '/ofertas/inventada' }), env: {} })).status, 403);
  assert.equal(adapter.calls.length, 1);
});

test('rejects a cross-site origin before handling a submission', async () => {
  const adapter = mockAdapter();
  const response = await createFormHandler(adapter)({ request: request(leadPayload, { origin: 'https://attacker.example' }), env: {} });

  assert.equal(response.status, 403);
  assert.equal(adapter.calls.length, 0);
});

test('rejects malformed fields and missing idempotency keys', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const unsupported = await handler({
    request: request({ ...leadPayload, fields: { ...leadPayload.fields, recipient: 'attacker@example.test' } }),
    env: {},
  });
  const noKey = await handler({
    request: request(leadPayload, { 'idempotency-key': '' }),
    env: {},
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
  const missing = await handler({ request: request({ ...leadPayload, fields: missingFields }), env: {} });
  const unchecked = await handler({ request: request({ ...leadPayload, fields: { ...leadPayload.fields, consent: false } }), env: {} });
  const wrongType = await handler({ request: request({ ...leadPayload, fields: { ...leadPayload.fields, consent: 'true' } }), env: {} });

  assert.equal(missing.status, 422);
  assert.equal(unchecked.status, 422);
  assert.equal(wrongType.status, 422);
  assert.equal(adapter.calls.length, 0);
});

test('rejects malformed JSON without handing it to an adapter', async () => {
  const adapter = mockAdapter();
  const response = await createFormHandler(adapter)({ request: request('{not json'), env: {} });

  assert.equal(response.status, 400);
  assert.equal(adapter.calls.length, 0);
});

test('stops reading oversized requests and preserves the 413 response', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const oversized = await handler({ request: request('a'.repeat(16_385)), env: {} });
  const declared = await handler({ request: request('{}', { 'content-length': '17000' }), env: {} });
  assert.equal(oversized.status, 413);
  assert.equal(declared.status, 413);
  assert.equal(adapter.calls.length, 0);
});

test('normalizes the visitor reply-to address without permitting header injection', async () => {
  const adapter = mockAdapter();
  const handler = createFormHandler(adapter);
  const accepted = await handler({ request: request(leadPayload), env: {} });
  const injected = await handler({
    request: request({ ...leadPayload, fields: { ...leadPayload.fields, email: 'visitor@example.test\r\nBcc: attacker@example.test' } }),
    env: {},
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
    return new Response('{}', { status: 200 });
  });
  const response = await createFormHandler(adapter)({
    request: request(leadPayload),
    env: {
      RESEND_SEND_API_KEY: 'send-key',
      RESEND_FROM: 'Joaquim Mota <noreply@mail.joaquimmota.pt>',
      FORMS_RECIPIENT: 'owner@example.test',
    },
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
});

test('missing configuration and retryable provider failures never return false success', async () => {
  const adapter = createResendAdapter(async () => new Response('{}', { status: 503, headers: { 'retry-after': '47' } }));
  const handler = createFormHandler(adapter);
  const missingConfig = await handler({ request: request(leadPayload), env: {} });
  const providerFailure = await handler({
    request: request(leadPayload),
    env: { RESEND_SEND_API_KEY: 'send-key', RESEND_FROM: 'Joaquim <noreply@mail.joaquimmota.pt>', FORMS_RECIPIENT: 'owner@example.test' },
  });

  assert.equal(missingConfig.status, 503);
  assert.equal(providerFailure.status, 503);
  assert.equal(providerFailure.headers.get('retry-after'), '47');
});
