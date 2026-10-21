export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  workspaceId: string | null;
};
export type LandingSession = { authenticated: false } | { authenticated: true; user: SessionUser };

/** The gateway validates the opaque browser cookie against the identity service. */
export async function getLandingSession(cookieHeader: string): Promise<LandingSession | null> {
  try {
    const gateway = process.env.API_GATEWAY_URL ?? 'http://localhost:4000';
    const response = await fetch(`${gateway}/api/v1/session/status`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    const session: unknown = await response.json();
    if (typeof session !== 'object' || session === null || !('authenticated' in session))
      return null;
    if (session.authenticated === false) return { authenticated: false };
    if (
      session.authenticated !== true ||
      !('user' in session) ||
      typeof session.user !== 'object' ||
      session.user === null
    )
      return null;
    const user = session.user;
    if (
      !('id' in user) ||
      typeof user.id !== 'string' ||
      !('email' in user) ||
      typeof user.email !== 'string' ||
      !('name' in user) ||
      !(typeof user.name === 'string' || user.name === null) ||
      !('workspaceId' in user) ||
      !(typeof user.workspaceId === 'string' || user.workspaceId === null)
    )
      return null;
    return { authenticated: true, user: user as SessionUser };
  } catch {
    return null;
  }
}

/** Show the public entrance whenever there is no valid signed-in session. */
export async function shouldShowLandingEntrance(cookieHeader: string): Promise<boolean> {
  const session = await getLandingSession(cookieHeader);
  return session?.authenticated !== true;
}
