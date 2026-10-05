import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const path = fileURLToPath(new URL('../../src/components/SellerLeadPage.astro', import.meta.url));
const source = await readFile(path, 'utf8');
const css = await readFile(new URL('../../src/styles/seller-leads.css', import.meta.url), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const built = await build({ stdin: { contents: script, resolveDir: dirname(path), loader: 'ts' }, bundle: true, format: 'iife', platform: 'browser', write: false });
const feedback = source.match(/(<div class="seller-lead__success"[\s\S]*?<\/div>\s*<div class="seller-lead__error"[\s\S]*?<\/div>)/)[1];
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(t) {
  assert.match(source, /<\/form>\s*<div class="seller-lead__success"/, 'Success is a sibling of the hidden form.');
  const dom = new JSDOM(`<style>${css}</style><main class="seller-lead"><div>
    <form class="seller-lead__form" data-seller-lead-form data-route="/uma-venda-com-sucesso" data-property-details="true">
      <input name="firstName" value="Ana" required><input name="lastName" value="Costa" required>
      <input name="email" type="email" value="ana@example.test" required><input name="phone" value="900000000" required>
      <select name="propertyType"><option value="apartamento">Apartamento</option></select><select name="bedrooms"><option value="1">1</option></select>
      <input name="street" value="Rua exemplo"><input name="postalCode" value="4000-000"><input name="county" value="Porto">
      <input name="consent" type="checkbox" required checked><button type="submit">Enviar</button>
    </form>${feedback}
  </div></main>`, { runScripts: 'outside-only', url: 'https://joaquimmota.pt/uma-venda-com-sucesso' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window, 'crypto', { value: { randomUUID: () => 'seller-test-key' } });
  return dom;
}
test('SellerLead actual handler preserves retry on rejection and displays sibling success only after 202', async t => {
  const dom = fixture(t), calls = [], responses = [200, 503, 202];
  dom.window.fetch = async (...args) => { calls.push(args); return { status: responses.shift() }; };
  dom.window.eval(built.outputFiles[0].text);
  const form = dom.window.document.querySelector('form'), success = dom.window.document.querySelector('[data-seller-lead-success]'), error = dom.window.document.querySelector('[data-seller-lead-error]');
  const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  for (let i = 0; i < 2; i++) { submit(); await flush(); assert.equal(form.hidden, false); assert.equal(error.hidden, false); assert.equal(success.hidden, true); assert.equal(form.querySelector('button').disabled, false); }
  submit(); await flush();
  assert.equal(calls.length, 3); assert.equal(form.hidden, true); assert.equal(dom.window.getComputedStyle(form).display, 'none'); assert.equal(success.hidden, false); assert.notEqual(dom.window.getComputedStyle(success).display, 'none'); assert.equal(error.hidden, true);
  assert.equal(success.textContent, 'Obrigado, Ana! Recebemos o seu pedido de avaliação. Entraremos em contacto consigo para confirmar os detalhes do imóvel.');
  const body = JSON.parse(calls[0][1].body); assert.equal(body.fields.consent, true); assert.equal(body.fields.propertyType, 'apartamento'); assert.equal(body.fields.bedrooms, '1'); assert.equal(body.fields.location, 'Rua exemplo, 4000-000, Porto');
  assert.equal(calls[0][1].headers['idempotency-key'], calls[2][1].headers['idempotency-key']);
});
test('SellerLead pending/accepted submissions cannot issue duplicate requests or hide rejection behind a success', async t => {
  const dom = fixture(t); let resolve, calls = 0;
  dom.window.fetch = () => { calls++; return new Promise(r => resolve = r); };
  dom.window.eval(built.outputFiles[0].text);
  const form = dom.window.document.querySelector('form'), button = form.querySelector('button'), error = dom.window.document.querySelector('[data-seller-lead-error]');
  const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  submit(); submit(); await flush(); assert.equal(calls, 1); assert.equal(button.disabled, true); assert.equal(error.hidden, true); assert.equal(form.hidden, false);
  resolve({ status: 202 }); await flush(); submit(); await flush(); assert.equal(calls, 1); assert.equal(form.hidden, true); assert.equal(error.hidden, true);
});
