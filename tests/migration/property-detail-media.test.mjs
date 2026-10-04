import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {mediaSource} from '../../src/lib/media-source.ts';
const root=new URL('../../',import.meta.url);
test('empty media fields and embeds have no source',()=>{
 for(const value of [undefined,null,'','  ','<iframe src=""></iframe>','<iframe></iframe>','javascript:alert(1)']) assert.equal(mediaSource(value),undefined);
 assert.equal(mediaSource(' https://example.com/video '),'https://example.com/video');
 assert.equal(mediaSource('<iframe src="https://example.com/map"></iframe>'),'https://example.com/map');
});
test('detail media sections follow filled CMS sources and amenities use corresponding Lucide icons',()=>{
 const {documents}=JSON.parse(fs.readFileSync(new URL('src/data/sample-content.json',root),'utf8'));
 const icons={elevator:'lift',storage:'warehouse',balcony:'balcony',terrace:'fence',garden:'trees',pool:'waves'};
 let withMedia=0,withoutMedia=0;
 for(const record of documents.filter(r=>r._type==='property')){
  const d=new JSDOM(fs.readFileSync(new URL(`dist/imoveis/${record.slug.current}.html`,root),'utf8')).window.document;
  for(const [field,title] of [['mapEmbed','Localização'],['videoUrl','Vídeo'],['matterportUrl','Visita virtual']]){
   const expected=mediaSource(record[field]);
   const frame=d.querySelector(`.property-page__body iframe[title="${title}"]`);
   assert.equal(frame?.getAttribute('src'),expected,`${record.slug.current}: ${field}`);
   if(expected)withMedia++;else withoutMedia++;
  }
  assert.equal(Boolean(d.querySelector('#localizacao')),Boolean(mediaSource(record.mapEmbed)));
  for(const [field,icon] of Object.entries(icons)) assert.equal(Boolean(d.querySelector(`#caracteristicas [data-icon="${icon}"]`)),Boolean(record.amenities?.[field]));
  if(record.energyCertificate){
   assert.equal(d.querySelector('.property-page__certificate-label--desktop').textContent,'Certificado Energético');
   assert.equal(d.querySelector('.property-page__certificate-label--mobile').textContent,'CE');
  }
 }
 assert.ok(withMedia>0);assert.ok(withoutMedia>0);
});
test('gallery thumbnails crop to 3:2 while lightbox keeps the original proportion',()=>{
 const css=fs.readFileSync(new URL('src/styles/cms.css',root),'utf8');
 assert.match(css,/\.cms-gallery__grid img\{[^}]*aspect-ratio:3\/2;object-fit:cover/);
 assert.match(css,/\.cms-gallery__dialog \.cms-gallery__full-image\{[^}]*width:auto;height:auto;object-fit:contain/);
});
