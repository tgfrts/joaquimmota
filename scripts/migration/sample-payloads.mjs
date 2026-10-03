import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { htmlToBlocks } from '@portabletext/block-tools';
import { Schema } from '@sanity/schema';

const PORTABLE_TEXT_SCHEMA = Schema.compile({
  name: 'joaquimMotaMigration',
  types: [
    {
      name: 'link',
      type: 'object',
      fields: [
        { name: 'href', type: 'url' },
        { name: 'openInNewTab', type: 'boolean' },
      ],
    },
    {
      name: 'article',
    type: 'document',
      fields: [{ name: 'body', type: 'array', of: [{ type: 'block', marks: { annotations: [{ type: 'link' }] } }] }],
    },
  ],
}).get('article').fields.find((field) => field.name === 'body').type;

const SAMPLE_IDS = {
  property: ['6a54f0b08ea6f4acb252d675', '69f85f2cd504290f91170cad'],
  article: ['69a2dce4b48d3344ed295952', '698af82db57942d2c5d10a3e'],
  testimonial: ['67b454c5e23698381d4b5a8b', '67b454c48728d3d81a387c44'],
  offer: ['64d744240d28836501ab496f'],
  preListing: ['6aaa6c0742b7f0b0b572f137', '6aaa6c05e5531aa86e7ef8a1'],
  processStep: ['64d73faf12672d652ab57824', '64d73faf12672d652ab57819'],
};

const COLLECTIONS = {
  property: { sourceName: 'Imóveis', routePrefix: '/imoveis/' },
  article: { sourceName: 'Blog Posts', routePrefix: '/post/' },
  testimonial: { sourceName: 'Testemunhos', routePrefix: '/testemunhos/' },
  offer: { sourceName: 'Ofertas', routePrefix: '/ofertas/' },
  preListing: { sourceName: 'Pre-Listings', routePrefix: '/vouvender/' },
  processStep: { sourceName: 'VS Destaques', routePrefix: '/vs-destaques/' },
};

const PROCESS_STEP_PLACEMENT = {
  '61e1b999e018031966a98c78f8548d5d': 'buy',
  '1d2e3b2ba040ba7d01a627b6f2c9396d': 'marketing',
};

const PROPERTY_STATUS = {
  '77306c0e91f8838c07881d84ef30e1ae': 'active',
  'b769cf6a216be5e71de8463250c064f1': 'sold',
  'f26b8d13f3de271a54c84b3dbc7106ba': 'reserved',
  '45794da0a6a7fb94fa45a5421cfa4267': 'expiredCancelled',
};
const PROPERTY_BANNER = {
  '53979b2f329c93a57999e82942298aa9': 'new',
  'ff323f575f6c60fa8ececf78f36417f3': 'newPrice',
  '4ac9c303f1f49c1a4fde70f037cb367b': 'openHouse',
  '7b249ccd749d622cb728ef0f846c2811': 'reserved',
};
const PROPERTY_TYPE = {
  '86ba35ed1a378e7de62d0088292a93ad': 'apartment',
  '1ad24d4a6a313ac31a0b60001ce773b4': 'house',
  'bfd26e85ffd939b9814073defbd58a37': 'building',
  '3126804b84a70e2eb4ef7e15c1ecd928': 'other',
};
const MUNICIPALITY = {
  'e26f92e10e59a19ca974ad7cbaafbd06': 'Porto',
  '1737fcdf9af2508858970387f4c0995b': 'Vila Nova de Gaia',
  '4350ced3542bbb3b9b019ca1da4f36d1': 'Gondomar',
  '53ef20ad0e053c1e104844b4f92866a0': 'Maia',
  'deee0ae1954896eb17df03a578188185': 'Matosinhos',
  '7127fc67f4303e2653c845f5565b7714': 'Póvoa de Varzim',
  'a40f7871429e22060fcff6a1c2d2242e': 'Valongo',
  '2b29497923f7334b1e8d64f26b833a62': 'Vila do Conde',
};
const ENERGY_CERTIFICATE = {
  'df389ea8b93ff88afa45e89e1ca81640': 'A+',
  '485fd88dbfa970a7f1b3bffa59a73031': 'A',
  'e37d1cbcb784db755a27fb407492ea1e': 'B',
  'af03baf9fcbb32da4efb5900fbfb7048': 'B-',
  'f53543c16a57e70c2f85bf9c0d608d4d': 'C',
  '165eb2939c53a4887bd2ce600a8831e2': 'D',
  '2187fb78e6f73ccdfa75dcda2fac992a': 'E',
  'b8eae98974506257d489eb9038361300': 'F',
  '82804a7cfc13347aa0b5dc4bef6c6449': 'G',
  'f669308ada6ccfe21735403988a558c2': 'Exempt',
};
const PRELISTING_TYPE = {
  '6027b99e4693143da643b6afb571aed5': 'apartment',
  '5480ef756d6933eebbf693ed49b1475a': 'house',
  '5681e6ddefeeccc74954301b0581969a': 'land',
  'caf0373435fbc4bcdf7efec117cf3efc': 'commercial',
  'b2b5e6eb8ed76dc4a6b25c817753fa54': 'garage',
  '381796996ca3b6d16e31dac75673ab6a': 'other',
};
const PRELISTING_TYPOLOGY = {
  'ce159bfbd24968c652828cb2b334ba39': 'T0',
  '96e2083e2aa1875d009d2815824c2b54': 'T1',
  'e4984315ebfaa5fda7ee8dbe75b393ee': 'T2',
  '4e29dcc17e248c6cf642780cc6fcbf95': 'T3',
  'cb66cd89561b7fb58ee536d9b0393cb2': 'T4',
  'cf482302c2ac1ef6aca6707f43d9091c': 'T5+',
  'd5283f699cff4d5827df2c23f19473ef': 'N/A',
};

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}.`);
  return value.trim();
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function collectionByName(source, sourceName) {
  const collection = source.collections?.find((candidate) => candidate.name === sourceName);
  if (!collection || !Array.isArray(collection.staged?.items) || !Array.isArray(collection.live?.items)) {
    throw new Error(`Invalid snapshot for collection ${sourceName}.`);
  }
  return collection;
}

function eligibleItem(source, kind, sourceId) {
  const config = COLLECTIONS[kind];
  const collection = collectionByName(source, config.sourceName);
  const item = collection.staged.items.find((candidate) => candidate.id === sourceId);
  if (!item) throw new Error(`${kind} sample ${sourceId} is missing from staged data.`);
  if (item.isDraft !== false || item.isArchived !== false) throw new Error(`${kind} sample ${sourceId} is not eligible.`);
  const legacyId = requiredString(item.id, `${kind} legacy id`);
  const locale = requiredString(item.cmsLocaleId, `${kind} locale`);
  const sourceSlug = requiredString(item.fieldData?.slug, `${kind} staged slug`);
  const live = collection.live.items.find((candidate) => candidate.id === legacyId && candidate.cmsLocaleId === locale);
  if (!live) throw new Error(`${kind} sample ${legacyId} has no matching live id+locale record.`);
  if (requiredString(live.slug, `${kind} live slug`) !== sourceSlug) throw new Error(`${kind} sample ${legacyId} changed slug between staged and live.`);
  return { item, route: `${config.routePrefix}${sourceSlug}` };
}

function assetRef(assetMap, sourceAsset, label) {
  if (!sourceAsset) return undefined;
  const fileId = requiredString(sourceAsset.fileId, `${label} file id`);
  const url = requiredString(sourceAsset.url, `${label} URL`);
  const tables = [assetMap, assetMap.assets, assetMap.byFileId, assetMap.byUrl].filter(Boolean);
  let mapped;
  for (const table of tables) {
    mapped = table[fileId] ?? table[url];
    if (mapped) break;
  }
  const ref = typeof mapped === 'string' ? mapped : mapped?._ref ?? mapped?.assetRef ?? mapped?.asset?._ref;
  if (typeof ref !== 'string' || !ref.startsWith('image-')) {
    throw new Error(`Asset map has no Sanity image ref for ${label} (${fileId}).`);
  }
  return prune({
    _type: 'image',
    asset: { _type: 'reference', _ref: ref },
    alt: optionalString(sourceAsset.alt),
  });
}

function enumValue(values, sourceValue, label) {
  const value = values[sourceValue];
  if (!value) throw new Error(`Unknown ${label} option ${sourceValue ?? '(missing)'}.`);
  return value;
}

function imageArray(assetMap, sourceAssets, label) {
  if (!Array.isArray(sourceAssets) || sourceAssets.length === 0) return undefined;
  return sourceAssets.map((sourceAsset, index) => ({
    _key: `source-${index}-${requiredString(sourceAsset.fileId, `${label} ${index} file id`)}`,
    ...assetRef(assetMap, sourceAsset, `${label} ${index}`),
  }));
}

function portableText(html, label) {
  const value = requiredString(html, `${label} HTML`);
  const blocks = htmlToBlocks(value, PORTABLE_TEXT_SCHEMA, {
    parseHtml: (input) => new JSDOM(input).window.document,
  });
  if (!Array.isArray(blocks) || blocks.length === 0) throw new Error(`${label} did not produce Portable Text blocks.`);
  return blocks.map((block, index) => ({ ...block, _key: block._key ?? `source-${index}` }));
}

function identity(item) {
  const sourceSlug = requiredString(item.fieldData?.slug, 'source slug');
  return {
    legacyId: requiredString(item.id, 'legacy id'),
    locale: requiredString(item.cmsLocaleId, 'locale'),
    sourceSlug,
    slug: { _type: 'slug', current: sourceSlug },
  };
}

function prune(value) {
  if (Array.isArray(value)) return value.map(prune).filter((entry) => entry !== undefined);
  if (value && typeof value === 'object') {
    const object = Object.fromEntries(Object.entries(value)
      .map(([key, entry]) => [key, prune(entry)])
      .filter(([, entry]) => entry !== undefined));
    return Object.keys(object).length ? object : undefined;
  }
  return value === undefined || value === null ? undefined : value;
}

function mapProperty(item, assetMap) {
  const data = item.fieldData;
  return prune({
    _type: 'property',
    ...identity(item),
    title: requiredString(data['id-kw'], 'property title'),
    referenceCode: requiredString(data.name, 'property reference code'),
    summary: optionalString(data['descricao-resumo']),
    description: data['descricao-completa'] ? portableText(data['descricao-completa'], 'property description') : undefined,
    listingStatus: data['estado-da-angariacao'] ? enumValue(PROPERTY_STATUS, data['estado-da-angariacao'], 'property listing status') : undefined,
    marketBanner: data['banner-de-mercado'] ? enumValue(PROPERTY_BANNER, data['banner-de-mercado'], 'property market banner') : undefined,
    price: optionalNumber(data.preco),
    priceOnRequest: typeof data['preco-sob-consulta'] === 'boolean' ? data['preco-sob-consulta'] : undefined,
    propertyType: data['natureza-do-imovel'] ? enumValue(PROPERTY_TYPE, data['natureza-do-imovel'], 'property type') : undefined,
    municipality: data['concelho'] ?? MUNICIPALITY[data['principais-concelhos']],
    parish: optionalString(data.freguesia),
    bedrooms: optionalNumber(data.quartos),
    bathrooms: optionalNumber(data['casas-de-banho']),
    parkingSpaces: optionalNumber(data.estacionamento),
    usableArea: optionalNumber(data['area-util']),
    grossArea: optionalNumber(data['area-bruta']),
    energyCertificate: data['certificado-energetico']
      ? enumValue(ENERGY_CERTIFICATE, data['certificado-energetico'], 'energy certificate')
      : undefined,
    amenities: {
      elevator: data.elevador,
      storage: data.arrecadacao,
      balcony: data.varanda,
      terrace: data.terraco,
      garden: data.jardim,
      pool: data.piscina,
    },
    featuredImage: assetRef(assetMap, data['fotografia-de-destaque'], 'property featured image'),
    gallery: imageArray(assetMap, data['outras-fotografias'], 'property gallery'),
    videoUrl: optionalString(data['link-video']?.url),
    matterportUrl: optionalString(data.matterport),
    mapEmbed: optionalString(data['google-maps']),
  });
}

function mapArticle(item, assetMap) {
  const data = item.fieldData;
  return prune({
    _type: 'article',
    ...identity(item),
    title: requiredString(data.name, 'article title'),
    subtitle: optionalString(data.subtitulo),
    summary: optionalString(data.resumo),
    body: portableText(data.artigo, 'article body'),
    readingMinutes: optionalNumber(data['tempo-de-leitura']),
    cta: {
      eyebrow: optionalString(data['cta-sub-heading']),
      heading: optionalString(data['cta-heading']),
      copy: optionalString(data['cta-copy']),
      label: optionalString(data['cta-buton-text']),
    },
    mainImage: assetRef(assetMap, data['imagem-principal'], 'article main image'),
    thumbnailImage: assetRef(assetMap, data['imagem-miniatura'], 'article thumbnail image'),
    openGraphImage: assetRef(assetMap, data['opengraph-image'], 'article OpenGraph image'),
    videoUrl: optionalString(data.video?.url),
    gallery: imageArray(assetMap, data.galeria, 'article gallery'),
  });
}

function mapTestimonial(item, assetMap) {
  const data = item.fieldData;
  return prune({
    _type: 'testimonial',
    ...identity(item),
    clientName: requiredString(data.name, 'testimonial client name'),
    quote: requiredString(data['testemunho-3'], 'testimonial quote'),
    portrait: assetRef(assetMap, data['foto-de-perfil'], 'testimonial portrait'),
  });
}

function mapOffer(item, assetMap) {
  const data = item.fieldData;
  return prune({
    _type: 'offer',
    ...identity(item),
    title: requiredString(data.name, 'offer title'),
    heading: optionalString(data['heading-copy']),
    body: optionalString(data.copy),
    image: assetRef(assetMap, data.imagem, 'offer image'),
  });
}

function mapPreListing(item, assetMap) {
  const data = item.fieldData;
  return prune({
    _type: 'preListing',
    ...identity(item),
    clientName: requiredString(data.name, 'pre-listing client name'),
    address: requiredString(data.morada, 'pre-listing address'),
    parish: requiredString(data.freguesia, 'pre-listing parish'),
    municipality: optionalString(data.concelho),
    propertyType: enumValue(PRELISTING_TYPE, data['tipo-de-imovel'], 'pre-listing property type'),
    typology: enumValue(PRELISTING_TYPOLOGY, data.tipologia, 'pre-listing typology'),
    heroImage: assetRef(assetMap, data['hero-image-2'], 'pre-listing hero image'),
    gallery: imageArray(assetMap, data['galeria-2'], 'pre-listing gallery'),
  });
}

function mapProcessStep(item, assetMap) {
  const data = item.fieldData;
  return prune({
    _type: 'processStep',
    ...identity(item),
    title: requiredString(data.name, 'process step title'),
    body: requiredString(data.copy, 'process step copy'),
    placement: enumValue(PROCESS_STEP_PLACEMENT, data.page, 'process step placement'),
    ctaLabel: optionalString(data['link-label']),
    ctaUrl: optionalString(data['link-url']),
    videoUrl: optionalString(data.video?.url),
    thumbnail: assetRef(assetMap, data.thumbnail, 'process step thumbnail'),
    image: assetRef(assetMap, data.image, 'process step image'),
  });
}

function buildPayload(source, assetMap) {
  const documents = [];
  const routes = [];
  for (const [kind, ids] of Object.entries(SAMPLE_IDS)) {
    for (const id of ids) {
      const { item, route } = eligibleItem(source, kind, id);
      const mapper = {
        property: () => mapProperty(item, assetMap),
        article: () => mapArticle(item, assetMap),
        testimonial: () => mapTestimonial(item, assetMap),
        offer: () => mapOffer(item, assetMap),
        preListing: () => mapPreListing(item, assetMap),
        processStep: () => mapProcessStep(item, assetMap),
      }[kind];
      const document = mapper();
      if (Object.hasOwn(document, '_id')) throw new Error('Sample documents must omit generated _id values.');
      documents.push(document);
      routes.push({ legacyId: document.legacyId, type: document._type, route });
    }
  }
  return { documents, routes };
}

function usage() {
  console.error('Usage: node scripts/migration/sample-payloads.mjs <staged-source.json> <asset-map.json> <output.json>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourcePath, assetMapPath, outputPath] = process.argv.slice(2);
  if (!sourcePath || !assetMapPath || !outputPath) {
    usage();
    process.exitCode = 2;
  } else {
    const payload = buildPayload(readJson(sourcePath), readJson(assetMapPath));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`Wrote ${payload.documents.length} source-eligible sample documents to ${outputPath}`);
  }
}

export { assetRef, buildPayload, eligibleItem, imageArray, mapProcessStep, portableText };
