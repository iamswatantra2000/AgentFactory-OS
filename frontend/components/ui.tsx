import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function BrandMark() {
  return (
    <span aria-label="AgentFactory OS" className="af-brand">
      <span aria-hidden="true" className="af-brand-mark">
        AF
      </span>
      <span className="af-brand-wordmark">AgentFactory OS</span>
    </span>
  );
}

export function Button({
  children,
  className = '',
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className={`af-button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
