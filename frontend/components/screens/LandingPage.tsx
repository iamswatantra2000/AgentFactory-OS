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

export default function LandingPage({
  showEntrance = false,
  authenticated = false,
}: {
  showEntrance?: boolean;
  authenticated?: boolean;
}) {
  return (
    <LandingMotion className={styles.page}>
      {showEntrance && <LandingEntrance />}
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <LandingHeader authenticated={authenticated} />
      <main id="main-content" tabIndex={-1}>
        <LandingHero authenticated={authenticated} />
        <Principles />
        <PurposeSection />
        <WorkflowSection />
        <GovernanceSection />
        <PricingSection authenticated={authenticated} />
        <NewsletterSection />
      </main>
      <CompleteFooter />
    </LandingMotion>
  );
}
