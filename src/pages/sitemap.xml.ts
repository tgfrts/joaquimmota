import content from '../data/sample-content.json';
import { recordsFromContent } from '../data/cms-content';
import { sitemapEntries, sitemapXml } from '../lib/seo';
export const prerender = true;
export function GET() {
  return new Response(sitemapXml(sitemapEntries(recordsFromContent(content), import.meta.env.SITE_ENV)), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
