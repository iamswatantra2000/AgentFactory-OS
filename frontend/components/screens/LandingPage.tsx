import { LandingHeader } from '../screen-components/Landing-page/LandingHeader';
import { LandingEntrance } from '../screen-components/Landing-page/LandingEntrance';
import { LandingMotion } from '../screen-components/Landing-page/LandingMotion';
import { LandingHero } from '../screen-components/Landing-page/LandingHero';
import {
  Principles,
  WorkflowSection,
  GovernanceSection,
} from '../screen-components/Landing-page/LandingSections';
import styles from '../screen-components/Landing-page/landing.module.css';
import { PurposeSection, CompleteFooter } from '../screen-components/Landing-page/ProductSections';
import {
  PricingSection,
  NewsletterSection,
} from '../screen-components/Landing-page/ConversionSections';

export default function LandingPage() {
  return (
    <LandingMotion className={styles.page}>
      <LandingEntrance />
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <LandingHero />
        <Principles />
        <PurposeSection />
        <WorkflowSection />
        <GovernanceSection />
        <PricingSection />
        <NewsletterSection />
      </main>
      <CompleteFooter />
    </LandingMotion>
  );
}
