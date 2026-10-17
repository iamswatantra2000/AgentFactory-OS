'use client';

import { useId, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react';
import {
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  CaretDownIcon,
  WarningCircleIcon,
  LockKeyIcon,
  XIcon,
  InfoIcon,
  CheckCircleIcon,
  WarningIcon,
} from '@phosphor-icons/react';

export type ButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'destructive' | 'destructive-outline';
export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  loading = false,
  loadingLabel = 'Working…',
  className = '',
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`af-button af-button--${variant} af-button--${size} ${loading ? 'af-button--loading' : ''} ${className}`}
    >
      <span className="ds-button-content" style={{ visibility: loading ? 'hidden' : undefined }}>
        {children}
      </span>
      {loading && (
        <span className="ds-button-loading">
          <span className="af-spinner" aria-hidden="true" />
          {loadingLabel}
        </span>
      )}
    </button>
  );
}

type FieldProps = { label: string; helperText?: string; error?: string };
export function TextField({
  label,
  helperText,
  error,
  id,
  className = '',
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return (
    <div className="af-field">
      <label className="af-field__label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="af-field__control-wrap">
        <input
          {...props}
          id={fieldId}
          type={password && visible ? 'text' : type}
          aria-invalid={!!error}
          aria-describedby={error || helperText ? `${fieldId}-help` : undefined}
          className={`af-field__control ${password ? 'af-field__control--with-action' : ''} ${className}`}
        />
        {password && (
          <button
            disabled={props.disabled}
            type="button"
            className="af-field__action"
            aria-label={visible ? 'Hide password' : 'Show password'}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        )}
      </div>
      {(error || helperText) && (
        <span
          id={`${fieldId}-help`}
          className={`af-field__message ${error ? 'af-field__message--error' : ''}`}
        >
          {error && <WarningCircleIcon size={14} aria-hidden="true" />}
          {error ?? helperText}
        </span>
      )}
    </div>
  );
}
export function SelectField({
  label,
  helperText,
  error,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="af-field">
      <label className="af-field__label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="af-field__control-wrap">
        <select
          {...props}
          id={fieldId}
          className="af-field__control af-select"
          aria-invalid={!!error}
          aria-describedby={error || helperText ? `${fieldId}-help` : undefined}
        >
          {children}
        </select>
        <CaretDownIcon className="af-select-icon" size={16} aria-hidden="true" />
      </div>
      {(error || helperText) && (
        <span
          id={`${fieldId}-help`}
          className={`af-field__message ${error ? 'af-field__message--error' : ''}`}
        >
          {error ?? helperText}
        </span>
      )}
    </div>
  );
}
type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };
function Choice({ label, type, ...props }: ChoiceProps & { type: 'checkbox' | 'radio' }) {
  return (
    <label className="af-choice">
      <input {...props} type={type} className="af-choice__input" />
      <span className={`af-choice__mark af-choice__mark--${type}`} aria-hidden="true">
        {type === 'checkbox' && <CheckIcon size={14} weight="bold" />}
      </span>
      <span>{label}</span>
    </label>
  );
}
export function Checkbox(props: ChoiceProps) {
  return <Choice {...props} type="checkbox" />;
}
export function Radio(props: ChoiceProps) {
  return <Choice {...props} type="radio" />;
}
export function Toggle({ label, ...props }: ChoiceProps) {
  return (
    <label className="af-toggle">
      <input {...props} type="checkbox" role="switch" className="af-toggle__input" />
      <span className="af-toggle__track" aria-hidden="true">
        <span className="af-toggle__thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}
export type StatusTone =
  'active' | 'completed' | 'progress' | 'review' | 'needs-review' | 'failed' | 'paused' | 'locked';
export function StatusChip({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={`af-status-chip af-status-chip--${tone}`}>
      {tone === 'locked' ? (
        <LockKeyIcon size={14} aria-hidden="true" />
      ) : (
        <span className="af-status-chip__dot" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
export function FeedbackBanner({
  tone,
  title,
  children,
  onDismiss,
}: {
  tone: 'success' | 'warning' | 'error' | 'info';
  title: string;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const Icon =
    tone === 'success'
      ? CheckCircleIcon
      : tone === 'info'
        ? InfoIcon
        : tone === 'warning'
          ? WarningIcon
          : WarningCircleIcon;
  return (
    <div
      className={`af-feedback af-feedback--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon size={24} weight="fill" aria-hidden="true" />
      <div>
        <p className="af-feedback__title">{title}</p>
        <p className="af-feedback__message">{children}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="af-feedback__dismiss"
          aria-label={`Dismiss ${title}`}
          onClick={onDismiss}
        >
          <XIcon size={16} />
        </button>
      )}
    </div>
  );
}
export function Card({
  raised,
  className = '',
  ...props
}: HTMLAttributes<HTMLElement> & { raised?: boolean }) {
  return (
    <article {...props} className={`af-card ${raised ? 'af-card--raised' : ''} ${className}`} />
  );
}
export function CardBody(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`af-card__body ${props.className ?? ''}`} />;
}
export function CardFooter(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`af-card__footer ${props.className ?? ''}`} />;
}
export function Avatar({ initials, label }: { initials: string; label?: string }) {
  return (
    <span className="af-avatar" aria-label={label}>
      {initials}
    </span>
  );
}
export function BrandWordmark() {
  return (
    <span className="ds-wordmark">
      AgentFactory <span>OS</span>
    </span>
  );
}
export function PublicShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="ds-public-header">{header}</header>
      <main className="ds-public-content">{children}</main>
    </>
  );
}
export function AuthShell({ brand, children }: { brand: ReactNode; children: ReactNode }) {
  return (
    <main className="ds-auth-shell">
      <aside>{brand}</aside>
      <section>
        <div>{children}</div>
      </section>
    </main>
  );
}

export type TableColumn<T> = {
  key: string;
  heading: string;
  render: (row: T) => ReactNode;
};

/** Native table semantics; every column remains available on narrow screens. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage = 'No work yet. Create an agent to get started.',
}: {
  caption: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  return (
    <div className="af-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="af-table">
        <caption className="ds-table-caption">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
