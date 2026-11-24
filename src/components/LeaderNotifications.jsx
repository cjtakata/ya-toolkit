import { useEffect, useMemo, useState } from 'react'
import { Bell, BellOff, AtSign, UserPlus, RefreshCw, Smartphone, X } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { LIST_META } from './listMeta.js'
import { stamp } from './teamStats.js'

// Admins: which leaders have notifications on, and a log of what each leader
// was actually sent (from GET /api/push?admin=1). No guessing who was told.
const KIND = {
  mention:  { Icon: AtSign,   label: 'Mention' },
  newguest: { Icon: UserPlus, label: 'New guest' },
  test:     { Icon: Bell,     label: 'Test' },
}
const RESULT = {
  push: {
    sent:   ['ok',    'Push delivered'],
    off:    ['muted', 'Push: notifications off'],
    failed: ['bad',   'Push failed'],
    held:   ['warn',  'Push held: quiet hours'],
  },
  text: {
    sent:          ['ok',    'Text sent'],
    zapier:        ['info',  'Text via Zapier'],
    'no-mobile':   ['warn',  'No mobile for texts'],
    failed:        ['bad',   'Text failed'],
    'test-number': ['info',  'Text to test number'],
  },
}

export default function LeaderNotifications({ people = [] }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')
  const [only, setOnly]   = useState(null)   // filter the log to one leader
  const [showAll, setShowAll] = useState(false)

  function load() {
    setError('')
    fetch('/api/push?admin=1')
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error))))
      .then(setData)
      .catch(e => setError(e.message || "Couldn't load notification info."))
  }
  useEffect(load, [])

  const byId = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])
  if (error) return (
    <div className="home-error">{error}<button className="home-link" onClick={load}><RefreshCw size={13} /> Try again</button></div>
  )
  if (!data) return <div className="home-empty home-empty-quiet"><div><span>Loading…</span></div></div>

  const on = data.leaders.filter(l => l.devices.length)
  const noMobile = data.leaders.filter(l => !l.hasMobile)
  const log = only ? data.log.filter(e => e.leaders.some(x => x.id === only.id)) : data.log
  const FEED = 15

  return (
    <div className="team-stats">
      <div className="stat-grid crew-stat-grid">
        <div className="stat stat-green"><Bell size={18} />
          <span className="stat-num">{on.length}<span className="stat-of"> / {data.leaders.length}</span></span>
          <span className="stat-label">Notifications on</span></div>
        <div className={`stat${noMobile.length ? ' stat-amber' : ''}`}><Smartphone size={18} />
          <span className="stat-num">{noMobile.length}</span>
          <span className="stat-label">No mobile for texts</span></div>
      </div>

      <section className="home-section">
        <div className="home-section-head"><h2>Leaders</h2><span className="crew-open">Tap one to see their log</span></div>
        <div className="home-list">
          {data.leaders.map(l => {
            const p = byId[l.id]
            const lm = LIST_META[l.crew]
            const selected = only?.id === l.id
            return (
              <div key={l.id} role="button" tabIndex={0} className={`person-row leader-row notif-leader${selected ? ' selected' : ''}`}
                onClick={() => { setOnly(selected ? null : l); setShowAll(false) }}
                onKeyDown={e => { if (e.key === 'Enter') setOnly(selected ? null : l) }}>
                <Avatar person={p || { name: l.name }} />
                <div className="person-info">
                  <div className="person-name-row">
                    <span className="person-name">{l.name}</span>
                    {lm && <span className={`badge ${lm.badgeCls}`}>{lm.crew}</span>}
                  </div>
                  <div className="leader-sub">
                    {l.devices.length
                      ? `${[...new Set(l.devices.map(d => d.label))].join(', ')} · since ${shortDay(l.devices.map(d => d.addedAt).sort()[0])}`
                      : 'Hasn’t turned on notifications'}
                    {!l.hasMobile && <span className="notif-warn"> · no mobile for texts</span>}
                  </div>
                </div>
                <span className={`notif-pill ${l.devices.length ? 'on' : 'off'}`}>
                  {l.devices.length ? <><Bell size={12} /> On</> : <><BellOff size={12} /> Off</>}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <h2>Notification log · 14 days</h2>
          {log.length > FEED && <button className="home-link" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show less' : `Show all ${log.length}`}</button>}
        </div>
        {only && (
          <button className="log-filter" onClick={() => setOnly(null)}>Showing {only.name} <X size={13} /></button>
        )}
        {log.length === 0 ? (
          <div className="home-empty home-empty-quiet"><div><span>{only ? `Nothing sent to ${only.name.split(' ')[0]} in the last 14 days.` : 'Nothing sent in the last 14 days.'}</span></div></div>
        ) : (
          <ul className="act-list log-list">
            {(showAll ? log : log.slice(0, FEED)).map((e, i) => {
              const k = KIND[e.kind] || KIND.test
              const rows = only ? e.leaders.filter(x => x.id === only.id) : e.leaders
              return (
                <li key={i} className="act-item">
                  <span className="act-icon log-icon" aria-hidden="true"><k.Icon size={15} /></span>
                  <div className="act-body">
                    <div><b>{e.summary}</b></div>
                    <div className="act-when">{k.label} · {stamp(e.at)}{e.urgent ? ' · Send now' : ''}</div>
                    <ul className="log-leaders">
                      {rows.map(x => (
                        <li key={x.id}>
                          <span className="log-name">{x.name || 'Leader'}</span>
                          {x.lines.map((ln, j) => {
                            const [tone, text] = RESULT[ln.channel]?.[ln.result] || ['muted', `${ln.channel}: ${ln.result}`]
                            return <span key={j} className={`log-chip ${tone}`}>{text}{ln.detail ? ` · ${ln.detail}` : ''}</span>
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="profile-hint">
        Push is the app’s own notification. Texts go out through Zapier until the app’s Clearstream texting is switched on,
        so “Text via Zapier” means it was handed to Zapier. Check Zapier’s run history to confirm delivery.
        Only notifications sent after this log was added appear here.
      </p>
    </div>
  )
}

const shortDay = iso => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
