import { ArrowRightIcon } from '@phosphor-icons/react/ssr';
import styles from './landing.module.css';

export function AccessAction({
  signIn = false,
  arrow = false,
  authenticated = false,
}: {
  signIn?: boolean;
  arrow?: boolean;
  authenticated?: boolean;
}) {
  return (
    <a
      className={signIn ? styles.textAction : styles.primaryAction}
      href={authenticated ? '/dashboard' : signIn ? '/login' : '/signup'}
    >
      {authenticated
        ? signIn
          ? 'Dashboard'
          : 'Go to dashboard'
        : signIn
          ? 'Sign in'
          : 'Get started'}
      {arrow && <ArrowRightIcon size={20} aria-hidden="true" />}
    </a>
  );
}
