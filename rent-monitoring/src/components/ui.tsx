import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Info, X, XCircle } from 'lucide-react';
import type { Compliance, RequestStatus } from '../types';
import { STATUS_LABELS } from '../lib/constants';
import { useData } from '../store/DataContext';

const cx = (...c: (string | number | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-kt-600 text-white hover:bg-kt-700 border-kt-600',
    secondary: 'bg-white text-kt-700 border-line hover:bg-kt-50 hover:border-kt-300',
    ghost: 'bg-transparent text-kt-700 border-transparent hover:bg-kt-50',
    danger: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
    success: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700',
  };
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        v[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ title, actions, children, className, bodyClassName }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cx('rounded-lg border border-line bg-white', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({ label, error, hint, children, className, required }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cx('flex flex-col gap-1 text-xs', className)}>
      <span className="font-medium text-slate-600">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {error ? <span className="text-red-600">{error}</span> : hint ? <span className="text-slate-400">{hint}</span> : null}
    </label>
  );
}

const control = 'h-9 w-full rounded-md border border-line bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-kt-500 focus:ring-2 focus:ring-kt-100 disabled:bg-slate-50';

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} className={cx(control, invalid && 'border-red-400', className)} />;
}

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select {...rest} className={cx(control, 'pr-7', invalid && 'border-red-400', className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(control, 'h-auto min-h-[72px] py-2', className)} />;
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, width = 'max-w-3xl' }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-6 no-print" onMouseDown={onClose}>
      <div className={cx('my-8 w-full rounded-lg border border-line bg-white shadow-xl', width)} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button className="rounded p-1 text-slate-500 hover:bg-kt-50" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/25 no-print" onMouseDown={onClose}>
      <aside className="flex h-full w-full max-w-[640px] flex-col border-l border-line bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="text-base font-semibold text-slate-800">{title}</div>
          <button className="rounded p-1 text-slate-500 hover:bg-kt-50" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const c: Record<RequestStatus, string> = {
    review: 'bg-kt-50 text-kt-700 border-kt-200',
    justification_requested: 'bg-amber-50 text-amber-800 border-amber-200',
    justification_received: 'bg-violet-50 text-violet-700 border-violet-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-slate-100 text-slate-600 border-slate-300',
  };
  return <span className={cx('inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium', c[status])}>{STATUS_LABELS[status]}</span>;
}

export function ComplianceBadge({ compliance }: { compliance: Compliance }) {
  if (compliance === 'over')
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-red-700">
        <AlertTriangle size={13} /> Превышение
      </span>
    );
  if (compliance === 'within')
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-emerald-700">
        <CheckCircle2 size={13} /> В пределах
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-slate-500">
      <CircleHelp size={13} /> Нет ориентира
    </span>
  );
}

export function DemoTag() {
  return <span className="ml-1 rounded bg-amber-100 px-1 py-px align-middle text-[9px] font-semibold uppercase tracking-wide text-amber-800" title="Демонстрационные данные">демо</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-line bg-kt-50/40 px-4 py-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Notice({ kind, title, children }: { kind: 'danger' | 'success' | 'info' | 'warning'; title?: ReactNode; children?: ReactNode }) {
  const c = {
    danger: ['border-red-300 bg-red-50 text-red-800', <AlertTriangle key="i" size={18} className="mt-px shrink-0" />],
    success: ['border-emerald-300 bg-emerald-50 text-emerald-800', <CheckCircle2 key="i" size={18} className="mt-px shrink-0" />],
    info: ['border-kt-200 bg-kt-50 text-kt-800', <Info key="i" size={18} className="mt-px shrink-0" />],
    warning: ['border-amber-300 bg-amber-50 text-amber-800', <AlertTriangle key="i" size={18} className="mt-px shrink-0" />],
  }[kind];
  return (
    <div className={cx('flex gap-2.5 rounded-md border px-3.5 py-3 text-sm', c[0] as string)}>
      {c[1]}
      <div>
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cx(title && 'mt-0.5', 'text-[13px] opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useData();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[380px] flex-col gap-2 no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex items-start gap-2 rounded-md border bg-white px-3 py-2.5 text-sm shadow-lg',
            t.kind === 'error' ? 'border-red-300 text-red-800' : t.kind === 'success' ? 'border-emerald-300 text-emerald-800' : 'border-kt-200 text-kt-800',
          )}
        >
          {t.kind === 'error' ? <XCircle size={16} className="mt-0.5 shrink-0" /> : t.kind === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismissToast(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Закрыть">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, tone = 'default', sub, icon }: { label: string; value: ReactNode; tone?: 'default' | 'danger' | 'success' | 'info'; sub?: ReactNode; icon?: ReactNode }) {
  const t = { default: 'text-slate-800', danger: 'text-red-700', success: 'text-emerald-700', info: 'text-kt-700' }[tone];
  const bar = { default: 'bg-kt-500', danger: 'bg-red-500', success: 'bg-emerald-500', info: 'bg-kt-300' }[tone];
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-white px-4 py-3.5">
      <span className={cx('absolute inset-y-0 left-0 w-1', bar)} />
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <div className={cx('mt-1.5 text-2xl font-semibold tabular-nums', t)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export { cx };
