import Image from 'next/image';
import { AuthForm } from '../screen-components/Auth/AuthForm';
import styles from '../screen-components/Auth/auth.module.css';

export default function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  return (
    <main className={styles.page}>
      <section className={styles.frame} aria-labelledby="auth-title">
        <aside className={styles.brandRail}>
          <a href="/" className={styles.wordmark} aria-label="AgentFactory OS home">
            AgentFactory <span>OS</span>
          </a>
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
            sizes="(max-width: 767px) 400px, 660px"
          />
          <p className={styles.railFoot}>People. Context. Outcomes.</p>
        </aside>
        <div className={styles.content}>
          <a href="/" className={styles.backLink}>
            ← Back to home
          </a>
          <div className={styles.formIntro}>
            <p className={styles.eyebrow}>{signup ? 'Get started' : 'Welcome back'}</p>
            <h1 id="auth-title">{signup ? 'Create your account' : 'Sign in to continue'}</h1>
            <p>
              {signup
                ? 'Give your workspace a clear beginning. Start with an account for the person who will lead it.'
                : 'Return to your AgentFactory OS workspace and pick up where you left off.'}
            </p>
          </div>
          <AuthForm mode={mode} />
          <p className={styles.switchLink}>
            {signup ? 'Already have an account?' : 'New to AgentFactory OS?'}{' '}
            <a href={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</a>
          </p>
          <p className={styles.securityNote}>
            Your password is never stored in plain text. Sessions use a secure, HttpOnly browser
            cookie.
          </p>
        </div>
      </section>
    </main>
  );
}
