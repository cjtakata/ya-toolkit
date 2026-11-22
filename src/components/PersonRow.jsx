import { StickyNote } from 'lucide-react'
import { LIST_META } from './listMeta.js'
import { statusClass } from './statusMeta.js'
import Avatar from './Avatar.jsx'

export default function PersonRow({ person: p, card = null, selected, onClick, currentUser }) {
  const lm = LIST_META[p.list] || { crew: p.list, badgeCls: '' }

  const hasNote = !!(p.notes && p.notes.trim())

  // Connection-card status, if this person has an open/recent card
  let cardChip = null
  if (card?.state === 'waiting')   cardChip = <div className="owner-chip owner-chip-unclaimed">Not claimed</div>
  if (card?.state === 'claimed')   cardChip = <div className={`owner-chip ${card.claimedBy === currentUser ? 'owner-chip-mine' : 'owner-chip-theirs'}`}>{card.claimedBy === currentUser ? 'Yours' : (card.claimedBy || 'Claimed').split(' ')[0]}</div>
  if (card?.state === 'contacted') cardChip = <div className="owner-chip owner-chip-done">Texted</div>

  return (
    <div className={`person-row${selected ? ' selected' : ''}`} onClick={onClick}>
      <Avatar person={p} />
      <div className="person-info">
        <div className="person-name-row">
          <span className="person-name">{p.name}</span>
          {hasNote && <StickyNote className="note-indicator" size={13} aria-label="Has a note" />}
        </div>
        <div className="person-chips">
          {p.status && <span className={`badge ${statusClass(p.status)}`}>{p.status}</span>}
          {p.list !== 'unassigned' && <span className={`badge ${lm.badgeCls}`}>{lm.crew}</span>}
        </div>
      </div>
      {cardChip && <div className="person-meta-right">{cardChip}</div>}
    </div>
  )
}
