import { useId, useState, type ReactNode } from 'react'
import { GLOSSARY, type GlossaryKey } from './glossary.ts'

/**
 * Terme souligné en pointillé avec une infobulle de glossaire.
 * Survol, focus clavier ou toucher (mobile) l'affichent.
 */
export function Term({ k, children, light = false }: { k: GlossaryKey; children?: ReactNode; light?: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const g = GLOSSARY[k]
  return (
    <span className="relative inline" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span
        role="button"
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        className={`cursor-help underline decoration-dotted decoration-1 underline-offset-[3px] ${light ? 'decoration-white/60' : 'decoration-stone-400'}`}
      >
        {children ?? g.term}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full left-1/2 z-50 mb-2 block w-64 max-w-[80vw] -translate-x-1/2 rounded-xl bg-stone-900 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg"
        >
          <b className="block font-semibold">{g.term}</b>
          {g.def}
        </span>
      )}
    </span>
  )
}
