import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { JSDOM } from 'jsdom';

const ROUTES = [
  { kind: 'property', slug: 'kwpt036155', path: '/imoveis/kwpt036155' },
  { kind: 'property', slug: 'kwpt032055', path: '/imoveis/kwpt032055' },
  { kind: 'article', slug: 'a-proposta-mais-alta-pode-nao-ser-a-melhor', path: '/post/a-proposta-mais-alta-pode-nao-ser-a-melhor' },
  { kind: 'article', slug: 'os-segredos-que-as-casas-nao-contam-2', path: '/post/os-segredos-que-as-casas-nao-contam-2' },
  { kind: 'offer', slug: 'vinho-e-fado', path: '/ofertas/vinho-e-fado' },
  { kind: 'preListing', slug: 'te-t2-gulpilhares-20260916-39528', path: '/vouvender/te-t2-gulpilhares-20260916-39528' },
  { kind: 'preListing', slug: 'sc-t4-arcozelo-20260416', path: '/vouvender/sc-t4-arcozelo-20260416' },
  { kind: 'consumer', slug: 'comprar', path: '/comprar' },
  { kind: 'consumer', slug: 'reviews', path: '/reviews' },
];
const SEO_NAMES = ['description', 'robots', 'author', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
const SEO_PROPERTIES = ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:site_name'];
const fetchedImageBytes = new Map();

function cleanText(value) {
  return (value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(raw, baseUrl) {
  try {
    const url = new URL(raw, baseUrl);
    const base = new URL(baseUrl);
    const pathQueryAnchor = `${url.pathname}${url.search}${url.hash}`;
    return url.origin === base.origin || url.hostname === 'joaquimmota.pt' || url.hostname === 'www.joaquimmota.pt'
      ? pathQueryAnchor : `${url.origin}${pathQueryAnchor}`;
  } catch { return raw; }
}

function valueForMeta(document, selector, attribute) {
  const values = [...document.querySelectorAll(selector)].map((element) => element.getAttribute(attribute)).filter((value) => value !== null);
  return values.length ? values : null;
}

function seo(document, baseUrl) {
  const meta = {};
  for (const name of SEO_NAMES) meta[`name:${name}`] = valueForMeta(document, `meta[name="${name}"]`, 'content');
  for (const property of SEO_PROPERTIES) {
    const values = valueForMeta(document, `meta[property="${property}"]`, 'content');
    meta[`property:${property}`] = property === 'og:url' && values ? values.map((value) => normalizeUrl(value, baseUrl)) : values;
  }
  const canonical = [...document.querySelectorAll('link[rel~="canonical"]')].map((element) => normalizeUrl(element.href, baseUrl));
  return { title: document.title || null, canonical: canonical.length ? canonical : null, meta };
}

function labelFor(control) {
  const labels = control.labels ? [...control.labels].map((label) => cleanText(label.textContent)).filter(Boolean) : [];
  let previous = control.previousElementSibling;
  while (previous && (!cleanText(previous.textContent) || previous.hidden || previous.matches('.w-hidden,[hidden]'))) previous = previous.previousElementSibling;
  const previousVisiblePrompt = previous && !previous.querySelector('input,select,textarea,button') ? cleanText(previous.textContent) : null;
  return labels[0] ?? control.getAttribute('aria-label') ?? control.getAttribute('placeholder') ?? previousVisiblePrompt ?? null;
}

function formContract(form, sourceOrTarget, route) {
  const rawName = form.getAttribute('name') || form.id || form.getAttribute('data-form-type') || 'unnamed';
  let formKey = rawName.replace(/^wf-form-Form-/, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  const excludedSourceControls = [];
  const controls = [...form.querySelectorAll('input,select,textarea,button')].filter((control) => {
    if (sourceOrTarget === 'source' && route.kind === 'offer' && control.matches('textarea[placeholder="Assunto"]')) {
      excludedSourceControls.push({ selector: 'textarea[placeholder="Assunto"]', reason: 'Owner browser evidence: permanently display:none with a 0x0 rectangle.' });
      return false;
    }
    return true;
  });
  const fields = controls.filter((control) => control.type !== 'hidden' && control.type !== 'submit' && control.tagName.toLowerCase() !== 'button').map((control) => ({
    name: control.name || null,
    type: control.type || control.tagName.toLowerCase(),
    required: control.required,
    label: labelFor(control),
    ...(control.tagName.toLowerCase() === 'select' ? { options: [...control.options].map((option) => ({ value: option.value, label: cleanText(option.textContent) })) } : {}),
  }));
  const consent = controls.filter((control) => control.type === 'checkbox').map((control) => ({ name: control.name || null, required: control.required, label: labelFor(control) }));
  const parent = form.parentElement?.parentElement ?? form.parentElement;
  const successText = cleanText(parent?.querySelector('.w-form-done,[data-form-success],[data-newsletter-success],[data-newsletter-status]')?.textContent) || null;
  const errorText = cleanText(parent?.querySelector('.w-form-fail,[data-form-error],[data-newsletter-error]')?.textContent) || null;
  const action = form.getAttribute('action');
  const sourceRedirect = sourceOrTarget === 'source' ? form.getAttribute('data-redirect') || form.getAttribute('redirect') : null;
  const footerNewsletter = form.matches('form[data-footer-newsletter],form[data-blog-newsletter]');
  const inlineCmsNewsletter = form.matches('form[data-newsletter]') && route.kind === 'article';
  const newsletter = footerNewsletter || inlineCmsNewsletter;
  const dataType = form.getAttribute('data-form-type') || (newsletter ? 'newsletter' : null);
  const excludedSourceForm = sourceOrTarget === 'source' && route.path === '/comprar' && form.matches('form[action="/search"]');
  const hasSearchQuery = fields.some((field) => field.name === 'query' || field.type === 'search');
  if (hasSearchQuery) formKey = 'search';
  else if (inlineCmsNewsletter) formKey = 'blog';
  else if (dataType === 'newsletter') formKey = 'newsletter';
  else if (sourceOrTarget === 'target' && route.kind === 'property' && formKey === 'contact') formKey = 'imoveis';
  else if (sourceOrTarget === 'target' && route.kind === 'offer' && dataType === 'leadMagnet') formKey = 'ofertas';
  else if (sourceOrTarget === 'target' && route.kind === 'article' && formKey === 'unnamed') formKey = 'blog';
  let backendTarget;
  if (sourceOrTarget === 'source') backendTarget = form.matches('form[action="/search"]') ? 'GET /search query route' : 'Webflow-managed form endpoint (not copied)';
  else backendTarget = dataType ? 'Site 1 /api/forms via existing form client' : action ? `local route ${normalizeUrl(action, form.ownerDocument.URL)}` : 'No explicit target in rendered form';
  return {
    key: formKey,
    sourceName: sourceOrTarget === 'source' ? rawName : undefined,
    formType: dataType,
    method: (form.getAttribute('method') || 'get').toUpperCase(),
    backendTarget,
    fields,
    consent,
    successText,
    errorText,
    ...(sourceRedirect ? { successAction: `redirect ${normalizeUrl(sourceRedirect, form.ownerDocument.URL)}` } : {}),
    ...(excludedSourceControls.length ? { excludedSourceControls } : {}),
    ...(excludedSourceForm ? { excludedByRecordedVisibility: { selector: 'form[action="/search"]', reason: 'Owner browser evidence: permanently hidden search filter with a 0x0 rectangle.' } } : {}),
    ...(excludedSourceForm ? { excluded: true } : {}),
  };
}

async function targetHandlerEvidence(form) {
  const handlerPath = form.key === 'imoveis' ? 'src/components/CmsPropertyInquiry.astro'
    : form.key === 'blog' ? 'src/components/CmsNewsletter.astro'
      : form.key === 'ofertas' ? 'src/pages/ofertas/[slug].astro' : null;
  if (!handlerPath) return null;
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const source = await fs.readFile(path.join(repoRoot, handlerPath), 'utf8');
  const assignments = [...source.matchAll(/(?:status|success)\.textContent\s*=\s*['"]([^'"]+)['"]/g)].map((match) => cleanText(match[1]));
  const errorAssignments = [...source.matchAll(/(?:status|error)\.textContent\s*=\s*['"]([^'"]*(?:Oops|erro)[^'"]*)['"]/gi)].map((match) => cleanText(match[1]));
  const successAction = source.match(/location\.assign\(['"]([^'"]+)['"]\)/)?.[1] ?? null;
  return {
    sourceFile: handlerPath,
    method: 'static literal source inspection; no script execution or form submission',
    successText: assignments.find((value) => !/(?:Oops|erro|a enviar)/i.test(value)) ?? null,
    errorText: errorAssignments.at(-1) ?? null,
    successAction: successAction ? `redirect ${successAction}` : assignments.some((value) => !/(?:Oops|erro|a enviar)/i.test(value)) || form.successText ? 'inline success status' : null,
  };
}

async function imageBytes(url, targetOrigin) {
  if (!url) return null;
  let requestUrl = url;
  try {
    const parsed = new URL(url);
    if ((parsed.hostname === 'joaquimmota.pt' || parsed.hostname === 'www.joaquimmota.pt') && targetOrigin.includes('127.0.0.1')) {
      requestUrl = new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, targetOrigin).toString();
    }
  } catch { return null; }
  if (!fetchedImageBytes.has(requestUrl)) {
    fetchedImageBytes.set(requestUrl, (async () => {
      try {
        const response = await fetch(requestUrl, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
        if (!response.ok) return null;
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > 20 * 1024 * 1024) return null;
        const digest = (algorithm) => crypto.createHash(algorithm).update(bytes).digest('hex');
        return { sha1: digest('sha1'), sha256: digest('sha256'), bytes: bytes.length };
      } catch { return null; }
    })());
  }
  return fetchedImageBytes.get(requestUrl);
}

async function compareImageUrlIdentity(sourceUrl, targetUrl, targetOrigin, sourceDigests) {
  if (sourceUrl === targetUrl) return { status: 'same-url', sourceUrl, targetUrl };
  const record = sourceDigests.get(sourceUrl);
  const targetHash = targetUrl?.match(/\/production\/([a-f0-9]{40})-/i)?.[1]?.toLowerCase();
  if (record && targetHash && targetHash === record.targetOriginalSHA1?.toLowerCase()
    && record.originalDigestMatches === true && record.originalSizeMatches === true) {
    return { status: 'same-original-content', sourceUrl, targetUrl, sourceSHA1: record.sourceSHA1, sourceBytes: record.sourceBytes, targetOriginalSHA1: record.targetOriginalSHA1, targetOriginalBytes: record.targetOriginalBytes, evidence: 'validated source original digest/bytes match the target Sanity image asset hash' };
  }
  const [source, target] = await Promise.all([imageBytes(sourceUrl, targetOrigin), imageBytes(targetUrl, targetOrigin)]);
  if (source && target && source.sha256 === target.sha256 && source.bytes === target.bytes) {
    return { status: 'same-original-content', sourceUrl, targetUrl, sourceSHA256: source.sha256, sourceBytes: source.bytes, evidence: 'read-only HTTP GET byte digest and size match' };
  }
  return { status: 'content-identity-unverified', sourceUrl, targetUrl, sourceBytes: source?.bytes ?? null, targetBytes: target?.bytes ?? null };
}

function hrefInventory(document, baseUrl) {
  const links = new Map();
  for (const anchor of document.querySelectorAll('a[href]')) {
    const hrefValue = anchor.getAttribute('href');
    const whatsappPopup = hrefValue === 'https://api.whatsapp.com/send?phone=914257870';
    if (!whatsappPopup && anchor.closest('[aria-hidden="true"], [hidden], .w-hidden, .w-dyn-hide')) continue;
    if (anchor.closest('.sticky-bar')) continue;
    if (anchor.closest('.navbar2_component.imoveis')) continue;
    const href = normalizeUrl(hrefValue, baseUrl);
    if (!href || href.startsWith('javascript:')) continue;
    const target = anchor.getAttribute('target') === '_blank' ? '_blank' : null;
    const key = `${href}\0${target ?? ''}`;
    if (!links.has(key)) links.set(key, { href, target, label: cleanText(anchor.getAttribute('aria-label') || anchor.textContent) || anchor.getAttribute('title') || null, ...(whatsappPopup ? { visibilityEvidence: 'Owner browser confirmed the popup is temporarily hidden but interactively available in source and target.' } : {}) });
  }
  return [...links.values()].sort((a, b) => `${a.href}\0${a.target ?? ''}`.localeCompare(`${b.href}\0${b.target ?? ''}`));
}

function compare(source, target) {
  const seoKeys = new Set([...Object.keys(source.seo.meta), ...Object.keys(target.seo.meta)]);
  const seoDiffs = [];
  if (source.seo.title !== target.seo.title) seoDiffs.push({ field: 'title', source: source.seo.title, target: target.seo.title });
  if (JSON.stringify(source.seo.canonical) !== JSON.stringify(target.seo.canonical)) seoDiffs.push({ field: 'canonical', source: source.seo.canonical, target: target.seo.canonical });
  for (const field of seoKeys) {
    let sourceValue = source.seo.meta[field];
    let targetValue = target.seo.meta[field];
    if (field === 'name:robots') {
      const withoutNoindex = (values) => {
        if (!values) return null;
        const targetCarriesNoindex = values.some((value) => /(?:^|,)\s*noindex(?:\s*,|$)/i.test(value));
        const filtered = values.map((value) => value.split(',').map((token) => token.trim())
          .filter((token) => token.toLowerCase() !== 'noindex' && !(targetCarriesNoindex && token.toLowerCase() === 'nofollow')).join(',')).filter(Boolean);
        return filtered.length ? filtered : null;
      };
      sourceValue = withoutNoindex(sourceValue);
      targetValue = withoutNoindex(targetValue);
    }
    if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
      seoDiffs.push({ field, source: sourceValue, target: targetValue });
    }
  }
  const linkKey = (entry) => JSON.stringify({ href: entry.href, target: entry.target });
  const sourceLinks = new Map(source.hrefs.map((entry) => [linkKey(entry), entry]));
  const targetLinks = new Map(target.hrefs.map((entry) => [linkKey(entry), entry]));
  const sourceOnlyLinks = [...sourceLinks].filter(([key]) => !targetLinks.has(key)).map(([, entry]) => entry);
  const targetOnlyLinks = [...targetLinks].filter(([key]) => !sourceLinks.has(key)).map(([, entry]) => entry);
  const sourceForms = new Map(source.forms.filter((form) => !form.excluded).map((form) => [form.key, form]));
  const targetForms = new Map(target.forms.map((form) => [form.key, form]));
  const formKeys = new Set([...sourceForms.keys(), ...targetForms.keys()]);
  const formDiffs = [];
  for (const key of formKeys) {
    const before = sourceForms.get(key);
    const after = targetForms.get(key);
    if (!before || !after) { formDiffs.push({ key, issue: before ? 'missing-target-form' : 'unexpected-target-form' }); continue; }
    const fieldShape = (form) => form.fields.map(({ type, required, label, options }) => ({ type, required, label, ...(options ? { options } : {}) }));
    const consentShape = (form) => form.consent.map(({ required, label }) => ({ required, label }));
    const sourceRuntime = before.runtimeMessages ?? { successText: before.successText, errorText: before.errorText, successAction: before.successAction ?? (before.successText ? 'inline success status' : null) };
    const targetRuntime = after.runtimeMessages ? {
      successText: after.runtimeMessages.successText ?? after.successText,
      errorText: after.runtimeMessages.errorText ?? after.errorText,
      successAction: after.runtimeMessages.successAction ?? (after.successText ? 'inline success status' : null),
    } : { successText: after.successText, errorText: after.errorText, successAction: after.successText ? 'inline success status' : null };
    const shape = (form, runtime) => JSON.stringify({ method: form.method, fields: fieldShape(form), consent: consentShape(form), successText: runtime.successAction?.startsWith('redirect ') ? null : runtime.successText, errorText: runtime.errorText, successAction: runtime.successAction });
    if (shape(before, sourceRuntime) !== shape(after, targetRuntime)) formDiffs.push({ key, issue: 'form-contract-diff', source: { method: before.method, fields: before.fields, consent: before.consent, successText: sourceRuntime.successText, errorText: sourceRuntime.errorText, successAction: sourceRuntime.successAction }, target: { method: after.method, fields: after.fields, consent: after.consent, successText: targetRuntime.successText, errorText: targetRuntime.errorText, successAction: targetRuntime.successAction } });
    const nameMappings = before.fields.map((field, index) => ({ sourceName: field.name, targetName: after.fields[index]?.name ?? null, matchedBy: 'ordered label + type + required + public options' })).filter((entry) => entry.sourceName !== entry.targetName);
    if (nameMappings.length) formDiffs.push({ key, issue: 'internal-field-name-mapping', informational: true, mappings: nameMappings, comparisonRule: 'Names are implementation-specific; public form comparison uses exact ordered labels, types, required flags, and select options.' });
  }
  return { seo: seoDiffs, hrefs: { sourceOnly: sourceOnlyLinks, targetOnly: targetOnlyLinks }, forms: formDiffs };
}

async function fetchPage(url) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45000) });
  const html = await response.text();
  const document = new JSDOM(html, { url: response.url }).window.document;
  return { status: response.status, finalUrl: response.url, bytes: Buffer.byteLength(html), document, seo: seo(document, response.url), hrefs: hrefInventory(document, response.url) };
}

async function main() {
  const [sourceOrigin = 'https://joaquimmota.pt', targetOrigin = 'http://127.0.0.1:4327', outputPath = 'docs/migration/sample-route-contract-parity.json', digestsPath = 'docs/migration/sample-image-original-digests.json'] = process.argv.slice(2);
  const digestReport = JSON.parse(await fs.readFile(digestsPath, 'utf8'));
  const sourceDigests = new Map((digestReport.records ?? []).map((record) => [record.sourceURL, record]));
  const routes = [];
  for (const route of ROUTES) {
    const [sourcePage, targetPage] = await Promise.all([
      fetchPage(new URL(route.path, sourceOrigin)), fetchPage(new URL(route.path, targetOrigin)),
    ]);
    const source = { status: sourcePage.status, url: sourcePage.finalUrl, bytes: sourcePage.bytes, seo: sourcePage.seo, hrefs: sourcePage.hrefs, forms: [...sourcePage.document.forms].map((form) => formContract(form, 'source', route)) };
    const target = { status: targetPage.status, url: targetPage.finalUrl, bytes: targetPage.bytes, seo: targetPage.seo, hrefs: targetPage.hrefs, forms: [...targetPage.document.forms].map((form) => formContract(form, 'target', route)) };
    for (const form of target.forms) form.runtimeMessages = await targetHandlerEvidence(form);
    const deltas = compare(source, target);
    const imageUrlEvidence = [];
    for (const field of ['property:og:image', 'name:twitter:image']) {
      const sourceUrl = source.seo.meta[field]?.[0];
      const targetUrl = target.seo.meta[field]?.[0];
      if (sourceUrl && targetUrl && sourceUrl !== targetUrl) imageUrlEvidence.push({ field, ...(await compareImageUrlIdentity(sourceUrl, targetUrl, targetOrigin, sourceDigests)) });
    }
    const verifiedImageFields = new Set(imageUrlEvidence.filter((item) => item.status === 'same-original-content').map((item) => item.field));
    deltas.seo = deltas.seo.filter((delta) => !verifiedImageFields.has(delta.field));
    const materialFormDeltas = deltas.forms.filter((delta) => !delta.informational);
    routes.push({ ...route, source, target, imageUrlEvidence, deltas, status: source.status === 200 && target.status === 200 && !deltas.seo.length && !deltas.hrefs.sourceOnly.length && !deltas.hrefs.targetOnly.length && !materialFormDeltas.length ? 'no-delta-in-audited-contracts' : 'deltas-found' });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    status: 'partial-contract-audit',
    scope: 'Seven sample CMS routes plus the public Comprar and Reviews consumers; title/SEO, DOM href inventory, and initial GET form contracts only. This does not certify visual/layout/interactive parity.',
    sourceOrigin,
    targetOrigin,
    rules: {
      links: 'Unique DOM anchor href + target pairs; URL normalization preserves pathname, query, and fragment. Browser-confirmed permanently hidden property-section nav is excluded. Sticky-bar links are excluded. Interactive WhatsApp popup is retained despite its closed-state hidden attribute. Other aria-hidden/hidden Webflow elements are excluded.',
      forms: 'Visible input/select/textarea contracts, required state, consent, success/error copy, and target backend class; source provider actions are not copied.',
      authorizedDifference: 'Target robots noindex and the accompanying nofollow directive are authorized preview directives and are not reported as SEO deltas.',
      exclusions: ['empty zero-width spans without href', 'property .navbar2_component.imoveis section links (browser-confirmed display:none and 0x0)', '/comprar form[action="/search"] (browser-confirmed permanently hidden, 0x0)', 'offer textarea[placeholder="Assunto"] (browser-confirmed display:none and 0x0)', 'non-public hidden Seller/marketing placements', 'Webflow runtime scripts and source webhook URLs'],
      fieldNameComparison: 'Exact source and target field names are retained in each form record; parity comparison ignores implementation-specific names and compares ordered public labels, types, required state, consent, and select options. Name mappings are reported explicitly.',
      runtimeMessages: 'Target success/error copy is extracted from static literal source inspection without executing scripts or submitting forms; source data-redirect/redirect takes precedence over default success DOM copy, which is retained as source evidence but not treated as the submitted outcome.',
    },
    routeCounts: { checked: routes.length, noDeltaInAuditedContracts: routes.filter((route) => route.status === 'no-delta-in-audited-contracts').length, deltasFound: routes.filter((route) => route.status === 'deltas-found').length },
    routes,
    safety: { sourceCmsWrites: false, targetCmsWrites: false, formsSubmitted: false, providerWrites: false },
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, routeCounts: report.routeCounts, sourceStatuses: routes.map(({ path: routePath, source: page }) => [routePath, page.status]), targetStatuses: routes.map(({ path: routePath, target: page }) => [routePath, page.status]) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
