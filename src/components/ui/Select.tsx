import React from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: React.ReactNode;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, children, className, ...props }, ref) => {
    const selectId = id ?? `select-${Math.random().toString(36).slice(2, 8)}`;

    return (
      <div className={styles.field}>
        {label && (
          <label htmlFor={selectId} className={styles.label}>
            {label}
          </label>
        )}
        <div className={styles.wrapper}>
          <select
            ref={ref}
            id={selectId}
            className={[styles.select, className].filter(Boolean).join(' ')}
            {...props}
          >
            {children}
          </select>
          <span className={styles.chevron} aria-hidden="true">
            <ChevronDown size={14} />
          </span>
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
