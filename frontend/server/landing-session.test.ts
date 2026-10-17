import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLandingSession, shouldShowLandingEntrance } from './landing-session';

afterEach(() => vi.unstubAllGlobals());

describe('landing entrance session decision', () => {
  it('shows on every verified logged-out request, without a visited flag', async () => {
    const request = vi.fn().mockImplementation(async () => Response.json({ authenticated: false }));
    vi.stubGlobal('fetch', request);
    expect(await shouldShowLandingEntrance('')).toBe(true);
    expect(await shouldShowLandingEntrance('')).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('skips signed-in visitors and forwards cookies without caching', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ authenticated: true }));
    vi.stubGlobal('fetch', request);
    expect(await shouldShowLandingEntrance('session=test-only')).toBe(false);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/session/status'),
      expect.objectContaining({
        headers: { cookie: 'session=test-only' },
        cache: 'no-store',
        redirect: 'error',
      }),
    );
  });

  it.each([{}, null, { authenticated: 'false' }])(
    'skips invalid session responses: %j',
    async (value) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value)));
      expect(await shouldShowLandingEntrance('')).toBe(false);
    },
  );

  it('skips failed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    expect(await shouldShowLandingEntrance('')).toBe(false);
  });

  it('skips network failures and timeouts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    expect(await shouldShowLandingEntrance('')).toBe(false);
  });
});

describe('landing session', () => {
  const user = {
    id: 'b36d99d5-c741-4785-9ca4-8c88209d81a7',
    email: 'agent@example.test',
    name: 'Agent',
    workspaceId: 'f5e80343-542f-465f-82e8-3b3fc608ec4e',
  };

  it('accepts a validated signed-in session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ authenticated: true, user })));
    expect(await getLandingSession('af_session=test-only')).toEqual({ authenticated: true, user });
  });

  it('fails closed when the signed-in user is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ authenticated: true, user: { id: 10 } })),
    );
    expect(await getLandingSession('af_session=test-only')).toBeNull();
  });
});
