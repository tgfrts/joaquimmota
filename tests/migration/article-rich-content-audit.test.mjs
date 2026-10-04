import assert from 'node:assert/strict';
import test from 'node:test';
import { auditArticles, semanticBlocks } from '../../scripts/migration/audit-article-rich-content.mjs';

test('semantic comparison ignores nonpainting edge spaces but keeps BR, strong and link targets', () => {
  assert.deepEqual(semanticBlocks('<p>  Copy </p>'), semanticBlocks('<p>Copy</p>'));
  assert.notDeepEqual(semanticBlocks('<ol><li>One</li></ol>'), semanticBlocks('<ul><li>One</li></ul>'));
  assert.notDeepEqual(semanticBlocks('<p>A&nbsp; B</p>'), semanticBlocks('<p>A B</p>'));
  assert.notDeepEqual(semanticBlocks('<p>One<br>Two</p>'), semanticBlocks('<p>One Two</p>'));
  assert.notDeepEqual(semanticBlocks('<p><strong>Copy</strong></p>'), semanticBlocks('<p>Copy</p>'));
  assert.notDeepEqual(semanticBlocks('<p><a href="https://example.test" target="_blank">Copy</a></p>'), semanticBlocks('<p><a href="https://example.test">Copy</a></p>'));
});

test('current Astro renderer preserves heading levels, bullet order, BR and every link mark; source drafts stay excluded', async () => {
  const html='<h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><p>First<strong>bold</strong><em>emphasis</em><br>Last<a href="https://example.test/a" target="_blank">external</a><a href="/comprar">internal</a></p><ul><li>One</li><li>Two</li></ul><ol><li><strong>Number one</strong></li><li>Number two<br>line</li></ol>';
  const item={id:'eligible-fixture',cmsLocaleId:'pt-PT',isDraft:false,isArchived:false,fieldData:{slug:'eligible-fixture',artigo:html}};
  const draft={...item,id:'draft-fixture',isDraft:true,fieldData:{slug:'draft-fixture',artigo:'<img src="https://example.test/never-converted.jpg">'}};
  const report=await auditArticles({collections:[{name:'Blog Posts',staged:{items:[item,draft]},live:{items:[{id:item.id,cmsLocaleId:item.cmsLocaleId,slug:item.fieldData.slug},{id:draft.id,cmsLocaleId:draft.cmsLocaleId,slug:draft.fieldData.slug}]}}]});
  assert.equal(report.eligibleCount,1);assert.equal(report.sourceDraftsExcluded,1);
  assert.equal(report.records[0].semanticMatch,true);assert.equal(report.records[0].structuralMatch,true);
  assert.deepEqual(report.records[0].sourceCounts.headings,{h2:1,h3:1,h4:1,h5:1});
  assert.equal(report.records[0].sourceCounts.listItems,4);assert.equal(report.records[0].sourceCounts.lineBreaks,2);
  assert.equal(report.totals.links,2);assert.equal(report.totals.blankLinks,1);assert.equal(report.totals.articlesWithBlankLinks,1);
  assert.equal(report.unsupportedConstructFixturesRejected,true);
  assert.equal(report.status,'blocked','One fixture cannot impersonate the expected complete 59-item source snapshot.');
});
