import Image from 'next/image';
import Link from 'next/link';
import { AuthForm, type AuthMode } from '../screen-components/Auth/AuthForm';
import styles from '../screen-components/Auth/auth.module.css';

const copy: Record<AuthMode, { eyebrow: string; title: string; description: string }> = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Sign in to continue',
    description: 'Return to your AgentFactory OS workspace and pick up where you left off.',
  },
  signup: {
    eyebrow: 'Get started',
    title: 'Create your account',
    description:
      'Give your workspace a clear beginning. Start with an account for the person who will lead it.',
  },
  'forgot-password': {
    eyebrow: 'Reset access',
    title: 'Reset your password',
    description: 'Enter your work email and we’ll send you a link to reset your password.',
  },
  'verify-email': {
    eyebrow: 'Action required',
    title: 'Check your inbox',
    description: 'Open the verification link we sent to your email. Links expire after 24 hours.',
  },
  'reset-password': {
    eyebrow: 'Reset password',
    title: 'Choose a new password',
    description: 'Create a strong password to keep your account secure.',
  },
};

export default function AuthScreen({
  mode,
  notice,
  returnTo,
}: {
  mode: AuthMode;
  notice?: string;
  returnTo?: string;
}) {
  const current = copy[mode];
  return (
    <main className={styles.page}>
      <section className={styles.frame} aria-labelledby="auth-title">
        <aside className={styles.brandRail}>
          <Link href="/" className={styles.wordmark} aria-label="AgentFactory OS home">
            AgentFactory <span>OS</span>
          </Link>
          <div className={styles.railMessage}>
            <span className={styles.railRule} />
            <p>Your agents, clearly accountable.</p>
          </div>
          <Image
            src="/images/brand/component4.png"
            alt=""
            aria-hidden="true"
            className={styles.railArt}
            width={1536}
            height={1024}
            sizes="(max-width: 767px) 1px, 1200px"
          />
          <Image
            src="/images/brand/component7.png"
            alt=""
            aria-hidden="true"
            className={styles.railLeaf}
            width={1448}
            height={1086}
            sizes="240px"
          />
          <p className={styles.railFoot}>People. Context. Outcomes.</p>
        </aside>
        <div className={styles.content}>
          <Link href="/" className={styles.backLink}>
            ← Back to home
          </Link>
          <div className={styles.formIntro}>
            <p className={styles.eyebrow}>{current.eyebrow}</p>
            <h1 id="auth-title">{current.title}</h1>
            <p>{current.description}</p>
          </div>
          <AuthForm mode={mode} notice={notice} returnTo={returnTo} />
          <p className={styles.switchLink}>
            {mode === 'signup'
              ? 'Already have an account?'
              : mode === 'login'
                ? 'New to AgentFactory OS?'
                : 'Ready to sign in?'}{' '}
            <Link href={mode === 'login' ? '/signup' : '/login'}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
