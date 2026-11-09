import assert from 'node:assert/strict';
import test from 'node:test';
import { cabazHasEnded } from '../../src/lib/offers.mjs';
import { createFormHandler } from '../../functions/api/forms.ts';

test('Cabaz accepts the whole deadline day in Portugal and closes at midnight', () => {
  assert.equal(cabazHasEnded(new Date('2026-12-18T00:00:00Z')), false);
  assert.equal(cabazHasEnded(new Date('2026-12-18T23:59:59.999Z')), false);
  assert.equal(cabazHasEnded(new Date('2026-12-19T00:00:00Z')), true);
});

test('expired Cabaz submission cannot access storage or send email', async () => {
  let sends = 0;
  const handler = createFormHandler({ async notifyLead() { sends++; }, async captureNewsletter() { sends++; } }, { now: () => new Date('2026-12-19T00:00:00Z') });
  const response = await handler({ request: new Request('https://joaquimmota.pt/api/forms', {
    method: 'POST', headers: { origin: 'https://joaquimmota.pt', 'content-type': 'application/json', 'idempotency-key': 'cabaz-expired-request' },
    body: JSON.stringify({ formType: 'leadMagnet', route: '/lp/cabaz-de-natal', fields: { name: 'Ana Costa', email: 'ana@example.invalid', phone: '912345678', consent: true, message: 'Conhece alguém que esteja a vender ou a comprar casa?: Não\nEstá a pensar vender ou a comprar casa?: Não' } }),
  }), env: { get LEADS_DB() { assert.fail('Expired campaign must not touch storage'); } } });
  assert.equal(response.status, 403);
  assert.equal(sends, 0);
});
