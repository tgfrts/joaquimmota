import allowedSourceRoutes from './allowed-source-routes.json' with { type: 'json' };

type FormType = 'newsletter' | 'contact' | 'valuation' | 'mortgage' | 'partnership' | 'leadMagnet';

type Env = {
  RESEND_SEND_API_KEY?: string;
  RESEND_CONTACTS_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_REPLY_TO?: string;
  FORMS_RECIPIENT?: string;
};

type Submission = {
  formType: FormType;
  route: string;
  fields: Record<string, unknown>;
  idempotencyKey: string;
};

type FormAdapter = {
  captureNewsletter(submission: Submission, env: Env): Promise<void>;
  notifyLead(submission: Submission, env: Env): Promise<void>;
};

const ROUTES: Record<FormType, ReadonlySet<string>> = {
  newsletter: new Set(['/', '/blog', '/vender', '/comprar', '/sobre', '/marketing', '/reviews', '/contacto']),
  contact: new Set(['/contacto', '/vamos-comecar', '/sessao-gratuita']),
  valuation: new Set(['/quanto-vale-a-sua-casa-hoje', '/estudo-de-mercado', '/uma-venda-com-sucesso', '/lp-flyer-uma-venda-com-sucesso']),
  mortgage: new Set(['/credito-habitacao']),
  partnership: new Set(['/partnerships', '/partenariats', '/parcerias']),
  leadMagnet: new Set(['/dossier', '/guia-vender-para-comprar', '/lp/guia-de-ferias', '/lp/smillingstreet', '/lp/cabaz-de-natal', '/lp/atualizacao-de-informacao', '/lp/oferta-selecao']),
};

const FIELDS: Record<FormType, ReadonlySet<string>> = {
  newsletter: new Set(['email', 'firstName', 'lastName']),
  contact: new Set(['name', 'email', 'phone', 'message', 'consent']),
  valuation: new Set(['name', 'email', 'phone', 'propertyType', 'bedrooms', 'location', 'message', 'consent']),
  mortgage: new Set(['name', 'email', 'phone', 'message', 'consent']),
  partnership: new Set(['name', 'email', 'phone', 'clientType', 'message', 'consent']),
  leadMagnet: new Set(['name', 'email', 'phone', 'message', 'consent']),
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const IDEMPOTENCY = /^[A-Za-z0-9._:-]{8,200}$/u;
const MAX_BODY_BYTES = 16_384;
const ORIGINS = new Set([
  'https://joaquimmota.pt',
  'https://www.joaquimmota.pt',
  'http://localhost:4321',
  'http://127.0.0.1:4327',
  // Cloudflare Pages local preview ports; these do not widen production origins.
  'http://localhost:8789',
  'http://127.0.0.1:8789',
]);

class FormError extends Error {
  readonly status: number;
  readonly retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function response(status: number, body: Record<string, unknown>, retryAfter?: number) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  if (retryAfter) headers.set('retry-after', String(retryAfter));
  return new Response(JSON.stringify(body), { status, headers });
}

function requiredString(value: unknown, field: string, limit = 2_000, allowNewlines = false) {
  if (typeof value !== 'string' || !value.trim()) throw new FormError(422, `Invalid ${field}.`);
  const result = value.trim();
  if (result.length > limit || (!allowNewlines && /[\r\n]/u.test(result))) throw new FormError(422, `Invalid ${field}.`);
  return result;
}

function optionalText(value: unknown, field: string, limit = 2_000) {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, field, limit, field === 'message');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character));
}

function formType(value: unknown): FormType {
  if (typeof value !== 'string' || !Object.hasOwn(ROUTES, value)) throw new FormError(404, 'Unknown form.');
  return value as FormType;
}

function parseSubmission(payload: unknown, idempotencyKey: string): Submission {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new FormError(400, 'Invalid request body.');
  const body = payload as Record<string, unknown>;
  const type = formType(body.formType);
  const route = requiredString(body.route, 'route', 200);
  const propertyRoute = route.startsWith('/imoveis/') && allowedSourceRoutes.propertySlugs.includes(route.slice('/imoveis/'.length));
  const articleRoute = route.startsWith('/post/') && allowedSourceRoutes.articleSlugs.includes(route.slice('/post/'.length));
  const offerRoute = route.startsWith('/ofertas/') && allowedSourceRoutes.offerSlugs.includes(route.slice('/ofertas/'.length));
  if (!ROUTES[type].has(route) && !((type === 'contact' && propertyRoute) || (type === 'newsletter' && (propertyRoute || articleRoute)) || (type === 'leadMagnet' && offerRoute))) throw new FormError(403, 'Form is not allowed on this route.');
  if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)) throw new FormError(422, 'Invalid fields.');
  const fields = body.fields as Record<string, unknown>;
  if (Object.keys(fields).some((key) => !FIELDS[type].has(key))) throw new FormError(422, 'Unsupported field.');
  if (type !== 'newsletter' && fields.consent !== true) throw new FormError(422, 'Consent is required.');
  const email = requiredString(fields.email, 'email', 320).toLowerCase();
  if (!EMAIL.test(email)) throw new FormError(422, 'Invalid email.');
  const normalized: Record<string, unknown> = { email };
  if (type !== 'newsletter') normalized.consent = true;
  if (type === 'contact' && !fields.name) throw new FormError(422, 'Invalid name.');
  for (const field of FIELDS[type]) {
    if (field === 'email' || field === 'consent') continue;
    const value = optionalText(fields[field], field, field === 'message' ? 4_000 : 500);
    if (value !== undefined) normalized[field] = value;
  }
  return { formType: type, route, fields: normalized, idempotencyKey };
}

function requiredConfig(env: Env, key: keyof Env) {
  const value = env[key];
  if (!value || /[\r\n]/u.test(value)) throw new FormError(503, 'Form delivery is temporarily unavailable.', 30);
  return value;
}

function configuredEmail(env: Env, key: 'FORMS_RECIPIENT' | 'RESEND_REPLY_TO') {
  const value = requiredConfig(env, key).trim().toLowerCase();
  if (!EMAIL.test(value)) throw new FormError(503, 'Form delivery is temporarily unavailable.', 30);
  return value;
}

function leadEmailHtml(submission: Submission) {
  const rows = Object.entries(submission.fields)
    .map(([key, value]) => `<tr><th scope="row">${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Novo contacto</title></head><body><h1>Novo contacto</h1><p>Formulário: ${escapeHtml(submission.formType)}</p><p>Rota: ${escapeHtml(submission.route)}</p><table>${rows}</table></body></html>`;
}

function retryable(status: number) {
  return status === 429 || status >= 500;
}

async function resendRequest(fetcher: typeof fetch, path: string, apiKey: string, idempotencyKey: string, body: Record<string, unknown>) {
  const result = await fetcher(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(body),
  });
  const retryAfter = Number(result.headers.get('retry-after'));
  if (!result.ok) throw new FormError(retryable(result.status) ? 503 : 422, 'Form delivery failed.', retryable(result.status) ? (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30) : undefined);
}

async function readBoundedJson(request: Request) {
  const declaredSize = Number(request.headers.get('content-length'));
  if (declaredSize > MAX_BODY_BYTES) throw new FormError(413, 'Request too large.');
  if (!request.body) throw new FormError(400, 'Invalid request body.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new FormError(413, 'Request too large.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof FormError) throw error;
    throw new FormError(400, 'Invalid request body.');
  } finally {
    reader.releaseLock();
  }
}

export function createResendAdapter(fetcher: typeof fetch): FormAdapter {
  return {
    async captureNewsletter(submission, env) {
      await resendRequest(fetcher, '/contacts', requiredConfig(env, 'RESEND_CONTACTS_API_KEY'), submission.idempotencyKey, {
        email: submission.fields.email,
        ...(submission.fields.firstName ? { first_name: submission.fields.firstName } : {}),
        ...(submission.fields.lastName ? { last_name: submission.fields.lastName } : {}),
      });
    },
    async notifyLead(submission, env) {
      const email = requiredString(submission.fields.email, 'email', 320);
      await resendRequest(fetcher, '/emails', requiredConfig(env, 'RESEND_SEND_API_KEY'), submission.idempotencyKey, {
        from: requiredConfig(env, 'RESEND_FROM'),
        to: [configuredEmail(env, 'FORMS_RECIPIENT')],
        reply_to: env.RESEND_REPLY_TO ? configuredEmail(env, 'RESEND_REPLY_TO') : email,
        subject: `Novo contacto — ${submission.formType}`,
        html: leadEmailHtml(submission),
      });
    },
  };
}

export function createFormHandler(adapter: FormAdapter) {
  return async ({ request, env }: { request: Request; env: Env }) => {
    try {
      if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
      if (!ORIGINS.has(request.headers.get('origin') ?? '')) throw new FormError(403, 'Origin is not allowed.');
      const idempotencyKey = request.headers.get('idempotency-key') ?? '';
      if (!IDEMPOTENCY.test(idempotencyKey)) throw new FormError(400, 'Missing or invalid idempotency key.');
      const payload: unknown = await readBoundedJson(request);
      const submission = parseSubmission(payload, idempotencyKey);
      if (submission.formType === 'newsletter') await adapter.captureNewsletter(submission, env);
      else await adapter.notifyLead(submission, env);
      return response(202, { accepted: true });
    } catch (error) {
      if (error instanceof FormError) return response(error.status, { error: error.message }, error.retryAfter);
      return response(503, { error: 'Form delivery is temporarily unavailable.' }, 30);
    }
  };
}

export const onRequestPost = createFormHandler(createResendAdapter(fetch));
