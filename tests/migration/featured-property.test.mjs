import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFeaturedProperty,selectFeaturedProperties,selectAvailableProperties} from '../../src/data/cms-content.ts';
const listing=(id,status,updated,banner)=>({_id:id,_type:'property',listingStatus:status,_updatedAt:updated,marketBanner:banner});
test('featured listing selects newest available edit, excluding sold, reserved, cancelled',()=>{
 const records=[listing('old','active','2026-01-01'),listing('new','active','2026-02-01','newPrice'),listing('sold','sold','2026-03-01'),listing('reserved','active','2026-04-01','reserved'),listing('cancelled','expiredCancelled','2026-05-01')];
 assert.equal(selectFeaturedProperty(records)._id,'new');records[0]._updatedAt='2026-07-01';assert.equal(selectFeaturedProperty(records)._id,'old');records[0].marketBanner='reserved';assert.equal(selectFeaturedProperty(records)._id,'new');
 assert.deepEqual(records.map(x=>x._id),['old','new','sold','reserved','cancelled']);
});
test('featured selection has a stable tie-breaker and no ineligible fallback',()=>{
 assert.equal(selectFeaturedProperty([listing('b','active','2026-01-01'),listing('a','active','2026-01-01')])._id,'a');
 assert.equal(selectFeaturedProperty([listing('sold','sold','2026-01-01')]),undefined);
});

test('available listings follow newest edits, retain reserved listings and exclude sold/cancelled',()=>{
 const records=[listing('old','active','2026-01-01'),listing('reserved','active','2026-03-01','reserved'),listing('new','active','2026-02-01'),listing('sold','sold','2026-04-01'),listing('cancelled','expiredCancelled','2026-05-01')];
 assert.deepEqual(selectAvailableProperties(records).map(x=>x._id),['reserved','new','old']);
 records[0]._updatedAt='2026-06-01';assert.equal(selectAvailableProperties(records)[0]._id,'old');records[0].listingStatus='sold';assert.equal(selectFeaturedProperty(records)._id,'new');
});

test('random pool is only the three latest eligible edits, after sold and reserved exclusion',()=>{
 const records=[listing('old','active','2026-01-01'),listing('third','active','2026-02-01'),listing('second','active','2026-03-01'),listing('first','active','2026-04-01'),listing('reserved','active','2026-05-01','reserved'),listing('sold','sold','2026-06-01')];
 assert.deepEqual(selectFeaturedProperties(records).map(x=>x._id),['first','second','third']);assert.equal(selectFeaturedProperties([]).length,0);
});

test('Sanity reserved status remains in directory but never featured',()=>{
 const records=[listing('reserved-status','reserved','2026-05-01'),listing('new','active','2026-04-01')];
 assert.deepEqual(selectAvailableProperties(records).map(x=>x._id),['reserved-status','new']);
 assert.deepEqual(selectFeaturedProperties(records).map(x=>x._id),['new']);
});
