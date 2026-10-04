import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const root=new URL('../../',import.meta.url);
const source=await readFile(new URL('src/components/CmsGallery.astro',root),'utf8');
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
const compiled=await build({stdin:{contents:script,loader:'ts'},bundle:true,format:'iife',platform:'browser',write:false});
test('property cover opens the existing gallery at its own image and returns focus on close',async t=>{
 const html=await readFile(new URL('dist/imoveis/kwpt013603.html',root),'utf8');
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/imoveis/kwpt013603'});t.after(()=>dom.window.close());
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollTo=function(){};
 w.eval(compiled.outputFiles[0].text);
 const cover=w.document.querySelector('[data-gallery-open]');
 const gallery=w.document.querySelector('#property-gallery');
 const dialog=gallery.querySelector('dialog');
 cover.focus();cover.click();
 assert.equal(dialog.open,true);
 assert.equal(gallery.querySelector('.cms-gallery__full-image').src,cover.querySelector('img').src);
 assert.equal(w.document.documentElement.style.overflow,'hidden');
 assert.equal(w.document.querySelectorAll('dialog.cms-gallery__dialog').length,1);
 gallery.querySelector('.cms-gallery__close').click();
 assert.equal(dialog.open,false);assert.equal(w.document.activeElement,cover);
 assert.equal(w.document.documentElement.style.overflow,'');
 const thumbnail=gallery.querySelector('[data-gallery-index]');thumbnail.click();
 assert.equal(gallery.querySelector('.cms-gallery__full-image').src,thumbnail.querySelector('img').src);
});
test('cover is included once in the lightbox without changing the gallery grid',async()=>{
 for(const slug of ['kwpt013603','kwpt036155']){
  const d=new JSDOM(await readFile(new URL(`dist/imoveis/${slug}.html`,root),'utf8')).window.document;
  const src=d.querySelector('.property-page__cover').getAttribute('src');
  assert.equal(Array.from(d.querySelectorAll('.cms-gallery__strip img')).filter(img=>img.getAttribute('src')===src).length,1);
 }
});

test('gallery more control reveals all images and then restores the responsive preview',async t=>{
 const dom=new JSDOM(await readFile(new URL('dist/imoveis/kwpt013603.html',root),'utf8'),{runScripts:'outside-only'});t.after(()=>dom.window.close());
 let scroll;dom.window.matchMedia=()=>({matches:false});dom.window.HTMLElement.prototype.scrollIntoView=function(options){scroll={element:this,options};};
 dom.window.eval(compiled.outputFiles[0].text);
 const gallery=dom.window.document.querySelector('#property-gallery');const more=gallery.querySelector('[data-gallery-more]');
 const images=gallery.querySelectorAll('[data-gallery-index]');const count=images.length;
 assert.ok(count>9);assert.ok(gallery.hasAttribute('data-gallery-limited'));
 assert.equal(more.getAttribute('aria-expanded'),'false');
 more.click();assert.ok(gallery.classList.contains('is-expanded'));assert.equal(more.getAttribute('aria-expanded'),'true');assert.equal(more.textContent,'Ver menos fotos');
 assert.equal(gallery.querySelectorAll('[data-gallery-index]').length,count);
 more.click();assert.equal(gallery.classList.contains('is-expanded'),false);assert.equal(more.getAttribute('aria-expanded'),'false');assert.equal(more.textContent,'Ver mais fotos');
 assert.equal(scroll.element,gallery.querySelector('.cms-gallery__grid'));assert.equal(scroll.options.behavior,'smooth');assert.equal(scroll.options.block,'start');
 dom.window.matchMedia=()=>({matches:true});more.click();more.click();assert.equal(scroll.options.behavior,'auto');
 const css=await readFile(new URL('src/styles/cms.css',root),'utf8');
 assert.match(css,/\[data-gallery-limited\]:not\(\.is-expanded\) \.cms-gallery__grid>button:nth-child\(n\+10\)\{display:none\}/);
 assert.match(css,/@media\(max-width:767px\)\{[^}]*nth-child\(n\+7\)\{display:none\}/);
});
