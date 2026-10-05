import { createHash } from 'node:crypto';
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PREVIEW_URL = 'https://migration-preview.joaquimmota.pages.dev';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

/** Object field order is insignificant; gallery/Portable Text array order is significant. */
export function contentRevision(snapshot) {
  if (!Array.isArray(snapshot?.documents) || snapshot.documents.length === 0) throw new Error('Revision requires nonempty published content.');
  const documents = [...snapshot.documents].sort((left, right) => left._id < right._id ? -1 : left._id > right._id ? 1 : 0);
  return {
    hash: createHash('sha256').update(JSON.stringify(stable(documents))).digest('hex'),
    documentCount: documents.length,
    routes: Object.fromEntries(documents.filter(document => ['property', 'article'].includes(document._type)).map(document => [document._id, `/${document._type === 'property' ? 'imoveis' : 'post'}/${document.slug.current}`])),
  };
}

export function assertPublishedRoutesUnchanged(revision, deployed) {
  if (!deployed?.routes) return; // Bootstrap older deployments that have hash-only metadata.
  for (const [id, route] of Object.entries(revision.routes ?? {})) {
    if (Object.hasOwn(deployed.routes, id) && deployed.routes[id] !== route) {
      throw new Error(`Published CMS URL changed for document ${id}: ${deployed.routes[id]} → ${route}. Restore its original slug before deployment.`);
    }
  }
}

async function readDeployedRevision(fetchImpl) {
  const url = new URL('/cms-revision.json', PREVIEW_URL);
  url.searchParams.set('check', Date.now().toString());
  const response = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000), headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error(`Cannot verify published URL baseline (HTTP ${response.status}).`);
  const deployed = await response.json();
  if (!deployed || typeof deployed.hash !== 'string' || !/^[a-f0-9]{64}$/.test(deployed.hash)
    || !Number.isSafeInteger(deployed.documentCount) || deployed.documentCount < 0) {
    throw new Error('Invalid deployed CMS revision metadata.');
  }
  if (Object.hasOwn(deployed, 'routes') && (!deployed.routes || typeof deployed.routes !== 'object' || Array.isArray(deployed.routes)
    || Object.entries(deployed.routes).some(([id, route]) => !id || typeof route !== 'string' || !/^\/(imoveis|post)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route)))) {
    throw new Error('Invalid deployed CMS URL baseline.');
  }
  return deployed;
}

export async function hasContentChanged(revision, { fetchImpl = fetch } = {}) {
  const deployed = await readDeployedRevision(fetchImpl);
  // A failed baseline read must stop deployment rather than erase URL history.
  assertPublishedRoutesUnchanged(revision, deployed);
  return !deployed || deployed.hash !== revision.hash || deployed.documentCount !== revision.documentCount;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = JSON.parse(await readFile(new URL('../../src/data/sample-content.json', import.meta.url), 'utf8'));
  const revision = contentRevision(snapshot);
  if (process.argv.includes('--write')) {
    const deployed = await readDeployedRevision(fetch);
    assertPublishedRoutesUnchanged(revision, deployed);
    // Retain public URL history across unpublish/re-publish, without preventing removal.
    revision.routes = { ...deployed?.routes, ...revision.routes };
    const output = new URL('../../dist/cms-revision.json', import.meta.url);
    await mkdir(new URL('.', output), { recursive: true });
    await writeFile(output, JSON.stringify({ ...revision, generatedAt: new Date().toISOString() }) + '\n');
    console.log(`Published CMS revision: ${revision.hash} (${revision.documentCount} documents)`);
  } else {
    const changed = await hasContentChanged(revision);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
    console.log(`CMS content changed: ${changed}`);
  }
}
