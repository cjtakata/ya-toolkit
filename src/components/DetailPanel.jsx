import { useState, useEffect, useCallback } from 'react'
import { LIST_META } from './listMeta.js'

const CREW_FALLBACK   = ['College Life', 'Early Career', 'Young Professional']
const STATUS_FALLBACK = ['First Time Guest', 'Active', 'Missing', 'Friend', 'Alumni', 'Moved On']

// Format a US 10-digit number as (xxx)xxx-xxxx; leave anything else as-is.
function formatPhone(raw) {
  if (!raw) return raw
  const d = raw.replace(/\D/g, '')
  const ten = d.length === 11 && d[0] === '1' ? d.slice(1) : d
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
  return raw
}

const NOTE_PALETTE = [
  '#6366f1','#0ea5e9','#ec4899','#f59e0b','#10b981',
  '#8b5cf6','#ef4444','#14b8a6','#f97316','#84cc16','#a855f7','#3b82f6',
]
function authorColor(name) {
  let hash = 0
  for (const c of (name || 'Leader')) hash = (hash << 5) - hash + c.charCodeAt(0)
  return NOTE_PALETTE[Math.abs(hash) % NOTE_PALETTE.length]
}
function authorInitials(name) {
  return (name || 'Leader').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function formatNoteDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DetailPanel({ person, crewOptions = [], statusOptions = [], onClose, onSave }) {
  const crewChoices   = crewOptions.length   ? crewOptions   : CREW_FALLBACK
  const statusChoices = statusOptions.length ? statusOptions : STATUS_FALLBACK
  const [draft, setDraft]       = useState(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [copied, setCopied]     = useState(false)

  // Comment-style notes (PCO Notes under the "Young Adults" category)
  const [notes, setNotes]             = useState([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteText, setNoteText]       = useState('')
  const [posting, setPosting]         = useState(false)

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  useEffect(() => {
    if (!person) return
    setDraft({
      status:        person.status        || '',
      crew:          person.crew          || '',
      needsFollowup: person.needsFollowup ?? false,
    })
    setSaved(false)

    // Load notes for this person
    setNotes([])
    setNoteText('')
    setNotesLoading(true)
    fetch(`/api/notes?personId=${person.id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setNotes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setNotesLoading(false))
  }, [person?.id])

  async function postNote() {
    const text = noteText.trim()
    if (!text) return
    setPosting(true)
    try {
      const res = await fetch('/api/notes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ personId: person.id, body: text }),
      })
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`
        throw new Error(detail)
      }
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setNoteText('')
    } catch (err) {
      alert(`Couldn't post note:\n\n${err.message}`)
    } finally {
      setPosting(false)
    }
  }

  if (!person) {
    return (
      <div className="detail-pane hidden">
        <div className="detail-empty">
          <p>Select a person to view and edit their YA profile.</p>
        </div>
      </div>
    )
  }

  const lm       = LIST_META[person.list] || { crew: person.list, badgeCls: '' }
  const initials = person.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // Auto-save: each field persists to PCO the moment it changes.
  async function update(field, value) {
    const prev = draft[field]
    setDraft(d => ({ ...d, [field]: value }))
    setSaved(false)
    setSaving(true)
    try {
      await onSave(person.id, {
        fields:       { [field]: value },
        fieldDataIds: person._fieldDataIds || {},
        personName:   person.name,
      })
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setDraft(d => ({ ...d, [field]: prev }))   // revert on failure
      setSaving(false)
      alert(`Couldn't save to PCO:\n\n${err.message}`)
    }
  }

  if (!draft) return null

  return (
    <div className={`detail-pane${window.innerWidth <= 700 ? ' open' : ''}`}>
      <div className="detail-header">
        <div className="detail-header-top">
          <div className="detail-person">
            <div className="detail-avatar" style={{ background: person.color }}>
              {person.avatar ? <img src={person.avatar} alt={initials} /> : initials}
            </div>
            <div>
              <div className="detail-name">{person.name}</div>
              {person.email
                ? <a className="detail-email" href={`mailto:${person.email}`} title={`Email ${person.email}`}>
                    {person.email}
                  </a>
                : <div className="detail-email">No email on file</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`copy-link-btn${copied ? ' copied' : ''}`} onClick={handleCopyLink} title="Copy link to this profile">
              {copied ? '✓ Copied' : '🔗 Copy Link'}
            </button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a
            className="pco-link"
            href={`https://people.planningcenteronline.com/people/AC${person.id}`}
            target="_blank"
            rel="noreferrer"
          >
            ↗ View in PCO
          </a>
          {person.list !== 'unassigned' && <span className={`badge ${lm.badgeCls}`}>{lm.crew}</span>}
        </div>
      </div>

      <div className="detail-body">
        {/* PCO read-only info */}
        <div>
          <div className="field-section-title">From Planning Center</div>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-item-label">Phone</div>
              <div className="info-item-value">
                {person.phone
                  ? <a className="info-link" href={`sms:${person.phone.replace(/[^\d+]/g, '')}`}>{formatPhone(person.phone)}</a>
                  : '—'}
              </div>
            </div>
            <div className="info-item">
              <div className="info-item-label">Age</div>
              <div className="info-item-value">{person.age ?? '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-item-label">Member since</div>
              <div className="info-item-value">{person.since || '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-item-label">Gender</div>
              <div className="info-item-value">{person.gender || '—'}</div>
            </div>
          </div>
        </div>

        {/* YA Details custom fields */}
        <div>
          <div className="field-section-title" style={{ justifyContent: 'space-between' }}>
            <span>YA Details</span>
            {saving ? <span className="save-indicator saving">Saving…</span>
              : saved ? <span className="save-indicator saved">✓ Saved</span>
              : null}
          </div>

          <div className="field-row">
            <div>
              <div className="field-label">Needs Follow-Up?</div>
              <div className="field-sub">Flag this person for a follow-up conversation</div>
            </div>
            <button
              className={`toggle ${draft.needsFollowup ? 'on' : 'off'}`}
              onClick={() => update('needsFollowup', !draft.needsFollowup)}
            />
          </div>

          <div className="field-stack-wrap">
            <div className="field-stack">
              <div className="field-label">YA Status</div>
              <select
                className="field-select"
                value={draft.status}
                onChange={e => update('status', e.target.value)}
              >
                <option value="">— Not set —</option>
                {statusChoices.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-stack-wrap">
            <div className="field-stack">
              <div className="field-label">Crew</div>
              <select
                className="field-select"
                value={draft.crew}
                onChange={e => update('crew', e.target.value)}
              >
                <option value="">— Not assigned —</option>
                {crewChoices.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Comment-style notes → PCO Notes under "Young Adults" */}
        <div className="notes-section">
          <div className="field-section-title" style={{ justifyContent: 'space-between' }}>
            <span>Notes</span>
            {notes.length > 0 && <span className="notes-count">{notes.length}</span>}
          </div>

          <div className="note-compose">
            <textarea
              className="note-compose-input"
              placeholder="Add a note…"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
            />
            <button
              className="note-compose-btn"
              onClick={postNote}
              disabled={posting || !noteText.trim()}
            >
              {posting ? '…' : 'Post'}
            </button>
          </div>

          {notesLoading ? (
            <div className="notes-empty">Loading notes…</div>
          ) : notes.length === 0 ? (
            <div className="notes-empty">No notes yet. Add the first one above.</div>
          ) : (
            <div className="notes-list">
              {notes.map(n => (
                <div className="note-item" key={n.id}>
                  <div className="note-avatar" style={{ background: authorColor(n.author) }}>
                    {authorInitials(n.author)}
                  </div>
                  <div className="note-bubble">
                    <div className="note-meta">
                      <span className="note-author">{n.author || 'Leader'}</span>
                      <span className="note-time">{formatNoteDate(n.createdAt)}</span>
                    </div>
                    <div className="note-body">{n.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
