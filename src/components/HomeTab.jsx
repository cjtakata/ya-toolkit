import usePullToRefresh from './usePullToRefresh.jsx'
import { useMemo, useState } from 'react'
import { UserRoundSearch, Hand, Clock, MessageCircleHeart, PartyPopper, RefreshCw, AlarmClock, ChevronRight } from 'lucide-react'
import CardRow from './CardRow.jsx'
import { overdueLevel } from './cardMeta.js'
import { CREW_LABEL } from './listMeta.js'

const PREVIEW = 6


function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// A guest belongs to the chosen crew if it's theirs or they have no crew yet.
export const inCrew = (c, myCrew) =>
  !myCrew || myCrew === 'all' || c.person.list === myCrew || c.person.list === 'unassigned'

const byOldest = key => (a, b) => (a[key] || '').localeCompare(b[key] || '')
const byNewest = key => (a, b) => (b[key] || '').localeCompare(a[key] || '')

// Home: connection-card follow-up for the leader's crew.
//   Who filled out a card → who claimed them → have they been texted?
export default function HomeTab({
  greetName, cards, cardsError, cardsLoading, onRefresh, myCrew = 'all', currentUser,
  selectedId, onSelect, onSeeAll, onClaim, busyCard, onPullRefresh,
}) {
  const ptr = usePullToRefresh(onPullRefresh)
  const [showAllDone, setShowAllDone] = useState(false)

  // What Home shows for the chosen crew: that crew's guests, plus guests with no
  // crew yet (otherwise nobody's Home shows them), plus anyone this leader claimed
  // or texted, whatever their crew. Your own guests never drop off your Home.
  const s = useMemo(() => {
    const isMine = c => (c.state === 'claimed' && c.claimedBy === currentUser) ||
                        (c.state === 'contacted' && c.contactedBy === currentUser)
    const shown  = c => isMine(c) || inCrew(c, myCrew)
    const scoped = cards.filter(shown)
    const waiting   = scoped.filter(c => c.state === 'waiting').sort(byOldest('submittedAt'))
    const claimed   = scoped.filter(c => c.state === 'claimed')
    const mine      = claimed.filter(c => c.claimedBy === currentUser).sort(byOldest('claimedAt'))
    const others    = claimed.filter(c => c.claimedBy !== currentUser).sort(byOldest('claimedAt'))
    const contacted = scoped.filter(c => c.state === 'contacted').sort(byNewest('contactedAt'))
    const late   = [...waiting, ...mine, ...others].filter(c => overdueLevel(c))
    const urgent = late.filter(c => overdueLevel(c) === 'urgent').length
    // Tile jumps to the first section holding an overdue guest.
    const lateAt = [['home-waiting', waiting], ['home-mine', mine], ['home-others', others]]
      .find(([, list]) => list.some(c => overdueLevel(c)))?.[0]
    return { waiting, mine, others, contacted, late: late.length, urgent, lateAt }
  }, [cards, myCrew, currentUser])

  const crewLabel = myCrew && myCrew !== 'all' ? CREW_LABEL[myCrew] : 'All crews'
  const first     = (currentUser || '').split(' ')[0] || 'there'
  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const row = c => (
    <CardRow key={c.cardId} card={c} currentUser={currentUser}
      selected={c.personId === selectedId} onOpen={() => onSelect(c.personId)}
      onClaim={onClaim} busy={busyCard === c.cardId} />
  )

  return (
    <div className="home-scroll" ref={ptr.ref}>
      {ptr.indicator}
      <div className="home-inner">
        <header className="section-head">
          <h1 className="section-title">{greeting()}, {greetName || first}</h1>
        </header>


        <div className="stat-grid">
          {s.late > 0 && (
            <button className={`stat stat-overdue${s.urgent ? ' stat-overdue-urgent' : ''}`} onClick={() => jump(s.lateAt)}>
              <AlarmClock size={20} />
              <span className="stat-overdue-text">
                <span className="stat-num">{s.late}</span>
                <span className="stat-label">
                  {s.late === 1 ? 'guest' : 'guests'} overdue · not texted 24h+ after their card
                  {s.urgent > 0 && <b> · {s.urgent} over 48h</b>}
                </span>
              </span>
              <ChevronRight size={18} className="stat-overdue-go" />
            </button>
          )}
          <button className="stat stat-amber" onClick={() => jump('home-waiting')}>
            <UserRoundSearch size={18} />
            <span className="stat-num">{s.waiting.length}</span>
            <span className="stat-label">Not claimed</span>
          </button>
          <button className="stat stat-indigo" onClick={() => jump('home-mine')}>
            <Hand size={18} />
            <span className="stat-num">{s.mine.length}</span>
            <span className="stat-label">Yours to text</span>
          </button>
          <button className="stat" onClick={() => jump('home-others')}>
            <Clock size={18} />
            <span className="stat-num">{s.others.length}</span>
            <span className="stat-label">Claimed by others</span>
          </button>
          <button className="stat stat-green" onClick={() => jump('home-done')}>
            <MessageCircleHeart size={18} />
            <span className="stat-num">{s.contacted.length}</span>
            <span className="stat-label">Texted · 30 days</span>
          </button>
        </div>

        {cardsError && (
          <div className="home-error">
            Couldn't load connection cards from Planning Center.
            <button className="home-link" onClick={onRefresh}><RefreshCw size={13} /> Try again</button>
          </div>
        )}

        <section className="home-section" id="home-waiting">
          <div className="home-section-head">
            <h2>New cards · not claimed</h2>
            {s.waiting.length > PREVIEW && (
              <button className="home-link" onClick={() => onSeeAll({ card: 'waiting' })}>See all {s.waiting.length}</button>
            )}
          </div>
          {cardsLoading && !cards.length ? (
            <div className="home-empty home-empty-quiet"><div><span>Loading connection cards…</span></div></div>
          ) : s.waiting.length === 0 ? (
            <div className="home-empty">
              <PartyPopper size={22} />
              <div>
                <strong>Every new card has a leader.</strong>
                <span>Nobody{crewLabel === 'All crews' ? '' : ` in ${crewLabel}`} is waiting to be claimed.</span>
              </div>
            </div>
          ) : (
            <div className="home-list">{s.waiting.slice(0, PREVIEW).map(row)}</div>
          )}
        </section>

        <section className="home-section" id="home-mine">
          <div className="home-section-head"><h2>Yours to text</h2></div>
          {s.mine.length === 0 ? (
            <div className="home-empty home-empty-quiet">
              <div>
                <strong>Nobody waiting on you.</strong>
                <span>Claim someone above, then text them from their profile.</span>
              </div>
            </div>
          ) : (
            <div className="home-list">{s.mine.map(row)}</div>
          )}
        </section>

        <section className="home-section" id="home-others">
          <div className="home-section-head"><h2>Claimed by others · not texted yet</h2></div>
          {s.others.length === 0 ? (
            <div className="home-empty home-empty-quiet"><div><span>No guests waiting on another leader.</span></div></div>
          ) : (
            <div className="home-list">{s.others.map(row)}</div>
          )}
        </section>

        <section className="home-section" id="home-done">
          <div className="home-section-head">
            <h2>Texted · last 30 days</h2>
            {s.contacted.length > PREVIEW && (
              <button className="home-link" onClick={() => setShowAllDone(v => !v)}>
                {showAllDone ? 'Show less' : `Show all ${s.contacted.length}`}
              </button>
            )}
          </div>
          {s.contacted.length === 0 ? (
            <div className="home-empty home-empty-quiet"><div><span>No guests texted in the last 30 days yet.</span></div></div>
          ) : (
            <div className="home-list">{(showAllDone ? s.contacted : s.contacted.slice(0, PREVIEW)).map(row)}</div>
          )}
        </section>
      </div>
    </div>
  )
}
