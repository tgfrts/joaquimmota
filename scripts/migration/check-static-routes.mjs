import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function routePathFromHtml(filepath, root) {
  const relative = path.relative(root, filepath).split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'/index.html'.length)}`;
  return `/${relative.slice(0, -'.html'.length)}`;
}

function htmlFiles(directory) {
  if (!fs.existsSync(directory)) throw new Error(`Build output directory does not exist: ${directory}`);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
}

export function buildStaticRouteGate(inventory, eligibilityReport, outputDirectory) {
  if (!Array.isArray(inventory?.pages)) throw new Error('Route inventory must contain a pages array.');
  if (!Array.isArray(eligibilityReport?.collections)) throw new Error('Eligibility report must contain collections.');
  const staticPublished = [];
  const staticDrafts = [];
  const templates = [];
  for (const page of inventory.pages) {
    if (typeof page?.path !== 'string' || !page.path.startsWith('/') || page.path.includes('?') || page.path.includes('#')) {
      throw new Error('Every inventory page must have an absolute path without query or fragment.');
    }
    if (typeof page.draft !== 'boolean') throw new Error(`Page ${page.path} has unknown draft state.`);
    if (page.collectionId !== undefined) {
      if (typeof page.collectionId !== 'string' || !page.collectionId.trim()) throw new Error(`Template ${page.path} has invalid collectionId.`);
      if (!page.draft) templates.push(page);
    } else {
      (page.draft ? staticDrafts : staticPublished).push(page.path);
    }
  }
  const staticPublishedPaths = [...new Set(staticPublished)].sort();
  const staticDraftPaths = [...new Set(staticDrafts)].sort();
  const reportCollections = new Map(eligibilityReport.collections.map((collection) => [collection.collection?.id, collection]));
  const expandedCmsPaths = [];
  for (const template of templates) {
    const reportCollection = reportCollections.get(template.collectionId);
    if (!reportCollection) throw new Error(`No eligibility collection matches CMS template ${template.path}.`);
    for (const item of reportCollection.eligible ?? []) {
      if (typeof item.sourceSlug !== 'string' || !item.sourceSlug.trim() || item.sourceSlug.includes('/')) {
        throw new Error(`Eligible item in collection ${reportCollection.collection.slug} has invalid source slug.`);
      }
      expandedCmsPaths.push(`${template.path.replace(/\/$/, '')}/${item.sourceSlug}`);
    }
  }
  const uniqueExpandedCmsPaths = [...new Set(expandedCmsPaths)].sort();
  if (uniqueExpandedCmsPaths.length !== expandedCmsPaths.length) throw new Error('Eligible CMS items produce duplicate expanded routes.');
  const expectedPaths = [...new Set([...staticPublishedPaths, ...uniqueExpandedCmsPaths])].sort();
  const cmsTemplateBases = templates.map((template) => template.path.replace(/\/$/, ''));
  const actualPaths = htmlFiles(outputDirectory).map((file) => routePathFromHtml(file, outputDirectory));
  const actualSet = new Set(actualPaths);
  const missingPublishedPaths = expectedPaths.filter((route) => !actualSet.has(route));
  const generatedDraftPaths = staticDraftPaths.filter((route) => actualSet.has(route));
  const generatedUnlistedCmsPaths = [...actualSet].filter((route) => cmsTemplateBases.some((base) => route === base || route.startsWith(`${base}/`))
    && !uniqueExpandedCmsPaths.includes(route));
  const passes = missingPublishedPaths.length === 0 && generatedDraftPaths.length === 0 && generatedUnlistedCmsPaths.length === 0;
  return {
    generatedAt: new Date().toISOString(),
    status: passes ? 'pass' : 'fail',
    inventoryPageRecords: inventory.pages.length,
    staticPublishedPageRecords: staticPublished.length,
    excludedStaticDraftPageRecords: staticDrafts.length,
    cmsTemplateRecords: templates.length,
    staticPublishedPaths,
    expandedCmsPaths: uniqueExpandedCmsPaths,
    forbiddenStaticDraftPaths: staticDraftPaths,
    builtHtmlRouteCount: actualSet.size,
    missingPublishedPaths,
    generatedDraftPaths,
    generatedUnlistedCmsPaths,
  };
}

function usage() {
  console.error('Usage: node scripts/migration/check-static-routes.mjs <source-url-inventory.json> <eligibility-report.json> <astro-dist-dir> [report.json]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [inventoryPath, eligibilityPath, outputDirectory, reportPath] = process.argv.slice(2);
  if (!inventoryPath || !eligibilityPath || !outputDirectory) {
    usage();
    process.exitCode = 2;
  } else {
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const eligibility = JSON.parse(fs.readFileSync(eligibilityPath, 'utf8'));
    const report = buildStaticRouteGate(inventory, eligibility, outputDirectory);
    if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.status}: ${report.staticPublishedPageRecords} static published pages; ${report.excludedStaticDraftPageRecords} static drafts excluded; ${report.cmsTemplateRecords} CMS templates; ${report.missingPublishedPaths.length} required routes missing; ${report.generatedDraftPaths.length + report.generatedUnlistedCmsPaths.length} forbidden routes generated.`);
    if (report.status !== 'pass') process.exitCode = 1;
  }
}
