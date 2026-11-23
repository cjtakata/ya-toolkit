import { LIST_META } from './listMeta.js'
import { timeAgo, duration, hoursSince } from './cardMeta.js'
import Avatar from './Avatar.jsx'

// One connection-card guest: who, when the card came in, and where follow-up stands.
export default function CardRow({ card, currentUser, selected, onOpen, onClaim, busy }) {
  const p  = card.person
  const lm = LIST_META[p.list]
  const mine = card.claimedBy && card.claimedBy === currentUser

  let line, warn = false
  if (card.state === 'waiting') {
    line = `Card ${timeAgo(card.submittedAt)}`
    warn = hoursSince(card.submittedAt) > 24
  } else if (card.state === 'claimed') {
    line = `${mine ? 'You' : card.claimedBy || 'A leader'} claimed ${timeAgo(card.claimedAt)}`
    warn = hoursSince(card.claimedAt) > 48
  } else {
    line = `Texted by ${card.contactedBy === currentUser ? 'you' : card.contactedBy || 'a leader'} · ${duration(card.submittedAt, card.contactedAt)} after card`
  }

  return (
    <div className={`person-row card-row${selected ? ' selected' : ''}`} onClick={onOpen}>
      <Avatar person={p} />
      <div className="person-info">
        <div className="person-name-row">
          <span className="person-name">{p.name}</span>
        </div>
        <div className="card-meta">
          {lm && <span className={`badge ${lm.badgeCls}`}>{lm.crew}</span>}
          <span className={`card-line${warn ? ' warn' : ''}`}>{line}</span>
        </div>
      </div>
      {card.state === 'waiting' && onClaim && (
        <button className="row-claim" disabled={busy}
          onClick={e => { e.stopPropagation(); onClaim(card) }}>
          {busy ? '…' : 'Claim'}
        </button>
      )}
      {card.state === 'claimed' && mine && <span className="owner-chip owner-chip-mine">Yours</span>}
      {card.state === 'contacted' && <span className="owner-chip owner-chip-done">Texted</span>}
    </div>
  )
}
