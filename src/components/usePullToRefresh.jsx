import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

// Drag down at the top of a scrolling list to refresh (the app is pinned to the
// screen, so the browser's own pull-to-refresh never fires).
// Usage: const { ref, indicator } = usePullToRefresh(onRefresh)
//        <div ref={ref} className="…scroll…">{indicator}…</div>
const TRIGGER = 64      // px of (damped) pull needed to refresh
const MAX     = 96
const HOLD    = 48      // indicator height while refreshing

export default function usePullToRefresh(onRefresh) {
  const ref = useRef(null)
  const [pull, setPull]           = useState(0)
  const [refreshing, setRefreshing] = useState(false)
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
      if (s.pull >= TRIGGER) {
        s.busy = true; setRefreshing(true); setPull(HOLD)
        try { await cb.current?.() } finally {
          s.busy = false; s.pull = 0; setRefreshing(false); setPull(0)
        }
      } else {
        s.pull = 0; setPull(0)
      }
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

  const dragging = st.current.startY != null && !refreshing
  const indicator = onRefresh ? (
    <div className={`ptr${refreshing ? ' ptr-busy' : ''}${pull >= TRIGGER ? ' ptr-ready' : ''}`}
      style={{ height: pull, transition: dragging ? 'none' : undefined }} aria-hidden={!refreshing}
      role={refreshing ? 'status' : undefined} aria-label={refreshing ? 'Refreshing' : undefined}>
      <RefreshCw size={18} strokeWidth={2.4}
        style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / TRIGGER) }} />
    </div>
  ) : null

  return { ref, indicator, refreshing }
}
