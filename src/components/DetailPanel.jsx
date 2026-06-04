import { useState, useEffect, useCallback } from 'react'
import { LIST_META } from './listMeta.js'

const CREW_FALLBACK   = ['College Life', 'Early Career', 'Young Professionals']
const STATUS_FALLBACK = ['Active', 'Missing', 'Friend', 'Alumni', 'Moved On']

// Format a US 10-digit number as (xxx)xxx-xxxx; leave anything else as-is.
function formatPhone(raw) {
  if (!raw) return raw
  const d = raw.replace(/\D/g, '')
  const ten = d.length === 11 && d[0] === '1' ? d.slice(1) : d
  if (ten.length === 10) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
  return raw
}

export default function DetailPanel({ person, crewOptions = [], statusOptions = [], onClose, onSave }) {
  const crewChoices   = crewOptions.length   ? crewOptions   : CREW_FALLBACK
  const statusChoices = statusOptions.length ? statusOptions : STATUS_FALLBACK
  const [draft, setDraft]       = useState(null)
  const [unsaved, setUnsaved]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [copied, setCopied]     = useState(false)

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
      notes:         person.notes         || '',
    })
    setUnsaved(false)
    setSaved(false)
  }, [person?.id])

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

  function update(field, value) {
    setDraft(d => ({ ...d, [field]: value }))
    setUnsaved(true)
    setSaved(false)
  }

  async function handleSave() {
    // Diff against the loaded values — only send fields that actually changed,
    // so we never re-write (or clobber) a field the leader didn't touch.
    const original = {
      status:        person.status        || '',
      crew:          person.crew          || '',
      needsFollowup: person.needsFollowup ?? false,
      notes:         person.notes         || '',
    }
    const changed = {}
    for (const k of ['status', 'crew', 'needsFollowup', 'notes']) {
      if (draft[k] !== original[k]) changed[k] = draft[k]
    }

    if (Object.keys(changed).length === 0) {
      setUnsaved(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return
    }

    setSaving(true)
    try {
      await onSave(person.id, {
        fields:       changed,
        fieldDataIds: person._fieldDataIds || {},
        personName:   person.name,
      })
      setUnsaved(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert(`Couldn't save to PCO:\n\n${err.message}`)
    } finally {
      setSaving(false)
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
          <span className={`badge ${lm.badgeCls}`}>{lm.crew}</span>
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
          <div className="field-section-title">
            YA Details
            <span className={`unsaved-dot${unsaved ? ' show' : ''}`} />
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

          <div className="field-stack-wrap" style={{ borderBottom: 'none' }}>
            <div className="field-stack">
              <div className="field-label">YA Notes</div>
              <textarea
                className="field-textarea"
                placeholder="Notes visible to all leaders…"
                value={draft.notes}
                onChange={e => update('notes', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="detail-footer">
        <button className="btn-cancel" onClick={onClose}>Cancel</button>
        <button
          className={`btn-save${saved ? ' saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save to PCO'}
        </button>
      </div>
    </div>
  )
}
