import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindTestimonialsSection } from '../../src/scripts/testimonials-section.ts';

function setup(t, mobile, count = 10, random = () => 0) {
  const dom = new JSDOM(`<section><div class="testimonials-section__grid">${Array.from({length:count}, (_,i)=>`<figure class="testimonials-section__card">${i}</figure>`).join('')}</div><button class="testimonials-section__more" hidden>Ver mais</button></section>`);
  const query = new dom.window.EventTarget();
  query.matches = mobile;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {configurable:true,value:{matchMedia:()=>query}});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'window',original);else delete globalThis.window;dom.window.close();});
  const section=dom.window.document.querySelector('section');
  bindTestimonialsSection(section,()=>{},random);
  return {
    visible:()=>Array.from(section.querySelectorAll('figure:not([hidden])'),c=>c.textContent),
    all:()=>Array.from(section.querySelectorAll('figure'),c=>c.textContent),
    button:section.querySelector('button'),
    resize:matches=>{query.matches=matches;query.dispatchEvent(new dom.window.Event('change'));},
  };
}

test('desktop starts with six and reveals remaining cards in the same random order',t=>{
  const r=setup(t,false);const order=r.all();
  assert.equal(new Set(order).size,10);assert.deepEqual([...order].sort(),Array.from({length:10},(_,i)=>String(i)));
  assert.deepEqual(r.visible(),order.slice(0,6));assert.equal(r.button.hidden,false);
  r.button.click();assert.deepEqual(r.visible(),order);assert.equal(r.button.hidden,true);
});
test('mobile shows three per batch and hides the action at the end',t=>{
 const r=setup(t,true);const order=r.all();
 for(const count of [3,6,9]){assert.deepEqual(r.visible(),order.slice(0,count));assert.equal(r.button.hidden,false);r.button.click();}
 assert.deepEqual(r.visible(),order);assert.equal(r.button.hidden,true);
});
test('breakpoint changes preserve the randomized order',t=>{
 const r=setup(t,false);const order=r.all();r.resize(true);assert.deepEqual(r.visible(),order.slice(0,3));r.resize(false);assert.deepEqual(r.visible(),order.slice(0,6));
});
test('fresh page initialization draws a fresh permutation',t=>{
 const a=setup(t,false,10,()=>0);const b=setup(t,false,10,()=>0.99);assert.notDeepEqual(a.all(),b.all());
});
test('short collections do not show an unnecessary action',t=>{
 const r=setup(t,true,2);assert.equal(r.visible().length,2);assert.equal(r.button.hidden,true);
});
