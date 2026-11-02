import type { ReactNode } from 'react';

/** Shared presentational building blocks for the React procurement core screens. */
export const peso = (amount: unknown) => `₱${Number(amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export function StatusPill({ status }: { status: string }) {
  const label = String(status || 'Unknown');
  const normalized = label.toLowerCase();
  const color = /approved|agreed|completed|paid|verified|matched|signed/.test(normalized)
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : /reject|cancel|hold|fail|issue|damage|non-compliant/.test(normalized)
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : /pending|awaiting|submitted|processing/.test(normalized)
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${color}`}>{label}</span>;
}

export function MetricCard({ label, value, icon, action }: { label: string; value: string | number; icon: string; action?: () => void }) {
  const content = <>
    <div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-900 break-words">{value}</div></div>
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f8eee9] text-[#a64f32]" aria-hidden="true"><i className={`fa-solid ${icon}`} /></span>
  </>;
  const cls = 'flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-left min-w-0';
  return action ? <button className={`${cls} hover:border-[#a64f32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a64f32]`} onClick={action} type="button">{content}</button>
    : <div className={cls}>{content}</div>;
}

export function ScreenPanel({ heading, description, children, action }: { heading: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
      <div><h3 className="text-base font-bold text-slate-900">{heading}</h3>{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</div>{action}
    </div>{children}
  </section>;
}

export const fieldClass = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm text-slate-800 focus:border-[#a64f32] focus:ring-2 focus:ring-[#a64f32]/20 focus:outline-none';
export const mainButton = 'pf-primary-action inline-flex items-center justify-center gap-2 rounded-lg bg-[#a64f32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#873e27] disabled:opacity-50 disabled:cursor-not-allowed';
export const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
