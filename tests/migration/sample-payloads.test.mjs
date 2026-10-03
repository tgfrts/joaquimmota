import assert from 'node:assert/strict';
import test from 'node:test';
import { assetRef, eligibleItem, imageArray, mapProcessStep, portableText } from '../../scripts/migration/sample-payloads.mjs';

function sourceWithProperty(item, live = item) {
  return {
    collections: [{
      name: 'Imóveis',
      staged: { items: [item] },
      live: { items: [live] },
    }],
  };
}

function propertyItem(overrides = {}) {
  return {
    id: 'sample-property',
    cmsLocaleId: 'pt-PT',
    isDraft: false,
    isArchived: false,
    fieldData: { slug: 'sample-property', ...overrides.fieldData },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'fieldData')),
  };
}

test('draft source remains rejected even with an exact live item', () => {
  const draft = propertyItem({ isDraft: true });
  assert.throws(
    () => eligibleItem(sourceWithProperty(draft), 'property', 'sample-property'),
    /not eligible/,
  );
});

test('an image without an uploaded asset mapping fails closed', () => {
  assert.throws(
    () => assetRef({ byFileId: {} }, { fileId: 'source-file', url: 'https://example.test/image.jpg' }, 'fixture image'),
    /no Sanity image ref/,
  );
});

test('Webflow buying and marketing enum IDs retain their source placement; hidden seller placement is rejected', () => {
  const item = { id: 'step', cmsLocaleId: 'pt-PT', fieldData: { name: 'Step', copy: 'Source copy', slug: 'step', page: '61e1b999e018031966a98c78f8548d5d' } };
  assert.equal(mapProcessStep(item, {}).placement, 'buy');
  assert.equal(mapProcessStep({ ...item, fieldData: { ...item.fieldData, page: '1d2e3b2ba040ba7d01a627b6f2c9396d' } }, {}).placement, 'marketing');
  assert.throws(() => mapProcessStep({ ...item, fieldData: { ...item.fieldData, page: '12b19dfc9cb975be3f2f8c2b397c5af7' } }, {}));
});

test('ordered duplicate media slots receive distinct keys and retain supplied alt text', () => {
  const sourceImages = [
    { fileId: 'same-file', url: 'https://example.test/one.jpg', alt: 'First supplied alt' },
    { fileId: 'same-file', url: 'https://example.test/two.jpg', alt: 'Second supplied alt' },
  ];
  const images = imageArray({ byFileId: { 'same-file': { asset: { _ref: 'image-uploaded' } } } }, sourceImages, 'fixture gallery');
  assert.deepEqual(images.map((image) => image._key), ['source-0-same-file', 'source-1-same-file']);
  assert.deepEqual(images.map((image) => image.alt), ['First supplied alt', 'Second supplied alt']);
  assert.equal(new Set(images.map((image) => image._key)).size, images.length);
});

test('Portable Text conversion keeps block structure and link annotations', () => {
  const blocks = portableText('<p>Read <a href="https://example.test">this source link</a>.</p><h2>Heading</h2>', 'fixture article');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].style, 'h2');
  const link = blocks[0].markDefs.find((definition) => definition._type === 'link');
  assert.equal(link.href, 'https://example.test');
  assert.ok(blocks[0].children.some((child) => child.marks.includes(link._key)));
});
