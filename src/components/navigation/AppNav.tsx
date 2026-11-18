'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  MessageSquare,
  Folder,
  Brain,
  BookOpen,
  Activity,
  Plug,
  Cpu,
  Settings,
} from 'lucide-react';
import styles from './AppNav.module.css';

const PRIMARY_NAV = [
  { href: '/',               label: 'Overview',            icon: Home },
  { href: '/conversations',  label: 'Conversations',       icon: MessageSquare },
  { href: '/workspaces',     label: 'Workspaces',          icon: Folder },
  { href: '/memory',         label: 'Personal Memory',     icon: Brain },
  { href: '/knowledge',      label: 'Knowledge',           icon: BookOpen },
  { href: '/activity',       label: 'Intelligence Activity',icon: Activity },
];

const SYSTEM_NAV = [
  { href: '/apps',           label: 'Connected Apps',      icon: Plug },
  { href: '/providers',      label: 'AI Providers',        icon: Cpu },
  { href: '/settings',       label: 'Settings',            icon: Settings },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${styles.navItem}${active ? ` ${styles.active}` : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className={styles.navIcon} aria-hidden="true">
        <Icon size={15} strokeWidth={active ? 2.5 : 1.75} />
      </span>
      <span className={styles.navLabel}>{label}</span>
    </Link>
  );
}

export default function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <div className={styles.section}>
        {PRIMARY_NAV.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={isActive(item.href)}
          />
        ))}
      </div>

      <div className={styles.spacer} />

      <div className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.sectionLabel}>System</span>
        {SYSTEM_NAV.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={isActive(item.href)}
          />
        ))}
      </div>
    </nav>
  );
}
