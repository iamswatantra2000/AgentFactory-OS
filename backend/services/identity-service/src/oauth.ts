import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, decodeJwt, importPKCS8, jwtVerify, SignJWT } from 'jose';
import type { IdentityRepository } from './repository.js';

export type OAuthProvider = 'google' | 'microsoft' | 'apple';
export const oauthProviders: OAuthProvider[] = ['google', 'microsoft', 'apple'];

export class ProviderUnavailableError extends Error {}
export class OAuthProviderError extends Error {}

type ProviderCredentials = { clientId: string; clientSecret: string };
type OAuthConfig = {
  appBaseUrl: string;
  google?: ProviderCredentials;
  microsoft?: ProviderCredentials & { tenant: string };
  apple?: { clientId: string; teamId: string; keyId: string; privateKey: string };
};

const endpoints = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  apple: {
    authorize: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    jwks: 'https://appleid.apple.com/auth/keys',
  },
} as const;

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwks(url: string) {
  let keyset = jwksCache.get(url);
  if (!keyset) {
    keyset = createRemoteJWKSet(new URL(url), {
      timeoutDuration: 3_000,
      cacheMaxAge: 60 * 60 * 1000,
    });
    jwksCache.set(url, keyset);
  }
  return keyset;
}

function callbackUrl(base: string, provider: OAuthProvider) {
  return `${base.replace(/\/$/, '')}/api/auth/oauth/${provider}/callback`;
}

function base64url(input: Buffer) {
  return input.toString('base64url');
}

function validEmail(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export class OAuthService {
  constructor(
    private readonly config: OAuthConfig,
    private readonly repository: IdentityRepository,
  ) {}

  available() {
    return {
      google: Boolean(this.config.google?.clientId && this.config.google.clientSecret),
      microsoft: Boolean(this.config.microsoft?.clientId && this.config.microsoft.clientSecret),
      apple: Boolean(
        this.config.apple?.clientId &&
        this.config.apple.teamId &&
        this.config.apple.keyId &&
        this.config.apple.privateKey &&
        this.config.appBaseUrl.startsWith('https://'),
      ),
    };
  }

  async start(provider: OAuthProvider) {
    if (!this.available()[provider])
      throw new ProviderUnavailableError(`${provider} is not configured`);
    const codeVerifier = base64url(randomBytes(32));
    const nonce = base64url(randomBytes(24));
    const state = await this.repository.createOAuthAttempt(provider, codeVerifier, nonce);
    const challenge = base64url(createHash('sha256').update(codeVerifier).digest());
    const tenant = this.config.microsoft?.tenant ?? 'common';
    const authorizationEndpoint =
      provider === 'microsoft'
        ? `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`
        : endpoints[provider].authorize;
    const url = new URL(authorizationEndpoint);
    url.searchParams.set('client_id', this.clientId(provider));
    url.searchParams.set('redirect_uri', callbackUrl(this.config.appBaseUrl, provider));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('scope', provider === 'apple' ? 'name email' : 'openid email profile');
    if (provider === 'apple') {
      url.searchParams.set('response_mode', 'form_post');
    } else {
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }
    return { url: url.toString(), state };
  }

  async complete(provider: OAuthProvider, code: string, state: string) {
    if (!this.available()[provider])
      throw new ProviderUnavailableError(`${provider} is not configured`);
    const attempt = await this.repository.consumeOAuthAttempt(provider, state);
    const tenant = this.config.microsoft?.tenant ?? 'common';
    const tokenEndpoint =
      provider === 'microsoft'
        ? `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`
        : endpoints[provider].token;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(this.config.appBaseUrl, provider),
      client_id: this.clientId(provider),
      client_secret: await this.clientSecret(provider),
    });
    if (provider !== 'apple') body.set('code_verifier', attempt.codeVerifier);
    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new OAuthProviderError('The identity provider could not be reached');
    }
    if (!tokenResponse.ok)
      throw new OAuthProviderError('The identity provider rejected this sign-in');
    let tokenData: unknown;
    try {
      tokenData = await tokenResponse.json();
    } catch {
      throw new OAuthProviderError('The identity provider returned an invalid response');
    }
    if (
      typeof tokenData !== 'object' ||
      tokenData === null ||
      !('id_token' in tokenData) ||
      typeof tokenData.id_token !== 'string'
    )
      throw new OAuthProviderError('The identity provider did not return an identity token');
    const claims = await this.verifyIdToken(provider, tokenData.id_token, attempt.nonce);
    const email = validEmail(claims.email)
      ? claims.email.toLowerCase()
      : provider === 'microsoft' && validEmail(claims.preferred_username)
        ? claims.preferred_username.toLowerCase()
        : null;
    const name = typeof claims.name === 'string' ? claims.name.slice(0, 120) : null;
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    return this.repository.socialLogin({
      provider,
      subject: claims.sub,
      email,
      name,
      emailVerified,
    });
  }

  private clientId(provider: OAuthProvider) {
    return this.config[provider]?.clientId ?? '';
  }

  private async clientSecret(provider: OAuthProvider) {
    if (provider !== 'apple') return this.config[provider]?.clientSecret ?? '';
    const apple = this.config.apple;
    if (!apple) throw new ProviderUnavailableError('Apple is not configured');
    const key = await importPKCS8(apple.privateKey.replace(/\\n/g, '\n'), 'ES256');
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: apple.keyId })
      .setIssuer(apple.teamId)
      .setSubject(apple.clientId)
      .setAudience('https://appleid.apple.com')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key);
  }

  private async verifyIdToken(provider: OAuthProvider, token: string, nonce: string) {
    let issuer: string | string[];
    let keyUrl: string;
    if (provider === 'google') {
      issuer = ['https://accounts.google.com', 'accounts.google.com'];
      keyUrl = endpoints.google.jwks;
    } else if (provider === 'apple') {
      issuer = 'https://appleid.apple.com';
      keyUrl = endpoints.apple.jwks;
    } else {
      let untrusted;
      try {
        untrusted = decodeJwt(token);
      } catch {
        throw new OAuthProviderError('The identity token could not be decoded');
      }
      const tenantId = untrusted.tid;
      if (typeof tenantId !== 'string' || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
        throw new OAuthProviderError('Microsoft did not return a valid tenant');
      }
      const configuredTenant = this.config.microsoft?.tenant ?? 'common';
      if (
        !['common', 'organizations', 'consumers'].includes(configuredTenant) &&
        configuredTenant !== tenantId
      ) {
        throw new OAuthProviderError('Microsoft tenant is not allowed');
      }
      issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
      keyUrl = `https://login.microsoftonline.com/${encodeURIComponent(configuredTenant)}/discovery/v2.0/keys`;
    }
    let claims;
    try {
      ({ payload: claims } = await jwtVerify(token, jwks(keyUrl), {
        issuer,
        audience: this.clientId(provider),
        algorithms: ['RS256'],
        clockTolerance: '30s',
      }));
    } catch {
      throw new OAuthProviderError('The identity token could not be verified');
    }
    if (!claims.sub || claims.nonce !== nonce)
      throw new OAuthProviderError('Social sign-in could not be verified');
    return claims;
  }
}

export function createOAuthService(
  repository: IdentityRepository,
  env: NodeJS.ProcessEnv = process.env,
) {
  const credentials = (prefix: string): ProviderCredentials | undefined => {
    const clientId = env[`${prefix}_CLIENT_ID`];
    const clientSecret = env[`${prefix}_CLIENT_SECRET`];
    return clientId && clientSecret ? { clientId, clientSecret } : undefined;
  };
  const microsoft = credentials('MICROSOFT');
  const apple =
    env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY
      ? {
          clientId: env.APPLE_CLIENT_ID,
          teamId: env.APPLE_TEAM_ID,
          keyId: env.APPLE_KEY_ID,
          privateKey: env.APPLE_PRIVATE_KEY,
        }
      : undefined;
  return new OAuthService(
    {
      appBaseUrl: env.APP_BASE_URL ?? 'http://localhost:3000',
      google: credentials('GOOGLE'),
      microsoft: microsoft
        ? { ...microsoft, tenant: env.MICROSOFT_TENANT_ID ?? 'common' }
        : undefined,
      apple,
    },
    repository,
  );
}
