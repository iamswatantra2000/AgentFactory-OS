'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Button, FeedbackBanner, TextField } from '@/components/design-system';
import styles from './auth.module.css';

export type AuthMode = 'login' | 'signup' | 'forgot-password' | 'verify-email' | 'reset-password';

function message(result: unknown, fallback: string) {
  return typeof result === 'object' &&
    result &&
    'title' in result &&
    typeof result.title === 'string'
    ? result.title
    : fallback;
}

export function AuthForm({
  mode,
  notice,
  returnTo,
}: {
  mode: AuthMode;
  notice?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recoveryPath, setRecoveryPath] = useState('');
  const [token, setToken] = useState('');
  const [initialEmail, setInitialEmail] = useState('');
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
    setInitialEmail(new URLSearchParams(window.location.search).get('email') ?? '');
    if (mode === 'login' || mode === 'signup') {
      fetch('/api/auth/oauth/providers', { cache: 'no-store' })
        .then((response) => response.json())
        .then((data) => setProviders(data))
        .catch(() => setProviders({}));
    }
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setSuccess('');
    setRecoveryPath('');
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(values.get('password') ?? '');
    const confirm = String(values.get('confirm') ?? '');
    if ((mode === 'signup' || mode === 'reset-password') && password.length < 12) {
      setError('Choose a password with at least 12 characters.');
      return;
    }
    if (mode === 'reset-password' && password !== confirm) {
      setError('Passwords must match.');
      return;
    }
    if ((mode === 'verify-email' || mode === 'reset-password') && !token) {
      setError(
        'This link is missing its token. Open the link from your email or request a new one.',
      );
      return;
    }
    const action = {
      login: 'login',
      signup: 'signup',
      'forgot-password': 'request-reset',
      'verify-email': 'verify-email',
      'reset-password': 'reset-password',
    }[mode];
    const payload =
      mode === 'verify-email'
        ? { token }
        : mode === 'reset-password'
          ? { token, password }
          : mode === 'forgot-password'
            ? { email }
            : {
                email,
                password,
                ...(mode === 'signup' ? { name: String(values.get('name') ?? '').trim() } : {}),
              };
    setPending(true);
    let navigating = false;
    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      if (!response.ok) {
        setError(
          message(
            await response.json().catch(() => null),
            'We could not complete this request. Please try again.',
          ),
        );
        if (
          (mode === 'login' && response.status === 403) ||
          (mode === 'signup' && [409, 503].includes(response.status))
        ) {
          setRecoveryPath(`/verify-email?email=${encodeURIComponent(email)}`);
        }
        return;
      }
      navigating = true;
      if (mode === 'signup') router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
      else if (mode === 'forgot-password') router.replace('/reset-link-sent');
      else if (mode === 'verify-email') router.replace('/welcome');
      else if (mode === 'reset-password') router.replace('/reset-complete');
      else {
        const projectMatch =
          /^\/projects\/([0-9a-f-]{36})\/(overview|playground|agents|work|knowledge|reviews|analytics|team|settings)$/.exec(
            returnTo || '',
          );
        if (projectMatch) {
          const projectResponse = await fetch(`/api/projects/${projectMatch[1]}`, {
            cache: 'no-store',
          }).catch(() => null);
          if (projectResponse?.ok) {
            router.replace(returnTo!);
            return;
          }
        }
        router.replace('/welcome');
      }
    } catch {
      navigating = false;
      setError('Connection lost. Please check your connection and try again.');
    } finally {
      if (!navigating) setPending(false);
    }
  }

  async function resend() {
    if (!initialEmail || pending) {
      setError('Enter your email in the sign-up form to request a new link.');
      return;
    }
    setPending(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: initialEmail }),
        cache: 'no-store',
      });
      if (!response.ok) {
        setError(message(await response.json().catch(() => null), 'Could not resend the link.'));
        return;
      }
      setSuccess('If this account needs verification, a new link is on its way.');
    } catch {
      setError('Connection lost. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const isEmailEntry = mode === 'login' || mode === 'signup' || mode === 'forgot-password';
  return (
    <div className={styles.formArea}>
      {notice && (
        <FeedbackBanner tone="warning" title="Sign-in notice">
          {notice === 'session-expired'
            ? 'Your session expired. Sign in to continue.'
            : notice === 'provider-unavailable'
              ? 'This sign-in provider is not configured yet.'
              : 'Social sign-in did not complete. Please try again or use your email.'}
        </FeedbackBanner>
      )}
      {error && (
        <FeedbackBanner tone="error" title="Could not continue">
          {error}
        </FeedbackBanner>
      )}
      {recoveryPath && (
        <Link className={styles.inlineLink} href={recoveryPath}>
          Open email verification →
        </Link>
      )}
      {success && (
        <FeedbackBanner tone="success" title="Email requested">
          {success}
        </FeedbackBanner>
      )}
      {mode === 'verify-email' && !token && (
        <FeedbackBanner tone="info" title="Open your email link">
          Your verification link contains a one-time code. It will appear here when you open the
          link from your email.
        </FeedbackBanner>
      )}
      {mode === 'reset-password' && !token && (
        <FeedbackBanner tone="info" title="Open your reset link">
          Use the one-time link from your password reset email. If it is missing or expired, request
          another link.
        </FeedbackBanner>
      )}
      {((mode !== 'verify-email' && mode !== 'reset-password') || Boolean(token)) && (
        <form className={styles.form} onSubmit={submit}>
          {mode === 'signup' && (
            <TextField
              label="Full name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              disabled={pending}
              placeholder="Your name"
            />
          )}
          {isEmailEntry && (
            <TextField
              label="Work email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={pending}
              placeholder="you@company.com"
            />
          )}
          {(mode === 'login' || mode === 'signup' || mode === 'reset-password') && (
            <TextField
              label={mode === 'reset-password' ? 'New password' : 'Password'}
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'login' ? undefined : 12}
              maxLength={128}
              disabled={pending}
              helperText={
                mode === 'signup' || mode === 'reset-password'
                  ? 'Use at least 12 characters.'
                  : undefined
              }
            />
          )}
          {mode === 'reset-password' && (
            <TextField
              label="Confirm password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              disabled={pending}
            />
          )}
          {mode === 'login' && (
            <Link className={styles.inlineLink} href="/forgot-password">
              Forgot password?
            </Link>
          )}
          <Button
            type="submit"
            size="large"
            loading={pending}
            loadingLabel="Please wait…"
            className={styles.submit}
          >
            {
              {
                login: 'Sign in',
                signup: 'Create account',
                'forgot-password': 'Send reset link',
                'verify-email': 'Verify email',
                'reset-password': 'Reset password',
              }[mode]
            }
            <ArrowRightIcon size={18} aria-hidden="true" />
          </Button>
        </form>
      )}
      {mode === 'verify-email' && (
        <TextField
          label="Work email for a new link"
          type="email"
          value={initialEmail}
          onChange={(event) => setInitialEmail(event.target.value)}
          autoComplete="email"
          maxLength={254}
          disabled={pending}
          placeholder="you@company.com"
        />
      )}
      {mode === 'reset-password' && !token && (
        <Link className={styles.inlineLink} href="/forgot-password">
          Request a new reset link
        </Link>
      )}
      {mode === 'verify-email' && (
        <button className={styles.textButton} type="button" onClick={resend} disabled={pending}>
          Resend verification email
        </button>
      )}
      {(mode === 'login' || mode === 'signup') && (
        <div className={styles.socialArea}>
          <p>Or continue with</p>
          <div className={styles.socialButtons}>
            {(['google', 'apple', 'microsoft'] as const).map((provider) => (
              <a
                key={provider}
                className={`${styles.socialButton} ${!providers[provider] ? styles.socialDisabled : ''}`}
                href={providers[provider] ? `/api/auth/oauth/${provider}/start` : undefined}
                aria-disabled={!providers[provider]}
                title={!providers[provider] ? `${provider} sign-in is not configured` : undefined}
              >
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </a>
            ))}
          </div>
          {!Object.values(providers).some(Boolean) && (
            <small>Social sign-in will be available after provider setup.</small>
          )}
        </div>
      )}
    </div>
  );
}
