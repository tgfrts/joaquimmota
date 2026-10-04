import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildStaticRouteGate, OWNER_EXCLUDED_SOURCE_ROUTES } from '../../scripts/migration/check-static-routes.mjs';

function withBuild(files, run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jrmota-static-routes-'));
  try {
    for (const file of files) {
      const fullPath = path.join(directory, file);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '<html></html>');
    }
    return run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const htmlFileFor = (route) => route === '/' ? 'index.html' : `${route.slice(1)}/index.html`;

test('file-format output preserves nested extensionless routes and draft exclusions', () => {
  const inventory = { pages: [
    { path: '/', draft: false },
    { path: '/lp/public', draft: false },
    { path: '/lp/draft', draft: true },
    { path: '/imoveis', draft: false, collectionId: 'properties' },
  ] };
  const eligibility = { collections: [{ collection: { id: 'properties' }, eligible: [{ sourceSlug: 'original-slug' }] }] };
  withBuild(['index.html', 'lp/public.html', 'imoveis/original-slug.html'], (dist) => {
    const report = buildStaticRouteGate(inventory, eligibility, dist);
    assert.equal(report.status, 'pass');
    assert.deepEqual(report.missingPublishedPaths, []);
    assert.deepEqual(report.generatedDraftPaths, []);
  });
  withBuild(['index.html', 'lp/public.html', 'lp/draft.html', 'imoveis/original-slug.html'], (dist) => {
    assert.deepEqual(buildStaticRouteGate(inventory, eligibility, dist).generatedDraftPaths, ['/lp/draft']);
  });
});

test('real inventory separates 35 static pages, 9 drafts, and 10 CMS templates; /imoveis base remains excluded', () => {
  const inventory = JSON.parse(fs.readFileSync(new URL('../../docs/migration/source-url-inventory.json', import.meta.url), 'utf8'));
  const templates = inventory.pages.filter((page) => page.collectionId && page.draft === false);
  const eligibility = { collections: templates.map((template) => ({
    collection: { id: template.collectionId, slug: template.path.slice(1) },
    eligible: [{ sourceId: `item-${template.collectionId}`, sourceLocaleId: 'locale', sourceSlug: `eligible-${template.collectionId}` }],
  })) };
  const staticPublished = inventory.pages.filter((page) => !page.collectionId && page.draft === false).map((page) => page.path)
    .filter((route) => !OWNER_EXCLUDED_SOURCE_ROUTES.includes(route));
  const expandedCms = templates.map((page) => `${page.path}/${eligibility.collections.find((c) => c.collection.id === page.collectionId).eligible[0].sourceSlug}`)
    .filter((route) => !OWNER_EXCLUDED_SOURCE_ROUTES.includes(route));
  const files = [...new Set([...staticPublished, ...expandedCms])].map(htmlFileFor);
  withBuild(files, (dist) => {
    const report = buildStaticRouteGate(inventory, eligibility, dist);
    assert.equal(report.status, 'pass');
    assert.equal(report.inventoryPageRecords, 54);
    assert.equal(report.sourceStaticPublishedPageRecords, 35);
    assert.equal(report.staticPublishedPageRecords, 32);
    assert.equal(report.excludedStaticDraftPageRecords, 9);
    assert.equal(report.cmsTemplateRecords, 10);
    assert.equal(report.staticPublishedPaths.includes('/imoveis'), false);
    assert.ok(report.forbiddenStaticDraftPaths.includes('/imoveis'));
    assert.ok(report.expandedCmsPaths.some((route) => route.startsWith('/imoveis/eligible-')));
    assert.deepEqual(report.ownerExcludedSourceRoutes, [
      '/doop/relatorios-de-atividades', '/doop/relatorios-de-visita', '/lp/oferta-selecao', '/ofertas/vinho-e-fado',
    ]);
    assert.deepEqual(report.generatedOwnerExcludedPaths, []);
    assert.deepEqual(report.missingPublishedPaths, []);
    assert.deepEqual(report.generatedDraftPaths, []);
    assert.deepEqual(report.generatedUnlistedCmsPaths, []);
  });
});

test('Owner-excluded source URLs remain in historical inventory but must not be generated', () => {
  const inventory = { pages: [
    { path: '/lp/oferta-selecao', draft: false },
    { path: '/doop/relatorios-de-atividades', draft: false },
    { path: '/doop/relatorios-de-visita', draft: false },
    { path: '/ofertas', draft: false, collectionId: 'offers' },
  ] };
  const eligibility = { collections: [{ collection: { id: 'offers' }, eligible: [{ sourceSlug: 'vinho-e-fado' }] }] };
  withBuild([], (dist) => {
    const report = buildStaticRouteGate(inventory, eligibility, dist);
    assert.equal(report.status, 'pass');
    assert.deepEqual(report.staticPublishedPaths, []);
    assert.deepEqual(report.expandedCmsPaths, []);
    assert.deepEqual(report.ownerExcludedSourceRoutes, [
      '/doop/relatorios-de-atividades', '/doop/relatorios-de-visita', '/lp/oferta-selecao', '/ofertas/vinho-e-fado',
    ]);
  });
  withBuild([
    'lp/oferta-selecao/index.html',
    'doop/relatorios-de-atividades/index.html',
    'doop/relatorios-de-visita/index.html',
    'ofertas/vinho-e-fado/index.html',
  ], (dist) => {
    const report = buildStaticRouteGate(inventory, eligibility, dist);
    assert.equal(report.status, 'fail');
    assert.deepEqual(report.generatedOwnerExcludedPaths, [
      '/doop/relatorios-de-atividades', '/doop/relatorios-de-visita', '/lp/oferta-selecao', '/ofertas/vinho-e-fado',
    ]);
  });
});

test('CMS template base does not authorize draft index and extra noneligible expansions fail', () => {
  const inventory = { pages: [
    { path: '/public', draft: false },
    { path: '/imoveis', draft: true },
    { path: '/imoveis', draft: false, collectionId: 'collection-1' },
  ] };
  const eligibility = { collections: [{
    collection: { id: 'collection-1', slug: 'imoveis' },
    eligible: [{ sourceId: 'source-1', sourceLocaleId: 'pt', sourceSlug: 'authorized-slug' }],
  }] };
  withBuild(['public/index.html', 'imoveis/index.html', 'imoveis/authorized-slug/index.html', 'imoveis/not-eligible/index.html'], (dist) => {
    const report = buildStaticRouteGate(inventory, eligibility, dist);
    assert.equal(report.status, 'fail');
    assert.deepEqual(report.missingPublishedPaths, []);
    assert.deepEqual(report.generatedDraftPaths, ['/imoveis']);
    assert.deepEqual(report.generatedUnlistedCmsPaths, ['/imoveis', '/imoveis/not-eligible']);
  });
});

test('missing eligible route or eligibility mapping for a published template fails', () => {
  const inventory = { pages: [
    { path: '/public', draft: false },
    { path: '/cms', draft: false, collectionId: 'collection-1' },
  ] };
  withBuild([], (dist) => {
    const report = buildStaticRouteGate(inventory, { collections: [{
      collection: { id: 'collection-1' }, eligible: [{ sourceSlug: 'expected-item' }],
    }] }, dist);
    assert.deepEqual(report.missingPublishedPaths, ['/cms/expected-item', '/public']);
    assert.throws(() => buildStaticRouteGate(inventory, { collections: [] }, dist), /No eligibility collection matches/);
  });
});

test('unknown draft state fails closed', () => {
  const inventory = { pages: [{ path: '/unknown', draft: null }] };
  withBuild([], (dist) => assert.throws(() => buildStaticRouteGate(inventory, { collections: [] }, dist), /unknown draft state/));
});
