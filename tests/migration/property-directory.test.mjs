import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {selectFeaturedProperty} from '../../src/data/cms-content.ts';
const root=new URL('../../',import.meta.url);
const documentFor=route=>new JSDOM(fs.readFileSync(new URL(`dist/${route}.html`,root),'utf8')).window.document;
test('top navigation hides the current page, keeps testimonials everywhere and preserves lower navigation',()=>{
 for(const route of ['index','blog','vender','comprar','sobre','imoveis']){
  const d=documentFor(route);const nav=d.querySelector('.site-header--light nav');const current=route==='index'?'/':`/${route}`;
  assert.equal(nav.querySelector(`a[href="${current}"]`),null);
  const customer=nav.querySelector('a[href="/#testemunhos"]');assert.ok(customer);assert.equal(customer.classList.contains('nav-desktop-only'),false);
  if(route!=='index'){assert.equal(nav.querySelector('a').textContent,'Início');assert.equal(nav.querySelector('a').classList.contains('nav-mobile-only'),false);}
 }
 const lower=documentFor('comprar').querySelector('.site-header--blue nav');assert.deepEqual(Array.from(lower.children,x=>x.textContent),['Início','Vender','Comprar','Sobre nós','Vamos começar']);
});
test('property directory retains every available card and uses the featured property, newsletter and shared closing sections',()=>{
 const buy=documentFor('comprar'),directory=documentFor('imoveis');
 const cards=d=>Array.from(d.querySelectorAll('.buy-property'),a=>({href:a.getAttribute('href'),text:a.textContent}));
 assert.equal(cards(directory).length,9);assert.deepEqual(cards(directory),cards(buy));
 assert.equal(buy.querySelector('.buy-properties__more').getAttribute('href'),'/imoveis');
 const content=JSON.parse(fs.readFileSync(new URL('src/data/sample-content.json',root),'utf8'));const featured=selectFeaturedProperty(Array.isArray(content)?content:content.documents);
 assert.equal(directory.querySelector('.blog-index__featured-copy a').getAttribute('href'),`/imoveis/${featured.slug.current}`);
 assert.equal(directory.querySelector('.property-featured__badge').textContent,'Destaque');
 assert.equal(directory.querySelector('#blog-subscribe-title').textContent,'Não perca nenhuma novidade!');
 assert.equal(directory.querySelector('.buy-guide').textContent,buy.querySelector('.buy-guide').textContent);
 assert.ok(directory.querySelector('form[data-blog-newsletter]'));assert.ok(directory.querySelector('footer'));
});
