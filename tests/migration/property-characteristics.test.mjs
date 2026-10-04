import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {hasPropertyCharacteristic} from '../../src/lib/property-characteristics.ts';
const root=new URL('../../',import.meta.url);
test('only finite positive values have a property indicator',()=>{
 for(const value of [undefined,null,'',' ',0,'0','0.00',-1,NaN,Infinity,'unknown',false,true])assert.equal(hasPropertyCharacteristic(value),false,`${value}`);
 for(const value of [1,'2',0.5,'95.5'])assert.equal(hasPropertyCharacteristic(value),true,`${value}`);
});
test('built cards and detail headers omit the entire indicator for missing or zero values',()=>{
 const snapshot=JSON.parse(fs.readFileSync(new URL('src/data/sample-content.json',root),'utf8'));
 const records=Array.isArray(snapshot)?snapshot:snapshot.documents;
 const document=new JSDOM(fs.readFileSync(new URL('dist/comprar.html',root),'utf8')).window.document;
 let absent=0,present=0;
 for(const card of document.querySelectorAll('.buy-property')){
  const record=records.find(x=>x._type==='property'&&x.legacyId===card.dataset.sourceId);
  const slug=record.slug.current;
  const detail=new JSDOM(fs.readFileSync(new URL(`dist/imoveis/${slug}.html`,root),'utf8')).window.document;
  for(const [field,icon] of [['bedrooms','bed'],['bathrooms','bath'],['parkingSpaces','garage']]){
   const expected=hasPropertyCharacteristic(record[field]);
   assert.equal(Boolean(card.querySelector(`.buy-property__facts img[src="/assets/property-${icon}.svg"]`)),expected,`${slug} card ${field}`);
   assert.equal(Boolean(detail.querySelector(`.property-page__facts img[src="/assets/property-${icon}.svg"]`)),expected,`${slug} detail ${field}`);
   expected?present++:absent++;
  }
  assert.equal(card.querySelectorAll('.buy-property__area').length,hasPropertyCharacteristic(record.grossArea)?1:0);
  assert.equal(detail.querySelectorAll('.property-page__facts img[src="/assets/property-area.svg"]').length,[record.usableArea,record.grossArea].filter(hasPropertyCharacteristic).length);
 }
 assert.ok(absent>0);assert.ok(present>0);
});
