import { LIST_META } from './listMeta.js'
import { statusClass } from './statusMeta.js'

export default function PersonRow({ person: p, selected, onClick }) {
  const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const lm = LIST_META[p.list] || { crew: p.list, badgeCls: '' }

  const g = (p.gender || '').trim().toLowerCase()
  const genderTag = g === 'male' ? 'M' : g === 'female' ? 'F' : null
  const hasNote = !!(p.notes && p.notes.trim())

  return (
    <div className={`person-row${selected ? ' selected' : ''}`} onClick={onClick}>
      <div className="avatar" style={{ background: p.color }}>
        {p.avatar ? <img src={p.avatar} alt={initials} /> : initials}
      </div>
      <div className="person-info">
        <div className="person-name-row">
          <span className="person-name">{p.name}</span>
          {hasNote && <span className="note-indicator" title="Has a note">📝</span>}
        </div>
        <div className="person-chips">
          {p.status && <span className={`badge ${statusClass(p.status)}`}>{p.status}</span>}
          <span className={`badge ${lm.badgeCls}`}>{lm.crew}</span>
          {genderTag && <span className="badge badge-gender">{genderTag}</span>}
        </div>
      </div>
      <div className="person-meta-right">
        <div
          className={`followup-dot ${p.needsFollowup ? 'pending' : 'done'}`}
          title={p.needsFollowup ? 'Needs follow-up' : 'No follow-up needed'}
        />
        <div className="followup-label">{p.needsFollowup ? 'Follow up' : ''}</div>
      </div>
    </div>
  )
}
