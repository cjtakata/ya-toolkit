import { useEffect, useRef, useState } from 'react'

// iOS-style sheet: slides up over the app and dims what's behind it.
// Closes on "Done", a tap on the backdrop, Escape, or dragging it down —
// from the grabber/header, or from the content when it's scrolled to the top.
//
//   title    – header title; pass null for a headless sheet (content brings its own header)
//   tall     – open at full sheet height (for content that loads in, like a profile)
export default function Sheet({ open, title = null, tall = false, onClose, children }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown]     = useState(false)
  const sheetRef  = useRef(null)
  const bodyRef   = useRef(null)
  const backRef   = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 300)   // let the slide-down finish
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Back to the top of the content each time a sheet opens
  useEffect(() => { if (open && bodyRef.current) bodyRef.current.scrollTop = 0 }, [open, children?.key])

  // ── Drag to dismiss (touch + mouse/pen via pointer events) ─────────
  useEffect(() => {
    const sheet = sheetRef.current
    if (!mounted || !sheet) return
    let startY = 0, lastY = 0, lastT = 0, velocity = 0, dragging = false, armed = false

    const setY = (y, animate) => {
      sheet.style.transition = animate ? '' : 'none'
      sheet.style.transform  = y ? `translateY(${y}px)` : ''
      if (backRef.current) {
        backRef.current.style.transition = animate ? '' : 'none'
        backRef.current.style.opacity = y ? String(Math.max(0, 1 - y / (sheet.offsetHeight || 1))) : ''
      }
    }

    function start(y, target) {
      // Only drag when the content can't scroll up any further (or from the header).
      const inBody = bodyRef.current?.contains(target)
      if (inBody && bodyRef.current.scrollTop > 0) return
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      armed = true; dragging = false
      startY = lastY = y; lastT = performance.now(); velocity = 0
    }
    function move(y, e) {
      if (!armed) return
      const dy = y - startY
      if (!dragging) {
        if (dy < -4) { armed = false; return }         // scrolling up: let the content scroll
        if (dy < 6) return
        dragging = true
      }
      e.cancelable && e.preventDefault()
      const now = performance.now()
      velocity = (y - lastY) / Math.max(1, now - lastT)  // px per ms
      lastY = y; lastT = now
      setY(Math.max(0, dy), false)
    }
    function end() {
      if (!armed) return
      armed = false
      if (!dragging) return
      dragging = false
      const dy = lastY - startY
      if (performance.now() - lastT > 120) velocity = 0   // held still before letting go: not a flick
      if (dy > Math.min(140, sheet.offsetHeight * 0.3) || velocity > 0.6) {
        setY(0, true)               // let the normal close animation run from here
        sheet.style.transform = `translateY(${dy}px)`
        requestAnimationFrame(() => { sheet.style.transform = ''; onCloseRef.current() })
      } else {
        setY(0, true)                // spring back
      }
    }

    const ts = e => start(e.touches[0].clientY, e.target)
    const tm = e => move(e.touches[0].clientY, e)
    const pd = e => { if (e.pointerType !== 'touch') start(e.clientY, e.target) }
    const pm = e => { if (e.pointerType !== 'touch') move(e.clientY, e) }
    sheet.addEventListener('touchstart', ts, { passive: true })
    sheet.addEventListener('touchmove', tm, { passive: false })
    sheet.addEventListener('touchend', end)
    sheet.addEventListener('touchcancel', end)
    sheet.addEventListener('pointerdown', pd)
    window.addEventListener('pointermove', pm)
    window.addEventListener('pointerup', end)
    return () => {
      sheet.removeEventListener('touchstart', ts)
      sheet.removeEventListener('touchmove', tm)
      sheet.removeEventListener('touchend', end)
      sheet.removeEventListener('touchcancel', end)
      sheet.removeEventListener('pointerdown', pd)
      window.removeEventListener('pointermove', pm)
      window.removeEventListener('pointerup', end)
    }
  }, [mounted])

  if (!mounted) return null
  return (
    <div className={`sheet-layer${shown ? ' shown' : ''}`}>
      <div className="sheet-backdrop" ref={backRef} onClick={onClose} />
      <div className={`sheet${tall ? ' sheet-tall' : ''}`} ref={sheetRef} role="dialog" aria-modal="true" aria-label={title || undefined}>
        <div className="sheet-grabber" aria-hidden="true" />
        {title !== null && (
          <div className="sheet-head">
            <span className="sheet-title">{title}</span>
            <button className="sheet-done" onClick={onClose}>Done</button>
          </div>
        )}
        <div className="sheet-body" ref={bodyRef}>{children}</div>
      </div>
    </div>
  )
}
