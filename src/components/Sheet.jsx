import { useEffect, useState } from 'react'

// iOS-style sheet: slides up over the app, dims what's behind, closes on
// "Done", a tap on the backdrop, or Escape.
export default function Sheet({ open, title, onClose, children }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown]     = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 260)   // let the slide-down finish
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null
  return (
    <div className={`sheet-layer${shown ? ' shown' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          <button className="sheet-done" onClick={onClose}>Done</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
