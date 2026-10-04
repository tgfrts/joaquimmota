import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// Execute the actual Astro page handler plus its imported production helper.
// Only transport and navigation boundaries are replaced; no requests leave JSDOM.
const pagePath = fileURLToPath(new URL('../../src/pages/ofertas/[slug].astro', import.meta.url));
const source = await readFile(pagePath, 'utf8');
const forms = [...source.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)];
assert.equal(forms.length, 1, 'The offer fixture must come from the actual single page form.');
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1, 'Execute the actual offer page client script.');
const result = await build({ stdin: { contents: scripts[0][1], resolveDir: dirname(pagePath), loader: 'ts' }, bundle: true, format: 'iife', platform: 'browser', write: false });
const compiledScript = result.outputFiles[0].text;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const errorCopy = 'Oops! Aconteceu algo de errado enquanto submetia o seu formulário.';

function runtime(t, transport) {
  const dom = new JSDOM(forms[0][0], { runScripts: 'outside-only', url: 'https://joaquimmota.pt/ofertas/vinho-e-fado' });
  t.after(() => dom.window.close());
  const calls = [];
  const redirects = [];
  dom.window.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return transport(calls.length, options);
  };
  // Location.assign is non-configurable in JSDOM. A lexical location boundary
  // records navigation while running the otherwise unchanged compiled script.
  new dom.window.Function('location', compiledScript)({ pathname: '/ofertas/vinho-e-fado', assign: (url) => redirects.push(url) });
  const form = dom.window.document.querySelector('form');
  const status = form.querySelector('.offer-form__status');
  const set = (name, value) => { form.elements.namedItem(name).value = value; };
  const fill = () => {
    set('firstName', 'Ana'); set('lastName', 'Costa');
    set('email', 'ana@example.test'); set('phone', '+351900000000');
    set('referral', 'Sim, a vender'); set('intent', 'Não');
  };
  const submit = () => {
    const event = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  };
  return { form, status, set, fill, submit, calls, redirects, dom };
}

test('real offer handler blocks empty required fields, invalid email and unchecked consent before fetch', async (t) => {
  const r = runtime(t, () => { throw new Error('Invalid forms must never reach transport.'); });
  r.submit(); await flush();
  assert.equal(r.form.checkValidity(), false);
  r.fill(); r.set('email', 'invalid-email'); r.submit(); await flush();
  assert.equal(r.form.elements.email.validity.typeMismatch, true);
  r.set('email', 'ana@example.test'); r.form.elements.consent.checked = false;
  r.submit(); await flush();
  assert.equal(r.form.elements.consent.validity.valueMissing, true);
  assert.equal(r.calls.length, 0);
  assert.deepEqual(r.redirects, []);
  assert.equal(r.status.hidden, true);
});

test('real offer handler submits exact field names/consent/route and redirects only after status 202', async (t) => {
  const r = runtime(t, async () => ({ status: 202 }));
  r.fill(); assert.equal(r.form.checkValidity(), true); r.submit(); await flush();
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, '/api/forms');
  assert.equal(r.calls[0].method, 'POST');
  assert.equal(r.calls[0].headers['content-type'], 'application/json');
  assert.match(r.calls[0].headers['idempotency-key'], /^[0-9a-f-]{36}$/);
  assert.deepEqual(JSON.parse(r.calls[0].body), { formType: 'leadMagnet', route: '/ofertas/vinho-e-fado', fields: { name: 'Ana Costa', email: 'ana@example.test', phone: '+351900000000', message: 'Referência: Sim, a vender. Interesse: Não.', consent: true } });
  assert.deepEqual(r.redirects, ['/obrigado']);
  assert.equal(r.status.hidden, true);
});

test('real offer handler presents error for 503 and 200; unchanged retries reuse identity until 202', async (t) => {
  const r = runtime(t, async (number) => ({ status: [503, 200, 202][number - 1] }));
  r.fill();
  for (let i = 0; i < 2; i++) {
    r.submit(); await flush();
    assert.equal(r.status.hidden, false); assert.equal(r.status.textContent, errorCopy);
    assert.deepEqual(r.redirects, []);
  }
  r.submit(); await flush();
  assert.deepEqual(r.redirects, ['/obrigado']);
  assert.equal(new Set(r.calls.map((call) => call.headers['idempotency-key'])).size, 1);
  assert.equal(new Set(r.calls.map((call) => call.body)).size, 1);
});

test('transport TimeoutError allows retry with the same key; changed payload uses a fresh key', async (t) => {
  const r = runtime(t, async (number) => {
    if (number === 1) throw new DOMException('Mock transport timed out', 'TimeoutError');
    return { status: 202 };
  });
  r.fill(); r.submit(); await flush();
  assert.equal(r.status.textContent, errorCopy); assert.deepEqual(r.redirects, []);
  r.submit(); await flush();
  assert.equal(r.calls[0].headers['idempotency-key'], r.calls[1].headers['idempotency-key']);
  assert.deepEqual(r.redirects, ['/obrigado']);
  r.set('firstName', 'Maria'); r.submit(); await flush();
  assert.notEqual(r.calls[1].headers['idempotency-key'], r.calls[2].headers['idempotency-key']);
});

test('pending duplicate submit makes no second request and cannot redirect before acceptance', async (t) => {
  let accept;
  const r = runtime(t, () => new Promise((resolve) => { accept = resolve; }));
  r.fill(); r.submit(); r.submit(); await flush();
  assert.equal(r.calls.length, 1); assert.deepEqual(r.redirects, []);
  accept({ status: 202 }); await flush();
  assert.deepEqual(r.redirects, ['/obrigado']);
});
