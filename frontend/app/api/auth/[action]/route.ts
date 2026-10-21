const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:4000';
const actions = new Set([
  'login',
  'signup',
  'logout',
  'verify-email',
  'resend-verification',
  'request-reset',
  'reset-password',
]);

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!actions.has(action)) return Response.json({ title: 'Unknown auth action' }, { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ title: 'Origin not allowed' }, { status: 403 });
  }

  let body: string | undefined;
  if (action !== 'logout') {
    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      return Response.json({ title: 'Expected JSON' }, { status: 415 });
    }
    body = await request.text();
    if (body.length > 16_384) return Response.json({ title: 'Request too large' }, { status: 413 });
  }

  try {
    const upstream = await fetch(`${gatewayUrl}/api/v1/auth/${action}`, {
      method: 'POST',
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(request.headers.get('cookie') ? { cookie: request.headers.get('cookie')! } : {}),
      },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) headers.set('Set-Cookie', setCookie);
    if (action === 'logout' && upstream.ok) {
      headers.set('Location', '/');
      return new Response(null, { status: 303, headers });
    }
    if (action === 'logout') {
      headers.set('Location', '/settings?notice=signout-unavailable');
      return new Response(null, { status: 303, headers });
    }
    if (upstream.status === 204) return new Response(null, { status: 204, headers });
    headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    return new Response(await upstream.text(), { status: upstream.status, headers });
  } catch {
    if (action === 'logout') {
      return Response.redirect(new URL('/settings?notice=signout-unavailable', request.url), 303);
    }
    return Response.json(
      { title: 'Authentication service is unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
