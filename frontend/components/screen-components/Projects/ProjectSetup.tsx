'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon, FileTextIcon, FolderIcon } from '@phosphor-icons/react';
import type { Project } from '@/server/projects';
import styles from './overview.module.css';

export function ProjectSetup({ project }: { project: Project }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function complete() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${project.id}/complete-setup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        const payload: unknown = await response.json();
        throw new Error(
          typeof payload === 'object' &&
            payload &&
            'title' in payload &&
            typeof payload.title === 'string'
            ? payload.title
            : 'Could not complete setup.',
        );
      }
      router.replace(`/projects/${project.id}/overview`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete setup.');
      setPending(false);
    }
  }
  return (
    <main className={styles.setupPage}>
      <div className={styles.setupHeader}>
        <Link href="/projects">
          <ArrowLeftIcon size={18} /> All projects
        </Link>
        <span>AgentFactory OS</span>
      </div>
      <section className={styles.setupCard}>
        <span className={styles.setupIcon}>
          {project.startingPoint === 'blank' ? (
            <FolderIcon size={30} />
          ) : (
            <FileTextIcon size={30} />
          )}
        </span>
        <p className={styles.eyebrow}>Project preparing</p>
        <h1>
          {project.startingPoint === 'blank' ? 'Set your foundation.' : 'Configure your template.'}
        </h1>
        <p className={styles.setupLead}>
          Your project is saved. Confirm this starting point to create its usable shell and open the
          project overview.
        </p>
        <dl>
          <div>
            <dt>Project</dt>
            <dd>{project.name}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>{project.outcome}</dd>
          </div>
          <div>
            <dt>Team</dt>
            <dd>{project.teamName}</dd>
          </div>
          <div>
            <dt>Starting point</dt>
            <dd>
              {project.startingPoint === 'blank'
                ? 'Blank project'
                : project.templateKey?.replace('-', ' ')}
            </dd>
          </div>
        </dl>
        <div className={styles.setupNote}>
          {project.startingPoint === 'blank'
            ? 'You’ll begin with an empty, project-scoped workspace. No agents or runs are created automatically.'
            : 'The template prepares a structure only. Nothing will run or publish until your team configures it.'}
        </div>
        {error && (
          <p className={styles.setupError} role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={pending || !['owner', 'admin'].includes(project.role)}
          onClick={complete}
        >
          {pending ? 'Preparing…' : 'Finish setup and open project'} <ArrowRightIcon size={18} />
        </button>
      </section>
    </main>
  );
}
