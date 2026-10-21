import Image from 'next/image';
import styles from '../screen-components/Auth/auth.module.css';

export default function AuthResultScreen({
  kind,
}: {
  kind: 'reset-link-sent' | 'email-verified' | 'reset-complete';
}) {
  const copy = {
    'reset-link-sent': {
      eyebrow: 'Check your inbox',
      title: 'A reset link is on its way',
      detail:
        'If an account exists for that email, we sent a link to reset your password. It expires in 30 minutes.',
      href: '/login',
      cta: 'Back to sign in',
    },
    'email-verified': {
      eyebrow: 'Email verified',
      title: 'Your identity is confirmed',
      detail: 'Your email is verified and your account is ready to use.',
      href: '/welcome',
      cta: 'Continue to AgentFactory OS',
    },
    'reset-complete': {
      eyebrow: 'Password updated',
      title: 'You’re ready to sign in',
      detail: 'Your password has been reset. All previous sessions have been signed out.',
      href: '/login',
      cta: 'Continue to sign in',
    },
  }[kind];
  return (
    <main className={styles.page}>
      <section className={styles.frame} aria-labelledby="result-title">
        <aside className={styles.brandRail}>
          <a href="/" className={styles.wordmark}>
            AgentFactory <span>OS</span>
          </a>
          <div className={styles.railMessage}>
            <span className={styles.railRule} />
            <p>Your agents, clearly accountable.</p>
          </div>
          <Image
            src="/images/brand/component4.png"
            alt=""
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
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <div className={styles.formIntro}>
            <h1 id="result-title">{copy.title}</h1>
            <p>{copy.detail}</p>
          </div>
          <a href={copy.href} className={styles.resultAction}>
            {copy.cta}
          </a>
        </div>
      </section>
    </main>
  );
}
