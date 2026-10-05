import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// Server validation and email metadata use the same published CMS content as Astro.
export function buildCmsFormRoutes(content, previous = {}) {
  const records = Array.isArray(content) ? content : content.documents ?? [];
  const properties = {};
  const routes = { ...previous, propertySlugs: [], articleSlugs: [] };
  for (const record of records) {
    if (!['property', 'article'].includes(record._type)) continue;
    const slug = record.slug?.current ?? record.sourceSlug;
    if (typeof slug !== 'string' || slug.length > 200 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      throw new Error(`Invalid public slug for ${record._type} ${record._id ?? ''}`);
    }
    const key = record._type === 'property' ? 'propertySlugs' : 'articleSlugs';
    if (routes[key].includes(slug)) throw new Error(`Duplicate ${record._type} slug: ${slug}`);
    routes[key].push(slug);
    if (record._type === 'property') properties[slug] = { title: record.title, reference: record.referenceCode ?? slug.toUpperCase() };
  }
  routes.propertySlugs.sort();
  routes.articleSlugs.sort();
  return { routes, properties };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const content = JSON.parse(fs.readFileSync('src/data/sample-content.json', 'utf8'));
  const previous = JSON.parse(fs.readFileSync('functions/api/allowed-source-routes.json', 'utf8'));
  const { routes, properties } = buildCmsFormRoutes(content, previous);
  fs.writeFileSync('functions/api/allowed-source-routes.json', `${JSON.stringify(routes, null, 2)}\n`);
  fs.writeFileSync('functions/api/property-email-details.json', `${JSON.stringify(properties, null, 2)}\n`);
}
