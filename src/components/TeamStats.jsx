import { useEffect, useMemo, useState } from 'react'
import { MessageCircleHeart, Timer, Inbox, UserRoundSearch, RefreshCw } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { LIST_META } from './listMeta.js'
import { RANGES, teamStats, formatHours } from './teamStats.js'

// Admins: who's been reaching out to connection-card guests, and how fast.
export default function TeamStats({ leaders = [] }) {
  const [records, setRecords] = useState(null)
  const [error, setError]     = useState('')
  const [range, setRange]     = useState('30')

  function load(fresh) {
    setError('')
    fetch(`/api/cards?stats=1${fresh ? '&fresh=1' : ''}`)
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error))))
      .then(setRecords)
      .catch(e => setError(e.message || "Couldn't load reach-outs from Planning Center."))
  }
  useEffect(() => { load(false) }, [])

  const days = RANGES.find(r => r.key === range).days
  const byName = useMemo(() => Object.fromEntries(leaders.map(p => [p.name, p])), [leaders])
  const s = useMemo(
    () => records && teamStats(records, leaders.map(p => p.name), days),
    [records, leaders, days],
  )
  const max = s ? Math.max(1, ...s.active.map(x => x.texted)) : 1
  const period = days ? `the last ${days} days` : 'all time'

  return (
    <div className="team-stats">
      <div className="range-tabs" role="tablist">
        {RANGES.map(r => (
          <button key={r.key} role="tab" aria-selected={range === r.key}
            className={`range-tab${range === r.key ? ' active' : ''}`} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="home-error">
          {error}
          <button className="home-link" onClick={() => load(true)}><RefreshCw size={13} /> Try again</button>
        </div>
      ) : !s ? (
        <div className="home-empty home-empty-quiet"><div><span>Loading reach-outs…</span></div></div>
      ) : (
        <>
          <div className="stat-grid team-stat-grid">
            <div className="stat stat-green"><MessageCircleHeart size={18} />
              <span className="stat-num">{s.team.texted}</span><span className="stat-label">Guests texted</span></div>
            <div className="stat stat-indigo"><Timer size={18} />
              <span className="stat-num">{formatHours(s.team.medianHrs)}</span><span className="stat-label">Typical card → text</span></div>
            <div className="stat"><Inbox size={18} />
              <span className="stat-num">{s.team.newCards}</span><span className="stat-label">New cards</span></div>
            <div className="stat stat-amber"><UserRoundSearch size={18} />
              <span className="stat-num">{s.team.unclaimed}</span><span className="stat-label">Not claimed now</span></div>
          </div>

          <section className="home-section">
            <div className="home-section-head"><h2>By leader · {period}</h2></div>
            {s.active.length === 0 ? (
              <div className="home-empty home-empty-quiet"><div><span>No reach-outs in {period}.</span></div></div>
            ) : (
              <div className="home-list">
                {s.active.map(x => {
                  const p = byName[x.name]
                  return (
                    <div className="person-row leader-row" key={x.name}>
                      <Avatar person={p || { name: x.name }} />
                      <div className="person-info">
                        <div className="person-name-row">
                          <span className="person-name">{x.name}</span>
                          {p && LIST_META[p.list] && <span className={`badge ${LIST_META[p.list].badgeCls}`}>{LIST_META[p.list].crew}</span>}
                        </div>
                        {x.texted > 0 && <div className="leader-sub">Typically texts {formatHours(x.medianHrs)} after the card</div>}
                        {x.open > 0 && (
                          <div className="leader-sub">
                            {x.open} claimed, not texted yet · {x.open === 1 ? '' : 'oldest '}card {formatHours(x.waitingHrs)} ago
                          </div>
                        )}
                        <div className="leader-bar" aria-hidden="true"><span style={{ width: `${(x.texted / max) * 100}%` }} /></div>
                      </div>
                      <div className="leader-count">
                        <span className="leader-num">{x.texted}</span>
                        <span className="leader-unit">texted</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {s.quiet.length > 0 && (
            <section className="home-section">
              <div className="home-section-head"><h2>No reach-outs · {period}</h2></div>
              <p className="leader-quiet">{s.quiet.join(', ')}</p>
            </section>
          )}

          <p className="profile-hint">
            Counted from the claim and “texted” notes on each connection card.
            {s.unrecorded > 0 && ` ${s.unrecorded} texted ${s.unrecorded === 1 ? 'guest has' : 'guests have'} no leader recorded (finished in Planning Center directly).`}
            {' '}Guests texted without tapping “Yes, I sent it” or “Mark as texted” aren't counted.
          </p>
        </>
      )}
    </div>
  )
}
