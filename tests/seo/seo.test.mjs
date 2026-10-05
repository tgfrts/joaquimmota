import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { CANONICAL_ORIGIN, PUBLIC_STATIC_PATHS, canonicalUrl, isIndexablePath, robotsForPath, robotsText, sitemapEntries, sitemapXml } from '../../src/lib/seo.ts';

test('production indexing is explicit and excludes private, removed, utility and blank pages', () => {
  for (const route of ['/', '/blog', '/imoveis/new-home', '/post/new-article']) {
    assert.equal(robotsForPath(route), 'noindex, nofollow');
    assert.equal(robotsForPath(route, 'preview'), 'noindex, nofollow');
    assert.equal(robotsForPath(route, 'production'), 'index, follow');
    assert.equal(robotsForPath(route, 'production', true), 'noindex, nofollow');
  }
  for (const route of ['/admin/dashboard', '/401', '/404', '/obrigado', '/lp/obrigado-oferta', '/reviews', '/contacto', '/faq/example', '/testemunhos/client', '/api/forms']) {
    assert.equal(isIndexablePath(route), false);
    assert.equal(robotsForPath(route, 'production'), 'noindex, nofollow');
    assert.ok(!PUBLIC_STATIC_PATHS.includes(route));
  }
});
test('canonical removes query, hash and trailing slash and always uses preferred public host', () => {
  assert.equal(canonicalUrl('https://migration-preview.joaquimmota.pages.dev/blog/?page=2#title'), `${CANONICAL_ORIGIN}/blog`);
  assert.equal(canonicalUrl('/?utm_source=campaign'), `${CANONICAL_ORIGIN}/`);
  assert.equal(canonicalUrl('/index.html'), `${CANONICAL_ORIGIN}/`);
  assert.equal(canonicalUrl('/401.html'), `${CANONICAL_ORIGIN}/401`);
  assert.equal(canonicalUrl('/imoveis/new-home.html'), `${CANONICAL_ORIGIN}/imoveis/new-home`);
  assert.equal(canonicalUrl('/admin/dashboard/index.html'), `${CANONICAL_ORIGIN}/admin/dashboard`);
  assert.equal(robotsForPath('/blog.html', 'production'), 'index, follow');
  assert.equal(robotsForPath('/admin/dashboard/index.html', 'production'), 'noindex, nofollow');
});
test('sitemap contains newly published CMS routes but excludes drafts, unsupported and malformed routes', () => {
  const records = [
    {_id: 'new-property', _type:'property', slug:{current:'new-home'}, _updatedAt:'2026-10-05T13:00:00Z'},
    {_id: 'new-article', _type:'article', slug:{current:'new-article'}},
    {_id: 'drafts.unpublished', _type:'property', slug:{current:'draft-home'}},
    {_id: 'versions.release.home', _type:'property', slug:{current:'release-home'}},
    {_id:'removed', _type:'offer', slug:{current:'vinho-e-fado'}},
    {_id:'invalid', _type:'property', slug:{current:'home?test=x'}},
  ];
  const entries = sitemapEntries(records, 'production');
  assert.ok(entries.some(entry=>entry.url===`${CANONICAL_ORIGIN}/imoveis/new-home` && entry.lastmod==='2026-10-05T13:00:00.000Z'));
  assert.ok(entries.some(entry=>entry.url===`${CANONICAL_ORIGIN}/post/new-article`));
  assert.ok(!entries.some(entry=>/draft-home|release-home|vinho-e-fado|\/home$/.test(entry.url)));
  assert.deepEqual(sitemapEntries(records), []);
  assert.match(sitemapXml(entries), /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
});
test('preview robots blocks crawling; production references sitemap and protects private areas', () => {
  assert.equal(robotsText(), 'User-agent: *\nDisallow: /\n');
  assert.match(robotsText('production'), /^User-agent: \*\nAllow: \/\n/);
  assert.match(robotsText('production'), /Disallow: \/admin\//);
  assert.match(robotsText('production'), /Sitemap: https:\/\/joaquimmota.pt\/sitemap.xml/);
});

function htmlFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? htmlFiles(path.join(directory,entry.name)) : entry.name.endsWith('.html') ? [path.join(directory,entry.name)] : []);
}
test('built HTML has exactly one robots policy and normalized public canonical on every route', () => {
  const files = htmlFiles('dist');
  assert.ok(files.length > 100, 'Run the site build before the SEO output checks');
  for (const file of files) {
    const route = '/'+file.replace(/^dist\//,'').replace(/(?:\/)?index\.html$/, '').replace(/\.html$/, '');
    const dom = new JSDOM(fs.readFileSync(file,'utf8'));
    const doc = dom.window.document;
    const robots = doc.querySelectorAll('meta[name="robots"]');
    assert.equal(robots.length, 1, file);
    assert.equal(robots[0].content, robotsForPath(route, process.env.SITE_ENV), file);
    const canonical = doc.querySelectorAll('link[rel="canonical"]');
    assert.equal(canonical.length, 1, file);
    assert.equal(canonical[0].href, canonicalUrl(route), file);
    dom.window.close();
  }
});
test('built robots and sitemap agree with build environment and contain only emitted routes', () => {
  assert.equal(fs.readFileSync('dist/robots.txt','utf8'), robotsText(process.env.SITE_ENV));
  const xml = new JSDOM(fs.readFileSync('dist/sitemap.xml','utf8'), {contentType:'text/xml'}).window.document;
  assert.equal(xml.querySelector('parsererror'),null);
  const locs = [...xml.querySelectorAll('loc')].map(node=>node.textContent);
  if (process.env.SITE_ENV !== 'production') assert.deepEqual(locs, []);
  else {
    assert.ok(locs.length>100);
    for(const loc of locs) {
      const route=new URL(loc).pathname;
      assert.equal(isIndexablePath(route),true,loc);
      assert.ok(fs.existsSync(route==='/'?'dist/index.html':`dist${route}.html`), `Sitemap points to missing HTML: ${loc}`);
    }
  }
});
