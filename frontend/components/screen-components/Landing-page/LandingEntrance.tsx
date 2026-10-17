import { BrandWordmark } from '@/components/design-system';
import styles from './entrance.module.css';

/** Decorative only: never delays rendering, navigation, or assistive technology. */
export function LandingEntrance() {
  return (
    <div className={styles.entrance} aria-hidden="true">
      <div className={styles.brand}>
        <BrandWordmark />
        <p>People. Context. Accountable work.</p>
        <span className={styles.line} />
      </div>
    </div>
  );
}
