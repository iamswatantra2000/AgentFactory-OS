'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FileTextIcon,
  FolderIcon,
  UsersThreeIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { SessionUser } from '@/server/landing-session';
import type { ProjectList, WorkspaceMember } from '@/server/projects';
import styles from './projects.module.css';

const steps = ['Details', 'Starting point', 'Members', 'Review'] as const;
const templates = [
  {
    key: 'customer-insights',
    name: 'Customer insights',
    description: 'Bring product and support signals into a clear brief.',
  },
  {
    key: 'campaign-operations',
    name: 'Campaign operations',
    description: 'Plan, produce, and review launch work.',
  },
] as const;
type MemberChoice = { userId: string; role: 'admin' | 'member' };

export function CreateProjectDialog({
  open,
  onClose,
  plan,
  user,
  members,
  initialTemplate,
}: {
  open: boolean;
  onClose: () => void;
  plan: ProjectList['plan'] | null;
  user: SessionUser;
  members: WorkspaceMember[];
  initialTemplate?: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState('');
  const [ownerId, setOwnerId] = useState(user.id);
  const [teamName, setTeamName] = useState('Core team');
  const [startingPoint, setStartingPoint] = useState<'blank' | 'template'>(
    initialTemplate ? 'template' : 'blank',
  );
  const [templateKey, setTemplateKey] = useState(initialTemplate || 'customer-insights');
  const [selected, setSelected] = useState<MemberChoice[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  useEffect(() => {
    if (initialTemplate) {
      setStartingPoint('template');
      setTemplateKey(initialTemplate);
    }
  }, [initialTemplate]);
  const atLimit = plan ? plan.projectCount >= plan.projectLimit : false;
  function next() {
    setError('');
    if (step === 0 && (name.trim().length < 2 || outcome.trim().length < 10 || !teamName.trim())) {
      setError('Add a project name, team, and a clear outcome of at least 10 characters.');
      return;
    }
    setStep(Math.min(3, step + 1));
  }
  function toggleMember(userId: string) {
    setSelected((current) =>
      current.some((member) => member.userId === userId)
        ? current.filter((member) => member.userId !== userId)
        : [...current, { userId, role: 'member' }],
    );
  }
  async function create() {
    if (pending || atLimit) return;
    setPending(true);
    setError('');
    let navigating = false;
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          outcome: outcome.trim(),
          ownerId,
          teamName: teamName.trim(),
          startingPoint,
          templateKey: startingPoint === 'template' ? templateKey : undefined,
          members: selected,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          typeof payload === 'object' &&
            payload &&
            'title' in payload &&
            typeof payload.title === 'string'
            ? payload.title
            : 'Could not create project.',
        );
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('id' in payload) ||
        typeof payload.id !== 'string'
      )
        throw new Error('Invalid project response.');
      navigating = true;
      router.push(`/projects/${payload.id}/setup`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create project.');
    } finally {
      if (!navigating) setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={styles.createDialog}
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      aria-labelledby="create-project-title"
    >
      <div className={styles.dialogHeader}>
        <div>
          <p className={styles.eyebrow}>New project</p>
          <h2 id="create-project-title">Create a fresh project</h2>
          <p>Give your agents a clear workspace, goal, and team.</p>
        </div>
        <div className={styles.dialogHeaderAside}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close project creation"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            <XIcon size={22} />
          </button>
          {plan && (
            <span className={styles.dialogCapacity}>
              <span>
                <FolderIcon size={20} />
              </span>
              <span>
                <small>Projects</small>
                <strong>
                  {plan.projectCount} of {plan.projectLimit}
                </strong>
              </span>
            </span>
          )}
        </div>
      </div>
      <ol className={styles.stepper} aria-label="Create project steps">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={step === index ? styles.stepActive : index < step ? styles.stepDone : ''}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className={styles.dialogBody}>
        {error && (
          <p className={styles.dialogError} role="alert">
            {error}
          </p>
        )}
        {step === 0 && (
          <div className={styles.formStack}>
            <div className={styles.stepIntro}>
              <h3>What will this project accomplish?</h3>
              <p>Start with the outcome. You can refine it as the work takes shape.</p>
            </div>
            <label>
              Project name
              <input
                autoFocus
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Customer intelligence"
              />
            </label>
            <label>
              Outcome
              <textarea
                value={outcome}
                maxLength={1000}
                onChange={(event) => setOutcome(event.target.value)}
                placeholder="Describe the result your team wants to produce."
                rows={4}
              />
            </label>
            <label>
              Workspace team
              <input
                value={teamName}
                maxLength={120}
                onChange={(event) => setTeamName(event.target.value)}
              />
            </label>
            <label>
              Project owner
              <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                {members.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name || person.email}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.noteBox}>
              <UsersThreeIcon size={20} />
              <span>
                <strong>
                  {ownerId === user.id
                    ? 'You will own this project.'
                    : 'The selected teammate will own this project.'}
                </strong>
                <small>
                  {ownerId === user.id
                    ? 'You remain responsible for approvals and access.'
                    : 'You will retain Admin access to finish setup.'}
                </small>
              </span>
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <div className={styles.stepIntro}>
              <h3>Choose a starting point</h3>
              <p>
                A blank project gives you full control; a template offers a thoughtful first
                structure.
              </p>
            </div>
            <div className={styles.choiceGrid}>
              <button
                type="button"
                aria-pressed={startingPoint === 'blank'}
                onClick={() => setStartingPoint('blank')}
              >
                <FolderIcon size={28} />
                <strong>Blank project</strong>
                <span>Design your own project from the ground up.</span>
              </button>
              {templates.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  aria-pressed={startingPoint === 'template' && templateKey === template.key}
                  onClick={() => {
                    setStartingPoint('template');
                    setTemplateKey(template.key);
                  }}
                >
                  <FileTextIcon size={28} />
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div className={styles.stepIntro}>
              <h3>Bring your people in</h3>
              <p>
                Choose existing workspace members and decide who can manage this project. You can
                update roles later.
              </p>
            </div>
            <div className={styles.memberList}>
              <div className={styles.ownerRow}>
                <span className={styles.miniAvatar}>
                  {(
                    members.find((person) => person.id === ownerId)?.name ||
                    members.find((person) => person.id === ownerId)?.email ||
                    user.name ||
                    user.email
                  )
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <span>
                  <strong>
                    {members.find((person) => person.id === ownerId)?.name ||
                      members.find((person) => person.id === ownerId)?.email ||
                      user.name ||
                      user.email}
                  </strong>
                  <small>Project owner</small>
                </span>
                <span>Owner</span>
              </div>
              {ownerId !== user.id && (
                <div className={styles.ownerRow}>
                  <span className={styles.miniAvatar}>
                    {(user.name || user.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{user.name || user.email}</strong>
                    <small>Project creator</small>
                  </span>
                  <span>Admin</span>
                </div>
              )}
              {members
                .filter((person) => person.id !== user.id && person.id !== ownerId)
                .map((person) => {
                  const choice = selected.find((item) => item.userId === person.id);
                  return (
                    <div key={person.id} className={styles.memberRow}>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(choice)}
                          onChange={() => toggleMember(person.id)}
                        />
                        <span className={styles.miniAvatar}>
                          {(person.name || person.email).slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{person.name || person.email}</strong>
                          <small>{person.email}</small>
                        </span>
                      </label>
                      <select
                        aria-label={`Role for ${person.name || person.email}`}
                        disabled={!choice}
                        value={choice?.role || 'member'}
                        onChange={(event) =>
                          setSelected((current) =>
                            current.map((item) =>
                              item.userId === person.id
                                ? { ...item, role: event.target.value as 'admin' | 'member' }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  );
                })}
            </div>
            {members.length <= 1 && (
              <p className={styles.helperText}>
                You’re the only workspace member right now. Continue as owner; teammate invitations
                will be available when workspace membership is enabled.
              </p>
            )}
          </div>
        )}
        {step === 3 && (
          <div>
            <div className={styles.stepIntro}>
              <h3>Review your project</h3>
              <p>
                We’ll prepare a project shell first. You’ll finish setup before opening the
                overview.
              </p>
            </div>
            <dl className={styles.reviewList}>
              <div>
                <dt>Project</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>{outcome}</dd>
              </div>
              <div>
                <dt>Team</dt>
                <dd>{teamName}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>
                  {members.find((person) => person.id === ownerId)?.name ||
                    members.find((person) => person.id === ownerId)?.email ||
                    user.name ||
                    user.email}
                </dd>
              </div>
              <div>
                <dt>Starting point</dt>
                <dd>
                  {startingPoint === 'blank'
                    ? 'Blank project'
                    : templates.find((template) => template.key === templateKey)?.name}
                </dd>
              </div>
              <div>
                <dt>Members</dt>
                <dd>
                  {selected.filter((person) => person.userId !== ownerId).length +
                    1 +
                    (ownerId === user.id ? 0 : 1)}{' '}
                  including owner and creator
                </dd>
              </div>
              <div>
                <dt>Plan usage</dt>
                <dd>
                  {plan
                    ? `${plan.projectCount + 1} of ${plan.projectLimit} projects after creation`
                    : 'Checking plan'}
                </dd>
              </div>
            </dl>
            {atLimit && (
              <div className={styles.limitBanner}>
                <strong>Project limit reached.</strong> Your entered details stay here. Manage your
                plan before creating another project.
              </div>
            )}
          </div>
        )}
      </div>
      <div className={styles.dialogFooter}>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => dialog.current?.close()}
          disabled={pending}
        >
          Cancel
        </button>
        <div>
          {step > 0 && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setStep(step - 1)}
              disabled={pending}
            >
              <ArrowLeftIcon size={17} /> Back
            </button>
          )}
          {step < 3 ? (
            <button type="button" className={styles.primaryButton} onClick={next}>
              Continue <ArrowRightIcon size={17} />
            </button>
          ) : atLimit ? (
            <a className={styles.primaryButton} href="/plan">
              Upgrade plan <ArrowRightIcon size={17} />
            </a>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              disabled={pending || !plan}
              onClick={create}
            >
              {pending ? 'Preparing project…' : 'Create project'} <ArrowRightIcon size={17} />
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
