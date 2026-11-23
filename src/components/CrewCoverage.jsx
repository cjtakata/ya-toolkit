import { useMemo } from 'react'
import { Users, UserRoundCheck } from 'lucide-react'
import { crewStats, perLeaderText } from './crewStats.js'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const split = x => `${x.guys} guys · ${x.girls} girls${x.unknown ? ` · ${x.unknown} not set` : ''}`

// Admins: how many guy/girl leaders each crew has against the people in it.
export default function CrewCoverage({ people = [], cards = [], loading }) {
  const s = useMemo(() => crewStats(people, cards), [people, cards])
  const L = s.totals.leaders, M = s.totals.members
  const count = x => (Array.isArray(x.guys) ? { guys: x.guys.length, girls: x.girls.length, unknown: x.unknown.length } : x)

  if (loading && !people.length) {
    return <div className="home-empty home-empty-quiet"><div><span>Loading people…</span></div></div>
  }

  return (
    <div className="team-stats">
      <div className="stat-grid crew-stat-grid">
        <div className="stat stat-indigo"><UserRoundCheck size={18} />
          <span className="stat-num">{L.guys + L.girls + L.unknown}</span>
          <span className="stat-label">Leaders</span>
          <span className="stat-sub">{split(L)}</span></div>
        <div className="stat"><Users size={18} />
          <span className="stat-num">{M.guys + M.girls + M.unknown}</span>
          <span className="stat-label">In crews</span>
          <span className="stat-sub">{split(M)}</span></div>
      </div>

      {(s.heaviest || s.uncovered.length > 0) && (
        <div className="crew-callout">
          {s.uncovered.map(g => (
            <p key={g.crew + g.group}><b>{g.crew} {g.group}</b> have no {g.group === 'guys' ? 'guy' : 'girl'} leader ({plural(g.people, g.group.slice(0, -1), g.group)}).</p>
          ))}
          {s.heaviest && (
            <p>Heaviest load: <b>{s.heaviest.crew} {s.heaviest.group}</b>, {perLeaderText(s.heaviest.perLeader)} per leader
              ({plural(s.heaviest.people, s.heaviest.group.slice(0, -1), s.heaviest.group)}, {plural(s.heaviest.leaders, 'leader', 'leaders')}).</p>
          )}
        </div>
      )}

      {s.crews.filter(c => c.key !== 'unassigned').map(c => {
        const lc = count(c.leaders)
        return (
          <section className="home-section" key={c.key}>
            <div className="home-section-head">
              <h2>{c.name}</h2>
              {c.open > 0 && <span className="crew-open">{plural(c.open, 'open follow-up', 'open follow-ups')}</span>}
            </div>
            <div className="crew-card">
              <div className="crew-table" role="table" aria-label={`${c.name} leaders and people`}>
                <div className="crew-tr crew-th" role="row">
                  <span role="columnheader" />
                  <span role="columnheader">Leaders</span>
                  <span role="columnheader">People</span>
                  <span role="columnheader">Per leader</span>
                </div>
                {['guys', 'girls'].map(g => (
                  <div className="crew-tr" role="row" key={g}>
                    <span role="rowheader" className="crew-g">{g === 'guys' ? 'Guys' : 'Girls'}</span>
                    <span role="cell">{lc[g]}</span>
                    <span role="cell">{c.members[g]}</span>
                    <span role="cell" className="crew-per">
                      {c.perLeader[g] == null ? (c.members[g] ? 'No leader' : '—') : perLeaderText(c.perLeader[g])}
                    </span>
                  </div>
                ))}
              </div>
              <div className="crew-names">
                <span><b>Guys:</b> {c.leaders.guys.join(', ') || 'none'}</span>
                <span><b>Girls:</b> {c.leaders.girls.join(', ') || 'none'}</span>
                {c.leaders.unknown.length > 0 && <span><b>Gender not set:</b> {c.leaders.unknown.join(', ')}</span>}
                {c.members.unknown > 0 && <span className="crew-note">{plural(c.members.unknown, 'person has', 'people have')} no gender set in Planning Center.</span>}
              </div>
            </div>
          </section>
        )
      })}

      {(() => {
        const u = s.crews.find(c => c.key === 'unassigned')
        if (!u) return null
        const leaders = [...u.leaders.guys, ...u.leaders.girls, ...u.leaders.unknown]
        const people = u.members.guys + u.members.girls + u.members.unknown
        return (
          <section className="home-section">
            <div className="home-section-head">
              <h2>No crew set</h2>
              {u.open > 0 && <span className="crew-open">{plural(u.open, 'open follow-up', 'open follow-ups')}</span>}
            </div>
            <div className="crew-callout">
              {people > 0 && <p>{plural(people, 'person', 'people')} ({split(u.members)}) {people === 1 ? "isn't" : "aren't"} in a crew yet, so they're not counted above.</p>}
              {leaders.length > 0 && <p>{plural(leaders.length, 'leader', 'leaders')} without a crew: {leaders.join(', ')}.</p>}
            </div>
          </section>
        )
      })()}

      <p className="profile-hint">
        From each person's YA Status, Crew and gender in Planning Center. “People” counts Active and Serving;
        Archived aren't counted. Leaders count toward the crew set on their own profile.
      </p>
    </div>
  )
}
