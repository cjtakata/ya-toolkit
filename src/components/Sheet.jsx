import { useEffect, useRef, useState } from 'react'

// iOS-style sheet: slides up over the app (eased in and out) and dims what's
// behind it. Closes on "Done", a tap on the backdrop, Escape, or a drag down
// from the TOP of the sheet — the grabber and header row only, so scrolling,
// typing and pinch-zooming inside the content never move the sheet.
//
//   title    – header title; pass null for a headless sheet (its content brings
//              its own top row — mark it with data-sheet-handle to make it draggable)
//   tall     – open at full sheet height (for content that loads in, like a profile)
const CLOSE_DISTANCE = 0.35   // drag at least 35% of the sheet's height…
const FLICK_SPEED    = 0.9    // …or flick at least this fast (px per ms)…
const FLICK_MIN      = 70     // …and at least this far, so a small bump never closes it

export default function Sheet({ open, title = null, tall = false, onClose, children }) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown]     = useState(false)
  const sheetRef   = useRef(null)
  const bodyRef    = useRef(null)
  const backRef    = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 450)   // let the slide-down finish
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => { if (open && bodyRef.current) bodyRef.current.scrollTop = 0 }, [open])

  // ── Drag to dismiss, from the handle area only ────────────────────
  useEffect(() => {
    const sheet = sheetRef.current
    if (!mounted || !sheet) return
    let startY = 0, dy = 0, samples = [], active = false

    const isHandle = target =>
      !!target.closest('.sheet-handle, .sheet-head, [data-sheet-handle]') &&
      !target.closest('button, a, input, textarea, select')

    const paint = (y, animate) => {
      sheet.style.transition = animate ? '' : 'none'
      sheet.style.transform  = y > 0 ? `translateY(${y}px)` : ''
      const back = backRef.current
      if (back) {
        back.style.transition = animate ? '' : 'none'
        back.style.opacity = y > 0 ? String(Math.max(0, 1 - y / (sheet.offsetHeight || 1))) : ''
      }
    }

    function start(y, target) {
      if (!isHandle(target)) return
      active = true; startY = y; dy = 0
      samples = [{ y, t: performance.now() }]
    }
    function move(y, e) {
      if (!active) return
      e.cancelable && e.preventDefault()
      const raw = y - startY
      // Pulling up past the top meets resistance instead of lifting the sheet
      dy = raw > 0 ? raw : raw / 6
      paint(Math.max(0, dy), false)
      const now = performance.now()
      samples.push({ y, t: now })
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift()   // last ~100ms
    }
    function end() {
      if (!active) return
      active = false
      const now = performance.now()
      const first = samples[0], last = samples[samples.length - 1]
      // Speed over the final ~100ms; holding still before letting go isn't a flick
      const speed = (now - last.t > 80) ? 0 : (last.y - first.y) / Math.max(1, last.t - first.t)
      const farEnough = dy > (sheet.offsetHeight || 600) * CLOSE_DISTANCE
      const flicked   = speed > FLICK_SPEED && dy > FLICK_MIN
      if (farEnough || flicked) {
        // Finish the close at the speed the finger let go with — no slow start.
        // Ease-OUT only, timed from the distance left and the release speed.
        const remaining = Math.max(0, (sheet.offsetHeight || 600) - dy)
        const v  = Math.max(speed, 1.1)                         // px per ms; a slow drag still finishes briskly
        const ms = Math.round(Math.min(320, Math.max(160, remaining / v)))
        const curve = `${ms}ms cubic-bezier(.2,.75,.35,1)`
        sheet.style.transition = `transform ${curve}`
        sheet.style.transform = ''
        if (backRef.current) { backRef.current.style.transition = `opacity ${curve}`; backRef.current.style.opacity = '' }
        onCloseRef.current()
      } else {
        paint(0, true)   // ease back into place
      }
    }
    function cancel() { if (active) { active = false; paint(0, true) } }

    const ts = e => {
      if (e.touches.length > 1) { cancel(); return }      // two fingers = pinch, not a drag
      start(e.touches[0].clientY, e.target)
    }
    const tm = e => {
      if (!active) return
      if (e.touches.length > 1) { cancel(); return }
      move(e.touches[0].clientY, e)
    }
    const pd = e => { if (e.pointerType === 'mouse') start(e.clientY, e.target) }
    const pm = e => { if (e.pointerType === 'mouse') move(e.clientY, e) }
    const pu = e => { if (e.pointerType === 'mouse') end() }

    // A swipe that starts in the sheet stays in the sheet. If the content is too
    // short to scroll (or the swipe isn't in the content), stop the browser from
    // handing it to the page underneath.
    const layer = sheet.parentElement
    const keepInSheet = e => {
      if (active || e.touches.length > 1) return       // drags handled above; let pinch zoom through
      const body = bodyRef.current
      const scrollable = body && body.contains(e.target) && body.scrollHeight > body.clientHeight + 1
      const ownScroll = e.target.closest?.('textarea')
      if (!scrollable && !ownScroll && e.cancelable) e.preventDefault()
    }
    layer.addEventListener('touchmove', keepInSheet, { passive: false })

    sheet.addEventListener('touchstart', ts, { passive: true })
    sheet.addEventListener('touchmove', tm, { passive: false })
    sheet.addEventListener('touchend', end)
    sheet.addEventListener('touchcancel', cancel)
    sheet.addEventListener('pointerdown', pd)
    window.addEventListener('pointermove', pm)
    window.addEventListener('pointerup', pu)
    return () => {
      layer.removeEventListener('touchmove', keepInSheet)
      sheet.removeEventListener('touchstart', ts)
      sheet.removeEventListener('touchmove', tm)
      sheet.removeEventListener('touchend', end)
      sheet.removeEventListener('touchcancel', cancel)
      sheet.removeEventListener('pointerdown', pd)
      window.removeEventListener('pointermove', pm)
      window.removeEventListener('pointerup', pu)
    }
  }, [mounted])

  if (!mounted) return null
  return (
    <div className={`sheet-layer${shown ? ' shown' : ''}`}>
      <div className="sheet-backdrop" ref={backRef} onClick={onClose} />
      <div className={`sheet${tall ? ' sheet-tall' : ''}`} ref={sheetRef} role="dialog" aria-modal="true" aria-label={title || undefined}>
        <div className="sheet-handle" aria-hidden="true"><div className="sheet-grabber" /></div>
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
