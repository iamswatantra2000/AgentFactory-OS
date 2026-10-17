'use client';
import { useRef, useState } from 'react';
import { ListIcon, XIcon } from '@phosphor-icons/react';
import { BrandWordmark } from '@/components/design-system';
import { AccessAction } from './AccessAction';
import styles from './landing.module.css';
const links = [
  ['Overview', '#overview'],
  ['Capabilities', '#capabilities'],
  ['Governance', '#governance'],
  ['Pricing', '#pricing'],
] as const;
export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <header
      className={styles.header}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className={styles.headerInner}>
        <a href="#overview" className={styles.logo} aria-label="AgentFactory OS home">
          <BrandWordmark />
        </a>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {links.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <AccessAction signIn />
          <AccessAction />
        </div>
        <button
          ref={toggle}
          type="button"
          className={styles.menuButton}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="landing-mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <XIcon size={24} /> : <ListIcon size={24} />}
        </button>
      </div>
      <nav
        id="landing-mobile-navigation"
        className={styles.mobileNav}
        hidden={!open}
        aria-label="Mobile navigation"
      >
        {links.map(([label, href]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
        <div>
          <AccessAction signIn />
          <AccessAction arrow />
        </div>
      </nav>
    </header>
  );
}
