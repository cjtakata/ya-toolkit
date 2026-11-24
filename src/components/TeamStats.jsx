import { useEffect, useMemo, useState } from 'react'
import { MessageCircleHeart, Timer, Inbox, UserRoundSearch, RefreshCw, Hand, ChevronDown } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { LIST_META } from './listMeta.js'
import { RANGES, teamStats, formatHours, activity, leaderGuests, stamp } from './teamStats.js'

// Admins: who's been reaching out to connection-card guests, and how fast.
export default function TeamStats({ leaders = [], onOpenPerson }) {
  const [records, setRecords] = useState(null)
  const [error, setError]     = useState('')
  const [range, setRange]     = useState('30')
  const [openLeader, setOpenLeader] = useState(null)
  const [showAll, setShowAll] = useState(false)

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
  const events = useMemo(() => (records ? activity(records, days) : []), [records, days])
  const FEED = 12
  const guestLink = (name, personId) => (onOpenPerson && personId
    ? <button className="act-guest" onClick={() => onOpenPerson(personId)}>{name}</button>
    : <b>{name}</b>)
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
                  const open = openLeader === x.name
                  return (
                    <div className={`leader-item${open ? ' open' : ''}`} key={x.name}>
                    <div className="person-row leader-row" role="button" tabIndex={0} aria-expanded={open}
                      onClick={() => setOpenLeader(open ? null : x.name)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenLeader(open ? null : x.name) } }}>
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
                      <ChevronDown size={16} className="leader-chev" aria-hidden="true" />
                    </div>
                    {open && (
                      <ul className="leader-guests">
                        {leaderGuests(records, x.name, days).map((g, i) => (
                          <li key={i} className="lg-item">
                            <div className="lg-name">{guestLink(g.guest, g.personId)}{g.open && <span className="lg-open">Not texted yet</span>}</div>
                            <div className="lg-times">
                              <span><i className="lg-dot lg-card" />Card {stamp(g.cardAt)}</span>
                              {g.claimedAt && <span><i className="lg-dot lg-claim" />Claimed {stamp(g.claimedAt)}</span>}
                              {g.textedAt && <span><i className="lg-dot lg-text" />Texted {stamp(g.textedAt)} · {formatHours(g.hrs)} after card</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="home-section">
            <div className="home-section-head">
              <h2>Recent activity · {period}</h2>
              {events.length > FEED && (
                <button className="home-link" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show less' : `Show all ${events.length}`}</button>
              )}
            </div>
            {events.length === 0 ? (
              <div className="home-empty home-empty-quiet"><div><span>No claims or texts in {period}.</span></div></div>
            ) : (
              <ul className="act-list">
                {(showAll ? events : events.slice(0, FEED)).map((e, i) => (
                  <li key={i} className={`act-item act-${e.kind}`}>
                    <span className="act-icon" aria-hidden="true">{e.kind === 'texted' ? <MessageCircleHeart size={15} /> : <Hand size={15} />}</span>
                    <div className="act-body">
                      <div><b>{e.leader}</b> {e.kind} {guestLink(e.guest, e.personId)}</div>
                      <div className="act-when">{stamp(e.at)} · {formatHours(e.afterCardHrs)} after card</div>
                    </div>
                  </li>
                ))}
              </ul>
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
