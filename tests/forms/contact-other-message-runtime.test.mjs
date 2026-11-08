import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createFormHandler } from '../../functions/api/forms.ts';
import { buildLeadEmails } from '../../functions/api/email-copy.ts';
const path = fileURLToPath(new URL('../../src/components/CampaignLeadForm.astro', import.meta.url));
const source = await readFile(path, 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const compiled = await build({ stdin: { contents: script, resolveDir: dirname(path), loader: 'ts' }, bundle: true, format: 'iife', platform: 'browser', write: false });
const flush = () => new Promise(resolve => setImmediate(resolve));
function runtime(t) {
 const dom = new JSDOM(`<form data-campaign-form data-route="/vamos-comecar" data-form-type="contact"><input name="firstName" value="Ana"><input name="lastName" value="Costa"><input name="email" value="ana@example.invalid"><input name="phone" value="912345678"><select name="contactSubject"><option>Comprar</option><option>Vender</option><option>Outro</option></select><label data-other-message hidden>Mensagem (opcional)<textarea name="message" maxlength="4000" disabled></textarea></label><input type="checkbox" required checked><button type="submit">Enviar</button><p class="campaign-form__status"></p></form><div hidden></div>`, { runScripts: 'outside-only', url: 'https://joaquimmota.pt/vamos-comecar' });
 t.after(() => dom.window.close());
 const calls = [];
 dom.window.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); return { status: 503 }; };
 dom.window.eval(compiled.outputFiles[0].text);
 const doc = dom.window.document, form = doc.querySelector('form'), subject = doc.querySelector('select'), field = doc.querySelector('textarea'), panel = doc.querySelector('[data-other-message]');
 return { calls, field, panel, form, select(value) { subject.value = value; subject.dispatchEvent(new dom.window.Event('change')); }, async submit() { form.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); await flush(); } };
}
test('Other reveals an optional message, persisted payload and consultant email include its text safely', async t => {
 const r = runtime(t);
 assert.ok(r.panel.hidden); assert.ok(r.field.disabled);
 r.select('Outro'); assert.equal(r.panel.hidden, false); assert.equal(r.field.disabled, false); assert.equal(r.field.required, false);
 r.field.value = 'Preciso de ajuda com uma herança <script>alert(1)</script>';
 await r.submit();
 assert.equal(r.calls[0].fields.contactSubject, 'Outro');
 assert.ok(r.calls[0].fields.message.includes(r.field.value));
 const emails = buildLeadEmails(r.calls[0]);
 assert.equal(emails.consultant.subject, 'Novo contato - Outro');
 assert.ok(emails.consultant.text.includes(r.field.value));
 assert.ok(emails.consultant.html.includes('&lt;script&gt;'));
 assert.ok(!emails.customer.text.includes('herança'));
});
test('Other allows blank message and switching to Buy/Sell never sends the hidden draft', async t => {
 const r = runtime(t);
 r.select('Outro'); await r.submit();
 assert.equal(r.calls[0].fields.message, undefined);
 assert.equal(r.calls[0].fields.contactSubject, 'Outro');
 r.field.value = 'Mensagem privada de rascunho';
 for (const selection of ['Comprar', 'Vender']) {
  r.select(selection); assert.ok(r.panel.hidden); assert.ok(r.field.disabled); await r.submit();
  assert.equal(r.calls.at(-1).fields.message, undefined);
  assert.equal(r.calls.at(-1).fields.contactSubject, selection);
 }
});
test('reset restores the conditional message visibility without deleting the typed draft on subject change', async t => {
 const r = runtime(t); r.select('Outro'); r.field.value = 'Rascunho'; r.select('Comprar'); r.select('Outro'); assert.equal(r.field.value, 'Rascunho');
 r.form.reset(); await flush(); assert.ok(r.panel.hidden); assert.ok(r.field.disabled);
 assert.match(source, /Mensagem \(opcional\)/); assert.match(source, /maxlength="4000"/);
});

test('a full 4000-character optional message passes server validation without adding a subject suffix', async t => {
 const r = runtime(t); r.select('Outro'); r.field.value = 'a'.repeat(4000); await r.submit();
 assert.equal(r.calls[0].fields.message.length, 4000);
 const handler = createFormHandler({ notifyLead() { throw new Error('No real sending'); }, captureNewsletter() { throw new Error('No real sending'); } });
 const request = payload => new Request('https://joaquimmota.pt/api/forms', { method: 'POST', headers: { origin: 'https://joaquimmota.pt', 'content-type': 'application/json', 'idempotency-key': 'other-message-boundary' }, body: JSON.stringify(payload) });
 // 503 missing DB means validation passed; oversized messages fail earlier with 422.
 assert.equal((await handler({ request: request(r.calls[0]), env: {} })).status, 503);
 assert.equal((await handler({ request: request({ ...r.calls[0], fields: { ...r.calls[0].fields, message: 'a'.repeat(4001) } }), env: {} })).status, 422);
});
