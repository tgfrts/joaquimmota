import assert from 'node:assert/strict';
import test from 'node:test';
import { assetRef, eligibleItem, imageArray, mapArticle, mapPreListing, mapProcessStep, portableText } from '../../scripts/migration/sample-payloads.mjs';

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
  assert.equal(mapProcessStep({ ...item, fieldData: { ...item.fieldData, page: '663132020846a392d304a25e78392a84' } }, {}).placement, 'home');
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

test('article public date uses createdOn despite a later publication batch and cannot silently disappear', () => {
  const item = { id: 'article-source', cmsLocaleId: 'pt-PT', createdOn: '2026-02-28T12:17:40.199Z', lastPublished: '2026-04-17T10:00:00.000Z', fieldData: { name: 'Original title', slug: 'original-slug', artigo: '<p>Original article.</p>' } };
  const mapped = mapArticle(item, {});
  assert.equal(mapped.publishedAt, '2026-02-28T12:17:40.199Z');
  assert.equal(mapped.slug.current, 'original-slug');
  assert.throws(() => mapArticle({ ...item, createdOn: undefined }, {}), /createdOn/);
  assert.throws(() => mapArticle({ ...item, createdOn: 'invalid-date' }, {}), /createdOn/);
});


test('pre-listing imports the active hero only and fails closed on a changed residual gallery', () => {
  const item = { id: 'prelisting-source', cmsLocaleId: 'pt-PT', fieldData: { name: 'Original client', slug: 'original-prelisting', morada: 'Original address', freguesia: 'Original parish', 'hero-image-2': { fileId: 'hero', url: 'https://example.test/hero.jpg' }, 'galeria-2': [], 'tipo-de-imovel': 'unused-type', tipologia: 'unused-typology' } };
  const mapped = mapPreListing(item, { byFileId: { hero: { asset: { _ref: 'image-own-hero' } } } });
  assert.equal(mapped.heroImage.asset._ref, 'image-own-hero');
  assert.equal(mapped.slug.current, 'original-prelisting');
  assert.equal(Object.hasOwn(mapped, 'gallery'), false);
  assert.equal(Object.hasOwn(mapped, 'propertyType'), false);
  assert.equal(Object.hasOwn(mapped, 'typology'), false);
  assert.throws(() => mapPreListing(item, { byFileId: {} }), /no Sanity image ref/);
  assert.throws(() => mapPreListing({ ...item, fieldData: { ...item.fieldData, 'galeria-2': [{ fileId: 'residual' }] } }, {}), /refresh public visibility inventory/);
});

test('Portable Text preserves H5 and source _blank behavior while rejecting unsupported body constructs', () => {
  const blocks = portableText('<h5>Source subheading</h5><p><a href="https://example.test" target="_blank">External source link</a></p>', 'fixture article');
  assert.equal(blocks[0].style, 'h5');
  const link = blocks[1].markDefs.find((definition) => definition._type === 'link');
  assert.equal(link.href, 'https://example.test');
  assert.equal(link.openInNewTab, true);
  assert.throws(() => portableText('<p>Copy</p><img src="https://example.test/image.jpg" />', 'fixture article'), /unsupported <img>/);
  assert.throws(() => portableText('<p><a href="https://example.test" target="frame">Link</a></p>', 'fixture article'), /unsupported link target/);
});


test('Portable Text preserves NBSP spacing and marks attached to explicit line breaks', () => {
  const blocks=portableText('<h3><strong>1. &nbsp;Source heading</strong></h3><p><a href="https://example.test" target="_blank">Source<br><br></a> after&nbsp; space</p>', 'spacing fixture');
  assert.equal(blocks[0].children.map(child=>child.text).join(''), '1. \u00a0Source heading');
  assert.ok(blocks[0].children.every(child=>child.marks.includes('strong')));
  const link=blocks[1].markDefs.find(definition=>definition._type==='link');
  assert.equal(link.openInNewTab,true);
  const linkedText=blocks[1].children.filter(child=>child.marks.includes(link._key)).map(child=>child.text).join('');
  assert.equal(linkedText,'Source\n\n');
  assert.equal(blocks[1].children.map(child=>child.text).join(''),'Source\n\n after\u00a0 space');
  assert.throws(()=>portableText('<p>Reserved \uE000 character</p>','fixture'), /reserved migration marker/);
});


test('numbered lists retain order and inline marks, with unsupported numbering and nesting rejected', () => {
  const blocks = portableText('<p>Before</p><ol id="" start="1"><li><strong>First</strong></li><li>Second<br>line</li></ol><p>After</p>', 'numbered list');
  assert.deepEqual(blocks.map(block => block.listItem ?? null), [null, 'number', 'number', null]);
  assert.equal(blocks[1].level, 1);
  assert.equal(blocks[1].children[0].text, 'First');
  assert.ok(blocks[1].children[0].marks.includes('strong'));
  assert.equal(blocks[2].children.map(span => span.text).join(''), 'Second\nline');
  for (const html of ['<ol start="2"><li>Two</li></ol>', '<ol reversed><li>Reverse</li></ol>', '<ol type="a"><li>Letter</li></ol>', '<ol><li value="3">Three</li></ol>']) assert.throws(() => portableText(html, 'numbered fixture'), /unsupported .*numbering/);
  for (const html of ['<ol><li>A<ul><li>B</li></ul></li></ol>', '<ul><li>A<ol><li>B</li></ol></li></ul>']) assert.throws(() => portableText(html, 'nested fixture'), /nested list/);
});
