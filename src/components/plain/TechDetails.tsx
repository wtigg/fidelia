import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/** Volet repliable « Voir le détail technique » : le niveau principal reste en mots simples. */
export function TechDetails({ children, label = 'Voir le détail technique', className = '' }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <details className={`group ${className}`}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-brand-600 hover:text-brand-700 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">Masquer le détail technique</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

/** Onglets qui passent à la ligne au lieu d'être coupés (écrans étroits, cartes en deux colonnes). */
export function WrapTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${value === it.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

