import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentRevision, hasContentChanged, deploymentRevision, assertPublishedRoutesUnchanged, PREVIEW_URL, PRODUCTION_URL } from './check-revision.mjs';

test('revision ignores document/object key order but tracks fields and array order', () => {
  const document = { _id: 'a', _type: 'article', slug: { current: 'title' }, title: 'Title', body: ['first', 'second'] };
  const second = { _id: 'b', _type: 'property', slug: { current: 'property' }, price: 200000 };
  const revision = contentRevision({ documents: [document, second] });
  assert.deepEqual(contentRevision({ documents: [second, { body: document.body, title: 'Title', _type: 'article', _id: 'a', slug: { current: 'title' } }] }), revision);
  assert.notEqual(contentRevision({ documents: [{ ...document, title: 'Changed' }, second] }).hash, revision.hash);
  assert.notEqual(contentRevision({ documents: [{ ...document, body: ['second', 'first'] }, second] }).hash, revision.hash);
  assert.notEqual(contentRevision({ documents: [document] }).hash, revision.hash);
  assert.equal(revision.documentCount, 2);
  assert.match(revision.hash, /^[a-f0-9]{64}$/);
  assert.throws(() => contentRevision({ documents: [] }), /nonempty/);
});

test('public route baseline protects newly created CMS URLs without preventing additions/removals', async () => {
  const deployed = { hash: 'a'.repeat(64), documentCount: 2, routes: { newProperty: '/imoveis/original', article: '/post/original-article' } };
  assertPublishedRoutesUnchanged({ routes: { newProperty: '/imoveis/original', fresh: '/imoveis/new' } }, deployed);
  assertPublishedRoutesUnchanged({ routes: {} }, deployed);
  assertPublishedRoutesUnchanged({ routes: { fresh: '/imoveis/new' } }, { hash: 'older-metadata' });
  assert.throws(() => assertPublishedRoutesUnchanged({ routes: { newProperty: '/imoveis/changed' } }, deployed), /Published CMS URL changed/);
  await assert.rejects(hasContentChanged({ routes: { article: '/post/changed' } }, { fetchImpl: async () => ({ ok: true, json: async () => deployed }) }), /Published CMS URL changed/, 'Invariant errors must not become the deploy-on-network-failure fallback.');
  const revision = contentRevision({ documents: [{ _id: 'newProperty', _type: 'property', slug: { current: 'original' }, description: 'Private-field-not-in-route-metadata' }] });
  assert.deepEqual(revision.routes, { newProperty: '/imoveis/original' });
  assert.equal(JSON.stringify(revision).includes('Private-field'), false);
});

test('identical deployed content is identified using uncached metadata', async () => {
  const revision = contentRevision({ documents: [{ _id: 'a' }] });
  assert.equal(await hasContentChanged(revision, { fetchImpl: async (url, options) => {
    assert.equal(url.origin, 'https://migration-preview.joaquimmota.pages.dev');
    assert.equal(url.pathname, '/cms-revision.json');
    assert.ok(url.searchParams.get('check'));
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers['Cache-Control'], 'no-cache');
    return { ok: true, json: async () => revision };
  } }), false);
});

test('changed valid metadata triggers deployment', async () => {
  const revision = contentRevision({ documents: [{ _id: 'a' }] });
  for (const fetchImpl of [
    async () => ({ ok: true, json: async () => ({ ...revision, hash: 'b'.repeat(64) }) }),
    async () => ({ ok: true, json: async () => ({ ...revision, documentCount: 9 }) }),
  ]) assert.equal(await hasContentChanged(revision, { fetchImpl }), true);
  assert.equal(await hasContentChanged(revision, { fetchImpl: async () => ({ ok: true, json: async () => ({ hash: revision.hash, documentCount: revision.documentCount }) }) }), false, 'Valid hash-only metadata may bootstrap the routes baseline.');
});

test('baseline network, HTTP and malformed metadata failures stop deployment', async () => {
  const revision = contentRevision({ documents: [{ _id: 'a' }] });
  for (const fetchImpl of [
    async () => { throw new Error('Network failed'); },
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: false, status: 404 }),
    async () => ({ ok: false, status: 403 }),
    async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } }),
    ...[null, {}, { ...revision, hash: 'bad' }, { ...revision, documentCount: -1 }, { ...revision, documentCount: 1.5 }, { ...revision, routes: null }, { ...revision, routes: [] }, { ...revision, routes: { a: '/wrong/route' } }].map(value => async () => ({ ok: true, json: async () => value })),
  ]) await assert.rejects(hasContentChanged(revision, { fetchImpl }));
});

test('production protects and writes both production and preview URL histories', async () => {
  const revision = contentRevision({ documents: [{ _id: 'new', _type: 'property', slug: { current: 'new' } }] });
  const production = { ...revision, routes: { productionOnly: '/imoveis/production-original' } };
  const preview = { ...revision, hash: 'b'.repeat(64), routes: { previewOnly: '/post/preview-original' } };
  const requested = [];
  const options = { siteEnv: 'production', fetchImpl: async (url, request) => {
    requested.push(url.origin);
    assert.equal(url.pathname, '/cms-revision.json');
    assert.ok(url.searchParams.get('check'));
    assert.equal(request.cache, 'no-store');
    return { ok: true, json: async () => url.origin === PRODUCTION_URL ? production : preview };
  } };
  assert.equal(await hasContentChanged(revision, options), false, 'Compare against production content, regardless of preview hash.');
  assert.deepEqual(requested.sort(), [PREVIEW_URL, PRODUCTION_URL].sort());
  assert.deepEqual(await deploymentRevision(revision, options), { ...revision, routes: { ...production.routes, ...preview.routes, ...revision.routes } });
  for (const [id, route] of [['productionOnly', '/imoveis/changed'], ['previewOnly', '/post/changed']]) {
    const changed = { ...revision, routes: { [id]: route } };
    await assert.rejects(hasContentChanged(changed, options), /Published CMS URL changed/);
    await assert.rejects(deploymentRevision(changed, options), /Published CMS URL changed/);
  }
  production.hash = 'c'.repeat(64);
  preview.hash = revision.hash;
  assert.equal(await hasContentChanged(revision, options), true, 'Matching preview content cannot suppress a production update.');
});

test('production check and write fail closed if either baseline fails or histories conflict', async () => {
  const revision = contentRevision({ documents: [{ _id: 'a' }] });
  const valid = { ...revision, routes: { removed: '/imoveis/original' } };
  for (const failedOrigin of [PRODUCTION_URL, PREVIEW_URL]) {
    for (const failure of [
      async () => { throw new Error('Network failed'); },
      async () => ({ ok: false, status: 404 }),
      async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } }),
      async () => ({ ok: true, json: async () => ({ ...valid, routes: { a: '/bad/route' } }) }),
      async () => ({ ok: true, json: async () => ({ ...valid, hash: 'bad' }) }),
      async () => ({ ok: true, json: async () => ({ hash: revision.hash, documentCount: revision.documentCount }) }),
    ]) {
      const options = { siteEnv: 'production', fetchImpl: async url => url.origin === failedOrigin ? failure() : { ok: true, json: async () => valid } };
      await assert.rejects(hasContentChanged(revision, options));
      await assert.rejects(deploymentRevision(revision, options));
    }
  }
  const conflict = { siteEnv: 'production', fetchImpl: async url => ({ ok: true, json: async () => ({ ...valid, routes: { removed: url.origin === PRODUCTION_URL ? '/imoveis/original' : '/imoveis/changed' } }) }) };
  await assert.rejects(hasContentChanged(revision, conflict), /Published CMS URL changed/);
  await assert.rejects(deploymentRevision(revision, conflict), /Published CMS URL changed/, 'History conflicts must fail even when the document is currently unpublished.');
});

test('preview metadata writes preserve historical routes without reading production', async () => {
  const revision = contentRevision({ documents: [{ _id: 'a' }] });
  const result = await deploymentRevision(revision, { fetchImpl: async url => {
    assert.equal(url.origin, PREVIEW_URL);
    return { ok: true, json: async () => ({ ...revision, routes: { removed: '/imoveis/removed' } }) };
  } });
  assert.deepEqual(result.routes, { removed: '/imoveis/removed' });
});

test('pre-listing URL history bootstraps from old metadata and protects later edits and unpublish/re-publish', async () => {
  const revision = contentRevision({ documents: [{ _id: 'presentation', _type: 'preListing', slug: { current: 'original-presentation' }, clientName: 'Not-in-public-metadata' }] });
  assert.deepEqual(revision.routes, { presentation: '/vouvender/original-presentation' });
  assert.equal(JSON.stringify(revision).includes('Not-in-public-metadata'), false);
  const old = { ...revision, routes: { oldProperty: '/imoveis/protected-property' } };
  const bootstrap = await deploymentRevision(revision, { fetchImpl: async () => ({ ok: true, json: async () => old }) });
  assert.deepEqual(bootstrap.routes, { ...old.routes, ...revision.routes });
  const current = { fetchImpl: async () => ({ ok: true, json: async () => bootstrap }) };
  assert.deepEqual((await deploymentRevision({ ...revision, routes: {} }, current)).routes, bootstrap.routes);
  await assert.rejects(deploymentRevision({ ...revision, routes: { presentation: '/vouvender/changed' } }, current), /Published CMS URL changed/);
  assert.equal(await hasContentChanged(revision, current), false, 'The expanded baseline accepts protected vouvender routes.');
});

test('production webhook dispatch and manual release share serialization and URL guards', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/production.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /workflow_call:\n    secrets:\n      CLOUDFLARE_API_TOKEN:\n        required: true/);
  assert.match(workflow, /group: joaquimmota-production\n  cancel-in-progress: false/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/codex\/migration-foundation'/);
  assert.match(workflow, /SITE_ENV: production/);
  assert.match(workflow, /node scripts\/cms\/check-revision\.mjs\n/);
  assert.match(workflow, /node scripts\/cms\/check-revision\.mjs --write/);
});

test('workflow credential preflight skips pushes but fails webhook/manual dispatch without credentials', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/sanity-preview.yml', import.meta.url), 'utf8');
  const command = workflow.match(/name: Check deployment credential availability[\s\S]*?run: \|\n([\s\S]*?)(?=      - uses:)/)[1];
  const directory = mkdtempSync(join(tmpdir(), 'jrmota-workflow-'));
  try {
    assert.doesNotMatch(workflow, /\bschedule:|\bcron:/);
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /branches: \[codex\/migration-foundation\]/);
    assert.match(workflow, /refresh-preview:\n    if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/codex\/migration-foundation'/);
    assert.match(workflow, /refresh-production:\n    if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/codex\/migration-foundation'\n    uses: \.\/\.github\/workflows\/production\.yml\n    secrets: inherit/);
    for (const [event, token, expected] of [['push', '', 0], ['workflow_dispatch', '', 1], ['workflow_dispatch', 'fixture-token', 0]]) {
      const output = join(directory, `${event}-${expected}-${token ? 'present' : 'missing'}`);
      const result = spawnSync('bash', ['-e', '-c', command], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_EVENT_NAME: event, CLOUDFLARE_API_TOKEN: token } });
      assert.equal(result.status, expected);
      assert.equal(readFileSync(output, 'utf8').trim(), `configured=${Boolean(token)}`);
      assert.equal(result.stdout.includes('fixture-token'), false);
      if (!token) assert.match(result.stdout, /::warning::/);
    }
    const guardedSteps = workflow.split('    steps:\n')[1].split(/\n      - /).slice(2);
    for (const step of guardedSteps) assert.match(step, /if: steps\.credential\.outputs\.configured == 'true'/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
