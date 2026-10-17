import { TreeStructureIcon, ArrowsLeftRightIcon, ArrowRightIcon } from '@phosphor-icons/react/ssr';
import { BrandWordmark } from '@/components/design-system';
import Image from 'next/image';
import oliveBranch from '@/public/images/brand/component6.png';
import styles from './complete.module.css';

export function PurposeSection() {
  return (
    <section id="purpose" className={styles.purpose} aria-labelledby="purpose-heading">
      <div className={styles.intro} data-motion-reveal>
        <p className={styles.eyebrow}>Why AgentFactory OS</p>
        <h2 id="purpose-heading">
          Your idea deserves
          <br />
          more than a prompt.
        </h2>
        <p>
          Turn the company in your head into a system your team can understand. AgentFactory OS is a
          visual workspace for founders and small teams to design an AI-enabled company—one role,
          responsibility, and decision at a time.
        </p>
        <a href="#workflow">
          See how it comes together <ArrowRightIcon size={18} aria-hidden="true" />
        </a>
      </div>
      <div className={styles.purposeCards} data-motion-reveal data-motion-group>
        <article>
          <TreeStructureIcon size={28} weight="light" aria-hidden="true" />
          <span>01 / THE ORGANIZATION</span>
          <h3>Who owns what?</h3>
          <p>
            Define departments, specialist roles, reporting lines, and the people who hold final
            authority.
          </p>
        </article>
        <article>
          <ArrowsLeftRightIcon size={28} weight="light" aria-hidden="true" />
          <span>02 / THE WORK</span>
          <h3>How does it move?</h3>
          <p>
            Map inputs, handoffs, expected outputs, and approval checkpoints. Keep the work
            connected without blurring responsibility.
          </p>
        </article>
      </div>
    </section>
  );
}

export function CompleteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerSignature} data-motion-reveal>
        <p>
          Built for people.
          <br />
          <span>Designed for possibility.</span>
        </p>
        <Image
          src={oliveBranch}
          alt=""
          aria-hidden="true"
          sizes="(max-width: 767px) 180px, 360px"
        />
      </div>
      <div className={styles.footerGrid}>
        <div className={styles.footerBrand}>
          <a href="#overview" aria-label="AgentFactory OS home">
            <BrandWordmark />
          </a>
          <p>
            A more capable company.
            <br />A clearer place for human judgment.
          </p>
          <span>People. Context. Accountable work.</span>
        </div>
        <nav aria-label="Footer product navigation">
          <h2>Explore</h2>
          <a href="#purpose">Our purpose</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#workflow">How it works</a>
          <a href="#pricing">Plans & pricing</a>
        </nav>
        <nav aria-label="Footer resources">
          <h2>Stay informed</h2>
          <a href="#governance">Human oversight</a>
          <a href="#newsletter">Product newsletter</a>
          <a href="#pricing-note">Preview availability</a>
        </nav>
        <div className={styles.footerNote}>
          <h2>Built with intention.</h2>
          <p>
            We’re building the foundation first: clear roles, thoughtful workflows, and accountable
            decisions.
          </p>
          <a href="#newsletter">
            Follow the journey <ArrowRightIcon size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>© {new Date().getFullYear()} AgentFactory OS</p>
        <p>Product preview · No live agent execution</p>
        <a href="#overview">Back to top ↑</a>
      </div>
    </footer>
  );
}
