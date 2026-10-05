/** Production indexing is enabled explicitly; local and preview builds stay private. */
export const CANONICAL_ORIGIN = 'https://joaquimmota.pt';
export const PUBLIC_STATIC_PATHS = [
  '/', '/vender', '/comprar', '/sobre', '/blog', '/imoveis', '/marketing',
  '/vamos-comecar', '/sessao-gratuita', '/uma-venda-com-sucesso',
  '/quanto-vale-a-sua-casa-hoje', '/estudo-de-mercado', '/lp-flyer-uma-venda-com-sucesso',
  '/partnerships', '/partenariats', '/parcerias', '/credito-habitacao',
  '/guia-vender-para-comprar', '/dossier', '/oferta-certificado-energetico',
  '/lp/guia-de-ferias', '/lp/smillingstreet', '/lp/cabaz-de-natal', '/lp/atualizacao-de-informacao',
];
// Published source GET audit found no robots exclusions on these public pages.
// Utility, blank templates, removed pages and thank-you pages are deliberately omitted.
export function normalizedPath(input: string): string {
  // Astro's file-format prerender context uses output filenames, while the
  // public Cloudflare routes are extensionless (including directory indexes).
  const path = new URL(input, CANONICAL_ORIGIN).pathname
    .replace(/\/index\.html$/, '/')
    .replace(/\.html$/, '');
  return path === '/' ? '/' : path.replace(/\/+$/, '');
}
export function canonicalUrl(input: string): string {
  return new URL(normalizedPath(input), CANONICAL_ORIGIN).href;
}
export function isIndexablePath(input: string): boolean {
  const path = normalizedPath(input);
  return PUBLIC_STATIC_PATHS.includes(path) || /^\/(?:imoveis|post|vouvender)\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(path);
}
export function robotsForPath(input: string, environment?: string, noindex = false): string {
  return environment === 'production' && !noindex && isIndexablePath(input) ? 'index, follow' : 'noindex, nofollow';
}
export function robotsText(environment?: string): string {
  return environment === 'production'
    ? `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /doop/\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}
export function sitemapEntries(records: any[], environment?: string): { url: string; lastmod?: string }[] {
  if (environment !== 'production') return [];
  const entries: {url: string; lastmod?: string}[] = PUBLIC_STATIC_PATHS.map(path => ({ url: canonicalUrl(path) }));
  const prefixes: Record<string, string> = { property: 'imoveis', article: 'post', preListing: 'vouvender' };
  for (const record of records) {
    if (String(record._id ?? '').startsWith('drafts.') || String(record._id ?? '').startsWith('versions.')) continue;
    const prefix = prefixes[record._type];
    const slug = record.slug?.current ?? record.sourceSlug;
    if (!prefix || typeof slug !== 'string' || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) continue;
    const path = `/${prefix}/${slug}`;
    if (!isIndexablePath(path)) continue;
    const timestamp = Date.parse(record._updatedAt);
    entries.push({ url: canonicalUrl(path), ...(Number.isFinite(timestamp) ? { lastmod: new Date(timestamp).toISOString() } : {}) });
  }
  return [...new Map(entries.map(entry => [entry.url, entry])).values()];
}
export function sitemapXml(entries: {url: string; lastmod?: string}[]): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(entry => `<url><loc>${escape(entry.url)}</loc>${entry.lastmod ? `<lastmod>${escape(entry.lastmod)}</lastmod>` : ''}</url>`).join('')}</urlset>\n`;
}
