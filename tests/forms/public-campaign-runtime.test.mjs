import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const componentPath = fileURLToPath(new URL('../../src/components/PublicCampaignPage.astro', import.meta.url));
const source = await readFile(componentPath, 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Compile the actual PublicCampaignPage submit handler.');
const compiled = await build({
  stdin: { contents: script, resolveDir: dirname(componentPath), loader: 'ts' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false,
});
const handler = compiled.outputFiles[0].text;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const errorCopy = 'Oops! Aconteceu algo de errado enquanto submetia o seu formulário.';

function html() {
  return `<main><form data-public-campaign data-route="/lp/cabaz-de-natal" data-redirect="/lp/obrigado-oferta">
    <input name="firstName" required value="Ana"><input name="lastName" required value="Costa">
    <input name="email" type="email" required value="ana@example.test"><input name="phone" required value="+351900000000">
    <select name="referral" required><option value="Sim, a vender" selected>Sim, a vender</option></select>
    <select name="intent" required><option value="Não" selected>Não</option></select>
    <input name="street" required value="Rua do Sol"><input name="postalCode" required value="4000-001"><input name="county" required value="Porto">
    <input name="consent" type="checkbox" required checked><button type="submit">Participar</button>
    <p data-campaign-status role="status" hidden></p>
  </form></main>`;
}

function runtime(t, transport) {
  const dom = new JSDOM(html(), { runScripts: 'outside-only', url: 'https://joaquimmota.pt/lp/cabaz-de-natal' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window, 'crypto', { value: { randomUUID: () => 'campaign-idempotency-key' } });
  const calls = [];
  const redirects = [];
  dom.window.fetch = async (url, options) => { calls.push({ url, ...options }); return transport(calls.length, options); };
  new dom.window.Function('location', handler)({ assign: (url) => redirects.push(url) });
  const form = dom.window.document.querySelector('form');
  const status = form.querySelector('[data-campaign-status]');
  const button = form.querySelector('button');
  const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  return { form, status, button, submit, calls, redirects };
}

test('Cabaz handler sends its source route and redirects only after 202', async (t) => {
  const r = runtime(t, async () => ({ status: 202 }));
  r.submit(); await flush();
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, '/api/forms');
  assert.equal(r.calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(r.calls[0].body), {
    formType: 'leadMagnet', route: '/lp/cabaz-de-natal',
    fields: { name: 'Ana Costa', email: 'ana@example.test', phone: '+351900000000', message: 'Conhece alguém que esteja a vender ou a comprar casa?: Sim, a vender\nEstá a pensar vender ou a comprar casa?: Não\nMorada: Rua do Sol\nCódigo Postal: 4000-001\nConcelho: Porto', consent: true },
  });
  assert.deepEqual(r.redirects, ['/lp/obrigado-oferta']);
});

test('actual PublicCampaign handler shows 503 feedback and makes the same form retryable', async (t) => {
  const r = runtime(t, async () => ({ status: 503 }));
  r.submit(); await flush();
  assert.equal(r.redirects.length, 0);
  assert.equal(r.status.hidden, false);
  assert.equal(r.status.textContent, errorCopy);
  assert.equal(r.button.disabled, false);
  r.submit(); await flush();
  assert.equal(r.calls.length, 2);
});

test('actual PublicCampaign handler ignores duplicate submits while its request is pending', async (t) => {
  let accept;
  const r = runtime(t, () => new Promise((resolve) => { accept = resolve; }));
  r.submit(); r.submit(); await flush();
  assert.equal(r.calls.length, 1);
  assert.equal(r.button.disabled, true);
  accept({ status: 202 }); await flush();
  assert.deepEqual(r.redirects, ['/lp/obrigado-oferta']);
});
