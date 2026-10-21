import { timingSafeEqual } from 'node:crypto';

const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:4000';
const providers = new Set(['google', 'microsoft', 'apple']);

async function complete(request: Request, provider: string, input: URLSearchParams) {
  if (!providers.has(provider)) return new Response('Unknown provider', { status: 404 });
  const state = input.get('state') ?? '';
  const code = input.get('code') ?? '';
  const stored =
    request.headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`af_oauth_${provider}=`))
      ?.split('=')[1] ?? '';
  const goodState =
    /^[0-9a-f]{64}$/.test(state) &&
    /^[0-9a-f]{64}$/.test(stored) &&
    timingSafeEqual(Buffer.from(state), Buffer.from(stored));
  const destination = new URL(
    goodState && code ? '/welcome' : '/login?notice=oauth-failed',
    request.url,
  );
  let sessionCookie: string | null = null;
  if (goodState && code) {
    try {
      const upstream = await fetch(`${gatewayUrl}/api/v1/auth/oauth/${provider}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state, code }),
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      });
      if (upstream.ok) sessionCookie = upstream.headers.get('set-cookie');
      else {
        destination.pathname = '/login';
        destination.search = '?notice=oauth-failed';
      }
    } catch {
      destination.pathname = '/login';
      destination.search = '?notice=oauth-failed';
    }
  }
  const response = new Response(null, {
    status: 303,
    headers: { Location: destination.toString(), 'Cache-Control': 'no-store' },
  });
  response.headers.append(
    'Set-Cookie',
    `af_oauth_${provider}=; HttpOnly; Path=/api/auth/oauth/${provider}; Max-Age=0; SameSite=${provider === 'apple' ? 'None; Secure' : 'Lax'}`,
  );
  if (sessionCookie) response.headers.append('Set-Cookie', sessionCookie);
  return response;
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  return complete(request, (await context.params).provider, new URL(request.url).searchParams);
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
    return new Response('Expected form response', { status: 415 });
  const text = await request.text();
  if (text.length > 16_384) return new Response('Response too large', { status: 413 });
  return complete(request, (await context.params).provider, new URLSearchParams(text));
}
