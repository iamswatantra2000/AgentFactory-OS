import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { hashPassword, verifyPassword } from './password.js';

const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  workspaceId: string | null;
};
type AccountRow = { id: string; email: string; name: string | null; passwordHash: string | null };

export class DuplicateAccountError extends Error {}
export class InvalidCredentialsError extends Error {}
export class EmailNotVerifiedError extends Error {}
export class InvalidTokenError extends Error {}
export class AccountLinkRequiredError extends Error {}
export class ProviderEmailRequiredError extends Error {}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function newSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    hash: tokenHash(token),
    userId,
    expiresAt: new Date(Date.now() + sessionLifetimeMs),
  };
}

async function insertSession(client: PoolClient, userId: string) {
  const session = newSession(userId);
  await client.query(
    'INSERT INTO "Session" ("tokenHash", "userId", "expiresAt") VALUES ($1, $2, $3)',
    [session.hash, session.userId, session.expiresAt],
  );
  return session.token;
}

async function insertAuthToken(
  client: PoolClient,
  userId: string,
  purpose: string,
  lifetimeMs: number,
) {
  const token = randomBytes(32).toString('hex');
  await client.query(
    'INSERT INTO "AuthToken" ("tokenHash", "userId", purpose, "expiresAt") VALUES ($1, $2, $3, $4)',
    [tokenHash(token), userId, purpose, new Date(Date.now() + lifetimeMs)],
  );
  return token;
}

async function workspaceFor(client: PoolClient, userId: string) {
  const result = await client.query<{ workspaceId: string }>(
    'SELECT "workspaceId" FROM "Membership" WHERE "userId" = $1 ORDER BY "workspaceId" LIMIT 1',
    [userId],
  );
  return result.rows[0]?.workspaceId ?? null;
}

export class IdentityRepository {
  constructor(private readonly pool: Pool) {}

  async ready() {
    await this.pool.query('SELECT 1');
  }

  async register(input: { name: string; email: string; password: string }) {
    const passwordHash = await hashPassword(input.password);
    const userId = randomUUID();
    const workspaceId = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO "User" (id, email, name, "passwordHash") VALUES ($1, $2, $3, $4)',
        [userId, input.email, input.name, passwordHash],
      );
      await client.query('INSERT INTO "Workspace" (id, name, "ownerId") VALUES ($1, $2, $3)', [
        workspaceId,
        `${input.name}'s workspace`,
        userId,
      ]);
      await client.query(
        'INSERT INTO "Membership" ("workspaceId", "userId", role) VALUES ($1, $2, $3)',
        [workspaceId, userId, 'owner'],
      );
      const verificationToken = await insertAuthToken(
        client,
        userId,
        'verify-email',
        24 * 60 * 60 * 1000,
      );
      await client.query('COMMIT');
      return { email: input.email, verificationToken };
    } catch (error) {
      await client.query('ROLLBACK');
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new DuplicateAccountError('Account already exists');
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async login(input: { email: string; password: string }) {
    const result = await this.pool.query<AccountRow>(
      'SELECT id, email, name, "passwordHash" FROM "User" WHERE email = $1',
      [input.email],
    );
    const account = result.rows[0];
    if (!account?.passwordHash || !(await verifyPassword(input.password, account.passwordHash))) {
      throw new InvalidCredentialsError('Invalid credentials');
    }
    const verified = await this.pool.query<{ emailVerifiedAt: Date | null }>(
      'SELECT "emailVerifiedAt" FROM "User" WHERE id = $1',
      [account.id],
    );
    if (!verified.rows[0]?.emailVerifiedAt)
      throw new EmailNotVerifiedError('Verify your email first');
    const client = await this.pool.connect();
    try {
      const token = await insertSession(client, account.id);
      return {
        token,
        user: {
          id: account.id,
          email: account.email,
          name: account.name,
          workspaceId: await workspaceFor(client, account.id),
        },
      };
    } finally {
      client.release();
    }
  }

  async session(token: string): Promise<SessionUser | null> {
    const result = await this.pool.query<SessionUser>(
      `SELECT u.id, u.email, u.name,
         (SELECT m."workspaceId" FROM "Membership" m WHERE m."userId" = u.id ORDER BY m."workspaceId" LIMIT 1) AS "workspaceId"
       FROM "Session" s JOIN "User" u ON u.id = s."userId"
       WHERE s."tokenHash" = $1 AND s."expiresAt" > NOW()`,
      [tokenHash(token)],
    );
    return result.rows[0] ?? null;
  }

  async workspaceMembers(workspaceId: string) {
    const result = await this.pool.query<{
      id: string;
      email: string;
      name: string | null;
      role: string;
    }>(
      `SELECT u.id, u.email, u.name, m.role
       FROM "Membership" m JOIN "User" u ON u.id = m."userId"
       WHERE m."workspaceId" = $1 ORDER BY u.name NULLS LAST, u.email`,
      [workspaceId],
    );
    return result.rows;
  }

  async logout(token: string) {
    await this.pool.query('DELETE FROM "Session" WHERE "tokenHash" = $1', [tokenHash(token)]);
  }

  async requestVerification(email: string) {
    const account = await this.pool.query<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1 AND "emailVerifiedAt" IS NULL',
      [email],
    );
    const userId = account.rows[0]?.id;
    if (!userId) return null;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "AuthToken" WHERE "userId" = $1 AND purpose = $2', [
        userId,
        'verify-email',
      ]);
      const token = await insertAuthToken(client, userId, 'verify-email', 24 * 60 * 60 * 1000);
      await client.query('COMMIT');
      return token;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async verifyEmail(token: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ userId: string }>(
        'SELECT "userId" FROM "AuthToken" WHERE "tokenHash" = $1 AND purpose = $2 AND "expiresAt" > NOW() FOR UPDATE',
        [tokenHash(token), 'verify-email'],
      );
      const userId = result.rows[0]?.userId;
      if (!userId) throw new InvalidTokenError('Verification link is invalid or expired');
      await client.query('DELETE FROM "AuthToken" WHERE "tokenHash" = $1', [tokenHash(token)]);
      await client.query(
        'UPDATE "User" SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", NOW()) WHERE id = $1',
        [userId],
      );
      const account = await client.query<{ id: string; email: string; name: string | null }>(
        'SELECT id, email, name FROM "User" WHERE id = $1',
        [userId],
      );
      const sessionToken = await insertSession(client, userId);
      const user = { ...account.rows[0], workspaceId: await workspaceFor(client, userId) };
      await client.query('COMMIT');
      return { token: sessionToken, user };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async requestPasswordReset(email: string) {
    const account = await this.pool.query<{ id: string }>(
      'SELECT id FROM "User" WHERE email = $1 AND "passwordHash" IS NOT NULL',
      [email],
    );
    const userId = account.rows[0]?.id;
    if (!userId) return null;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM "AuthToken" WHERE "userId" = $1 AND purpose = $2', [
        userId,
        'reset-password',
      ]);
      const token = await insertAuthToken(client, userId, 'reset-password', 30 * 60 * 1000);
      await client.query('COMMIT');
      return token;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resetPassword(token: string, password: string) {
    const passwordHash = await hashPassword(password);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ userId: string }>(
        'SELECT "userId" FROM "AuthToken" WHERE "tokenHash" = $1 AND purpose = $2 AND "expiresAt" > NOW() FOR UPDATE',
        [tokenHash(token), 'reset-password'],
      );
      const userId = result.rows[0]?.userId;
      if (!userId) throw new InvalidTokenError('Reset link is invalid or expired');
      await client.query('UPDATE "User" SET "passwordHash" = $1 WHERE id = $2', [
        passwordHash,
        userId,
      ]);
      await client.query('DELETE FROM "Session" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "AuthToken" WHERE "userId" = $1 AND purpose = $2', [
        userId,
        'reset-password',
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createOAuthAttempt(provider: string, codeVerifier: string, nonce: string) {
    const state = randomBytes(32).toString('hex');
    await this.pool.query(
      'INSERT INTO "OAuthAttempt" ("stateHash", provider, "codeVerifier", nonce, "expiresAt") VALUES ($1, $2, $3, $4, $5)',
      [tokenHash(state), provider, codeVerifier, nonce, new Date(Date.now() + 10 * 60 * 1000)],
    );
    return state;
  }

  async consumeOAuthAttempt(provider: string, state: string) {
    const result = await this.pool.query<{ codeVerifier: string; nonce: string }>(
      'DELETE FROM "OAuthAttempt" WHERE "stateHash" = $1 AND provider = $2 AND "expiresAt" > NOW() RETURNING "codeVerifier", nonce',
      [tokenHash(state), provider],
    );
    if (!result.rows[0]) throw new InvalidTokenError('Social sign-in request expired');
    return result.rows[0];
  }

  async socialLogin(input: {
    provider: string;
    subject: string;
    email: string | null;
    name: string | null;
    emailVerified: boolean;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const linked = await client.query<{ id: string; email: string; name: string | null }>(
        'SELECT u.id, u.email, u.name FROM "ExternalIdentity" i JOIN "User" u ON u.id = i."userId" WHERE i.provider = $1 AND i.subject = $2',
        [input.provider, input.subject],
      );
      let account = linked.rows[0];
      if (!account) {
        if (!input.email)
          throw new ProviderEmailRequiredError('This provider did not share an email address');
        const collision = await client.query('SELECT id FROM "User" WHERE email = $1', [
          input.email,
        ]);
        if (collision.rows.length)
          throw new AccountLinkRequiredError('An account with this email already exists');
        const userId = randomUUID();
        const workspaceId = randomUUID();
        await client.query(
          'INSERT INTO "User" (id, email, name, "emailVerifiedAt") VALUES ($1, $2, $3, $4)',
          [userId, input.email, input.name, input.emailVerified ? new Date() : null],
        );
        await client.query('INSERT INTO "Workspace" (id, name, "ownerId") VALUES ($1, $2, $3)', [
          workspaceId,
          `${input.name ?? input.email}'s workspace`,
          userId,
        ]);
        await client.query(
          'INSERT INTO "Membership" ("workspaceId", "userId", role) VALUES ($1, $2, $3)',
          [workspaceId, userId, 'owner'],
        );
        await client.query(
          'INSERT INTO "ExternalIdentity" (provider, subject, "userId") VALUES ($1, $2, $3)',
          [input.provider, input.subject, userId],
        );
        account = { id: userId, email: input.email, name: input.name };
      }
      const token = await insertSession(client, account.id);
      const user = { ...account, workspaceId: await workspaceFor(client, account.id) };
      await client.query('COMMIT');
      return { token, user };
    } catch (error) {
      await client.query('ROLLBACK');
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new AccountLinkRequiredError('An account with this email already exists');
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

export function createIdentityRepository(databaseUrl: string) {
  return new IdentityRepository(
    new Pool({ connectionString: databaseUrl, max: process.env.VERCEL ? 2 : 10 }),
  );
}
