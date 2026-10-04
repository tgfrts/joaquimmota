import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { collectVisibleAssets, prepareMedia } from '../../scripts/migration/prepare-bulk-media.mjs';

const ids = {
  buy: '61e1b999e018031966a98c78f8548d5d',
  home: '663132020846a392d304a25e78392a84',
  seller: '12b19dfc9cb975be3f2f8c2b397c5af7',
  exclusive: '476ae63fed50f2fc5dcf2605b91221c0',
};

function item(id, slug, fields = {}, options = {}) {
  return { id, cmsLocaleId: 'locale-pt', isDraft: options.draft ?? false, isArchived: false, fieldData: { slug, ...fields } };
}

function collection(name, slug, fields, items) {
  return {
    name, slug, schema: { fields },
    staged: { items, pagination: { total: items.length } },
    live: { items: items.map((entry) => ({ id: entry.id, cmsLocaleId: entry.cmsLocaleId, slug: entry.fieldData.slug })) , pagination: { total: items.length } },
  };
}

function fixture() {
  const propertyItems = [
    item('property-visible', 'visivel', {
      hero: { fileId: 'asset-a', url: 'https://cdn.prod.website-files.com/site/a.jpg' },
      gallery: [
        { fileId: 'asset-b', url: 'https://uploads-ssl.webflow.com/site/b.jpg' },
        { fileId: 'asset-a', url: 'https://cdn.prod.website-files.com/site/a.jpg' },
      ],
    }),
    item('property-draft', 'draft', { hero: { fileId: 'draft-asset', url: 'https://cdn.prod.website-files.com/site/draft.jpg' } }, { draft: true }),
  ];
  const processItems = [
    ...Array.from({ length: 5 }, (_, index) => item(`buy-${index}`, `buy-${index}`, { page: ids.buy, image: { fileId: `buy-asset-${index}`, url: `https://cdn.prod.website-files.com/site/buy-${index}.jpg` } })),
    ...Array.from({ length: 3 }, (_, index) => item(`home-${index}`, `home-${index}`, { page: ids.home })),
    ...Array.from({ length: 7 }, (_, index) => item(`seller-${index}`, `seller-${index}`, { page: ids.seller, image: { fileId: `seller-asset-${index}`, url: `https://cdn.prod.website-files.com/site/seller-${index}.jpg` } })),
    ...Array.from({ length: 3 }, (_, index) => item(`exclusive-${index}`, `exclusive-${index}`, { page: ids.exclusive })),
    item('marketing-draft', 'marketing-draft', { page: '1d2e3b2ba040ba7d01a627b6f2c9396d' }, { draft: true }),
  ];
  return { collections: [
    collection('Imóveis', 'imoveis', [{ slug: 'hero', type: 'Image' }, { slug: 'gallery', type: 'MultiImage' }], propertyItems),
    collection('Blog Posts', 'post', [], [item('article', 'article')]),
    collection('Testemunhos', 'testemunhos', [], [item('testimonial', 'testimonial')]),
    collection('Ofertas', 'ofertas', [], [item('offer', 'offer')]),
    collection('Pre-Listings', 'vouvender', [
      { slug: 'hero-image-2', type: 'Image' }, { slug: 'galeria-2', type: 'MultiImage' },
    ], [item('prelisting', 'prelisting', {
      'hero-image-2': { fileId: 'prelisting-hero', url: 'https://cdn.prod.website-files.com/site/prelisting.jpg' },
      'galeria-2': [{ fileId: 'excluded-gallery', url: 'https://cdn.prod.website-files.com/site/unused.jpg' }],
    })]),
    collection('VS Destaques', 'vs-destaques', [{ slug: 'image', type: 'Image' }], processItems),
  ] };
}

test('visible media inventory preserves positions and excludes drafts and hidden placements/fields', () => {
  const inventory = collectVisibleAssets(fixture());
  assert.equal(inventory.documents.length, 13);
  assert.equal(inventory.slots.length, 9);
  assert.equal(inventory.assets.length, 8);
  assert.deepEqual(inventory.slots.map(({ position, sourceCollection, sourceField, fieldIndex, fileId }) => ({ position, sourceCollection, sourceField, fieldIndex, fileId })), [
    { position: 0, sourceCollection: 'Imóveis', sourceField: 'hero', fieldIndex: 0, fileId: 'asset-a' },
    { position: 1, sourceCollection: 'Imóveis', sourceField: 'gallery', fieldIndex: 0, fileId: 'asset-b' },
    { position: 2, sourceCollection: 'Imóveis', sourceField: 'gallery', fieldIndex: 1, fileId: 'asset-a' },
    { position: 3, sourceCollection: 'Pre-Listings', sourceField: 'hero-image-2', fieldIndex: 0, fileId: 'prelisting-hero' },
    { position: 4, sourceCollection: 'VS Destaques', sourceField: 'image', fieldIndex: 0, fileId: 'buy-asset-0' },
    { position: 5, sourceCollection: 'VS Destaques', sourceField: 'image', fieldIndex: 0, fileId: 'buy-asset-1' },
    { position: 6, sourceCollection: 'VS Destaques', sourceField: 'image', fieldIndex: 0, fileId: 'buy-asset-2' },
    { position: 7, sourceCollection: 'VS Destaques', sourceField: 'image', fieldIndex: 0, fileId: 'buy-asset-3' },
    { position: 8, sourceCollection: 'VS Destaques', sourceField: 'image', fieldIndex: 0, fileId: 'buy-asset-4' },
  ]);
  assert.ok(inventory.documents.every(({ legacyId }) => !legacyId.includes('draft') && !legacyId.startsWith('seller-') && !legacyId.startsWith('exclusive-')));
});

test('incomplete source pagination blocks media inventory preparation', () => {
  const source = fixture();
  source.collections[0].staged.pagination.total += 1;
  assert.throws(() => collectVisibleAssets(source), /Incomplete staged pagination for Imóveis/);
});

test('one source file ID cannot silently change its public URL between placements', () => {
  const source = fixture();
  source.collections[0].staged.items[0].fieldData.gallery[1].url = 'https://cdn.prod.website-files.com/site/other.jpg';
  assert.throws(() => collectVisibleAssets(source), /One source file ID resolves to multiple URLs/);
});

test('non-Webflow and non-HTTPS source URLs are rejected before GET', () => {
  const source = fixture();
  source.collections[0].staged.items[0].fieldData.hero.url = 'https://example.com/untrusted.jpg';
  assert.throws(() => collectVisibleAssets(source), /outside the approved public Webflow asset hosts/);
});

test('validated source files are reused by checksum and resumed into the private media cache', async () => {
  const source = fixture();
  const inventory = collectVisibleAssets(source);
  const root = await fs.mkdtemp('/private/tmp/jrmota-media-test-');
  const sourceCache = `${root}/validated`;
  const outputCache = `${root}/full`;
  await fs.mkdir(sourceCache);
  const records = inventory.assets.map((asset) => {
    const bytes = Buffer.from(`validated:${asset.fileId}`);
    const sourceSHA1 = createHash('sha1').update(bytes).digest('hex');
    return { fileId: asset.fileId, sourceURL: asset.url, sourceSHA1, sourceBytes: bytes.length, originalDigestMatches: true, originalSizeMatches: true, bytes };
  });
  for (const record of records) await fs.writeFile(`${sourceCache}/${record.fileId}`, record.bytes);
  try {
    const result = await prepareMedia(source, { records }, { cacheDir: outputCache, validatedCacheDir: sourceCache });
    assert.equal(result.inventoryCounts.uniqueAssets, 8);
    assert.equal(result.assets.length, 8);
    assert.equal(result.assets.every((entry) => entry.reusedValidated), true);
    assert.equal(result.failures.length, 0);
    assert.ok(await fs.stat(`${outputCache}/${records[0].fileId}`));
    assert.ok(await fs.stat(`${outputCache}/source-digest-checkpoint.json`));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
