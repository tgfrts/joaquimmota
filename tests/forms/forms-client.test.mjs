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

test('nonnewsletter submissions preserve given name, surname and structured subject for email routing', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => { requestBody = JSON.parse(options.body); return new Response('{}', { status: 202 }); };
  try {
    const values = { firstName: ' Ana ', lastName: ' Costa ', contactSubject: 'Vender' };
    const form = { querySelector: (selector) => selector.includes('checkbox') ? { checked: true } : { value: values[selector.match(/name="(.*?)"/)[1]] } };
    await submitFormAccepted(form, { formType: 'contact', route: '/vamos-comecar', fields: { name: 'Ana Costa', email: 'ana@example.test' } });
    assert.deepEqual(requestBody.fields, { name: 'Ana Costa', email: 'ana@example.test', firstName: 'Ana', lastName: 'Costa', contactSubject: 'Vender', consent: true });
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid phone shows actionable field feedback without sending and clears on editing', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0, validity = '', reported = false, onInput;
  globalThis.fetch = async () => { calls++; return new Response('{}', { status: 202 }); };
  const field = { setCustomValidity(value) { validity = value; }, reportValidity() { reported = true; }, addEventListener(event, callback) { assert.equal(event, 'input'); onInput = callback; } };
  const form = { querySelector(selector) { return selector.includes('phone') ? field : { checked: true }; } };
  try {
    const payload = { formType: 'contact', route: '/vamos-comecar', fields: { name: 'Ana', email: 'ana@example.test', phone: '000000000' } };
    await assert.rejects(submitFormAccepted(form, payload));
    assert.equal(calls, 0); assert.equal(reported, true); assert.equal(validity, 'Introduza um número de telefone válido.');
    onInput(); assert.equal(validity, '');
    await submitFormAccepted(form, { ...payload, fields: { ...payload.fields, phone: '+351 912 345 678' } });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
