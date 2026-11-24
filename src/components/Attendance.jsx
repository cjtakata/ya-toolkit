import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CalendarDays, UserRoundCheck, Hourglass, RefreshCw } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { LIST_META } from './listMeta.js'
import { MINISTRY } from '../../ministry.config.js'
import { weekly, lastGathering, drifting, cameBack, shortDate, todayThere } from './attendance.js'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const CREW_SHORT = Object.fromEntries(MINISTRY.crews.map(c => [c.key, c.label]))

// Admins: who's checking in on the YA Connect kiosk, who came back after a
// text, and who hasn't been back in a while.
export default function Attendance({ people = [], loading, onOpenPerson }) {
  const [records, setRecords] = useState(null)
  const [error, setError] = useState('')
  const [showAllDrift, setShowAllDrift] = useState(false)

  function load(fresh) {
    setError('')
    fetch(`/api/cards?stats=1${fresh ? '&fresh=1' : ''}`)
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.error))))
      .then(setRecords)
      .catch(e => setError(e.message || "Couldn't load follow-ups from Planning Center."))
  }
  useEffect(() => { load(false) }, [])

  const today = todayThere()
  const weeks = useMemo(() => weekly(people, 8, today), [people, today])
  const last = useMemo(() => lastGathering(people), [people])
  const drift = useMemo(() => drifting(people, today), [people, today])
  const back = useMemo(() => (records ? cameBack(records, 90, today) : null), [records, today])
  const recent = weeks.slice(1, 5)   // the 4 full weeks before this one
  const avg = recent.length ? Math.round(recent.reduce((a, w) => a + w.total, 0) / recent.length) : 0
  const max = Math.max(1, ...weeks.map(w => w.total))

  if (loading && !people.length) return <div className="home-empty home-empty-quiet"><div><span>Loading people…</span></div></div>

  const open = id => onOpenPerson && onOpenPerson(id)
  const DRIFT = 10

  return (
    <div className="team-stats">
      <div className="stat-grid team-stat-grid">
        <div className="stat stat-green"><CalendarCheck size={18} />
          <span className="stat-num">{last ? last.count : 0}</span>
          <span className="stat-label">{last ? `Checked in ${shortDate(last.date)}` : 'No check-ins yet'}</span></div>
        <div className="stat stat-indigo"><CalendarDays size={18} />
          <span className="stat-num">{avg}</span><span className="stat-label">Weekly average (4 weeks)</span></div>
        <div className="stat"><UserRoundCheck size={18} />
          <span className="stat-num">{back ? (back.texted ? `${Math.round((back.back / back.texted) * 100)}%` : '—') : '…'}</span>
          <span className="stat-label">Came back after a text</span>
          {back && back.texted > 0 && <span className="stat-sub">{back.back} of {plural(back.texted, 'guest', 'guests')} · 90 days</span>}</div>
        <div className={`stat${drift.length ? ' stat-amber' : ''}`}><Hourglass size={18} />
          <span className="stat-num">{drift.length}</span><span className="stat-label">Not back in 3+ weeks</span></div>
      </div>

      <section className="home-section">
        <div className="home-section-head"><h2>Each week</h2></div>
        <div className="home-list">
          {weeks.map((w, i) => (
            <div className="person-row leader-row att-week" key={w.week}>
              <div className="person-info">
                <div className="person-name-row"><span className="person-name">{i === 0 ? 'This week' : `Week of ${shortDate(w.week)}`}</span></div>
                <div className="leader-sub">
                  {w.total ? Object.entries(w.byCrew).sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => `${CREW_SHORT[k] || 'No crew'} ${n}`).join(' · ') : 'No check-ins'}
                </div>
                <div className="leader-bar" aria-hidden="true"><span style={{ width: `${(w.total / max) * 100}%` }} /></div>
              </div>
              <div className="leader-count"><span className="leader-num">{w.total}</span><span className="leader-unit">{w.total === 1 ? 'person' : 'people'}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <h2>Haven't been back</h2>
          {drift.length > DRIFT && <button className="home-link" onClick={() => setShowAllDrift(v => !v)}>{showAllDrift ? 'Show less' : `Show all ${drift.length}`}</button>}
        </div>
        {drift.length === 0 ? (
          <div className="home-empty home-empty-quiet"><div><span>Everyone who's checked in twice or more has been in the last 3 weeks.</span></div></div>
        ) : (
          <div className="home-list">
            {(showAllDrift ? drift : drift.slice(0, DRIFT)).map(d => <PersonLine key={d.person.id} person={d.person} onOpen={open}
              sub={`Last here ${shortDate(d.last)} · ${d.daysAway} days ago · ${plural(d.count, 'check-in', 'check-ins')}`} />)}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="home-section-head"><h2>Texted guests · 90 days</h2></div>
        {error ? (
          <div className="home-error">{error}<button className="home-link" onClick={() => load(true)}><RefreshCw size={13} /> Try again</button></div>
        ) : !back ? (
          <div className="home-empty home-empty-quiet"><div><span>Loading…</span></div></div>
        ) : back.texted === 0 ? (
          <div className="home-empty home-empty-quiet"><div><span>No guests texted in the last 90 days.</span></div></div>
        ) : (
          <div className="home-list">
            {back.list.map(g => {
              const p = people.find(x => x.id === g.personId) || { id: g.personId, name: g.guest || 'Guest' }
              return <PersonLine key={g.personId} person={p} onOpen={open} tone={g.back ? 'ok' : 'muted'}
                pill={g.back ? 'Came back' : 'Not yet'}
                sub={`Texted ${shortDate(g.textedOn)}${g.contactedBy ? ` by ${g.contactedBy.split(' ')[0]}` : ''}` +
                  (g.back ? ` · back ${shortDate(g.back)}${g.times > 1 ? ` (+${g.times - 1} more)` : ''}` : '')} />
            })}
          </div>
        )}
      </section>

      <p className="profile-hint">
        From the YA Connect check-in kiosk. Each check-in is kept from when this was switched on; before that, only each
        person's most recent check-in (Last Seen in Planning Center) is known. “Came back” means a check-in on a later day than the text.
      </p>
    </div>
  )
}

function PersonLine({ person, sub, onOpen, pill, tone }) {
  const lm = LIST_META[person.list]
  return (
    <div className="person-row leader-row" role="button" tabIndex={0}
      onClick={() => onOpen(person.id)} onKeyDown={e => { if (e.key === 'Enter') onOpen(person.id) }}>
      <Avatar person={person} />
      <div className="person-info">
        <div className="person-name-row">
          <span className="person-name">{person.name}</span>
          {lm && <span className={`badge ${lm.badgeCls}`}>{lm.crew}</span>}
        </div>
        <div className="leader-sub">{sub}</div>
      </div>
      {pill && <span className={`log-chip ${tone}`}>{pill}</span>}
    </div>
  )
}
