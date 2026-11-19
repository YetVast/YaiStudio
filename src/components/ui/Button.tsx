import React from 'react';
import Link from 'next/link';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export type ButtonProps = ButtonBaseProps &
  (
    | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ href: string; target?: string; rel?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
  );

export function getButtonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
} = {}) {
  return [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : undefined,
    loading ? styles.loading : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const combinedClass = getButtonClassName({
    variant,
    size,
    fullWidth,
    loading,
    className,
  });

  const content = (
    <>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </>
  );

  if ('href' in props && props.href) {
    const { href, target, rel, ...rest } = props;
    const isExternal =
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('/api/');

    if (isExternal) {
      return (
        <a
          href={href}
          target={target}
          rel={rel}
          className={combinedClass}
          aria-busy={loading ? 'true' : undefined}
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={href}
        target={target}
        rel={rel}
        className={combinedClass}
        aria-busy={loading ? 'true' : undefined}
        {...(rest as any)}
      >
        {content}
      </Link>
    );
  }

  const { disabled, type = 'button', ...buttonProps } = props as React.ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button
      type={type}
      className={combinedClass}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      {...buttonProps}
    >
      {content}
    </button>
  );
}
