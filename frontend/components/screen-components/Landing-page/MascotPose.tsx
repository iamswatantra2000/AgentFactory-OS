import Image from 'next/image';
import styles from './mascot-pose.module.css';

type MascotPoseName = 'peek' | 'dance';

/** Decorative stills from the supplied robot pose sheets; never presented as a live assistant. */
export function MascotPose({ pose }: { pose: MascotPoseName }) {
  if (pose === 'peek') {
    return (
      <span className={`${styles.frame} ${styles[pose]}`}>
        <Image
          className={styles.gridSheet}
          src="/images/brand/robo-sprites.png"
          alt=""
          width={1448}
          height={1086}
          sizes="(max-width: 767px) 360px, 560px"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span className={`${styles.frame} ${styles.strip} ${styles[pose]}`}>
      <Image
        className={styles.stripSheet}
        src="/images/brand/robo-poses.png"
        alt=""
        width={2172}
        height={724}
        sizes="980px"
        loading="lazy"
      />
    </span>
  );
}
