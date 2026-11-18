import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <div className={styles.title}>{title}</div>
        {description && (
          <div className={styles.description}>{description}</div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return (
    <div className={[styles.body, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <div className={[styles.footer, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export default function Card({ children, className }: CardProps) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
