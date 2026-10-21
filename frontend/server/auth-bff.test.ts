import { afterEach, expect, it, vi } from 'vitest';
import { POST } from '../app/api/auth/[action]/route';

afterEach(() => vi.unstubAllGlobals());

it('passes a successful password-reset 204 through without creating a response body', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  const request = new Request('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({ token: 'a'.repeat(64), password: 'a-long-password' }),
  });
  const response = await POST(request, { params: Promise.resolve({ action: 'reset-password' }) });
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
});

it('clears the browser session and returns home after a successful sign out', async () => {
  const upstream = vi.fn(
    async () =>
      new Response(null, {
        status: 204,
        headers: { 'set-cookie': 'af_session=; Path=/; Max-Age=0; HttpOnly' },
      }),
  );
  vi.stubGlobal('fetch', upstream);
  const request = new Request('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', cookie: 'af_session=active' },
  });

  const response = await POST(request, { params: Promise.resolve({ action: 'logout' }) });
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/');
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(upstream).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/auth/logout'),
    expect.objectContaining({ headers: expect.objectContaining({ cookie: 'af_session=active' }) }),
  );
});

it('retains the session and shows a retry notice when sign out fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('Unavailable', { status: 503 })),
  );
  const request = new Request('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', cookie: 'af_session=active' },
  });

  const response = await POST(request, { params: Promise.resolve({ action: 'logout' }) });
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/settings?notice=signout-unavailable');
  expect(response.headers.get('set-cookie')).toBeNull();
});
