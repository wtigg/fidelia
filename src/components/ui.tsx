import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className, title, subtitle, action }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]', className)}>
      {title && (
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, icon, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'default' | 'good' | 'bad' | 'gold' }) {
  const toneCls = { default: 'bg-stone-100 text-stone-600', good: 'bg-brand-50 text-brand-600', bad: 'bg-rose-50 text-rose-600', gold: 'bg-amber-50 text-amber-700' }[tone]
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        {icon && <span className={cx('grid size-8 place-items-center rounded-lg', toneCls)}>{icon}</span>}
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-stone-900">{value}</p>
      {hint && <p className="mt-2 text-[13px] text-stone-500">{hint}</p>}
    </div>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', className ?? 'bg-stone-100 text-stone-700 ring-stone-200')}>{children}</span>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }
export function Button({ variant = 'secondary', size = 'md', className, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-stone-300',
    secondary: 'bg-white text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-50 disabled:text-stone-400',
    ghost: 'text-stone-600 hover:bg-stone-100 disabled:text-stone-300',
    danger: 'bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
  }[variant]
  const s = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4 text-sm'
  return <button {...rest} className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed', v, s, className)} />
}

/** Barre de probabilité colorée selon l'intensité */
export function ProbBar({ value, color = '#1f7a4d', width = 'w-24' }: { value: number; color?: string; width?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cx('h-1.5 overflow-hidden rounded-full bg-stone-100', width)}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
      </div>
      <span className="w-9 text-right text-[13px] font-medium tabular-nums text-stone-700">{Math.round(value * 100)} %</span>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === it.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800',
          )}
        >
          {it.label}
          {it.count !== undefined && <span className={cx('rounded-md px-1.5 text-xs tabular-nums', value === it.value ? 'bg-stone-100' : 'bg-stone-200/60')}>{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-stone-300')}
    >
      <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

export function Drawer({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col bg-stone-50 shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
          <div className="min-w-0">{title}</div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
            <X className="size-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </aside>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-stone-100 text-stone-400">{icon}</div>
      <p className="mt-4 font-medium text-stone-800">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-stone-500">{children}</div>}
    </div>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx('px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-stone-400', className)}>{children}</th>
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-4 py-3 align-middle', className)}>{children}</td>
}
