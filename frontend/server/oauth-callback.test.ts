import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '../app/api/auth/oauth/[provider]/callback/route';

afterEach(() => vi.unstubAllGlobals());

it('rejects a callback whose state does not match the browser cookie', async () => {
  const upstream = vi.fn();
  vi.stubGlobal('fetch', upstream);
  const request = new Request(
    `http://localhost:3000/api/auth/oauth/google/callback?state=${'a'.repeat(64)}&code=test`,
    {
      headers: { cookie: `af_oauth_google=${'b'.repeat(64)}` },
    },
  );
  const response = await GET(request, { params: Promise.resolve({ provider: 'google' }) });
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('http://localhost:3000/login?notice=oauth-failed');
  expect(upstream).not.toHaveBeenCalled();
});

it('forwards the session cookie only after a matching state and successful exchange', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('{"user":{}}', {
          status: 200,
          headers: { 'set-cookie': `af_session=${'c'.repeat(64)}; HttpOnly; Path=/` },
        }),
    ),
  );
  const state = 'a'.repeat(64);
  const request = new Request(
    `http://localhost:3000/api/auth/oauth/google/callback?state=${state}&code=test`,
    {
      headers: { cookie: `af_oauth_google=${state}` },
    },
  );
  const response = await GET(request, { params: Promise.resolve({ provider: 'google' }) });
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('http://localhost:3000/welcome');
  expect(response.headers.get('set-cookie')).toContain('af_session=');
});
