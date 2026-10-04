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
