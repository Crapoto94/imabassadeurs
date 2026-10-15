import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '../types';

// ── Atomes partagés du thème « Ivry IA Citoyenne » (maquettes Stitch) ──

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Mention discrète « modifié » + date, affichée uniquement si une édition a eu lieu.
export function EditedAt({ editedAt }: { editedAt?: string | null }) {
  if (!editedAt) return null;
  return (
    <span className="inline-flex items-center gap-1 text-outline" title={`Modifié le ${new Date(editedAt).toLocaleString('fr-FR')}`}>
      <span className="material-symbols-outlined text-[13px]">edit</span>
      <span>modifié {timeAgo(editedAt)}</span>
    </span>
  );
}

export function Avatar({ name, size = 40, className = '' }: { name?: string | null; size?: number; className?: string }) {
  const initials = (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className={`rounded-full bg-primary flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="font-headline text-on-primary" style={{ fontSize: size * 0.36 }}>{initials}</span>
    </div>
  );
}

const ROLE_LABELS: Record<Role | string, string> = {
  admin: 'Admin',
  iambassadeur: 'IAmbassadeur',
  iaeclaireur: 'IA.Éclaireur',
  ianimateur: 'IAnimateur',
};

const ROLE_CLS: Record<string, string> = {
  admin: 'bg-primary/10 text-primary border border-primary/20',
  iambassadeur: 'bg-primary/10 text-primary border border-primary/20',
  iaeclaireur: 'bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary-fixed-dim/40',
  ianimateur: 'bg-secondary-fixed text-on-secondary-fixed-variant border border-secondary-fixed-dim/40',
};

export function RoleBadge({ role }: { role: Role | string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-headline text-label-sm ${ROLE_CLS[role] || 'bg-surface-container text-on-surface-variant'}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

// ── Niveaux de lecture des ressources ──
export const LEVELS = ['debutant', 'intermediaire', 'avance'] as const;
export type LevelKey = (typeof LEVELS)[number];

export const LEVEL_META: Record<LevelKey, { label: string; cls: string }> = {
  debutant: { label: 'Débutant', cls: 'bg-tertiary/10 text-tertiary border border-tertiary/25' },
  intermediaire: { label: 'Intermédiaire', cls: 'bg-warning/15 text-on-warning border border-warning/30' },
  avance: { label: 'Avancé', cls: 'bg-primary/10 text-primary border border-primary/25' },
};

export function LevelBadge({ level, className = '' }: { level?: string | null; className?: string }) {
  if (!level || !LEVEL_META[level as LevelKey]) return null;
  const meta = LEVEL_META[level as LevelKey];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-headline text-label-sm uppercase tracking-wider ${meta.cls} ${className}`}>
      {meta.label}
    </span>
  );
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest rounded-2xl shadow-card ${className}`}>{children}</div>
  );
}

export function IconBtn({
  icon, children, onClick, active, tone = 'default', className = '',
}: {
  icon: string; children?: ReactNode; onClick?: () => void; active?: boolean;
  tone?: 'default' | 'secondary' | 'error'; className?: string;
}) {
  const tones = {
    default: 'text-on-surface-variant hover:text-secondary hover:bg-surface-container-low',
    secondary: active ? 'text-secondary bg-secondary-fixed/50' : 'text-on-surface-variant hover:text-secondary hover:bg-surface-container-low',
    error: 'text-error hover:bg-error-container/40',
  };
  return (
    <button
      type="button" onClick={onClick}
      className={`py-2 px-3 rounded-lg font-headline text-label-md flex items-center justify-center gap-2 transition-colors ${tones[tone]} ${className}`}
    >
      <span className={`material-symbols-outlined text-[20px] ${active ? 'filled' : ''}`}>{icon}</span>
      {children && <span>{children}</span>}
    </button>
  );
}

// Petit système de toast façon maquette Stitch.
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((msg: string) => {
    setMessage(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3200);
  }, []);
  const Toast = message ? (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-inverse-surface text-inverse-on-surface rounded-xl shadow-xl transition-all duration-300">
      <span className="material-symbols-outlined text-tertiary-fixed-dim filled">check_circle</span>
      <span className="font-headline text-label-md">{message}</span>
    </div>
  ) : null;
  return { show, Toast };
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`w-full bg-surface-container-high h-2 rounded-full overflow-hidden ${className}`}>
      <div className="bg-secondary h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, icon, children }: {
  open: boolean; onClose: () => void; title: string; icon?: string; children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-surface-container-lowest rounded-3xl w-full max-w-xl p-6 shadow-modal space-y-4 max-h-[90vh] overflow-y-auto"
        role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            {icon && <span className="material-symbols-outlined text-secondary text-[24px]">{icon}</span>}
            <h3 className="font-headline text-headline-sm text-on-surface">{title}</h3>
          </div>
          <button className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container" onClick={onClose} aria-label="Fermer">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
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

export function StitchSpinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-surface-container-high border-t-secondary" role="status" aria-label="Chargement" />
    </div>
  );
}

export function StitchEmpty({ icon = 'inbox', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant p-8 text-center space-y-2">
      <span className="material-symbols-outlined text-[32px] text-outline">{icon}</span>
      <p className="font-body text-body-md text-on-surface-variant">{children}</p>
    </div>
  );
}

export function StitchAlert({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const kinds = {
    info: 'bg-secondary-fixed/40 text-on-secondary-fixed-variant border border-secondary-fixed',
    error: 'bg-error-container text-on-error-container border border-error/20',
    success: 'bg-tertiary-fixed/50 text-on-tertiary-fixed-variant border border-tertiary-fixed-dim/40',
  };
  return <div className={`rounded-xl px-4 py-3 font-body text-body-md ${kinds[kind]}`}>{children}</div>;
}

export function PrimaryButton({ children, onClick, disabled, icon, className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; icon?: string; className?: string; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-secondary hover:bg-secondary-container text-on-secondary rounded-full font-headline text-label-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled, icon, className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; icon?: string; className?: string; type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-container font-headline text-label-md transition-colors disabled:opacity-50 ${className}`}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {children}
    </button>
  );
}

const inputCls = 'w-full px-3.5 py-2.5 bg-surface-container-low rounded-lg font-body text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/20 transition-all';

export function StitchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} />;
}
export function StitchTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className || ''}`} />;
}
export function StitchSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className || ''}`} />;
}

export function StitchField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block font-headline text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="block font-body text-body-sm text-outline">{hint}</span>}
    </label>
  );
}
