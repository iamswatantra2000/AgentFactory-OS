import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '../app/api/auth/oauth/[provider]/start/route';

afterEach(() => vi.unstubAllGlobals());

it('sets a short-lived state cookie before redirecting to the configured provider', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        state: 'a'.repeat(64),
        url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
      }),
    ),
  );
  const response = await GET(new Request('http://localhost:3000/api/auth/oauth/google/start'), {
    params: Promise.resolve({ provider: 'google' }),
  });
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toContain('https://accounts.google.com/');
  expect(response.headers.get('set-cookie')).toContain(`af_oauth_google=${'a'.repeat(64)}`);
});
