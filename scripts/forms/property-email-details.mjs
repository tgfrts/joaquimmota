import fs from 'node:fs';
// Build the server email metadata from the same CMS snapshot used by Astro.
const content = JSON.parse(fs.readFileSync('src/data/sample-content.json', 'utf8'));
const allowed = JSON.parse(fs.readFileSync('functions/api/allowed-source-routes.json', 'utf8'));
const properties = {};
for (const property of content.documents ?? []) {
  if (property._type !== 'property') continue;
  const slug = property.sourceSlug ?? property.slug?.current;
  if (!allowed.propertySlugs.includes(slug)) continue;
  properties[slug] = { title: property.title, reference: property.referenceCode ?? slug.toUpperCase() };
}
fs.writeFileSync('functions/api/property-email-details.json', `${JSON.stringify(properties, null, 2)}\n`);
