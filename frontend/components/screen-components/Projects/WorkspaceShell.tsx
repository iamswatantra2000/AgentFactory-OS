'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BellIcon,
  CaretDownIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderIcon,
  GearSixIcon,
  QuestionIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { BrandWordmark } from '@/components/design-system';
import type { SessionUser } from '@/server/landing-session';
import styles from './projects.module.css';

const accountItems = [
  { href: '/projects', label: 'Projects', Icon: FolderIcon },
  { href: '/templates', label: 'Templates', Icon: FileTextIcon },
  { href: '/members', label: 'Members', Icon: UsersThreeIcon },
  { href: '/plan', label: 'Plan & billing', Icon: CreditCardIcon },
  { href: '/settings', label: 'Settings', Icon: GearSixIcon },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export function WorkspaceShell({
  user,
  active,
  search,
  children,
}: {
  user: SessionUser;
  active: string;
  search?: ReactNode;
  children: ReactNode;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const name = user.name || user.email;
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.wordmark} href="/welcome" aria-label="AgentFactory OS home">
          <BrandWordmark />
        </Link>
        <div className={styles.workspaceSelect}>
          <span className={styles.workspaceMonogram}>{initials(name)}</span>
          <span>
            <strong>My workspace</strong>
            <small>Development plan</small>
          </span>
        </div>
        <nav className={styles.sideNav} aria-label="Account navigation">
          {accountItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active === href ? 'page' : undefined}
              className={active === href ? styles.navActive : ''}
            >
              <Icon size={21} aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>
        <details className={styles.sidebarBottom}>
          <summary>
            <span className={styles.userAvatar}>{initials(name)}</span>
            <span>
              <strong>{name}</strong>
              <small>Workspace owner</small>
            </span>
            <CaretDownIcon size={15} aria-hidden="true" />
          </summary>
          <div className={styles.profileActions}>
            <Link href="/settings" aria-label="Account settings">
              Account settings
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" aria-label="Sign out of AgentFactory OS">
                Sign out
              </button>
            </form>
          </div>
        </details>
      </aside>
      <div className={styles.contentColumn}>
        <header className={styles.topbar}>
          {search ?? (
            <span className={styles.topbarContext}>A clear place for your team’s work.</span>
          )}
          <div className={styles.topbarActions}>
            <div className={styles.notificationWrap}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <BellIcon size={22} />
              </button>
              {notificationsOpen && (
                <div className={styles.popover} role="status">
                  <strong>You’re all caught up.</strong>
                  <p>Project updates will appear here.</p>
                </div>
              )}
            </div>
            <Link className={styles.iconButton} href="/settings" aria-label="Help and settings">
              <QuestionIcon size={22} />
            </Link>
            <span className={styles.topAvatar} title={name}>
              {initials(name)}
            </span>
          </div>
        </header>
        <div className={styles.contentSurface}>
          <Image
            src="/images/brand/component1.png"
            alt=""
            aria-hidden="true"
            className={styles.cornerArt}
            width={2172}
            height={724}
            sizes="360px"
          />
          {children}
        </div>
      </div>
      <nav className={styles.mobileNav} aria-label="Account mobile navigation">
        {accountItems
          .filter((item) =>
            ['/projects', '/templates', '/members', '/settings'].includes(item.href),
          )
          .map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={active === href ? 'page' : undefined}>
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
      </nav>
    </div>
  );
}
