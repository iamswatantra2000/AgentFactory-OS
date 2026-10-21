const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:4000';
const hosts: Record<string, string> = {
  google: 'accounts.google.com',
  microsoft: 'login.microsoftonline.com',
  apple: 'appleid.apple.com',
};

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!hosts[provider]) return new Response('Unknown provider', { status: 404 });
  try {
    const upstream = await fetch(`${gatewayUrl}/api/v1/auth/oauth/${provider}/start`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!upstream.ok)
      return Response.redirect(new URL('/login?notice=provider-unavailable', request.url), 303);
    const payload: unknown = await upstream.json();
    if (
      typeof payload !== 'object' ||
      !payload ||
      !('url' in payload) ||
      typeof payload.url !== 'string' ||
      !('state' in payload) ||
      typeof payload.state !== 'string' ||
      !/^[0-9a-f]{64}$/.test(payload.state)
    ) {
      throw new Error('Invalid provider response');
    }
    const target = new URL(payload.url);
    if (target.protocol !== 'https:' || target.hostname !== hosts[provider])
      throw new Error('Invalid provider URL');
    const response = new Response(null, {
      status: 303,
      headers: { Location: target.toString(), 'Cache-Control': 'no-store' },
    });
    response.headers.append(
      'Set-Cookie',
      `af_oauth_${provider}=${payload.state}; HttpOnly; Path=/api/auth/oauth/${provider}; Max-Age=600; SameSite=${provider === 'apple' ? 'None; Secure' : 'Lax'}`,
    );
    return response;
  } catch {
    return Response.redirect(new URL('/login?notice=provider-unavailable', request.url), 303);
  }
}
