import {
  ArrowRightIcon,
  SquaresFourIcon,
  UsersThreeIcon,
  GitBranchIcon,
} from '@phosphor-icons/react/ssr';
import { BrandWordmark } from '@/components/design-system';
import type { SessionUser } from '@/server/landing-session';
import styles from '../screen-components/Dashboard/dashboard.module.css';

export default function DashboardScreen({ user }: { user: SessionUser }) {
  const firstName = user.name?.split(' ')[0] || 'there';
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/welcome" aria-label="AgentFactory OS welcome">
          <BrandWordmark />
        </a>
        <div className={styles.headerActions}>
          <span>{user.name ?? user.email}</span>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className={styles.main}>
        <p className={styles.eyebrow}>Your workspace</p>
        <h1>Welcome, {firstName}.</h1>
        <p className={styles.lead}>
          Your account is ready. We’re building the workspace around clear roles, connected work,
          and human decisions.
        </p>
        <div className={styles.cards}>
          <article>
            <UsersThreeIcon size={32} weight="light" aria-hidden="true" />
            <h2>Define roles</h2>
            <p>Give every specialist a purpose and a clear boundary.</p>
          </article>
          <article>
            <GitBranchIcon size={32} weight="light" aria-hidden="true" />
            <h2>Connect the work</h2>
            <p>Map context, handoffs, and expected outcomes.</p>
          </article>
          <article>
            <SquaresFourIcon size={32} weight="light" aria-hidden="true" />
            <h2>Keep oversight</h2>
            <p>Make approvals and human judgment visible.</p>
          </article>
        </div>
        <div className={styles.previewNote}>
          <div>
            <strong>Workspace preview</strong>
            <p>
              Agent execution and paid subscriptions are not active yet. Your account and workspace
              have been created; more tools will appear here as they become available.
            </p>
          </div>
          <a href="/welcome">
            Explore the product <ArrowRightIcon size={18} aria-hidden="true" />
          </a>
        </div>
      </main>
    </div>
  );
}
