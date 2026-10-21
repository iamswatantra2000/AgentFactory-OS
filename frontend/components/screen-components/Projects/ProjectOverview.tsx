'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BellIcon,
  CaretDownIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  FolderIcon,
  GearSixIcon,
  GitBranchIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { BrandWordmark } from '@/components/design-system';
import type { SessionUser } from '@/server/landing-session';
import type { Project, ProjectList } from '@/server/projects';
import { VisualFactory } from './VisualFactory';
import styles from './overview.module.css';

const nav = [
  { slug: 'overview', label: 'Project overview', Icon: FolderIcon },
  { slug: 'playground', label: 'Playground', Icon: GitBranchIcon },
  { slug: 'agents', label: 'Agents', Icon: UsersThreeIcon },
  { slug: 'work', label: 'Work ledger', Icon: FileTextIcon },
  { slug: 'knowledge', label: 'Knowledge', Icon: FolderIcon },
  { slug: 'reviews', label: 'Reviews', Icon: CheckCircleIcon },
  { slug: 'analytics', label: 'Analytics', Icon: ChartBarIcon },
  { slug: 'team', label: 'Team', Icon: UsersThreeIcon },
  { slug: 'settings', label: 'Project settings', Icon: GearSixIcon },
] as const;

export function ProjectOverview({
  project,
  list,
  user,
  section = 'overview',
}: {
  project: Project;
  list: ProjectList | null;
  user: SessionUser;
  section?: string;
}) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const firstName = user.name?.split(' ')[0] || 'there';
  const readOnly = project.status === 'archived';
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/projects">
          <BrandWordmark />
        </Link>
        <Link className={styles.allProjects} href="/projects">
          <ArrowLeftIcon size={17} /> Back to all projects
        </Link>
        <div className={styles.selectorWrap}>
          <button
            type="button"
            className={styles.projectSelector}
            aria-expanded={selectorOpen}
            onClick={() => setSelectorOpen(!selectorOpen)}
          >
            <span className={styles.projectMark}>
              <FolderIcon size={20} />
            </span>
            <span>{project.name}</span>
            <CaretDownIcon size={16} aria-hidden="true" />
          </button>
          {selectorOpen && (
            <div className={styles.selectorMenu}>
              <Link href="/projects" className={styles.firstAction}>
                All projects
              </Link>
              {(list?.projects || [])
                .filter((row) => row.status !== 'archived')
                .map((row) => (
                  <Link
                    key={row.id}
                    href={`/projects/${row.id}/${row.status === 'preparing' ? 'setup' : 'overview'}`}
                  >
                    {row.name}
                  </Link>
                ))}
            </div>
          )}
        </div>
        <nav className={styles.nav} aria-label="Project navigation">
          {nav.map(({ slug, label, Icon }) => (
            <Link
              key={slug}
              href={`/projects/${project.id}/${slug}`}
              aria-current={section === slug ? 'page' : undefined}
            >
              <Icon size={20} /> {label}
            </Link>
          ))}
        </nav>
        <details className={styles.bottomProfile}>
          <summary>
            <span>{firstName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.name || user.email}</strong>
              <small>
                {project.role} · {project.name}
              </small>
            </div>
            <CaretDownIcon size={15} aria-hidden="true" />
          </summary>
          <div className={styles.profileActions}>
            <Link href="/settings" aria-label="Account settings">
              Account settings
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" aria-label="Sign out of AgentFactory OS">
                Sign out
              </button>
            </form>
          </div>
        </details>
        <div className={styles.ariCard} aria-label="Ari assistant is coming soon">
          <span className={styles.ariFace}>✦</span>
          <span>
            <strong>Ask Ari</strong>
            <small>Your AI assistant · Coming soon</small>
          </span>
          <ArrowRightIcon size={16} aria-hidden="true" />
        </div>
      </aside>
      <div className={styles.mainColumn}>
        <Image
          src="/images/brand/component1.png"
          alt=""
          aria-hidden="true"
          className={styles.cornerArt}
          width={2172}
          height={724}
          sizes="400px"
        />
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.topSearch}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <MagnifyingGlassIcon size={20} />
            <span>Jump to a section in {project.name}</span>
            <kbd>⌘ K</kbd>
          </button>
          {searchOpen && (
            <div className={styles.commandMenu}>
              <label htmlFor="project-command-search">Project sections</label>
              <input
                id="project-command-search"
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search sections…"
              />
              <div>
                {nav
                  .filter(({ label }) => label.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(({ slug, label, Icon }) => (
                    <Link key={slug} href={`/projects/${project.id}/${slug}`}>
                      <Icon size={17} /> {label}
                    </Link>
                  ))}
              </div>
              <small>
                Agent, run, and knowledge search will appear as those services are added.
              </small>
            </div>
          )}
          <div className={styles.headerActions}>
            <span className={styles.dateRange}>
              <ClockIcon size={18} /> Last 7 days
            </span>
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <BellIcon size={22} />
            </button>
            {notificationsOpen && (
              <div className={styles.notificationPanel}>No project notifications yet.</div>
            )}
            <span className={styles.mobileAvatar}>{firstName.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main className={`${styles.main} ${section === 'playground' ? styles.playgroundMain : ''}`}>
          {section === 'overview' ? (
            <>
              <div className={styles.heading}>
                <div>
                  <p className={styles.eyebrow}>Operational overview · {project.name}</p>
                  <h1>Good to see you, {firstName}.</h1>
                  <p>Here’s where your agents will need attention and what they’ve completed.</p>
                </div>
                <div className={styles.actions}>
                  <Link href={`/projects/${project.id}/playground`}>
                    <GitBranchIcon size={18} /> Open playground
                  </Link>
                  <button
                    type="button"
                    disabled
                    title="Workflow runs will be available when execution is ready"
                  >
                    <PlayIcon size={18} /> Run workflow
                  </button>
                </div>
              </div>
              {readOnly && (
                <div className={styles.notice}>
                  <strong>Archived project · Read-only</strong>
                  <p>
                    Existing information remains safe. An Owner or Admin can restore this project
                    from Projects home.
                  </p>
                </div>
              )}
              {project.status === 'paused' && (
                <div className={styles.notice}>
                  <strong>Project paused</strong>
                  <p>
                    Existing work is visible, but new execution is paused until an Owner or Admin
                    resumes the project.
                  </p>
                </div>
              )}
              <div className={styles.metrics}>
                <div>
                  <span className={styles.metricIcon}>
                    <UsersThreeIcon size={23} />
                  </span>
                  <span>
                    <small>Active agents</small>
                    <strong>0</strong>
                    <em>None configured yet</em>
                  </span>
                </div>
                <div>
                  <span className={styles.metricIcon}>
                    <ChartBarIcon size={23} />
                  </span>
                  <span>
                    <small>Runs this week</small>
                    <strong>0</strong>
                    <em>No runs started</em>
                  </span>
                </div>
                <div>
                  <span className={styles.metricIcon}>
                    <FileTextIcon size={23} />
                  </span>
                  <span>
                    <small>Review queue</small>
                    <strong>0</strong>
                    <em>Nothing needs review</em>
                  </span>
                </div>
                <div>
                  <span className={styles.metricIcon}>
                    <CheckCircleIcon size={23} />
                  </span>
                  <span>
                    <small>Success rate</small>
                    <strong>—</strong>
                    <em>Available after runs</em>
                  </span>
                </div>
              </div>
              <div className={styles.mainGrid}>
                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div>
                      <h2>Live operations</h2>
                      <p>Agents and their current work in this project.</p>
                    </div>
                    <div className={styles.operationFilters} aria-label="Operation counts">
                      <span className={styles.pill}>All&nbsp; 0</span>
                      <span>Running&nbsp; 0</span>
                      <span>Waiting&nbsp; 0</span>
                    </div>
                  </div>
                  <div className={styles.panelEmpty}>
                    <span className={styles.emptyGlyph}>
                      <PlayIcon size={26} />
                    </span>
                    <strong>No live operations yet.</strong>
                    <p>
                      Once agents and workflows are available, active runs and checkpoints will
                      appear here.
                    </p>
                  </div>
                </section>
                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div>
                      <h2>Review queue</h2>
                      <p>Items that need a human decision.</p>
                    </div>
                  </div>
                  <div className={styles.panelEmpty}>
                    <span className={styles.emptyGlyph}>
                      <CheckCircleIcon size={26} />
                    </span>
                    <strong>You’re all caught up.</strong>
                    <p>There are no items waiting for review.</p>
                  </div>
                </section>
              </div>
              <div className={styles.lowerGrid}>
                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div>
                      <h2>Work ledger</h2>
                      <p>Recent agent work, decisions, and outcomes.</p>
                    </div>
                    <Link href={`/projects/${project.id}/work`}>
                      View all work <ArrowRightIcon size={15} />
                    </Link>
                  </div>
                  <div className={styles.tableHead}>
                    <span>Task</span>
                    <span>Owner</span>
                    <span>Status</span>
                    <span>Outcome</span>
                  </div>
                  <div className={styles.ledgerEmpty}>
                    No work has been recorded for this project yet.
                  </div>
                </section>
                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div>
                      <h2>Outcome pulse</h2>
                      <p>Agent outcomes over time.</p>
                    </div>
                  </div>
                  <div className={styles.panelEmpty}>
                    <span className={styles.emptyGlyph}>
                      <ChartBarIcon size={26} />
                    </span>
                    <strong>Not enough data yet.</strong>
                    <p>Outcome trends will appear after the first completed runs.</p>
                  </div>
                </section>
              </div>
            </>
          ) : section === 'playground' ? (
            <VisualFactory project={project} />
          ) : (
            <section className={styles.sectionState}>
              <p className={styles.eyebrow}>{project.name}</p>
              <h1>{nav.find((item) => item.slug === section)?.label || 'Project'}</h1>
              <p>
                This area belongs only to the active project. Its data and controls will appear as
                the corresponding service is built.
              </p>
              <Link href={`/projects/${project.id}/overview`}>
                Back to project overview <ArrowRightIcon size={16} />
              </Link>
            </section>
          )}
        </main>
      </div>
      <nav className={styles.mobileNav} aria-label="Project mobile navigation">
        <Link
          href={`/projects/${project.id}/overview`}
          aria-current={section === 'overview' ? 'page' : undefined}
        >
          <FolderIcon size={22} />
          Overview
        </Link>
        <Link
          href={`/projects/${project.id}/playground`}
          aria-current={section === 'playground' ? 'page' : undefined}
        >
          <GitBranchIcon size={22} />
          Playground
        </Link>
        <Link
          href={`/projects/${project.id}/agents`}
          aria-current={section === 'agents' ? 'page' : undefined}
        >
          <UsersThreeIcon size={22} />
          Agents
        </Link>
        <Link
          href={`/projects/${project.id}/work`}
          aria-current={section === 'work' ? 'page' : undefined}
        >
          <FileTextIcon size={22} />
          Work
        </Link>
        <Link href="/projects">
          <FolderIcon size={22} />
          Projects
        </Link>
      </nav>
    </div>
  );
}
