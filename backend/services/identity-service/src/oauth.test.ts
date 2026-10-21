import { describe, expect, it, vi } from 'vitest';
import { createOAuthService, ProviderUnavailableError } from './oauth.js';
import type { IdentityRepository } from './repository.js';

const state = 'a'.repeat(64);
const repository = {
  createOAuthAttempt: vi.fn(async () => state),
} as unknown as IdentityRepository;

describe('OAuth provider setup', () => {
  it('keeps unconfigured providers unavailable', async () => {
    const service = createOAuthService(repository, { APP_BASE_URL: 'http://localhost:3000' });
    expect(service.available()).toEqual({ google: false, microsoft: false, apple: false });
    await expect(service.start('google')).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('creates a state-bound Google authorization request with PKCE', async () => {
    const service = createOAuthService(repository, {
      APP_BASE_URL: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-secret',
    });
    const result = await service.start('google');
    const url = new URL(result.url);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/oauth/google/callback',
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('nonce')).toBeTruthy();
  });

  it('does not expose Apple on an HTTP development origin', () => {
    const service = createOAuthService(repository, {
      APP_BASE_URL: 'http://localhost:3000',
      APPLE_CLIENT_ID: 'service-id',
      APPLE_TEAM_ID: 'team',
      APPLE_KEY_ID: 'key',
      APPLE_PRIVATE_KEY: 'placeholder',
    });
    expect(service.available().apple).toBe(false);
  });
});
