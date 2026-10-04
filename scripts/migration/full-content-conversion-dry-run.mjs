import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildFullPayload } from './sample-payloads.mjs';
import { auditArticles } from './audit-article-rich-content.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const kinds = { 'Imóveis': 'property', 'Blog Posts': 'article', Testemunhos: 'testimonial', Ofertas: 'offer', 'Pre-Listings': 'preListing', 'VS Destaques': 'processStep' };
export function conversionDryRun(source, manifest) {
  if (manifest.status !== 'ready' || manifest.assets?.length !== 1342 || manifest.failures?.length) throw new Error('A ready source media manifest with 1342 receipts is required.');
  // These intentionally invalid preview IDs only satisfy the local mapper's
  // image-reference shape; they are never uploaded, persisted as content or approved.
  const syntheticMap = Object.fromEntries(manifest.assets.map((asset) => {
    if (!/^[a-f0-9]{40}$/.test(asset.sourceSHA1) || !(asset.sourceBytes > 0)) throw new Error('Source hash receipt is incomplete.');
    return [asset.fileId, `image-SYNTHETIC-DRY-RUN-${asset.sourceSHA1}-1x1-preview`];
  }));
  let payload;
  const failures = [];
  let individuallyConverted = 0;
  let individualAttempts = 0;
  try { payload = buildFullPayload(source, syntheticMap); }
  catch (error) {
    // Diagnose every eligible record with the same production builder, keeping
    // pagination totals intact and excluding other records only in memory.
    for (const collection of source.collections.filter((entry) => kinds[entry.name])) {
      for (const item of collection.staged.items) {
        if (item.isDraft !== false || item.isArchived !== false) continue;
        if (collection.name === 'VS Destaques' && !['61e1b999e018031966a98c78f8548d5d', '663132020846a392d304a25e78392a84'].includes(item.fieldData?.page)) continue;
        const isolated = structuredClone(source);
        for (const candidateCollection of isolated.collections) for (const candidate of candidateCollection.staged.items) {
          if (candidateCollection.name !== collection.name || candidate.id !== item.id || candidate.cmsLocaleId !== item.cmsLocaleId) candidate.isDraft = true;
        }
        individualAttempts++;
        try { individuallyConverted += buildFullPayload(isolated, syntheticMap).documents.length; }
        catch (failure) { failures.push({ type: kinds[collection.name], legacyId: item.id, error: failure.message }); }
      }
    }
    if (!failures.length) failures.push({ type: 'aggregate', error: error.message });
  }
  const counts = { documents: payload?.documents.length ?? 0, routes: payload?.routes.length ?? 0, imageSlots: 0, uniqueSyntheticReferences: 0, portableTextFields: 0, portableTextBlocks: 0, types: {} };
  const refs = new Set();
  function visit(value) {
    if (Array.isArray(value)) {
      if (value.some((entry) => entry?._type === 'block')) { counts.portableTextFields++; counts.portableTextBlocks += value.filter((entry) => entry?._type === 'block').length; }
      value.forEach(visit);
    } else if (value && typeof value === 'object') {
      if (value._type === 'image') { counts.imageSlots++; refs.add(value.asset._ref); }
      Object.values(value).forEach(visit);
    }
  }
  for (const document of payload?.documents ?? []) { counts.types[document._type] = (counts.types[document._type] ?? 0) + 1; visit(document); }
  counts.uniqueSyntheticReferences = refs.size;
  if (payload && (counts.documents !== 190 || counts.imageSlots !== 1447 || refs.size !== 1342)) failures.push({ type: 'aggregate', error: 'Converted counts differ from the pinned 190 documents / 1447 slots / 1342 assets.' });
  return { diagnosticIndividualConversions: payload ? undefined : { attempted: individualAttempts, succeeded: individuallyConverted }, status: failures.length ? 'conversion-failed' : 'conversion-succeeded-only', counts, sourceReceiptCount: manifest.assets.length, failures, limitations: ['Synthetic image references exist only in memory and are not destination assets.', 'This checks all production-mapped content fields and converter rejection rules, not renderer or visual parity.', 'No provider call, upload, content import, publication or bulk acceptance was performed.'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourcePath, manifestPath, reportPath] = process.argv.slice(2);
  if (!sourcePath || !manifestPath || !reportPath) throw new Error('Usage: source.json source-media-manifest.json safe-report.json');
  const sourceBytes = await readFile(sourcePath);
  const manifestBytes = await readFile(manifestPath);
  const converterBytes = await readFile(new URL('./sample-payloads.mjs', import.meta.url));
  const report = { generatedAt: new Date().toISOString(), sourceSHA256: sha256(sourceBytes), sourceManifestSHA256: sha256(manifestBytes), converterSHA256: sha256(converterBytes), ...conversionDryRun(JSON.parse(sourceBytes), JSON.parse(manifestBytes)) };
  const source = JSON.parse(sourceBytes);
  const property = source.collections.find(collection => collection.name === 'Imóveis').staged.items.find(item => item.id === '650adb87585f82f314b74670');
  if (!property || property.isDraft !== false || property.isArchived !== false) throw new Error('Pinned numbered-list source property is missing or excluded.');
  const auditItem = { ...property, fieldData: { ...property.fieldData, artigo: property.fieldData['descricao-completa'] } };
  const rendering = await auditArticles({ collections: [{ name: 'Blog Posts', staged: { items: [auditItem] }, live: { items: [{ id: property.id, cmsLocaleId: property.cmsLocaleId, slug: property.fieldData.slug }] } }] });
  const record = rendering.records[0];
  report.numberedPropertyRendering = { legacyId: property.id, sourceSlug: property.fieldData.slug, semanticMatch: record?.semanticMatch === true, structuralMatch: record?.structuralMatch === true, sourceListItems: record?.sourceCounts?.listItems, renderedListItems: record?.renderedCounts?.listItems, sourceDigest: record?.sourceDigest, renderedDigest: record?.renderedDigest, rendererSHA256: rendering.rendererSha256, method: rendering.renderMethod };
  if (!record?.semanticMatch || !record?.structuralMatch) { report.failures.push({ type: 'property-rendering', legacyId: property.id, error: record?.error ?? 'Numbered-list renderer differs from the source.' }); report.status = 'conversion-failed'; }
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, counts: report.counts, failureCount: report.failures.length }));
  if (report.failures.length) process.exitCode = 1;
}
