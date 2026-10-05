import assert from 'node:assert/strict';
import test from 'node:test';
import { submitFormAccepted } from '../../src/scripts/forms-client.ts';

test('unchanged retries reuse the key, changed submissions use a new key, and only 202 succeeds', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(options);
    return new Response('{}', { status: calls.length === 1 ? 503 : calls.length === 2 ? 200 : 202 });
  };
  try {
    const form = { querySelector: () => ({ checked: true }) };
    const payload = { formType: 'contact', route: '/vamos-comecar', fields: { name: 'Ana', email: 'ana@example.test' } };
    await assert.rejects(submitFormAccepted(form, payload));
    await assert.rejects(submitFormAccepted(form, payload));
    await submitFormAccepted(form, payload);
    await submitFormAccepted(form, { ...payload, fields: { ...payload.fields, name: 'Maria' } });
    assert.equal(calls[0].headers['idempotency-key'], calls[1].headers['idempotency-key']);
    assert.equal(calls[1].headers['idempotency-key'], calls[2].headers['idempotency-key']);
    assert.notEqual(calls[2].headers['idempotency-key'], calls[3].headers['idempotency-key']);
    assert.equal(JSON.parse(calls[0].body).fields.consent, true);
    assert.equal(calls[0].body, calls[1].body);
  } finally { globalThis.fetch = originalFetch; }
});

test('newsletter payloads do not acquire a consent field', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = options.body;
    return new Response('{}', { status: 202 });
  };
  try {
    const form = { querySelector: () => { throw new Error('Newsletter has no consent checkbox.'); } };
    const payload = { formType: 'newsletter', route: '/blog', fields: { email: 'ana@example.test' } };
    await submitFormAccepted(form, payload);
    assert.deepEqual(JSON.parse(requestBody), payload);
  } finally { globalThis.fetch = originalFetch; }
});
