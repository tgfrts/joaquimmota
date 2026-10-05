import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchPublishedContent, writeContentSnapshot } from './fetch-published.mjs';

test('published fetch paginates with an advancing cursor and preserves new content and references', async () => {
  const image = { asset: { _ref: 'image-example-300x200-jpg' } };
  const pages = [
    [{ _id: 'a', _type: 'article', slug: { current: 'article' }, body: [{ children: [{ text: 'Article' }] }] }, { _id: 'b', _type: 'property', slug: { current: 'property' }, featuredImage: image }],
    [{ _id: 'c', _type: 'property', slug: { current: 'new-property' } }],
  ];
  const urls = [];
  const result = await fetchPublishedContent({ pageSize: 2, fetchImpl: async (url, options) => {
    urls.push(url);
    assert.equal(url.hostname, 'kaq1vd9b.api.sanity.io');
    assert.equal(url.searchParams.get('perspective'), 'published');
    assert.equal(options.cache, 'no-store');
    assert.match(url.searchParams.get('query'), /drafts/);
    assert.match(url.searchParams.get('query'), /versions/);
    return { ok: true, json: async () => ({ result: pages.shift() }) };
  } });
  assert.equal(JSON.parse(urls[0].searchParams.get('$after')), '');
  assert.equal(JSON.parse(urls[1].searchParams.get('$after')), 'b');
  assert.equal(result.documents.length, 3);
  assert.deepEqual(result.documents[1].featuredImage, image);
  assert.equal(result.documents[2].legacyId, undefined);
});

test('a full final page is followed by a terminating empty page', async () => {
  let calls = 0;
  const result = await fetchPublishedContent({ pageSize: 1, fetchImpl: async () => ({ ok: true, json: async () => ({ result: calls++ ? [] : [{ _id: 'a', _type: 'article', slug: { current: 'article' } }] }) }) });
  assert.equal(calls, 2);
  assert.equal(result.documents.length, 1);
});

test('public routes require valid unique slugs and protect imported URLs', async () => {
  const run = documents => fetchPublishedContent({ fetchImpl: async () => ({ ok: true, json: async () => ({ result: documents }) }) });
  const property = { _id: 'a', _type: 'property', slug: { current: 'new-property' } };
  assert.equal((await run([property])).documents.length, 1, 'New content needs no legacy identity.');
  for (const slug of [undefined, '', 'Bad Slug', '../invalid', 'double--hyphen', 'accentué', '-leading']) {
    await assert.rejects(run([{ ...property, slug: { current: slug } }]), /Invalid public/);
  }
  await assert.rejects(run([{ ...property, sourceSlug: 'original-property' }]), /protected source slug/);
  await assert.rejects(run([property, { ...property, _id: 'b' }]), /Duplicate published/);
  assert.equal((await run([property, { ...property, _id: 'b', _type: 'article' }])).documents.length, 2, 'Separate route prefixes may share slugs.');
});

test('failed or empty results cannot silently fall back to a previous snapshot', async () => {
  await assert.rejects(fetchPublishedContent({ fetchImpl: async () => ({ ok: false, status: 503 }) }), /HTTP 503/);
  await assert.rejects(fetchPublishedContent({ fetchImpl: async () => ({ ok: true, json: async () => ({ result: [] }) }) }), /no published/);
  await assert.rejects(fetchPublishedContent({ fetchImpl: async () => { throw new Error('Network unavailable'); } }), /Network unavailable/);
});

test('defensive validation rejects drafts, versions and duplicate/unordered IDs', async () => {
  for (const documents of [
    [{ _id: 'drafts.a', _type: 'article' }],
    [{ _id: 'versions.release.a', _type: 'article' }],
    [{ _id: 'a', _type: 'article' }, { _id: 'a', _type: 'property' }],
    [{ _id: 'b', _type: 'article' }, { _id: 'a', _type: 'property' }],
    [{ _id: 'a', _type: 'unknown' }],
  ]) await assert.rejects(fetchPublishedContent({ fetchImpl: async () => ({ ok: true, json: async () => ({ result: documents }) }) }), /invalid, unpublished or unordered/);
});

test('snapshot atomically replaces the previous content', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jrmota-cms-'));
  try {
    const output = pathToFileURL(join(directory, 'content.json'));
    await writeFile(output, '{"documents":[]}');
    const snapshot = { documents: [{ _id: 'a', _type: 'article' }] };
    await writeContentSnapshot(snapshot, output);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), snapshot);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
