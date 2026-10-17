'use client';
import { useEffect, useRef, useState } from 'react';
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
  const openedByHover = useRef(false);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 960px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [open]);
  return (
    <header
      ref={header}
      className={styles.header}
      onPointerLeave={(event) => {
        openedByHover.current = false;
        if (event.pointerType === 'mouse' && !header.current?.contains(document.activeElement))
          setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
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
          onClick={(event) => {
            if (event.detail > 0 && openedByHover.current) {
              openedByHover.current = false;
              setOpen(true);
            } else setOpen(!open);
          }}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse' && window.matchMedia('(hover: hover)').matches)
              openedByHover.current = !open;
            setOpen(true);
          }}
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
