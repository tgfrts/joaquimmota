import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer } from 'astro/container';
import { portableText } from './sample-payloads.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const renderedTags = 'p,h2,h3,h4,h5,li';
export function semanticBlocks(html) {
  const body = new JSDOM(html).window.document.body;
  return [...body.querySelectorAll(renderedTags)].map(element => {
    const runs = [];
    const visit = (node, marks = []) => {
      if (node.nodeType === 3) {
        const text = node.textContent.replace(/[\t\r\n ]+/g, ' ');
        if (text) runs.push({ text, marks });
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') { runs.push({ text: '\n', marks }); return; }
      const next = tag === 'strong' || tag === 'em' ? [...marks, tag] : tag === 'a' ? [...marks, { href: node.getAttribute('href'), openInNewTab: node.getAttribute('target') === '_blank' }] : marks;
      [...node.childNodes].forEach(child => visit(child, next));
    };
    [...element.childNodes].forEach(node => visit(node));
    // Equivalent adjacent text-node boundaries are not product-visible structure.
    const merged = [];
    for (const run of runs) {
      const previous = merged.at(-1);
      if (previous && JSON.stringify(previous.marks) === JSON.stringify(run.marks)) previous.text += run.text;
      else merged.push({ ...run });
    }
    // Collapsed spaces at a block edge do not paint; explicit BR/newlines remain significant.
    if (merged.length) { merged[0].text=merged[0].text.replace(/^ +/,'');merged.at(-1).text=merged.at(-1).text.replace(/ +$/,''); }
    return { tag: element.tagName.toLowerCase(), ...(element.tagName === 'LI' ? { listKind: element.parentElement.tagName.toLowerCase() } : {}), runs: merged.filter(run=>run.text) };
  });
}
function counts(html) {
  const body = new JSDOM(html).window.document.body;
  return { paragraphs: body.querySelectorAll('p').length, headings: Object.fromEntries(['h2','h3','h4','h5'].map(tag => [tag,body.querySelectorAll(tag).length])), listItems:body.querySelectorAll('li').length, lineBreaks:body.querySelectorAll('br').length, strong:body.querySelectorAll('strong').length, nonbreakingSpaces:[...body.querySelectorAll(renderedTags)].reduce((n,e)=>n+(e.textContent.match(/\u00a0/g)?.length??0),0), links:[...body.querySelectorAll('a')].map(a=>({href:a.getAttribute('href'),openInNewTab:a.getAttribute('target')==='_blank'})) };
}
export async function auditArticles(source) {
  const collection = source.collections.find(c => c.name === 'Blog Posts');
  if (!collection?.staged?.items || !collection?.live?.items) throw new Error('Missing complete staged/live Blog Posts snapshot.');
  const eligible = collection.staged.items.filter(item => item.isDraft === false && item.isArchived === false && collection.live.items.some(live => live.id === item.id && live.cmsLocaleId === item.cmsLocaleId && live.slug === item.fieldData?.slug));
  const config = await getViteConfig({server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true},logLevel:'silent'}, {devToolbar:{enabled:false}})({mode:'test',command:'build'});
  const server = await createServer(config);
  try {
    const component = await server.ssrLoadModule('/src/components/CmsRichContent.astro');
    const container = await experimental_AstroContainer.create();
    const records = [];
    for (const item of eligible) {
      const sourceHtml = item.fieldData.artigo;
      try {
        const blocks = portableText(sourceHtml, `article ${item.id}`);
        const rendered = await container.renderToString(component.default,{props:{blocks}});
        const sourceSemantic = semanticBlocks(sourceHtml), renderedSemantic = semanticBlocks(rendered);
        const sourceCounts = counts(sourceHtml), renderedCounts = counts(rendered);
        const semanticMatch = JSON.stringify(sourceSemantic) === JSON.stringify(renderedSemantic);
        const structuralMatch = JSON.stringify(sourceCounts) === JSON.stringify(renderedCounts);
        records.push({legacyId:item.id,locale:item.cmsLocaleId,sourceSlug:item.fieldData.slug,semanticMatch,structuralMatch,sourceDigest:sha256(JSON.stringify(sourceSemantic)),renderedDigest:sha256(JSON.stringify(renderedSemantic)),sourceCounts:{...sourceCounts,links:sourceCounts.links.length,blankLinks:sourceCounts.links.filter(l=>l.openInNewTab).length},renderedCounts:{...renderedCounts,links:renderedCounts.links.length,blankLinks:renderedCounts.links.filter(l=>l.openInNewTab).length}});
      } catch(error) { records.push({legacyId:item.id,locale:item.cmsLocaleId,sourceSlug:item.fieldData.slug,error:error.message}); }
    }
    const rejectedConstructs = ['<p>Copy</p><img src="https://example.test/a.jpg">','<p><a href="https://example.test" target="frame">Copy</a></p>','<ul><li>One<ul><li>Nested</li></ul></li></ul>','<table><tr><td>Copy</td></tr></table>'].map(html=>{try{portableText(html,'unsupported fixture');return false}catch{return true}});
    const failures=records.filter(r=>r.error||!r.semanticMatch||!r.structuralMatch);
    return {generatedAt:new Date().toISOString(),scope:'Read-only aggregate rich-body conversion/rendering audit of eligible source articles; no provider writes or item-by-item Sanity inspection',status:eligible.length===59&&failures.length===0&&rejectedConstructs.every(Boolean)?'passed':'blocked',expectedEligibleCount:59,eligibleCount:eligible.length,sourceDraftsExcluded:collection.staged.items.filter(i=>i.isDraft===true).length,sourceSnapshotSha256:sha256(JSON.stringify(source)),converterSha256:sha256(await fs.readFile(new URL('./sample-payloads.mjs',import.meta.url))),rendererSha256:sha256(await fs.readFile(new URL('../../src/components/CmsRichContent.astro',import.meta.url))),renderMethod:'Actual CmsRichContent.astro loaded through Astro Vite plugin and rendered by AstroContainer; compares ordered semantic blocks and source structural counts',normalization:'HTML whitespace collapse and nonpainting block-edge spaces only; text-node boundaries merged when marks match. Generated Portable Text keys ignored by renderer. BR, heading levels, bullet order, strong/em/link marks and every href/target retained.',totals:{headings:Object.fromEntries(['h2','h3','h4','h5'].map(tag=>[tag,records.reduce((n,r)=>n+(r.sourceCounts?.headings?.[tag]??0),0)])),listItems:records.reduce((n,r)=>n+(r.sourceCounts?.listItems??0),0),lineBreaks:records.reduce((n,r)=>n+(r.sourceCounts?.lineBreaks??0),0),strongElements:records.reduce((n,r)=>n+(r.sourceCounts?.strong??0),0),nonbreakingSpacesSource:records.reduce((n,r)=>n+(r.sourceCounts?.nonbreakingSpaces??0),0),nonbreakingSpacesRendered:records.reduce((n,r)=>n+(r.renderedCounts?.nonbreakingSpaces??0),0),links:records.reduce((n,r)=>n+(r.sourceCounts?.links??0),0),blankLinks:records.reduce((n,r)=>n+(r.sourceCounts?.blankLinks??0),0),articlesWithBlankLinks:records.filter(r=>r.sourceCounts?.blankLinks>0).length},unsupportedConstructFixturesRejected:rejectedConstructs.every(Boolean),failures:failures.map(r=>({legacyId:r.legacyId,error:r.error,semanticMatch:r.semanticMatch,structuralMatch:r.structuralMatch})),records,limitations:['This checks source rich-body semantics and actual target renderer, not whole-page visual, SEO, motion or provider delivery parity.','No full source article body, link URL or private form content is written to this safe report.']};
  } finally {await server.close();}
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [sourcePath,outputPath]=process.argv.slice(2);if(!sourcePath||!outputPath)throw new Error('Usage: node scripts/migration/audit-article-rich-content.mjs <private-source.json> <safe-report.json>');
  const report=await auditArticles(JSON.parse(await fs.readFile(sourcePath,'utf8')));
  const [assetMapPath, originalDirectory, sampleCachePath]=process.argv.slice(4);
  if(assetMapPath&&originalDirectory&&sampleCachePath) {
    const mapping=JSON.parse(await fs.readFile(assetMapPath,'utf8')).byFileId;
    const snapshot=JSON.parse(await fs.readFile(sampleCachePath,'utf8'));
    const refs=new Set();
    const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){if(typeof value._ref==='string'&&value._ref.startsWith('image-'))refs.add(value._ref);Object.values(value).forEach(visit)}};
    visit(Array.isArray(snapshot)?snapshot:snapshot.documents);
    const checks=[];
    for(const ref of refs) {
      const entry=Object.entries(mapping).find(([,row])=>row.asset?._ref===ref);
      if(!entry){checks.push({status:'missing-map'});continue;}
      const [sourceFileId]=entry;
      try {const bytes=await fs.readFile(path.join(originalDirectory,sourceFileId));const sha1=createHash('sha1').update(bytes).digest('hex');checks.push({sourceFileId,originalSha1:sha1,referenceHash:ref.match(/^image-([a-f0-9]+)-/)?.[1],matches:sha1===ref.match(/^image-([a-f0-9]+)-/)?.[1]})}catch{checks.push({sourceFileId,status:'missing-original-file'})}
    }
    report.sampleAssetReferenceIntegrity={scope:'Current eleven sample documents only; checks locally retained original bytes against SHA-1 encoded in each referenced Sanity asset ID, without provider writes or a new remote byte download',referencedUniqueAssets:refs.size,verifiedOriginalBytes:checks.filter(c=>c.matches).length,status:checks.every(c=>c.matches)?'passed':'blocked',checks,limitation:'Does not re-download Sanity CDN bytes; upload provenance remains the recorded asset mapping plus the encoded asset content hash.'};
    if(report.sampleAssetReferenceIntegrity.status!=='passed')report.status='blocked';
  }
  await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,eligibleCount:report.eligibleCount,totals:report.totals,failures:report.failures}));if(report.status!=='passed')process.exitCode=1;
}
