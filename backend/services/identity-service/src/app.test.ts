import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { EmailNotVerifiedError, InvalidTokenError, type IdentityRepository } from './repository.js';
import type { AuthMail } from './mailer.js';
import type { OAuthService } from './oauth.js';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function start(repository: Partial<IdentityRepository>, mail: Partial<AuthMail> = {}) {
  const oauth = {
    available: () => ({ google: false, microsoft: false, apple: false }),
  } as OAuthService;
  const app = createApp(repository as IdentityRepository, {
    mail: mail as AuthMail,
    oauth,
  });
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  return `http://127.0.0.1:${address.port}`;
}

async function post(base: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('identity HTTP flow', () => {
  it('creates an unverified account and sends a link without exposing its token', async () => {
    const verification = vi.fn(async () => {});
    const base = await start(
      {
        register: vi.fn(async () => ({
          email: 'ada@example.com',
          verificationToken: 'a'.repeat(64),
        })),
      },
      { verification },
    );
    const response = await post(base, '/v1/auth/register', {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'a-long-password',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ requiresVerification: true, email: 'ada@example.com' });
    expect(verification).toHaveBeenCalledWith('ada@example.com', 'a'.repeat(64));
  });

  it('blocks sign-in until email is verified', async () => {
    const base = await start({
      login: vi.fn(async () => {
        throw new EmailNotVerifiedError();
      }),
    });
    const response = await post(base, '/v1/auth/login', {
      email: 'ada@example.com',
      password: 'a-long-password',
    });
    expect(response.status).toBe(403);
  });

  it('does not reveal whether a reset email exists', async () => {
    const passwordReset = vi.fn(async () => {});
    const base = await start({ requestPasswordReset: vi.fn(async () => null) }, { passwordReset });
    const response = await post(base, '/v1/auth/password/request-reset', {
      email: 'unknown@example.com',
    });
    expect(response.status).toBe(202);
    expect(passwordReset).not.toHaveBeenCalled();
  });

  it('rejects an expired reset token', async () => {
    const base = await start({
      resetPassword: vi.fn(async () => {
        throw new InvalidTokenError('Reset link is invalid or expired');
      }),
    });
    const response = await post(base, '/v1/auth/password/reset', {
      token: 'a'.repeat(64),
      password: 'a-long-password',
    });
    expect(response.status).toBe(400);
  });
});
