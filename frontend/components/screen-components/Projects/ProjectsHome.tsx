'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArchiveIcon,
  ArrowRightIcon,
  ChartBarIcon,
  ClockIcon,
  DotsThreeVerticalIcon,
  FolderIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlusIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import type { SessionUser } from '@/server/landing-session';
import type { Project, ProjectList, WorkspaceMember } from '@/server/projects';
import { WorkspaceShell } from './WorkspaceShell';
import { CreateProjectDialog } from './CreateProjectDialog';
import styles from './projects.module.css';

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}
function when(value: string | null, renderedAt: string) {
  if (!value) return 'Not opened yet';
  const elapsed = Math.max(0, Date.parse(renderedAt) - Date.parse(value));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (hours < 48) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}
function title(result: unknown, fallback: string) {
  return typeof result === 'object' &&
    result !== null &&
    'title' in result &&
    typeof result.title === 'string'
    ? result.title
    : fallback;
}

export function ProjectsHome({
  user,
  data,
  members,
  renderedAt,
  initialTemplate,
  openCreate = false,
}: {
  user: SessionUser;
  data: ProjectList | null;
  members: WorkspaceMember[];
  renderedAt: string;
  initialTemplate?: string;
  openCreate?: boolean;
}) {
  const router = useRouter();
  const createRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'current' | 'archived' | 'all'>('current');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [creating, setCreating] = useState(openCreate || Boolean(initialTemplate));
  const [template, setTemplate] = useState<string | undefined>(
    initialTemplate && ['customer-insights', 'campaign-operations'].includes(initialTemplate)
      ? initialTemplate
      : undefined,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const projects = useMemo(() => {
    const rows = (data?.projects ?? []).filter(
      (project) =>
        (filter === 'all' ||
          (filter === 'archived'
            ? project.status === 'archived'
            : project.status !== 'archived')) &&
        `${project.name} ${project.outcome ?? ''}`.toLowerCase().includes(query.toLowerCase()),
    );
    return sort === 'name' ? [...rows].sort((a, b) => a.name.localeCompare(b.name)) : rows;
  }, [data, filter, query, sort]);
  const atLimit = data ? data.plan.projectCount >= data.plan.projectLimit : false;
  useEffect(() => {
    function onSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onSearchShortcut);
    return () => window.removeEventListener('keydown', onSearchShortcut);
  }, []);

  async function projectAction(
    project: Project,
    action: 'open' | 'active' | 'paused' | 'archived',
  ) {
    setBusyId(project.id);
    setError('');
    let navigating = false;
    try {
      const response = await fetch(
        `/api/projects/${project.id}/${action === 'open' ? 'open' : 'state'}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(action === 'open' ? {} : { status: action }),
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(title(payload, 'We could not update this project.'));
      if (action === 'open') {
        navigating = true;
        router.push(
          project.status === 'preparing'
            ? `/projects/${project.id}/setup`
            : `/projects/${project.id}/overview`,
        );
      } else router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Project unavailable.');
    } finally {
      if (!navigating) setBusyId(null);
    }
  }

  const search = (
    <label className={styles.searchBox}>
      <MagnifyingGlassIcon size={20} aria-hidden="true" />
      <span className={styles.srOnly}>Search projects</span>
      <input
        ref={searchRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search projects…"
      />
      <kbd>⌘ K</kbd>
    </label>
  );

  return (
    <WorkspaceShell user={user} active="/projects" search={search}>
      <main className={styles.pageContent}>
        <div className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Your workspace</p>
            <h1>Projects</h1>
            <p>Choose a project to continue, or create a clear space for a new goal.</p>
          </div>
          {data && data.projects.length > 0 && (
            <button
              ref={createRef}
              className={styles.primaryButton}
              type="button"
              disabled={atLimit}
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setTemplate(undefined);
                setCreating(true);
              }}
            >
              <PlusIcon size={19} /> Create project
            </button>
          )}
        </div>
        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
            <button type="button" onClick={() => setError('')}>
              Dismiss
            </button>
          </div>
        )}
        {!data ? (
          <div className={styles.emptyState} role="alert">
            <FolderIcon size={34} />
            <h2>Projects are temporarily unavailable.</h2>
            <p>Your account is safe. Try again when the project service is ready.</p>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => router.refresh()}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <section className={styles.usageStrip} aria-label="Plan usage">
              <div className={styles.planIdentity}>
                <span className={styles.usageIcon}>
                  <UsersThreeIcon size={25} />
                </span>
                <div>
                  <h2>{data.plan.name}</h2>
                  <p>Your workspace plan</p>
                  <a href="/plan">
                    Manage plan <ArrowRightIcon size={15} />
                  </a>
                </div>
              </div>
              <div className={styles.usageMeter}>
                <span className={styles.usageIcon}>
                  <FolderIcon size={24} />
                </span>
                <div>
                  <p>Projects</p>
                  <strong>
                    {data.plan.projectCount} of {data.plan.projectLimit}
                  </strong>
                  <progress value={data.plan.projectCount} max={data.plan.projectLimit} />
                  <small>
                    {Math.round((data.plan.projectCount / data.plan.projectLimit) * 100)}% used this
                    cycle
                  </small>
                </div>
              </div>
              <div className={styles.usageMeter}>
                <span className={styles.usageIcon}>
                  <UsersThreeIcon size={24} />
                </span>
                <div>
                  <p>Members</p>
                  <strong>{members.length}</strong>
                  <small>In this workspace</small>
                </div>
              </div>
              <div className={styles.planNote}>
                <span className={styles.usageIcon}>
                  <ChartBarIcon size={24} />
                </span>
                <div>
                  <p>Monthly runs</p>
                  <strong>—</strong>
                  <small>Available when workflows launch</small>
                </div>
              </div>
            </section>
            <details className={styles.mobileUsage}>
              <summary>
                <span>
                  <strong>{data.plan.name}</strong>
                  <small>
                    {data.plan.projectCount} of {data.plan.projectLimit} project slots used
                  </small>
                </span>
                <span>Usage</span>
              </summary>
              <div>
                <progress value={data.plan.projectCount} max={data.plan.projectLimit} />
                <p>
                  {Math.max(0, data.plan.projectLimit - data.plan.projectCount)} project slots
                  remaining
                </p>
                <a href="/plan">Manage plan</a>
              </div>
            </details>
            {atLimit && (
              <div className={styles.limitBanner} role="status">
                <strong>Project limit reached.</strong> Your {data.plan.name} includes{' '}
                {data.plan.projectLimit} projects. Existing projects remain accessible.{' '}
                <a href="/plan">
                  Manage plan <ArrowRightIcon size={15} />
                </a>
              </div>
            )}
            {data.projects.length === 0 ? (
              <section className={`${styles.emptyState} ${styles.firstProjectState}`}>
                <span className={styles.emptyIcon}>
                  <FolderIcon size={32} />
                </span>
                <p className={styles.eyebrow}>Your first project</p>
                <h2>A clear space for work that matters.</h2>
                <p>
                  Define an outcome, choose your team, and give every future agent a place to do
                  accountable work.
                </p>
                <button
                  ref={createRef}
                  type="button"
                  className={styles.primaryButton}
                  onClick={(event) => {
                    openerRef.current = event.currentTarget;
                    setCreating(true);
                  }}
                >
                  <PlusIcon size={18} /> Create project
                </button>
              </section>
            ) : (
              <>
                <div className={styles.sectionHeading}>
                  <h2>Your projects</h2>
                  <div className={styles.projectControls}>
                    <div className={styles.viewSwitch} aria-label="Project view">
                      <button
                        type="button"
                        aria-label="Grid view"
                        aria-pressed={view === 'grid'}
                        onClick={() => setView('grid')}
                      >
                        <SquaresFourIcon size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label="List view"
                        aria-pressed={view === 'list'}
                        onClick={() => setView('list')}
                      >
                        <ListIcon size={18} />
                      </button>
                    </div>
                    <select
                      aria-label="Sort projects"
                      value={sort}
                      onChange={(event) => setSort(event.target.value as typeof sort)}
                    >
                      <option value="recent">Last opened</option>
                      <option value="name">Name</option>
                    </select>
                    <select
                      aria-label="Filter projects"
                      value={filter}
                      onChange={(event) => setFilter(event.target.value as typeof filter)}
                    >
                      <option value="current">Current projects</option>
                      <option value="archived">Archived</option>
                      <option value="all">All projects</option>
                    </select>
                  </div>
                </div>
                {projects.length === 0 ? (
                  <div className={styles.emptyState}>
                    <FolderIcon size={30} />
                    <h3>No projects match these filters.</h3>
                    <p>Try another search or status.</p>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setFilter('current');
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div
                    className={`${styles.projectGrid} ${view === 'list' ? styles.projectList : ''}`}
                  >
                    {projects.map((project) => (
                      <article key={project.id} className={styles.projectCard}>
                        <div className={styles.cardTop}>
                          <span className={styles.projectIcon}>
                            <FolderIcon size={24} />
                          </span>
                          <span className={`${styles.state} ${styles[`state${project.status}`]}`}>
                            {project.status}
                          </span>
                          {['owner', 'admin'].includes(project.role) && (
                            <details className={styles.cardMenu}>
                              <summary aria-label={`Actions for ${project.name}`}>
                                <DotsThreeVerticalIcon size={21} />
                              </summary>
                              <div>
                                {project.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => projectAction(project, 'paused')}
                                  >
                                    <PauseIcon size={16} /> Pause
                                  </button>
                                )}
                                {project.status === 'paused' && (
                                  <button
                                    type="button"
                                    onClick={() => projectAction(project, 'active')}
                                  >
                                    Resume
                                  </button>
                                )}
                                {project.status === 'archived' ? (
                                  <button
                                    type="button"
                                    onClick={() => projectAction(project, 'active')}
                                  >
                                    Restore
                                  </button>
                                ) : (
                                  project.status !== 'preparing' && (
                                    <button
                                      type="button"
                                      onClick={() => projectAction(project, 'archived')}
                                    >
                                      <ArchiveIcon size={16} /> Archive
                                    </button>
                                  )
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                        <h3>{project.name}</h3>
                        <p className={styles.cardPurpose}>
                          {project.outcome || 'Define the outcome for this project.'}
                        </p>
                        <div className={styles.cardMembers}>
                          <div className={styles.avatarStack}>
                            {project.memberIds.slice(0, 4).map((id) => {
                              const person = members.find((member) => member.id === id);
                              return (
                                <span key={id} title={person?.name || person?.email || 'Member'}>
                                  {initials(person?.name || person?.email || 'M')}
                                </span>
                              );
                            })}
                          </div>
                          <span>
                            {project.role.charAt(0).toUpperCase() + project.role.slice(1)}
                          </span>
                        </div>
                        <div className={styles.cardMeta}>
                          <span>
                            <UsersThreeIcon size={17} /> 0 agents
                          </span>
                          <span>
                            <ClockIcon size={17} /> {when(project.lastOpenedAt, renderedAt)}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={busyId === project.id}
                          className={styles.cardAction}
                          onClick={() => projectAction(project, 'open')}
                        >
                          {project.status === 'preparing'
                            ? 'Continue setup'
                            : project.status === 'archived'
                              ? 'Open read-only'
                              : 'Open project'}{' '}
                          <ArrowRightIcon size={17} />
                        </button>
                      </article>
                    ))}
                    {filter !== 'archived' && !atLimit && (
                      <button
                        type="button"
                        className={styles.createTile}
                        onClick={(event) => {
                          openerRef.current = event.currentTarget;
                          setCreating(true);
                        }}
                      >
                        <span>
                          <PlusIcon size={29} />
                        </span>
                        <strong>Create a fresh project</strong>
                        <small>Start blank or use a template.</small>
                      </button>
                    )}
                  </div>
                )}
                <div className={styles.bottomCards}>
                  <section>
                    <h2>Recently opened</h2>
                    {data.projects.filter(
                      (project) => project.lastOpenedAt && project.status !== 'archived',
                    ).length ? (
                      <div className={styles.recentTable}>
                        <div className={styles.recentTableHead}>
                          <span>Project</span>
                          <span>Last visited page</span>
                          <span>Time</span>
                        </div>
                        {data.projects
                          .filter(
                            (project) => project.lastOpenedAt && project.status !== 'archived',
                          )
                          .slice(0, 4)
                          .map((project) => (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => projectAction(project, 'open')}
                            >
                              <span>
                                <FolderIcon size={17} /> {project.name}
                              </span>
                              <span>Project overview</span>
                              <span>{when(project.lastOpenedAt, renderedAt)}</span>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p>Projects you open will appear here for quick return.</p>
                    )}
                  </section>
                  <section>
                    <h2>Workspace members</h2>
                    <p>
                      {members.length} {members.length === 1 ? 'person' : 'people'} in this
                      workspace
                    </p>
                    <div className={styles.avatarStack}>
                      {members.slice(0, 6).map((person) => (
                        <span key={person.id} title={person.name || person.email}>
                          {initials(person.name || person.email)}
                        </span>
                      ))}
                    </div>
                    <a href="/members">
                      Manage members <ArrowRightIcon size={15} />
                    </a>
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <CreateProjectDialog
        open={creating}
        onClose={() => {
          setCreating(false);
          (openerRef.current ?? createRef.current)?.focus();
          openerRef.current = null;
        }}
        plan={data?.plan ?? null}
        user={user}
        members={members}
        initialTemplate={template}
      />
    </WorkspaceShell>
  );
}
