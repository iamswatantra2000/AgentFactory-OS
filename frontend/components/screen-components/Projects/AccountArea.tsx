import Link from 'next/link';
import {
  ArrowRightIcon,
  FileTextIcon,
  FolderIcon,
  GearSixIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react/ssr';
import type { SessionUser } from '@/server/landing-session';
import type { ProjectList, WorkspaceMember } from '@/server/projects';
import { WorkspaceShell } from './WorkspaceShell';
import styles from './projects.module.css';

type Area = 'templates' | 'members' | 'plan' | 'settings';
export function AccountArea({
  area,
  user,
  projects,
  members,
  notice,
}: {
  area: Area;
  user: SessionUser;
  projects: ProjectList | null;
  members: WorkspaceMember[];
  notice?: string;
}) {
  const title = {
    templates: 'Templates',
    members: 'Members',
    plan: 'Plan & billing',
    settings: 'Settings',
  }[area];
  return (
    <WorkspaceShell user={user} active={`/${area}`}>
      <main className={styles.pageContent}>
        <div className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Your workspace</p>
            <h1>{title}</h1>
            <p>
              {area === 'templates'
                ? 'A considered starting point for new projects.'
                : area === 'members'
                  ? 'People who share this workspace.'
                  : area === 'plan'
                    ? 'Know your capacity before you create more work.'
                    : 'Account details and access.'}
            </p>
          </div>
        </div>
        {area === 'templates' && (
          <div className={styles.projectGrid}>
            {[
              {
                key: 'customer-insights',
                name: 'Customer insights',
                copy: 'Turn product and support signals into a leadership-ready brief.',
              },
              {
                key: 'campaign-operations',
                name: 'Campaign operations',
                copy: 'Plan, produce, and review launch work with clear handoffs.',
              },
            ].map((template) => (
              <article className={styles.projectCard} key={template.key}>
                <span className={styles.projectIcon}>
                  <FileTextIcon size={25} />
                </span>
                <h3>{template.name}</h3>
                <p className={styles.cardPurpose}>{template.copy}</p>
                <Link className={styles.cardAction} href={`/projects?template=${template.key}`}>
                  Use template <ArrowRightIcon size={17} />
                </Link>
              </article>
            ))}
          </div>
        )}
        {area === 'members' && (
          <section className={styles.bottomCards} style={{ display: 'block' }}>
            <section>
              <h2>Workspace directory</h2>
              <p>
                {members.length} {members.length === 1 ? 'member' : 'members'} can be selected
                during project creation.
              </p>
              <ul>
                {members.map((member) => (
                  <li key={member.id} style={{ padding: '10px 0', fontSize: 12 }}>
                    <UsersThreeIcon size={17} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    {member.name || member.email} · {member.role}
                  </li>
                ))}
              </ul>
              <p>
                Workspace invitations are not available yet; no invitation email will be sent from
                this screen.
              </p>
            </section>
          </section>
        )}
        {area === 'plan' && (
          <section className={styles.bottomCards} style={{ display: 'block' }}>
            <section>
              <h2>{projects?.plan.name || 'Plan unavailable'}</h2>
              <p>
                {projects
                  ? `${projects.plan.projectCount} of ${projects.plan.projectLimit} projects in use.`
                  : 'We could not load current capacity.'}
              </p>
              <p>
                Paid checkout and plan changes are not active in this development release. Existing
                projects remain available if you reach the limit.
              </p>
              <Link href="/projects">
                Back to projects <ArrowRightIcon size={16} />
              </Link>
            </section>
          </section>
        )}
        {area === 'settings' && (
          <section className={styles.bottomCards} style={{ display: 'block' }}>
            <section>
              {notice === 'signout-unavailable' && (
                <p className={styles.accountAlert} role="alert">
                  Sign out could not be completed. Your session is still active; please try again.
                </p>
              )}
              <GearSixIcon size={26} />
              <h2>Account settings</h2>
              <p>
                Signed in as {user.name || user.email} ({user.email}).
              </p>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className={styles.secondaryButton}>
                  Sign out
                </button>
              </form>
            </section>
          </section>
        )}
        <div className={styles.bottomCards} style={{ marginTop: 20 }}>
          <section>
            <FolderIcon size={22} />
            <h2 style={{ marginTop: 10 }}>Keep work in context</h2>
            <p>Choose a project to see its agents, ledger, reviews, and settings.</p>
            <Link href="/projects">
              All projects <ArrowRightIcon size={16} />
            </Link>
          </section>
        </div>
      </main>
    </WorkspaceShell>
  );
}
