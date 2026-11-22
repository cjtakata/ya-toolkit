import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

// A settings-style row (label · value ⌄) that opens the app's own menu card
// right under it — instead of the browser's native select.
export default function PickerRow({ label, value, options, onChange, emptyLabel = 'Not set', allowEmpty = true }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey  = e => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false) } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)   // capture: before the sheet's Escape
    // keep the menu in view when it opens near the bottom of a scrolling sheet
    requestAnimationFrame(() => ref.current?.querySelector('.picker-menu')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey, true) }
  }, [open])

  const shown = (value || '').trim()
  const items = [...(allowEmpty ? [{ value: '', label: emptyLabel }] : []), ...options.map(v => ({ value: v, label: v.trim() }))]

  function pick(v) {
    setOpen(false)
    if (v !== value) onChange(v)
  }

  return (
    <div className={`picker-row${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="picker-trigger" onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox" aria-expanded={open}>
        <span className="picker-label">{label}</span>
        <span className={`picker-value${shown ? '' : ' empty'}`}>
          <span className="picker-value-text">{shown || emptyLabel}</span><ChevronsUpDown size={15} />
        </span>
      </button>
      {open && (
        <div className="picker-menu" role="listbox" aria-label={label}>
          {items.map(it => {
            const on = (value || '') === it.value
            return (
              <button key={it.value || '__empty'} type="button" role="option" aria-selected={on}
                className={`picker-option${on ? ' on' : ''}${it.value ? '' : ' muted'}`} onClick={() => pick(it.value)}>
                <span className="picker-check">{on && <Check size={16} strokeWidth={2.6} />}</span>
                {it.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
