import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('static lead and newsletter controls preserve the source 256-character browser limit', async () => {
  const files = [
    ['src/components/CmsNewsletter.astro', ['firstName', 'lastName', 'email']],
    ['src/components/StaticLeadPage.astro', ['firstName', 'lastName', 'email', 'phone']],
    ['src/components/CampaignLeadForm.astro', ['firstName', 'lastName', 'email', 'phone']],
    ['src/components/PublicCampaignPage.astro', ['firstName', 'lastName', 'email', 'phone', 'street', 'postalCode', 'county']],
    ['src/components/Footer.astro', ['email', 'firstName', 'lastName']],
    ['src/pages/lp-flyer-uma-venda-com-sucesso.astro', ['firstName', 'lastName', 'email', 'phone']],
  ];
  for (const [file, fields] of files) {
    const source = await read(file);
    for (const field of fields) {
      const input = source.match(new RegExp(`<input\\b(?=[^>]*\\bname="${field}")[^>]*>`))?.[0];
      assert.ok(input, `${file}: visible ${field} input exists`);
      assert.match(input, /maxlength="256"/, `${file}: ${field} retains maxlength=256`);
      const dom = new JSDOM(input);
      assert.equal(dom.window.document.querySelector('input').maxLength, 256, `${file}: native limit for ${field}`);
      dom.window.close();
    }
  }
});

test('campaign prompts preserve the source null default and only source campaign pages add rich social tags', async () => {
  const campaign = await read('src/components/CampaignLeadForm.astro');
  const publicCampaign = await read('src/components/PublicCampaignPage.astro');
  const holidayGuide = await read('src/pages/lp/guia-de-ferias.astro');
  assert.equal((campaign.match(/<option value="null">Selecione uma opção<\/option>/g) ?? []).length, 2);
  assert.equal((publicCampaign.match(/<option value="null">Selecione uma opção<\/option>/g) ?? []).length, 2);
  assert.match(publicCampaign, /<BaseLayout[^>]*richSocial>/);
  assert.match(holidayGuide, /socialImage=\{false\} richSocial/);
  const layout = await read('src/layouts/BaseLayout.astro');
  assert.match(layout, /richSocial = false/);
});

test('the 202 response alone triggers the source campaign success redirect', async (t) => {
  const path = fileURLToPath(new URL('../../src/components/PublicCampaignPage.astro', import.meta.url));
  const source = await readFile(path, 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'Use the actual PublicCampaignPage handler.');
  const built = await build({ stdin: { contents: script, resolveDir: dirname(path), loader: 'ts' }, bundle: true, format: 'iife', platform: 'browser', write: false });
  const html = `<form data-public-campaign data-route="/lp/cabaz-de-natal" data-redirect="/lp/obrigado-oferta" data-success="ok">
    <input name="firstName" required value="Ana"><input name="lastName" required value="Costa">
    <input name="email" type="email" required value="ana@example.test"><input name="phone" type="tel" required value="+351900000000">
    <select name="referral" required><option value="null" selected>Selecione uma opção</option><option>Não</option></select>
    <select name="intent" required><option value="null" selected>Selecione uma opção</option><option>Não</option></select>
    <input type="checkbox" required checked><button type="submit">Enviar</button><p data-campaign-status hidden></p>
  </form>`;
  const errorCopy = 'Oops! Aconteceu algo de errado enquanto submetia o seu formulário.';

  async function exercise(statuses) {
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const calls = []; const redirects = [];
    dom.window.fetch = async (...args) => { calls.push(args); return { status: statuses[calls.length - 1] }; };
    const location = { assign: (href) => redirects.push(href) };
    new dom.window.Function('window', 'document', 'FormData', 'location', built.outputFiles[0].text)(dom.window, dom.window.document, dom.window.FormData, location);
    const form = dom.window.document.querySelector('form');
    const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    return { dom, form, calls, redirects, submit };
  }

  const rejected = await exercise([503, 200, 202]);
  assert.equal(rejected.form.checkValidity(), true, 'The source non-empty null prompt remains a valid default value.');
  rejected.submit(); await flush();
  assert.deepEqual(rejected.redirects, []);
  assert.equal(rejected.form.querySelector('[data-campaign-status]').textContent, errorCopy);
  assert.equal(rejected.form.hidden, false, 'A rejected response leaves the form available for retry.');
  rejected.submit(); await flush();
  assert.deepEqual(rejected.redirects, []);
  assert.equal(rejected.form.hidden, false, 'A non-202 response leaves the form available for retry.');
  rejected.submit(); await flush();
  assert.deepEqual(rejected.redirects, ['/lp/obrigado-oferta']);
  assert.equal(rejected.calls.length, 3);
  rejected.dom.window.close();

  let accept;
  const pending = await exercise([]);
  let pendingCalls = 0;
  pending.dom.window.fetch = () => { pendingCalls++; return new Promise((resolve) => { accept = resolve; }); };
  pending.submit(); pending.submit(); await flush();
  assert.equal(pendingCalls, 1, 'A pending attempt cannot issue a duplicate request.');
  const pendingButton = pending.form.querySelector('button');
  const pendingStatus = pending.form.querySelector('[data-campaign-status]');
  assert.equal(pendingButton.disabled, true);
  assert.equal(pendingStatus.textContent, '', 'Duplicate submits do not report a false error or success.');
  assert.equal(pending.form.hidden, false);
  assert.deepEqual(pending.redirects, []);
  accept({ status: 503 }); await flush();
  assert.equal(pendingButton.disabled, false, 'A failed response enables a normal retry.');
  assert.equal(pendingStatus.textContent, errorCopy);
  assert.deepEqual(pending.redirects, []);
  pending.dom.window.fetch = async () => ({ status: 202 });
  pending.submit(); await flush();
  assert.deepEqual(pending.redirects, ['/lp/obrigado-oferta']);
  pending.dom.window.close();
});

test('all owned shared form handlers short-circuit while the active submit button is disabled', async () => {
  const files = [
    'src/components/CmsNewsletter.astro',
    'src/components/Footer.astro',
    'src/components/StaticLeadPage.astro',
    'src/components/CampaignLeadForm.astro',
    'src/components/PublicCampaignPage.astro',
    'src/components/CmsPropertyInquiry.astro',
  ];
  for (const file of files) {
    const source = await read(file);
    assert.match(source, /button\.disabled\) return|!status \|\| button\.disabled\) return/, `${file}: ignore duplicate submits while pending`);
  }
});

test('source-present anchors are restored only on their audited pages', async () => {
  const flyer = await read('src/pages/lp-flyer-uma-venda-com-sucesso.astro');
  assert.match(flyer, /<footer class="seller-campaign__footer"[\s\S]*?href="https:\/\/www\.kwportugal\.pt\/politica-de-privacidade" target="_blank" rel="noopener noreferrer"/);
  // Owner removed the dedicated reviews page and testimonial action button.
  const marketing = new JSDOM(await read('dist/marketing.html'));
  assert.equal(marketing.window.document.querySelector('a[href="/reviews"]'), null);
  assert.ok(marketing.window.document.querySelector('a[href="#testemunhos"]'));
  assert.ok(marketing.window.document.getElementById('testemunhos'));
  assert.equal([...marketing.window.document.querySelectorAll('a')].some(link => link.textContent.includes('Leia as nossas avaliações')), false);
  marketing.window.close();
});
