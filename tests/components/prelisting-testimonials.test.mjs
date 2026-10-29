import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { selectPreListingTestimonials } from '../../src/data/prelisting-testimonials.ts';

const testimonial = (id, extra = {}) => ({ _id: id, _type: 'testimonial', clientName: id, quote: `Quote ${id}`, ...extra });

test('new presentations need no migration identity and use a bounded deterministic published selection', () => {
  const records = [
    ...Array.from({ length: 12 }, (_, index) => testimonial(`t-${String(index).padStart(2, '0')}`)).reverse(),
    testimonial('drafts.first'), testimonial('versions.release.first'),
    testimonial('invalid-name', { clientName: ' ' }), testimonial('invalid-quote', { quote: '' }),
    testimonial('not-a-testimonial', { _type: 'property' }),
  ];
  const original = records.slice();
  assert.deepEqual(selectPreListingTestimonials(records, { _type: 'preListing' }, [], []).map(item => item._id),
    Array.from({ length: 10 }, (_, index) => `t-${String(index).padStart(2, '0')}`));
  assert.deepEqual(records, original, 'Selection does not mutate the snapshot.');
  assert.deepEqual(selectPreListingTestimonials([], { _type: 'preListing' }, [], []), []);
});

test('all nineteen migrated testimonial mappings retain their exact source identity, content and order', () => {
  const order = JSON.parse(readFileSync(new URL('../../src/data/prelisting-testimonial-order.json', import.meta.url)));
  const source = JSON.parse(readFileSync(new URL('../../src/data/prelisting-testimonial-source.json', import.meta.url))).testimonials;
  const records = source.map((item, index) => ({ ...item, _type: 'testimonial', _id: `published-${index}` }));
  assert.equal(order.routes.length, 19);
  for (const route of order.routes) {
    const expected = route.testimonials.map(entry => {
      const own = entry.candidateLegacyIds.map(id => records.find(item => item._type === 'testimonial' && item.legacyId === id)).find(Boolean);
      return own ?? source.find(item => entry.candidateLegacyIds.includes(item.legacyId));
    });
    assert.deepEqual(selectPreListingTestimonials(records, { legacyId: route.preListingLegacyId }, order.routes, source), expected, route.slug);
    assert.deepEqual(selectPreListingTestimonials([], { legacyId: route.preListingLegacyId }, order.routes, source),
      route.testimonials.map(entry => source.find(item => entry.candidateLegacyIds.includes(item.legacyId))), `${route.slug} source fallback`);
  }
});

test('missing migrated source authority remains a build error instead of silently changing old pages', () => {
  assert.throws(() => selectPreListingTestimonials([], { legacyId: 'unknown-legacy' }, [], []), /Missing verified public/);
  assert.throws(() => selectPreListingTestimonials([], { legacyId: 'known' }, [{ preListingLegacyId: 'known', testimonials: [{ candidateLegacyIds: ['missing'] }] }], []), /Missing eligible/);
});
