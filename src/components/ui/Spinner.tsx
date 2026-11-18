import styles from './Spinner.module.css';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  centered?: boolean;
}

export default function Spinner({
  size = 'md',
  label = 'Loading…',
  centered = false,
}: SpinnerProps) {
  const spinner = (
    <span
      className={[styles.spinner, styles[size]].join(' ')}
      role="status"
      aria-label={label}
    />
  );

  if (centered) {
    return <div className={styles.wrapper}>{spinner}</div>;
  }

  return spinner;
}
