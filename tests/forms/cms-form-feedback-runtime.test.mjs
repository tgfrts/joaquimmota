import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer } from 'astro/container';

const config = await getViteConfig({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' }, { devToolbar: { enabled: false } })({ mode: 'test', command: 'build' });
const server = await createServer(config);
const fixtures = {};
try {
  const container = await experimental_AstroContainer.create();
  for (const name of ['CmsPropertyInquiry', 'CmsNewsletter']) {
    const path = fileURLToPath(new URL(`../../src/components/${name}.astro`, import.meta.url));
    const component = await server.ssrLoadModule(`/src/components/${name}.astro`);
    const source = await readFile(path, 'utf8');
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
    const compiled = await build({ stdin: { contents: script, resolveDir: dirname(path), loader: 'ts' }, bundle: true, format: 'iife', platform: 'browser', write: false });
    fixtures[name] = { html: await container.renderToString(component.default), script: compiled.outputFiles[0].text };
  }
} finally { await server.close(); }
const flush = () => new Promise(resolve => setImmediate(resolve));
for (const [name, route] of [['CmsPropertyInquiry', '/imoveis/kwpt036155'], ['CmsNewsletter', '/post/os-segredos-que-as-casas-nao-contam-2']]) {
  test(`${name}: actual handler preserves form on rejection and replaces it with sibling source feedback on 202`, async (t) => {
    const dom = new JSDOM(fixtures[name].html, { runScripts: 'outside-only', url: `https://joaquimmota.pt${route}` });
    t.after(() => dom.window.close());
    const { window } = dom;
    const calls = [];
    let resolveRequest;
    window.fetch = (url, options) => {
      calls.push({ url, ...options });
      return new Promise(resolve => { resolveRequest = resolve; });
    };
    window.eval(fixtures[name].script);
    const form = window.document.querySelector('form');
    const success = window.document.querySelector('[data-form-success]');
    const error = window.document.querySelector('[data-form-error]');
    const button = form.querySelector('button');
    const buttonText = button.textContent;
    assert.equal(success.parentElement, form.parentElement);
    assert.equal(error.parentElement, form.parentElement);
    assert.equal(success.textContent, 'Enviado com sucesso!');
    assert.equal(error.textContent, 'Oops! Alguma coisa correu mal.');
    assert.equal(success.hidden, true); assert.equal(error.hidden, true);
    const submit = () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    submit(); await flush(); assert.equal(calls.length, 0);
    form.elements.firstName.value = 'Ana'; form.elements.lastName.value = 'Costa'; form.elements.email.value = 'ana@example.test';
    if (form.elements.phone) form.elements.phone.value = '+351900000000';
    if (form.elements.marketingConsent) {
      form.elements.marketingConsent.checked = false; submit(); await flush(); assert.equal(calls.length, 0);
      form.elements.marketingConsent.checked = true;
    }
    submit(); assert.equal(button.disabled, true); assert.equal(button.textContent, 'Please wait...');
    assert.equal(success.hidden, true); assert.equal(error.hidden, true); assert.equal(form.hidden, false);
    resolveRequest({ status: 503 }); await flush();
    assert.equal(button.disabled, false); assert.equal(button.textContent, buttonText);
    assert.equal(form.hidden, false); assert.equal(success.hidden, true); assert.equal(error.hidden, false);
    submit(); assert.equal(error.hidden, true); resolveRequest({ status: 202 }); await flush();
    assert.equal(form.hidden, true); assert.equal(success.hidden, false); assert.equal(error.hidden, true);
    assert.equal(button.disabled, false); assert.equal(button.textContent, buttonText);
    assert.equal(calls[0].headers['idempotency-key'], calls[1].headers['idempotency-key']);
    assert.equal(JSON.parse(calls[1].body).route, route);
    assert.equal(window.location.pathname, route, 'Inline CMS success stays on the current page.');
  });
}
