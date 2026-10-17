'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Button, TextField } from '@/components/design-system';
import styles from './auth.module.css';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const signup = mode === 'signup';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    const values = new FormData(event.currentTarget);
    const payload = {
      ...(signup ? { name: String(values.get('name') ?? '').trim() } : {}),
      email: String(values.get('email') ?? '')
        .trim()
        .toLowerCase(),
      password: String(values.get('password') ?? ''),
    };
    if (signup && payload.password.length < 12) {
      setError('Choose a password with at least 12 characters.');
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        setError(
          typeof result === 'object' &&
            result !== null &&
            'title' in result &&
            typeof result.title === 'string'
            ? result.title
            : 'We could not complete this request. Please try again.',
        );
        return;
      }
      window.location.assign('/welcome');
    } catch {
      setError('Connection lost. Please check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {signup && (
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
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete={signup ? 'new-password' : 'current-password'}
        required
        minLength={signup ? 12 : undefined}
        maxLength={128}
        disabled={pending}
        helperText={signup ? 'Use at least 12 characters.' : undefined}
      />
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="large"
        loading={pending}
        loadingLabel={signup ? 'Creating account…' : 'Signing in…'}
        className={styles.submit}
      >
        {signup ? 'Create account' : 'Sign in'} <ArrowRightIcon size={18} aria-hidden="true" />
      </Button>
    </form>
  );
}
