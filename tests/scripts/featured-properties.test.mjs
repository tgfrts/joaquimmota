import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {bindFeaturedProperties} from '../../src/scripts/featured-properties.ts';
test('each load draws one complete candidate, including its matching image and link',()=>{
 for(const [random,expected] of [[0,0],[0.5,1],[0.99,2]]){
  const dom=new JSDOM(`<section>${[0,1,2].map(i=>`<div data-featured-card hidden><h1>Title ${i}</h1><a href="/imoveis/${i}">${i}</a><img loading="lazy" src="/${i}.jpg"></div>`).join('')}</section>`);
  const section=dom.window.document.querySelector('section');bindFeaturedProperties(section,()=>random);
  const visible=section.querySelectorAll('[data-featured-card]:not([hidden])');assert.equal(visible.length,1);assert.equal(visible[0].querySelector('a').getAttribute('href'),`/imoveis/${expected}`);assert.equal(visible[0].querySelector('img').loading,'eager');for(const hidden of section.querySelectorAll('[data-featured-card][hidden]'))assert.equal(hidden.querySelector('img').loading,'lazy');dom.window.close();
 }
});
test('empty or single available candidate is handled without inventing a fallback',()=>{
 const dom=new JSDOM('<section></section>');const section=dom.window.document.querySelector('section');bindFeaturedProperties(section);assert.equal(section.children.length,0);section.innerHTML='<div data-featured-card hidden>only</div>';bindFeaturedProperties(section);assert.equal(section.firstElementChild.hidden,false);dom.window.close();
});
