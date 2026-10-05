import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const componentPath = fileURLToPath(new URL('../../src/components/StaticLeadPage.astro', import.meta.url));
const source = await readFile(componentPath, 'utf8');
const stylesheet = await readFile(new URL('../../src/styles/static-leads.css', import.meta.url), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Compile the actual StaticLeadPage handler.');
const built = await build({
  stdin: { contents: script, resolveDir: dirname(componentPath), loader: 'ts' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false,
});
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('StaticLeadPage keeps sibling feedback visible on 202 and preserves the form on failure', async (t) => {
  assert.match(source, /<\/form>\s*<p class="static-lead__status" data-form-status/,
    'Feedback is outside the form that is hidden after acceptance.');
  const html = `<style>${stylesheet}</style><main data-static-lead-page>
    <form class="static-lead__form" data-static-lead-form data-route="/estudo-de-mercado" data-form-type="valuation">
      <input name="firstName" required value="Ana"><input name="lastName" required value="Costa">
      <input name="email" type="email" required value="ana@example.test"><input name="phone" type="tel" required value="+351900000000">
      <input name="consent" type="checkbox" required checked><button type="submit">Enviar</button>
      <p class="static-lead__copyright">© Somos Real Estate</p>
    </form>
    <p class="static-lead__status" data-form-status role="status" aria-live="polite" hidden></p>
  </main>`;
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://joaquimmota.pt/estudo-de-mercado' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window, 'crypto', { value: { randomUUID: () => 'test-idempotency-key' } });
  const responses = [503, 202];
  const calls = [];
  dom.window.fetch = async (...args) => {
    calls.push(args);
    return { status: responses.shift() };
  };
  dom.window.eval(built.outputFiles[0].text);
  const { document } = dom.window;
  const form = document.querySelector('form');
  const status = document.querySelector('[data-form-status]');
  const button = form.querySelector('button');
  const copyright = document.querySelector('.static-lead__copyright');
  const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  assert.equal(status.parentElement, form.parentElement);
  assert.equal(copyright.parentElement, form, 'Source legal copy stays in the form content.');
  assert.notEqual(dom.window.getComputedStyle(form).display, 'none', 'Form is visible before submit.');
  submit(); await flush();
  assert.equal(calls.length, 1);
  assert.equal(form.hidden, false, 'Rejected response leaves the form available.');
  assert.notEqual(dom.window.getComputedStyle(form).display, 'none', 'Rejected response keeps the form visible.');
  assert.equal(copyright.hidden, false, 'Legal copy remains visible while the form can be retried.');
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, 'Oops! Aconteceu algo de errado enquanto submetia o seu formulário.');
  assert.equal(button.disabled, false, 'Rejected response enables a normal retry.');

  submit(); await flush();
  assert.equal(calls.length, 2);
  assert.equal(form.hidden, true, 'Only accepted response hides the form.');
  assert.equal(dom.window.getComputedStyle(form).display, 'none', 'Real static-leads.css hides the form after acceptance.');
  assert.equal(status.hidden, false, 'Success feedback remains visible after the form is hidden.');
  assert.equal(status.textContent, 'Obrigado, Ana! Recebemos o seu pedido de avaliação. Entraremos em contacto consigo para confirmar os detalhes do imóvel.');
  assert.equal(copyright.closest('form').hidden, true, 'Legal copy shares the source form content state.');
});

test('StaticLeadPage does not process duplicate submissions while the accepted request is pending', async (t) => {
  const html = `<style>${stylesheet}</style><main data-static-lead-page>
    <form class="static-lead__form" data-static-lead-form data-route="/sessao-gratuita" data-form-type="contact">
      <input name="firstName" required value="Ana"><input name="lastName" required value="Costa">
      <input name="email" type="email" required value="ana@example.test"><input name="phone" type="tel" required value="+351900000000">
      <input name="consent" type="checkbox" required checked><button type="submit">Enviar</button>
    </form><p data-form-status role="status" hidden></p>
  </main>`;
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window, 'crypto', { value: { randomUUID: () => 'test-idempotency-key' } });
  let resolveRequest;
  let calls = 0;
  dom.window.fetch = () => { calls++; return new Promise((resolve) => { resolveRequest = resolve; }); };
  dom.window.eval(built.outputFiles[0].text);
  const form = dom.window.document.querySelector('form');
  const status = dom.window.document.querySelector('[data-form-status]');
  const button = form.querySelector('button');
  const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.notEqual(dom.window.getComputedStyle(form).display, 'none');
  submit(); submit(); await flush();
  assert.equal(calls, 1);
  assert.equal(button.disabled, true);
  assert.notEqual(dom.window.getComputedStyle(form).display, 'none', 'Pending request keeps the form visible.');
  assert.equal(status.textContent, '');
  assert.equal(status.hidden, false);
  resolveRequest({ status: 503 }); await flush();
  assert.equal(button.disabled, false);
  assert.equal(form.hidden, false);
  assert.match(status.textContent, /Aconteceu algo de errado/);
});
