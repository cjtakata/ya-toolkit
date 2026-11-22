import { StickyNote } from 'lucide-react'
import { LIST_META } from './listMeta.js'
import { statusClass } from './statusMeta.js'

export default function PersonRow({ person: p, card = null, selected, onClick, currentUser }) {
  const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const lm = LIST_META[p.list] || { crew: p.list, badgeCls: '' }

  const g = (p.gender || '').trim().toLowerCase()
  const genderTag = g === 'male' ? 'M' : g === 'female' ? 'F' : null
  const hasNote = !!(p.notes && p.notes.trim())

  // Connection-card status, if this person has an open/recent card
  let cardChip = null
  if (card?.state === 'waiting')   cardChip = <div className="owner-chip owner-chip-unclaimed">Not claimed</div>
  if (card?.state === 'claimed')   cardChip = <div className={`owner-chip ${card.claimedBy === currentUser ? 'owner-chip-mine' : 'owner-chip-theirs'}`}>{card.claimedBy === currentUser ? 'Yours' : (card.claimedBy || 'Claimed').split(' ')[0]}</div>
  if (card?.state === 'contacted') cardChip = <div className="owner-chip owner-chip-done">Texted</div>

  return (
    <div className={`person-row${selected ? ' selected' : ''}`} onClick={onClick}>
      <div className="avatar" style={{ background: p.color }}>
        {p.avatar ? <img src={p.avatar} alt={initials} /> : initials}
      </div>
      <div className="person-info">
        <div className="person-name-row">
          <span className="person-name">{p.name}</span>
          {hasNote && <StickyNote className="note-indicator" size={13} aria-label="Has a note" />}
        </div>
        <div className="person-chips">
          {p.status && <span className={`badge ${statusClass(p.status)}`}>{p.status}</span>}
          {p.list !== 'unassigned' && <span className={`badge ${lm.badgeCls}`}>{lm.crew}</span>}
          {genderTag && <span className="badge badge-gender">{genderTag}</span>}
        </div>
      </div>
      {cardChip && <div className="person-meta-right">{cardChip}</div>}
    </div>
  )
}
