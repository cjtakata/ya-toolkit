import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Check } from 'lucide-react'

// Drag down at the top of a scrolling list to refresh (the app is pinned to the
// screen, so the browser's own pull-to-refresh never fires).
// Usage: const { ref, indicator } = usePullToRefresh(onRefresh)
//        <div ref={ref} className="…scroll…">{indicator}…</div>
// onRefresh(report) may call report(0–1) as its work completes; the indicator
// shows that as a progress bar, then a short "Up to date" before closing.
const TRIGGER = 64      // px of (damped) pull needed to refresh
const MAX     = 96
const HOLD    = 64      // indicator height while refreshing
const DONE_MS = 900     // how long "Up to date" stays before the indicator closes

export default function usePullToRefresh(onRefresh) {
  const ref = useRef(null)
  const [pull, setPull]         = useState(0)
  const [phase, setPhase]       = useState('idle')   // idle | refreshing | done | error
  const [progress, setProgress] = useState(0)
  const st = useRef({ startY: null, pull: 0, busy: false })
  const cb = useRef(onRefresh)
  cb.current = onRefresh

  useEffect(() => {
    const el = ref.current
    if (!el || !onRefresh) return
    const s = st.current

    function start(e) {
      if (s.busy || el.scrollTop > 0 || e.touches.length !== 1) { s.startY = null; return }
      s.startY = e.touches[0].clientY
    }
    function move(e) {
      if (s.startY == null) return
      const dy = e.touches[0].clientY - s.startY
      if (dy <= 0 || el.scrollTop > 0) { if (s.pull) { s.pull = 0; setPull(0) } return }
      e.preventDefault()                         // we're pulling, not scrolling
      s.pull = Math.min(MAX, dy * 0.5)
      setPull(s.pull)
    }
    async function end() {
      if (s.startY == null) return
      s.startY = null
      if (s.pull < TRIGGER) { s.pull = 0; setPull(0); return }
      s.busy = true
      setPhase('refreshing'); setProgress(0.08); setPull(HOLD)
      let ok = true
      try {
        await cb.current?.(p => setProgress(prev => Math.max(prev, Math.min(1, p))))
      } catch { ok = false }
      setProgress(1)
      setPhase(ok ? 'done' : 'error')
      await new Promise(r => setTimeout(r, DONE_MS))
      s.busy = false; s.pull = 0
      setPull(0); setPhase('idle'); setProgress(0)
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [!!onRefresh])

  const active   = phase !== 'idle'
  const dragging = st.current.startY != null && !active
  const label =
    phase === 'refreshing' ? 'Refreshing…' :
    phase === 'done'       ? 'Up to date' :
    phase === 'error'      ? "Couldn't refresh" :
    pull >= TRIGGER        ? 'Release to refresh' : 'Pull to refresh'

  const indicator = onRefresh ? (
    <div className={`ptr ptr-${phase}${pull >= TRIGGER ? ' ptr-ready' : ''}`}
      style={{ height: pull, transition: dragging ? 'none' : undefined }}
      role={active ? 'status' : undefined} aria-live="polite" aria-hidden={!active}>
      <div className="ptr-inner" style={active ? undefined : { opacity: Math.min(1, pull / TRIGGER) }}>
        <div className="ptr-row">
          {phase === 'done'
            ? <Check size={16} strokeWidth={2.8} />
            : <RefreshCw size={16} strokeWidth={2.4}
                style={active ? undefined : { transform: `rotate(${pull * 3}deg)` }} />}
          <span>{label}</span>
        </div>
        {active && (
          <div className="ptr-bar" aria-hidden="true">
            <div className="ptr-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  ) : null

  return { ref, indicator, refreshing: phase === 'refreshing' }
}
