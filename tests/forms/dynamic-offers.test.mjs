import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { DatabaseSync } from 'node:sqlite';
import { validateOffer, publishedOffers, offerMetadata, offerImageUrl, offerWindowState, lisbonDay, validOfferDate } from '../../src/lib/offers.mjs';
import { buildCmsFormRoutes } from '../../scripts/forms/property-email-details.mjs';
import { fetchPublishedContent } from '../../scripts/cms/fetch-published.mjs';
import { contentRevision, deploymentRevision } from '../../scripts/cms/check-revision.mjs';
import { createFormHandler } from '../../functions/api/forms.ts';
import { buildLeadEmails } from '../../functions/api/email-copy.ts';
import { robotsForPath, sitemapEntries } from '../../src/lib/seo.ts';

const image = { asset: { _ref: 'image-abc123-1600x900-jpg' } };
const offer = { _id: 'native-offer', _type: 'offer', title: 'Oferta de inverno', slug: { current: 'oferta-inverno' }, heading: 'Participe\nna nossa campanha', image, ogImage: image, startDate: '2026-12-01', endDate: '2026-12-16', confirmationMessage: 'Olá [Nome], recebemos a sua participação na [Campanha].' };
const payload = { formType: 'leadMagnet', route: '/lp/oferta-inverno', fields: { name: 'Ana Costa', firstName: 'Ana', lastName: 'Costa', email: 'ana@example.invalid', phone: '912345678', consent: true, message: 'Conhece alguém que esteja a vender ou a comprar casa?: Sim, a vender\nEstá a pensar vender ou a comprar casa?: Não\nMorada: Rua A\nCódigo Postal: 4000-001\nConcelho: Porto' } };
const request = (body = payload) => new Request('https://joaquimmota.pt/api/forms', { method: 'POST', headers: { origin: 'https://joaquimmota.pt', 'content-type': 'application/json', 'idempotency-key': 'dynamic-offer-test' }, body: JSON.stringify(body) });

test('native published offers generate static and form metadata while drafts/releases stay absent', async () => {
  const content = { documents: [offer, { ...offer, _id: 'drafts.other' }, { ...offer, _id: 'versions.release.other' }] };
  assert.deepEqual(publishedOffers(content), [offer]);
  const { routes, offers } = buildCmsFormRoutes(content);
  assert.deepEqual(routes.offerSlugs, ['oferta-inverno']);
  assert.deepEqual(offers, offerMetadata([offer]));
  assert.equal(offers['oferta-inverno'].title, offer.title);
  assert.equal(Object.hasOwn(offers['oferta-inverno'], 'image'), false);
  const snapshot = await fetchPublishedContent({ fetchImpl: async () => ({ ok: true, json: async () => ({ result: [offer] }) }) });
  assert.deepEqual(snapshot.documents, [offer]);
  const source = await readFile(new URL('../../src/pages/lp/[slug].astro', import.meta.url), 'utf8');
  assert.match(source, /publishedOffers\(content\)/);
  assert.match(source, /params: \{ slug: offer.slug.current \}/);
});
test('offers reject incomplete fields, invalid windows and reserved/duplicate/protected slugs', () => {
  for (const field of ['title', 'heading', 'confirmationMessage', 'image', 'ogImage', 'startDate', 'endDate']) {
    assert.throws(() => validateOffer({ ...offer, [field]: undefined }), /Invalid offer/);
  }
  for (const value of ['2026-02-29', '2026-13-01', '2026-12-32', '2026-2-01', '2026-12-01T00:00:00Z']) assert.equal(validOfferDate(value), false);
  assert.equal(validOfferDate('2028-02-29'), true);
  assert.throws(() => validateOffer({ ...offer, startDate: '2026-12-17' }), /date window/);
  for (const slug of ['cabaz-de-natal', 'guia-de-ferias', 'smillingstreet', 'atualizacao-de-informacao', 'obrigado', 'obrigado-oferta', 'oferta-selecao', 'vinho-e-fado', '../test', 'upperCase', 'two--hyphens']) assert.throws(() => validateOffer({ ...offer, slug: { current: slug } }), /reserved public offer slug/);
  assert.throws(() => validateOffer({ ...offer, sourceSlug: 'original-offer' }), /protected source slug/);
  assert.throws(() => publishedOffers([offer, { ...offer, _id: 'other' }]), /Duplicate/);
  assert.match(offerImageUrl(image), /\?w=1600&fit=max&auto=format$/);
  assert.throws(() => offerImageUrl({ asset: { _ref: 'https://attacker.invalid/x' } }), /Invalid offer image/);
});
test('offer URLs enter persistent deployed history while new campaigns stay noindex and out of sitemap', async () => {
  const revision = contentRevision({ documents: [offer] });
  assert.deepEqual(revision.routes, { 'native-offer': '/lp/oferta-inverno' });
  const baseline = { ...revision, routes: { 'native-offer': '/lp/original-offer' } };
  await assert.rejects(deploymentRevision(revision, { fetchImpl: async () => ({ ok: true, json: async () => baseline }) }), /Published CMS URL changed/);
  assert.equal(robotsForPath('/lp/oferta-inverno', 'production'), 'noindex, nofollow');
  assert.equal(sitemapEntries([offer], 'production').some(entry => entry.url.endsWith('/lp/oferta-inverno')), false);
  assert.equal(robotsForPath('/lp/cabaz-de-natal', 'production'), 'index, follow');
});
test('Lisbon date windows are inclusive through winter and daylight-saving boundaries', () => {
  assert.equal(offerWindowState(offer, new Date('2026-11-30T23:59:59Z')), 'upcoming');
  assert.equal(offerWindowState(offer, new Date('2026-12-01T00:00:00Z')), 'active');
  assert.equal(offerWindowState(offer, new Date('2026-12-16T23:59:59Z')), 'active');
  assert.equal(offerWindowState(offer, new Date('2026-12-17T00:00:00Z')), 'ended');
  const summer = { startDate: '2026-06-01', endDate: '2026-06-01' };
  assert.equal(offerWindowState(summer, new Date('2026-05-31T22:59:59Z')), 'upcoming');
  assert.equal(offerWindowState(summer, new Date('2026-05-31T23:00:00Z')), 'active');
  assert.equal(offerWindowState(summer, new Date('2026-06-01T22:59:59Z')), 'active');
  assert.equal(offerWindowState(summer, new Date('2026-06-01T23:00:00Z')), 'ended');
  assert.equal(lisbonDay(new Date('2026-03-29T23:00:00Z')), '2026-03-30');
  assert.equal(lisbonDay(new Date('2026-10-25T23:00:00Z')), '2026-10-25');
});
test('server rejects unpublished, upcoming and expired submissions before any D1 or email work', async () => {
  const adapter = { async notifyLead() { assert.fail('must not send'); }, async captureNewsletter() { assert.fail('must not send'); } };
  for (const now of ['2026-11-30T23:59:59Z', '2026-12-17T00:00:00Z']) {
    let reads = 0;
    const env = { get LEADS_DB() { reads++; assert.fail('must not touch D1'); } };
    const response = await createFormHandler(adapter, { offers: offerMetadata([offer]), now: () => new Date(now) })({ request: request(), env });
    assert.equal(response.status, 403); assert.equal(reads, 0);
  }
  assert.equal((await createFormHandler(adapter, { offers: {} })({ request: request(), env: {} })).status, 403);
  const handler = createFormHandler(adapter, { offers: offerMetadata([offer]), now: () => new Date('2026-12-16T23:59:59Z') });
  assert.equal((await handler({ request: request(), env: {} })).status, 503, 'Valid closing-day submission passes validation and reaches missing DB gate.');
  assert.equal((await handler({ request: request({ ...payload, fields: { ...payload.fields, title: 'Attacker title' } }), env: {} })).status, 422);
  assert.equal((await createFormHandler(adapter, { now: () => new Date('2099-01-01') })({ request: request({ ...payload, route: '/lp/cabaz-de-natal' }), env: {} })).status, 503, 'Legacy Cabaz has no invented date limit.');
});
test('offer emails use trusted metadata, interpolate plain text safely and leave legacy Cabaz unchanged', () => {
  const context = { ...offerMetadata([offer])['oferta-inverno'], title: '<Campanha & amigos>' };
  const emails = buildLeadEmails(payload, undefined, context);
  assert.equal(emails.consultant.subject, 'Nova participação - <Campanha & amigos>');
  assert.ok(emails.customer.text.includes('Olá Ana, recebemos a sua participação na <Campanha & amigos>.'));
  assert.ok(emails.customer.html.includes('&lt;Campanha &amp; amigos&gt;'));
  assert.ok(emails.consultant.text.includes(payload.fields.message));
  const legacy = buildLeadEmails({ ...payload, route: '/lp/cabaz-de-natal' });
  assert.equal(legacy.customer.subject, 'A sua participação no sorteio do cabaz de Natal, Ana');
  assert.ok(legacy.customer.text.includes('Recebemos a sua participação no sorteio do nosso cabaz de Natal. Boa sorte!'));
});
test('active native offers persist unchanged form answers before delivery and retain idempotent retries', async t => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(await readFile(new URL('../../migrations/0001_create_leads.sql', import.meta.url), 'utf8'));
  const env = { LEADS_DB: { prepare(sql) {
    let values = [];
    return { bind(...next) { values = next; return this; },
      async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; } };
  } } };
  let sends = 0;
  const handler = createFormHandler({ async captureNewsletter() { assert.fail('not newsletter'); }, async notifyLead(submission) {
    sends++;
    const row = sqlite.prepare('SELECT * FROM leads').get();
    assert.equal(row.route, payload.route);
    assert.equal(row.message, payload.fields.message);
    assert.equal(row.delivery_status, 'sending');
    assert.equal(submission.fields.firstName, 'Ana');
    return { providerId: 'test-only-receipt' };
  } }, { offers: offerMetadata([offer]), now: () => new Date('2026-12-05T12:00:00Z') });
  assert.equal((await handler({ request: request(), env })).status, 202);
  assert.equal((await handler({ request: request(), env })).status, 202);
  assert.equal(sends, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS total FROM leads').get().total, 1);
});

const compiled = await build({ entryPoints: [new URL('../../src/scripts/dynamic-offer.ts', import.meta.url).pathname], bundle: true, format: 'iife', platform: 'browser', write: false });
async function runtime(t, initialNow) {
  const component = await readFile(new URL('../../src/components/DynamicOfferPage.astro', import.meta.url), 'utf8');
  const form = component.slice(component.indexOf('      <form '), component.indexOf('      <p class="public-campaign__status')).replace('data-route={route}', 'data-route="/lp/oferta-inverno"');
  assert.match(form, /data-offer-form[^>]*hidden/);
  const dom = new JSDOM(`<main data-dynamic-offer data-title="Oferta de inverno" data-heading="Participe" data-start-date="2026-12-01" data-end-date="2026-12-16"><h5 data-offer-heading></h5><p data-offer-thanks hidden>Obrigado</p>${form}<p data-campaign-status hidden></p></main>`, { url: 'https://joaquimmota.pt/lp/oferta-inverno', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  let now = initialNow;
  const RealDate = dom.window.Date;
  dom.window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } };
  const calls = [];
  dom.window.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); return { status: 202 }; };
  dom.window.eval(compiled.outputFiles[0].text);
  const doc = dom.window.document, node = doc.querySelector('form');
  for (const [name, value] of Object.entries({ firstName: 'Ana', lastName: 'Costa', email: 'ana@example.invalid', phone: '912345678', referral: 'Sim, a vender', intent: 'Não', street: 'Rua A', postalCode: '4000-001', county: 'Porto' })) node.elements.namedItem(name).value = value;
  return { doc, form: node, calls, setNow(value) { now = value; }, async submit() { node.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); await new Promise(resolve => setImmediate(resolve)); } };
}
test('client hides inactive forms and blocks a previously open form after its closing day', async t => {
  const upcoming = await runtime(t, '2026-11-30T23:59:59Z');
  assert.ok(upcoming.form.hidden); assert.match(upcoming.doc.querySelector('h5').textContent, /ainda não começaram/);
  const r = await runtime(t, '2026-12-16T23:59:59Z'); assert.equal(r.form.hidden, false);
  r.setNow('2026-12-17T00:00:00Z'); await r.submit();
  assert.ok(r.form.hidden); assert.equal(r.calls.length, 0); assert.match(r.doc.querySelector('h5').textContent, /já terminaram/);
  assert.equal(r.doc.querySelector('[data-offer-thanks]').hidden, false);
});
test('fixed offer form sends the native payload and derives page success from campaign title', async t => {
  const r = await runtime(t, '2026-12-01T12:00:00Z'); await r.submit();
  assert.equal(r.calls.length, 1);
  assert.deepEqual(r.calls[0], payload);
  assert.ok(r.form.hidden);
  assert.match(r.doc.querySelector('[data-campaign-status]').textContent, /Ana.*Oferta de inverno/);
  assert.equal(r.doc.querySelector('[data-campaign-status]').textContent.includes(offer.confirmationMessage), false);
});
test('active dynamic offer handler never sends either required question placeholder', async t => {
  const r = await runtime(t, '2026-12-01T12:00:00Z');
  for (const name of ['referral', 'intent']) {
    const field = r.form.elements.namedItem(name);
    const previous = field.value;
    field.value = ''; await r.submit();
    assert.equal(r.calls.length, 0); assert.equal(r.form.hidden, false);
    assert.equal(field.validity.valueMissing, true);
    field.value = previous;
  }
});
