type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

/** Serve only the public protected screen. No password or session is processed. */
export async function onRequest({ request, env }: { request: Request; env: Env }) {
  // Construct a fresh GET: never forward method, body, cookies or authorization.
  const asset = await env.ASSETS.fetch(new Request(new URL('/401', request.url), { method: 'GET' }));
  return new Response(asset.body, {
    status: 401,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
