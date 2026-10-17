import Image from 'next/image';
import { AccessAction } from './AccessAction';
import { WorkflowPreview } from './WorkflowPreview';
import styles from './landing.module.css';
export function LandingHero() {
  return (
    <section id="overview" className={styles.hero} aria-labelledby="landing-title">
      <Image
        className={styles.heroArt}
        src="/images/brand/component5.png"
        loading="eager"
        width={1774}
        height={887}
        sizes="(max-width: 767px) 600px, 1000px"
        alt=""
        aria-hidden="true"
      />
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Your company, clearly accountable</p>
          <h1 id="landing-title">
            Design the work.
            <br />
            Keep the judgment.
          </h1>
          <p className={styles.heroDescription}>
            Give your AI-enabled company a clear structure. Define each role, connect the work, and
            decide where your team stays in control.
          </p>
          <div className={styles.heroActions}>
            <AccessAction arrow />
            <a className={styles.secondaryAction} href="#workflow">
              Explore the workflow
            </a>
          </div>
          <p className={styles.heroNote}>A considered foundation for founders and small teams.</p>
        </div>
        <WorkflowPreview />
      </div>
    </section>
  );
}
