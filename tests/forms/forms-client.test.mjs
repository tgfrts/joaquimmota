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
    const form = {};
    const payload = { formType: 'contact', route: '/contacto', fields: { name: 'Ana', email: 'ana@example.test' } };
    await assert.rejects(submitFormAccepted(form, payload));
    await assert.rejects(submitFormAccepted(form, payload));
    await submitFormAccepted(form, payload);
    await submitFormAccepted(form, { ...payload, fields: { ...payload.fields, name: 'Maria' } });
    assert.equal(calls[0].headers['idempotency-key'], calls[1].headers['idempotency-key']);
    assert.equal(calls[1].headers['idempotency-key'], calls[2].headers['idempotency-key']);
    assert.notEqual(calls[2].headers['idempotency-key'], calls[3].headers['idempotency-key']);
  } finally { globalThis.fetch = originalFetch; }
});
