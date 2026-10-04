type Kind = 'activities' | 'visits';
type Env = { DOOP_ACTIVITY_WEBHOOK_URL?: string; DOOP_VISIT_WEBHOOK_URL?: string };
type Field = { required?: boolean; max?: number; values?: readonly string[] };
const ratings = ['mau', 'medio', 'bom', 'muito bom'];
const common: Record<string, Field> = {
  Data: { required: true, max: 256 }, message: { max: 5000 }, 'Propriet-rio': { max: 256 }, 'Email-Propriet-rio': { max: 256 },
};
export const schemas: Record<Kind, Record<string, Field>> = {
  activities: { ...common, Atividade: { required: true, max: 256 }, 'Tipo-atividade': { required: true, values: ['marketing', 'visita', 'proposta', 'contacto'] }, 'Im-vel': { required: true, max: 256 } },
  visits: { ...common, nome: { required: true, max: 256 }, 'Morada-comprador': { required: true, max: 256 }, 'Data-de-nascimento': { required: true, max: 256 }, Telefone: { required: true, max: 256 }, Documento: { required: true, max: 256 }, 'Im-vel-2': { required: true, max: 256 }, 'constru-o': { required: true, values: ratings }, acabamentos: { required: true, values: ratings }, 'exposi-o-solar': { required: true, values: ratings }, 'localiza-o': { required: true, values: ratings }, valor: { required: true, values: ratings }, global: { required: true, values: ratings }, compraria: { required: true, values: ['sim', 'nao'] }, 'compraria-2': { required: true, values: ['sim', 'nao'] } },
};
const INPUT_LIMIT = 64 * 1024;
const OUTPUT_LIMIT = 8 * 1024;
const textResponse = (text: string, status: number) => new Response(status === 204 || status === 205 ? null : text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
async function boundedText(body: ReadableStream<Uint8Array> | null, limit: number) {
  if (!body) return '';
  const reader = body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new Error('body-limit'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(joined);
}
function configuredURL(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'hook.eu1.make.com' || url.port || url.username || url.password || url.hash || url.search || !/^\/[a-zA-Z0-9_-]+$/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
export function createDoopHandler(kind: Kind, transport: typeof fetch = fetch) {
  return async ({ request, env }: { request: Request; env: Env }) => {
    if (request.method !== 'POST') return textResponse('Method not allowed.', 405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return textResponse('Request origin is not allowed.', 403);
    if (!/^application\/x-www-form-urlencoded(?:\s*;.*)?$/i.test(request.headers.get('content-type') ?? '')) return textResponse('Unsupported form encoding.', 415);
    const contentLength = request.headers.get('content-length');
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > INPUT_LIMIT)) return textResponse('Form body is too large.', 413);
    let raw: string;
    try { raw = await boundedText(request.body, INPUT_LIMIT); }
    catch (error) { return textResponse('Invalid or oversized form body.', error instanceof Error && error.message === 'body-limit' ? 413 : 400); }
    let fields: URLSearchParams;
    try {
      // URLSearchParams is otherwise permissive about malformed percent/UTF-8.
      for (const pair of raw.split('&')) for (const part of pair.split('=')) decodeURIComponent(part.replace(/\+/g, ' '));
      fields = new URLSearchParams(raw);
    } catch { return textResponse('Invalid form encoding.', 400); }
    const schema = schemas[kind]; const seen = new Set<string>();
    for (const [name, value] of fields) {
      const rule = schema[name];
      if (!Object.hasOwn(schema, name) || !rule || seen.has(name) || value.includes('\u0000') || (rule.max !== undefined && value.length > rule.max) || (rule.values && !rule.values.includes(value))) return textResponse('Invalid form fields.', 400);
      seen.add(name);
    }
    for (const [name, rule] of Object.entries(schema)) if (rule.required && !fields.get(name)?.trim()) return textResponse('Required form fields are missing.', 400);
    const target = configuredURL(kind === 'activities' ? env.DOOP_ACTIVITY_WEBHOOK_URL : env.DOOP_VISIT_WEBHOOK_URL);
    if (!target) return textResponse('Report submission is not configured.', 503);
    try {
      const upstream = await transport(target, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: fields.toString(), redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (upstream.status < 200 || upstream.status > 299) { await upstream.body?.cancel(); return textResponse('Report submission was not accepted.', 502); }
      const responseText = await boundedText(upstream.body, OUTPUT_LIMIT);
      return textResponse(responseText, upstream.status);
    } catch { return textResponse('Report submission could not be completed.', 502); }
  };
}
