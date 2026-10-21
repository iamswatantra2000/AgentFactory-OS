const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:4000';

/** Same-origin browser façade; the session cookie never reaches client JavaScript. */
export async function forwardProjectRequest(request: Request, path: string) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ title: 'Origin not allowed' }, { status: 403 });
  let body: string | undefined;
  if (request.method === 'POST') {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return Response.json({ title: 'Expected JSON' }, { status: 415 });
    body = await request.text();
    if (body.length > (path.endsWith('/graph') ? 131_072 : 16_384))
      return Response.json({ title: 'Request too large' }, { status: 413 });
  }
  try {
    const upstream = await fetch(`${gatewayUrl}${path}`, {
      method: request.method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(request.headers.get('cookie') ? { cookie: request.headers.get('cookie')! } : {}),
      },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(6_000),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ title: 'Project service is unavailable' }, { status: 503 });
  }
}
