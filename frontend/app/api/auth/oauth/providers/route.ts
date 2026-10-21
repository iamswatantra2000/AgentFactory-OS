const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:4000';

export async function GET() {
  try {
    const upstream = await fetch(`${gatewayUrl}/api/v1/auth/oauth/providers`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { google: false, microsoft: false, apple: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
