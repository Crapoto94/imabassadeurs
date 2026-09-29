import { ReactNode } from 'react';

// Bibliothèque historique, restylée sur le thème « Ivry IA Citoyenne » (Stitch).
// Même API publique : les pages existantes héritent du nouveau thème sans changement.

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface-container-lowest rounded-2xl shadow-card ${className}`}>{children}</div>;
}

export function Button({
  children, onClick, type = 'button', variant = 'primary', disabled, className = '',
}: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean; className?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-secondary hover:bg-secondary-container text-on-secondary shadow-sm',
    secondary: 'bg-surface-container hover:bg-surface-container-high text-on-surface',
    danger: 'bg-error hover:brightness-110 text-on-error',
    ghost: 'bg-transparent hover:bg-surface-container-low text-secondary',
  };
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-headline text-label-md transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-surface-container text-on-surface-variant',
    green: 'bg-tertiary-fixed text-on-tertiary-fixed',
    amber: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    red: 'bg-error-container text-on-error-container',
    blue: 'bg-primary-fixed text-on-primary-fixed-variant',
    purple: 'bg-secondary-fixed text-on-secondary-fixed-variant',
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 font-headline text-label-sm ${colors[color] || colors.slate}`}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block font-headline text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="block font-body text-body-sm text-outline">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-lg bg-surface-container-low px-3.5 py-2.5 font-body text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/20 transition-all';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className || ''}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className || ''}`} />;
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const kinds = {
    info: 'bg-secondary-fixed/40 text-on-secondary-fixed-variant border border-secondary-fixed',
    error: 'bg-error-container text-on-error-container border border-error/20',
    success: 'bg-tertiary-fixed/50 text-on-tertiary-fixed-variant border border-tertiary-fixed-dim/40',
  };
  return <div className={`rounded-xl border px-4 py-3 font-body text-body-md ${kinds[kind]}`}>{children}</div>;
}

export function Spinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-surface-container-high border-t-secondary" role="status" aria-label="Chargement" />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant p-8 text-center font-body text-body-md text-on-surface-variant">{children}</div>;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 font-body text-body-md text-on-surface-variant">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
