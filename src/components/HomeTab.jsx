import { useMemo } from 'react'
import { UserRoundSearch, Hand, TriangleAlert, Sparkles, PartyPopper, ChevronRight } from 'lucide-react'
import PersonRow from './PersonRow.jsx'
import { CREW_LABEL } from './listMeta.js'

const PREVIEW = 6   // rows shown per section before "See all"

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// Home: summary for the leader's crew + who is waiting on a follow-up.
export default function HomeTab({
  people, myCrew = 'all', currentUser, selectedId, onSelect, onSeeAll, onChangeCrew,
}) {
  const scoped = useMemo(
    () => (myCrew && myCrew !== 'all') ? people.filter(p => p.list === myCrew) : people,
    [people, myCrew],
  )

  const s = useMemo(() => {
    const needs     = scoped.filter(p => p.needsFollowup)
    const unclaimed = needs.filter(p => !(p.assignedLeader || '').trim())
    const mine      = needs.filter(p => p.assignedLeader === currentUser)
    const ftg       = scoped.filter(p => p.status === 'First Time Guest')
    const byName = (a, b) => a.name.localeCompare(b.name)
    return {
      total: scoped.length,
      needs: needs.length,
      unclaimed: [...unclaimed].sort(byName),
      mine: [...mine].sort(byName),
      ftg: ftg.length,
    }
  }, [scoped, currentUser])

  const first     = (currentUser || '').split(' ')[0] || 'there'
  const crewLabel = myCrew && myCrew !== 'all' ? CREW_LABEL[myCrew] : 'All crews'

  return (
    <div className="home-scroll">
      <div className="home-inner">
        <header className="home-head">
          <div className="home-hello">{greeting()}, {first}</div>
          <button className="home-scope" onClick={onChangeCrew}>
            {crewLabel} · {s.total} people <ChevronRight size={14} />
          </button>
        </header>

        <div className="stat-grid">
          <button className="stat stat-amber" onClick={() => onSeeAll({ followup: 'unclaimed' })}>
            <UserRoundSearch size={18} />
            <span className="stat-num">{s.unclaimed.length}</span>
            <span className="stat-label">Waiting to be claimed</span>
          </button>
          <button className="stat stat-indigo" onClick={() => document.getElementById('home-mine')?.scrollIntoView({ behavior: 'smooth' })}>
            <Hand size={18} />
            <span className="stat-num">{s.mine.length}</span>
            <span className="stat-label">Claimed by you</span>
          </button>
          <button className="stat" onClick={() => onSeeAll({ followup: 'needs' })}>
            <TriangleAlert size={18} />
            <span className="stat-num">{s.needs}</span>
            <span className="stat-label">Need follow-up</span>
          </button>
          <button className="stat stat-rose" onClick={() => onSeeAll({ status: 'First Time Guest' })}>
            <Sparkles size={18} />
            <span className="stat-num">{s.ftg}</span>
            <span className="stat-label">First-time guests</span>
          </button>
        </div>

        <section className="home-section">
          <div className="home-section-head">
            <h2>Awaiting a leader</h2>
            {s.unclaimed.length > 0 && (
              <button className="home-link" onClick={() => onSeeAll({ followup: 'unclaimed' })}>
                See all{s.unclaimed.length > PREVIEW ? ` ${s.unclaimed.length}` : ''}
              </button>
            )}
          </div>
          {s.unclaimed.length === 0 ? (
            <div className="home-empty">
              <PartyPopper size={22} />
              <div>
                <strong>Every follow-up has an owner.</strong>
                <span>Nobody in {crewLabel === 'All crews' ? 'any crew' : crewLabel} is waiting.</span>
              </div>
            </div>
          ) : (
            <div className="home-list">
              {s.unclaimed.slice(0, PREVIEW).map(p => (
                <PersonRow key={p.id} person={p} selected={p.id === selectedId}
                  onClick={() => onSelect(p.id)} currentUser={currentUser} />
              ))}
            </div>
          )}
        </section>

        <section className="home-section" id="home-mine">
          <div className="home-section-head">
            <h2>Your follow-ups</h2>
          </div>
          {s.mine.length === 0 ? (
            <div className="home-empty home-empty-quiet">
              <div>
                <strong>You haven't claimed anyone.</strong>
                <span>Open someone above and tap “Claim this follow-up”.</span>
              </div>
            </div>
          ) : (
            <div className="home-list">
              {s.mine.map(p => (
                <PersonRow key={p.id} person={p} selected={p.id === selectedId}
                  onClick={() => onSelect(p.id)} currentUser={currentUser} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
