import Image from 'next/image';
import {
  UsersIcon,
  FileTextIcon,
  ShieldIcon,
  MagnifyingGlassIcon,
  SlidersHorizontalIcon,
  TreeStructureIcon,
  UserCircleIcon,
  ArrowRightIcon,
} from '@phosphor-icons/react/ssr';
import { BrandWordmark } from '@/components/design-system';
import styles from './landing.module.css';
const principles = [
  {
    Icon: UsersIcon,
    title: 'Defined roles',
    copy: 'A clear purpose, responsibility, and scope for every role.',
    tone: 'sage',
  },
  {
    Icon: FileTextIcon,
    title: 'Shared context',
    copy: 'Map the knowledge, inputs, and handoffs your work needs.',
    tone: 'sand',
  },
  {
    Icon: ShieldIcon,
    title: 'Human decisions',
    copy: 'Make approval boundaries visible. Keep authority with your team.',
    tone: 'clay',
  },
];
export function Principles() {
  return (
    <section
      id="capabilities"
      className={styles.principles}
      aria-label="The foundations of accountable work"
    >
      <div className={styles.principlesInner}>
        {principles.map(({ Icon, title, copy, tone }) => (
          <article key={title} className={styles.principle}>
            <span className={`${styles.principleIcon} ${styles[tone]}`}>
              <Icon size={28} weight="light" aria-hidden="true" />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
const stages = [
  {
    Icon: MagnifyingGlassIcon,
    title: 'Define',
    copy: 'Start with the outcome your company exists to deliver.',
    tone: 'sage',
  },
  {
    Icon: SlidersHorizontalIcon,
    title: 'Configure',
    copy: 'Give each role a purpose, context, and decision boundary.',
    tone: 'sand',
  },
  {
    Icon: TreeStructureIcon,
    title: 'Connect',
    copy: 'Map who owns the work and how it moves between roles.',
    tone: 'sage',
  },
  {
    Icon: UserCircleIcon,
    title: 'Review',
    copy: 'Set the checkpoints where human judgment comes first.',
    tone: 'clay',
  },
];
export function WorkflowSection() {
  return (
    <section id="workflow" className={styles.workflow} aria-labelledby="workflow-heading">
      <div className={styles.sectionInner}>
        <p className={styles.eyebrow}>From an idea to a working structure</p>
        <h2 id="workflow-heading">
          A reliable path
          <br />
          from request to result.
        </h2>
        <p className={styles.sectionDescription}>
          A company is more than a collection of agents. Design the roles, responsibilities, and
          flow of work together—before you automate.
        </p>
        <ol className={styles.stages}>
          {stages.map(({ Icon, title, copy, tone }, index) => (
            <li key={title}>
              <span className={`${styles.stageIcon} ${styles[tone]}`}>
                <Icon size={34} weight="light" aria-hidden="true" />
              </span>
              {index < 3 && (
                <ArrowRightIcon
                  className={styles.stageArrow}
                  size={64}
                  weight="thin"
                  aria-hidden="true"
                />
              )}
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </div>
      <Image
        className={styles.workflowArt}
        src="/images/brand/component2.png"
        width={2103}
        height={748}
        sizes="100vw"
        alt=""
        aria-hidden="true"
      />
    </section>
  );
}
export function GovernanceSection() {
  return (
    <section id="governance" className={styles.governance} aria-labelledby="governance-heading">
      <div className={styles.governanceCopy}>
        <p className={styles.eyebrow}>Clarity before autonomy</p>
        <h2 id="governance-heading">
          A role is a responsibility.
          <br />
          Not a blank cheque.
        </h2>
        <p>
          Keep the organization chart distinct from the workflow. One shows who is accountable; the
          other shows how a specific job moves from input to output.
        </p>
        <p className={styles.productNote}>
          This is a product preview. Live agent execution, connected tools, and automated approvals
          are not available in this release.
        </p>
      </div>
      <aside className={styles.planCard} aria-labelledby="authority-heading">
        <p className={styles.eyebrow}>Built around your judgment</p>
        <h2 id="authority-heading">
          Clear boundaries.
          <br />
          Accountable decisions.
        </h2>
        <p>
          Define what a role owns, which information it needs, and when a decision belongs to a
          person. Make the handoff explicit before work begins.
        </p>
        <a href="#pricing" className={styles.secondaryAction}>
          Explore plans <ArrowRightIcon size={16} aria-hidden="true" />
        </a>
        <small>Human oversight is part of the structure—not an afterthought.</small>
      </aside>
    </section>
  );
}
export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <a href="#overview" aria-label="AgentFactory OS home">
        <BrandWordmark />
      </a>
      <p>People. Context. Accountable work.</p>
      <a href="#workflow">
        Explore the approach <ArrowRightIcon size={16} aria-hidden="true" />
      </a>
    </footer>
  );
}
