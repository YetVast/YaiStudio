import React from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'muted';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  variant = 'default',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={[styles.badge, styles[variant], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
