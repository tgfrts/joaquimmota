import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBulkPreview, validateSamplePreview } from '../../scripts/migration/prepare-preview.mjs';

function fixture() {
  const names = { property: 'Imóveis', article: 'Blog Posts', testimonial: 'Testemunhos', offer: 'Ofertas', preListing: 'Pre-Listings', processStep: 'VS Destaques' };
  const counts = { property:65, article:59, testimonial:38, offer:1, preListing:19, processStep:8 };
  const documents = [];
  const source = { siteId:'own-site', collections:[] };
  let index = 0;
  for (const [type, name] of Object.entries(names)) {
    const items = [];
    for (let number=0; number<counts[type]; number++) {
      const id = `source-${index++}`, slug = `original-${id}`;
      items.push({id,cmsLocaleId:'pt',isDraft:false,isArchived:false,fieldData:{slug,page:'663132020846a392d304a25e78392a84'}});
      documents.push({_type:type,_id:`drafts.${id}`,legacyId:id,locale:'pt',sourceSlug:slug,slug:{current:slug}});
    }
    const draft={id:`excluded-${type}`,cmsLocaleId:'pt',isDraft:true,isArchived:false,fieldData:{slug:'draft-slug',page:'663132020846a392d304a25e78392a84'}};
    items.push(draft);
    const live=items.map(item=>({id:item.id,cmsLocaleId:item.cmsLocaleId,slug:item.fieldData.slug}));
    source.collections.push({name,staged:{items,pagination:{total:items.length}},live:{items:live,pagination:{total:live.length}}});
  }
  // Fixture media has the pinned aggregate coverage; no actual assets/providers.
  documents[0].gallery=Array.from({length:1447},(_,i)=>({asset:{_ref:`image-${(i%1342).toString(16).padStart(40,'0')}-10x10-jpg`}}));
  const snapshot={documents};
  const fullPayload=structuredClone(snapshot);
  const manifest={sourceSiteId:'own-site',unresolvedVisibilityCases:[],bulkGate:{status:'passed',bulkWritesPermitted:true,fullPayload:{passed:true}},collections:Object.entries(counts).map(([type,count])=>({type,sourceEligibleItems:count,sourcePhotoSlots:type==='property'?1447:0}))};
  return {source,snapshot,fullPayload,manifest};
}
const check=fixture=>validateBulkPreview(fixture.snapshot,fixture.source,fixture.manifest,fixture.fullPayload);
test('explicit bulk preview validates 190 drafts by source allowlist and aggregate counts only',()=>{
  const f=fixture();assert.deepEqual(check(f),{documents:190,imageSlots:1447,uniqueAssets:1342});
  f.snapshot.documents[0].title='A title is not compared item by item in the aggregate gate';
  f.snapshot.documents[0].gallery.reverse();
  assert.equal(check(f).documents,190);
});
test('bulk preview refuses blocked manifest, missing documents, published targets and source drafts',()=>{
  for(const mutate of [f=>f.manifest.bulkGate.status='blocked',f=>f.snapshot.documents.pop(),f=>f.snapshot.documents[0]._id='published',f=>{const d=f.snapshot.documents[0];d.legacyId='excluded-property';d.sourceSlug='draft-slug';d.slug.current='draft-slug';}]) {
    const f=fixture();mutate(f);assert.throws(()=>check(f));
  }
});
test('bulk preview refuses duplicate identities, changed immutable slugs and incomplete source pagination',()=>{
  for(const mutate of [f=>f.snapshot.documents[1]=structuredClone(f.snapshot.documents[0]),f=>f.snapshot.documents[0].slug.current='new-slug',f=>f.source.collections[0].staged.pagination.total++]) {
    const f=fixture();mutate(f);assert.throws(()=>check(f));
  }
});
test('bulk preview rejects synthetic media, wrong photo totals and wrong collection allocation',()=>{
  for(const mutate of [f=>f.snapshot.documents[0].gallery[0].asset._ref='image-SYNTHETIC-DRY-RUN',f=>f.snapshot.documents[0].gallery.pop(),f=>{f.snapshot.documents[65].gallery=f.snapshot.documents[0].gallery;delete f.snapshot.documents[0].gallery;},f=>f.manifest.collections[1]=f.manifest.collections[0]]) {
    const f=fixture();mutate(f);assert.throws(()=>check(f));
  }
});
test('default sample validator still accepts exactly its eleven authorized draft identities',()=>{
  const f=fixture();const documents=f.snapshot.documents.slice(0,11);
  const evidence={samples:documents.map(d=>({identity:{type:d._type,legacyId:d.legacyId,locale:d.locale},sourceSlug:d.sourceSlug}))};
  assert.equal(validateSamplePreview({documents},evidence),11);
  assert.throws(()=>validateSamplePreview(f.snapshot,evidence),/11 authorized samples/);
});
