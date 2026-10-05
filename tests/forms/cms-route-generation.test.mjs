import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCmsFormRoutes } from '../../scripts/forms/property-email-details.mjs';

test('new CMS documents get form routes and property metadata without legacy IDs', () => {
  const result = buildCmsFormRoutes({ documents: [
    { _id: 'new-property', _type: 'property', slug: { current: 'new-home' }, sourceSlug: 'old-home', title: 'New home', referenceCode: 'NEW001' },
    { _id: 'new-article', _type: 'article', slug: { current: 'new-article' } },
  ] }, { offerSlugs: [], propertySlugs: ['removed-home'], articleSlugs: ['removed-article'] });
  assert.deepEqual(result.routes, { offerSlugs: [], propertySlugs: ['new-home'], articleSlugs: ['new-article'] });
  assert.deepEqual(result.properties['new-home'], { title: 'New home', reference: 'NEW001' });
});

test('invalid or duplicate public slugs fail route generation', () => {
  for (const slug of ['../admin', 'house/child', 'house?draft=true', 'house#x', '', ' house', '__proto__']) {
    assert.throws(() => buildCmsFormRoutes([{ _type: 'property', slug: { current: slug } }]), /Invalid public slug/);
  }
  assert.throws(() => buildCmsFormRoutes([
    { _type: 'property', slug: { current: 'same-home' } },
    { _type: 'property', slug: { current: 'same-home' } },
  ]), /Duplicate property slug/);
});
