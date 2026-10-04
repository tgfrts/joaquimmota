import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {mediaSource,videoEmbedSource} from '../../src/lib/media-source.ts';
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
   const expected=field==='videoUrl'?videoEmbedSource(record[field]):mediaSource(record[field]);
   const frame=d.querySelector(`.property-page__body iframe[title="${title}"]`);
   assert.equal(frame?.getAttribute('src'),expected,`${record.slug.current}: ${field}`);
   if(expected)withMedia++;else withoutMedia++;
  }
  assert.equal(Boolean(d.querySelector('#localizacao')),Boolean(mediaSource(record.mapEmbed)));
  if(mediaSource(record.mapEmbed)){assert.equal(d.querySelector('iframe[title="Localização"]').getAttribute('loading'),'eager');assert.ok(d.querySelector('head link[rel="preconnect"][href="https://www.google.com"]'));}
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
 assert.match(css,/\.cms-gallery__grid button\{[^}]*aspect-ratio:3\/2;overflow:hidden/);
 assert.match(css,/\.cms-gallery__grid img\{[^}]*width:100%;height:100%;object-fit:cover/);
 assert.match(css,/\.cms-gallery__dialog \.cms-gallery__full-image\{[^}]*width:auto;height:auto;object-fit:contain/);
});

test('YouTube share URLs become players while original embed and virtual tour URLs are retained',()=>{
 assert.equal(videoEmbedSource('https://www.youtube.com/watch?v=m5W8kMAnh-4&t=9s'),'https://www.youtube.com/embed/m5W8kMAnh-4?start=9');
 assert.equal(videoEmbedSource('https://youtu.be/mWEePWffcTo'),'https://www.youtube.com/embed/mWEePWffcTo');
 assert.equal(videoEmbedSource('https://www.youtube.com/shorts/mWEePWffcTo?t=1m30s'),'https://www.youtube.com/embed/mWEePWffcTo?start=90');
 assert.equal(videoEmbedSource('https://www.youtube-nocookie.com/embed/mWEePWffcTo?start=4'),'https://www.youtube-nocookie.com/embed/mWEePWffcTo?start=4');
 assert.equal(videoEmbedSource('https://www.youtube.com/watch?v=bad'),undefined);
 assert.equal(mediaSource('https://my.matterport.com/show/?m=PikcpURs7eK'),'https://my.matterport.com/show/?m=PikcpURs7eK');
});
