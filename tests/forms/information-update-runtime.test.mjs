import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const pagePath = fileURLToPath(new URL('../../src/pages/lp/atualizacao-de-informacao.astro', import.meta.url));
const source = await readFile(pagePath, 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Compile the actual information-update handler.');
const compiled = await build({ stdin: { contents: script, resolveDir: dirname(pagePath), loader: 'ts' }, bundle: true, format: 'iife', platform: 'browser', write: false });
const flush = () => new Promise((resolve) => setImmediate(resolve));
const html = `<main><form data-information-update data-route="/lp/atualizacao-de-informacao">
  <input name="firstName" required value="Ana"><input name="lastName" required value="Costa">
  <input name="email" type="email" required value="ana@example.test"><input name="phone" required value="+351900000000">
  <input name="street" required value="Rua do Sol"><input name="postalCode" required value="4000-001"><input name="county" required value="Porto">
  <input name="consent" type="checkbox" required checked><button type="submit" data-wait="Por favor aguarde...">Enviar</button>
</form><p data-information-status role="status" hidden></p></main>`;

function runtime(t, transport) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://joaquimmota.pt/lp/atualizacao-de-informacao' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window, 'crypto', { value: { randomUUID: () => 'information-idempotency-key' } });
  const calls = [];
  dom.window.fetch = async (url, options) => { calls.push({ url, ...options }); return transport(calls.length, options); };
  dom.window.eval(compiled.outputFiles[0].text);
  const form = dom.window.document.querySelector('form');
  const button = form.querySelector('button');
  const status = dom.window.document.querySelector('[data-information-status]');
  const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  return { form, button, status, submit, calls };
}

test('actual information-update handler hides only the form and leaves its sibling success visible after 202', async (t) => {
  assert.match(source, /<\/form>\s*<p class="information-update__status"/, 'Source feedback is a sibling of the form that becomes hidden.');
  const r = runtime(t, async () => ({ status: 202 }));
  r.submit(); await flush();
  assert.equal(r.calls.length, 1);
  assert.deepEqual(JSON.parse(r.calls[0].body), {
    formType: 'leadMagnet', route: '/lp/atualizacao-de-informacao',
    fields: { name: 'Ana Costa', email: 'ana@example.test', phone: '+351900000000', message: 'A sua morada: Rua do Sol\nCódigo Postal: 4000-001\nConcelho: Porto', firstName: 'Ana', lastName: 'Costa', consent: true },
  });
  assert.equal(r.form.hidden, true);
  assert.equal(r.status.hidden, false);
  assert.equal(r.status.textContent, 'Obrigado, Ana! Recebemos a atualização dos seus dados.');
});

test('actual information-update handler recovers from 503 and ignores duplicate pending requests', async (t) => {
  let resolveRequest;
  let attempt = 0;
  const r = runtime(t, () => {
    attempt++;
    if (attempt === 1) return { status: 503 };
    return new Promise((resolve) => { resolveRequest = resolve; });
  });
  r.submit(); await flush();
  assert.equal(r.form.hidden, false);
  assert.equal(r.button.disabled, false);
  assert.match(r.status.textContent, /Aconteceu algo de errado/);
  r.submit(); r.submit(); await flush();
  assert.equal(r.calls.length, 2);
  assert.equal(r.button.disabled, true);
  resolveRequest({ status: 202 }); await flush();
  assert.equal(r.form.hidden, true);
});
