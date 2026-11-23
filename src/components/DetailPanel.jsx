import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { Check, Link2, ChevronLeft, ExternalLink, Flag, UserCheck, User, MessageCircle, Inbox, Hand, Undo2, CircleCheck, CircleMinus, Workflow, ShieldCheck } from 'lucide-react'
import { LIST_META } from './listMeta.js'
import PickerRow from './PickerRow.jsx'
import Avatar from './Avatar.jsx'
import { timeAgo, duration, shortDate, renderMessage, smsHref } from './cardMeta.js'
import { mentionTargets, activeQuery, matchTargets, mentionsInText, splitMentions } from './mentions.js'

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

export default function DetailPanel({ person, crewOptions = [], statusOptions = [], currentUser, textTemplate = '', leaderFirst = '', backLabel = 'Back', variant = 'pane', card = null, onCardAction, isAdmin = false, leaders = [], onClose, onSave }) {
  const isSheet = variant === 'sheet'   // phones: shown inside a slide-up Sheet
  const crewChoices   = crewOptions.length   ? crewOptions   : CREW_FALLBACK
  const statusChoices = statusOptions.length ? statusOptions : STATUS_FALLBACK
  const [draft, setDraft]       = useState(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [copied, setCopied]     = useState(false)

  // Comment-style notes (PCO Notes under the "Young Adults" category)
  const [notes, setNotes]             = useState([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [noteText, setNoteText]       = useState('')
  const [posting, setPosting]         = useState(false)
  // @mentions: what's been picked, the "@query" being typed, the highlighted suggestion
  const noteRef = useRef(null)
  const pendingCaret = useRef(null)
  const [picked, setPicked]           = useState([])
  const [mq, setMq]                   = useState(null)
  const [mIndex, setMIndex]           = useState(0)
  const [notice, setNotice]           = useState('')
  const targets = useMemo(() => mentionTargets(leaders), [leaders])
  const suggestions = mq ? matchTargets(targets, mq.query) : []
  // After inserting a mention, put the caret right after it before the next keystroke
  useLayoutEffect(() => {
    const el = noteRef.current
    if (el && pendingCaret.current != null) {
      el.focus()
      el.setSelectionRange(pendingCaret.current, pendingCaret.current)
      pendingCaret.current = null
    }
  }, [noteText])
  const [cardBusy, setCardBusy]       = useState(false)
  const [confirmText, setConfirmText] = useState(false)   // "Did you send it?" after opening Messages

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
    })
    setSaved(false)

    // Load notes for this person
    setNotes([])
    setShowAllActivity(false)
    setNoteText('')
    setPicked([])
    setMq(null)
    setNotice('')
    setConfirmText(false)
    loadFeed()
  }, [person?.id])

  // Notes + follow-up workflow history, newest first
  function loadFeed() {
    if (!person) return
    setNotesLoading(true)
    const id = person.id
    return fetch(`/api/notes?personId=${id}&history=1`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (id === person.id) setNotes(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => setNotesLoading(false))
  }

  async function postNote() {
    const text = noteText.trim()
    if (!text) return
    setPosting(true)
    try {
      const res = await fetch('/api/notes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ personId: person.id, body: text, mentions: mentionsInText(text, picked) }),
      })
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))).error || `HTTP ${res.status}`
        throw new Error(detail)
      }
      const note = await res.json()
      setNotes(prev => [note, ...prev])
      setNoteText('')
      setPicked([])
      setMq(null)
      const who = [...(note.notified?.leaders || []), ...(note.notified?.crews || []).map(c => `${c} leaders`)]
      if (who.length) {
        setNotice(note.notified.sent ? `Texting ${listJoin(who)}` : `Note saved, but the text to ${listJoin(who)} didn't go out`)
        setTimeout(() => setNotice(''), 5000)
      }
    } catch (err) {
      alert(`Couldn't post note:\n\n${err.message}`)
    } finally {
      setPosting(false)
    }
  }

  function onNoteChange(e) {
    setNoteText(e.target.value)
    setMq(activeQuery(e.target.value, e.target.selectionStart))
    setMIndex(0)
  }
  function pickMention(t) {
    const el = noteRef.current
    const caret = el ? el.selectionStart : noteText.length
    const insert = `@${t.label} `
    const next = noteText.slice(0, mq.start) + insert + noteText.slice(caret)
    pendingCaret.current = mq.start + insert.length
    setNoteText(next)
    setPicked(p => [...p, t])
    setMq(null)
  }
  function onNoteKeyDown(e) {
    if (!mq || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setMIndex(i => (i + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMIndex(i => (i - 1 + suggestions.length) % suggestions.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(suggestions[mIndex]) }
    else if (e.key === 'Escape') { e.preventDefault(); setMq(null) }
  }

  async function cardAction(action, extra) {
    if (!card || !onCardAction) return
    setCardBusy(true)
    try {
      await onCardAction(card, action, extra)
      loadFeed()                       // show the new claim / text in the history
    } catch (err) {
      alert(err.message)
    } finally {
      setCardBusy(false)
      setConfirmText(false)
    }
  }

  const noteCount = notes.filter(n => n.kind !== 'workflow').length

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
    <div className={isSheet ? 'detail-sheet' : 'detail-pane'}>
      <div className="detail-header">
        {!isSheet && (
          <div className="detail-nav">
            <button className="back-btn" onClick={onClose}>
              <ChevronLeft size={20} strokeWidth={2.4} />{backLabel}
            </button>
          </div>
        )}
        <div className="detail-header-top">
          {/* On phones Done sits inline at the top right of this row (no row of its own) */}
          <div className="detail-person" {...(isSheet ? { 'data-sheet-handle': true } : {})}>
            <Avatar person={person} className="detail-avatar" />
            <div>
              <div className="detail-name">{person.name}</div>
              {person.email
                ? <a className="detail-email" href={`mailto:${person.email}`} title={`Email ${person.email}`}>
                    {person.email}
                  </a>
                : <div className="detail-email">No email on file</div>}
            </div>
          </div>
          {isSheet && <button className="sheet-done-inline detail-done" onClick={onClose}>Done</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            className="pco-link"
            href={`https://people.planningcenteronline.com/people/AC${person.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={13} />View in PCO
          </a>
          <button className={`copy-link-btn${copied ? ' copied' : ''}`} onClick={handleCopyLink} title="Copy link to this profile">
            {copied ? <><Check size={13} />Copied</> : <><Link2 size={13} />Copy Link</>}
          </button>
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

        {card && (
          <CardSection
            card={card} person={person} currentUser={currentUser} textTemplate={textTemplate} leaderFirst={leaderFirst} busy={cardBusy}
            confirming={confirmText} onTextOpened={() => setConfirmText(true)}
            onAction={cardAction} onCancelConfirm={() => setConfirmText(false)}
          />
        )}
        {card && isAdmin && !confirmText && (
          <AdminCardTools key={card.cardId} card={card} person={person} leaders={leaders}
            currentUser={currentUser} busy={cardBusy} onAction={cardAction} />
        )}

        {/* YA Details custom fields */}
        <div>
          <div className="field-section-title" style={{ justifyContent: 'space-between' }}>
            <span>YA Details</span>
            {saving ? <span className="save-indicator saving">Saving…</span>
              : saved ? <span className="save-indicator saved"><Check size={12} />Saved</span>
              : null}
          </div>

          <div className="picker-group">
            <PickerRow label="YA Status" value={draft.status} options={statusChoices}
              emptyLabel="Not set" onChange={v => update('status', v)} />
            <PickerRow label="Crew" value={draft.crew} options={crewChoices}
              emptyLabel="Not assigned" onChange={v => update('crew', v)} />
          </div>
        </div>

        {/* Comment-style notes → PCO Notes under "Young Adults" */}
        <div className="notes-section">
          <div className="field-section-title" style={{ justifyContent: 'space-between' }}>
            <span>Notes & history</span>
            {noteCount > 0 && <span className="notes-count">{noteCount}</span>}
          </div>

          <div className="note-compose">
            <textarea
              ref={noteRef}
              className="note-compose-input"
              placeholder="Add a note… type @ to text a leader or crew"
              value={noteText}
              onChange={onNoteChange}
              onKeyDown={onNoteKeyDown}
              onBlur={() => setTimeout(() => setMq(null), 150)}
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
            />
            {suggestions.length > 0 && (
              <ul className="mention-menu" role="listbox">
                {suggestions.map((t, i) => (
                  <li key={t.type + (t.id || t.key)} role="option" aria-selected={i === mIndex}
                    className={`mention-option${i === mIndex ? ' active' : ''}`}
                    onMouseDown={e => { e.preventDefault(); pickMention(t) }}>
                    <span className="mention-option-label">@{t.label}</span>
                    <span className="mention-option-sub">{t.sub}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="note-compose-btn"
              onClick={postNote}
              disabled={posting || !noteText.trim()}
            >
              {posting ? '…' : 'Post'}
            </button>
          </div>

          {notice && <div className="mention-notice">{notice}</div>}

          {notesLoading ? (
            <div className="notes-empty">Loading notes…</div>
          ) : notes.length === 0 ? (
            <div className="notes-empty">No notes yet. Add the first one above.</div>
          ) : (
            <div className="notes-list">
              {(showAllActivity ? notes : notes.slice(0, FEED_PREVIEW)).map(n => n.kind === 'workflow'
                ? <HistoryItem key={n.id} item={n} currentUser={currentUser} />
                : <NoteItem key={n.id} note={n} currentUser={currentUser} targets={targets} />)}
              {notes.length > FEED_PREVIEW && (
                <button className="feed-more" onClick={() => setShowAllActivity(v => !v)}>
                  {showAllActivity ? 'Show less' : `View all activity (${notes.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Connection card: claimed? texted? ──────────────────────────────
function CardSection({ card, person, currentUser, textTemplate, leaderFirst, busy, confirming, onTextOpened, onAction, onCancelConfirm }) {
  const mine     = card.claimedBy && card.claimedBy === currentUser
  const first    = person.name.split(' ')[0]
  const crewName = (person.crew || '').trim()
  const body     = renderMessage(textTemplate, { guestFirst: first, leaderFirst: leaderFirst || (currentUser || '').split(' ')[0], crew: crewName })
  const submitted = `Card ${shortDate(card.submittedAt)} · ${timeAgo(card.submittedAt)}`

  // Already texted them from your own phone? "Mark as texted" skips Messages
  // and goes straight to the same "Did you send the text?" confirm.
  const textButton = person.phone ? (
    <div className="fu-btn-row">
      <a className="fu-log fu-log-mine fu-text-btn" href={smsHref(person.phone, body)} onClick={onTextOpened}>
        <MessageCircle size={16} /> Text {first}
      </a>
      <button className="fu-btn-takeover fu-btn-marktexted" onClick={onTextOpened} disabled={busy}>
        <Check size={15} strokeWidth={3} /> Mark as texted
      </button>
    </div>
  ) : (
    <div className="fu-sub">No phone number on file. Reached them another way?
      <button className="fu-inline-link" onClick={() => onAction('texted')} disabled={busy}>Mark as contacted</button>
    </div>
  )

  if (confirming) return (
    <div className="fu-card fu-card-mine">
      <div className="fu-head">
        <MessageCircle className="fu-icon fu-icon-mine" size={22} />
        <div>
          <div className="fu-title">Did you send the text to {first}?</div>
          <div className="fu-sub">We'll mark {first} as contacted. Only the time is saved, not your message.</div>
        </div>
      </div>
      <div className="fu-btn-row">
        <button className="fu-log fu-log-mine" onClick={() => onAction('texted')} disabled={busy}>
          {busy ? '…' : 'Yes, I sent it'}
        </button>
        <button className="fu-btn-release" onClick={onCancelConfirm} disabled={busy}>Not yet</button>
      </div>
    </div>
  )

  if (card.state === 'contacted') return (
    <div className="fu-card fu-card-done">
      <div className="fu-head">
        <Check className="fu-icon fu-icon-done" size={22} strokeWidth={3} />
        <div>
          <div className="fu-title">Texted by {card.contactedBy === currentUser ? 'you' : card.contactedBy || 'a leader'}</div>
          <div className="fu-sub">{shortDate(card.contactedAt)} · {duration(card.submittedAt, card.contactedAt)} after their connection card</div>
        </div>
      </div>
    </div>
  )

  if (card.state === 'waiting') return (
    <div className="fu-card">
      <div className="fu-head">
        <Flag className="fu-icon" />
        <div>
          <div className="fu-title">New connection card</div>
          <div className="fu-sub">{submitted} · not claimed yet</div>
        </div>
      </div>
      <button className="fu-log" onClick={() => onAction('claim')} disabled={busy}>
        {busy ? '…' : `Claim ${first}`}
      </button>
    </div>
  )

  if (mine) return (
    <div className="fu-card fu-card-mine">
      <div className="fu-head">
        <UserCheck className="fu-icon fu-icon-mine" size={22} />
        <div style={{ flex: 1 }}>
          <div className="fu-title">Claimed by you</div>
          <div className="fu-sub">{timeAgo(card.claimedAt)} · {submitted}</div>
        </div>
        <button className="fu-btn-release" onClick={() => onAction('release')} disabled={busy}>Release</button>
      </div>
      {textButton}
    </div>
  )

  return (
    <div className="fu-card fu-card-theirs">
      <div className="fu-head">
        <User className="fu-icon fu-icon-theirs" size={22} />
        <div>
          <div className="fu-title">Claimed by {card.claimedBy || 'another leader'}</div>
          <div className="fu-sub">{timeAgo(card.claimedAt)} · they're planning to text {first}</div>
        </div>
      </div>
    </div>
  )
}


// ── Admin only: assign a leader / remove from follow-up ─────────────
function AdminCardTools({ card, person, leaders, currentUser, busy, onAction }) {
  const [leaderId, setLeaderId] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const first = person.name.split(' ')[0]
  const open  = card.state === 'waiting' || card.state === 'claimed'
  if (!open) return null   // a texted guest's follow-up is finished; nothing to assign or remove
  const choices = [...leaders]
    .filter(l => l.name !== card.claimedBy)
    .sort((a, b) => a.name.localeCompare(b.name))
  const choiceLabel = l => (l ? (l.name === currentUser ? `${l.name} (you)` : l.name) : '')

  if (confirmRemove) return (
    <div className="fu-card fu-admin fu-admin-confirm">
      <div className="fu-title">Remove {first} from follow-up?</div>
      <div className="fu-sub">Their card leaves the follow-up workflow in Planning Center. Their profile and notes stay.</div>
      <div className="fu-btn-row">
        <button className="fu-btn-danger" disabled={busy}
          onClick={() => onAction('remove').then(() => setConfirmRemove(false))}>
          {busy ? '…' : 'Remove'}
        </button>
        <button className="fu-btn-takeover" onClick={() => setConfirmRemove(false)} disabled={busy}>Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="fu-card fu-admin">
      <div className="fu-admin-label"><ShieldCheck size={14} /> Admin</div>
      {open && (
        <div className="fu-admin-row">
          {/* Same picker as YA Status / Crew, not the browser's own dropdown */}
          <div className="picker-group fu-admin-picker">
            <PickerRow label={card.state === 'claimed' ? 'Reassign to' : 'Assign to'}
              value={choiceLabel(choices.find(l => String(l.id) === String(leaderId)))}
              options={choices.map(choiceLabel)} emptyLabel="Choose" allowEmpty={false}
              onChange={label => setLeaderId(choices.find(l => choiceLabel(l) === label)?.id ?? '')} />
          </div>
          <button className="fu-btn-takeover" disabled={busy || !leaderId}
            onClick={() => onAction('assign', { leaderId }).then(() => setLeaderId(''))}>
            {busy ? '…' : 'Assign'}
          </button>
        </div>
      )}
      <div className="fu-admin-row">
        {card.state === 'claimed' && card.claimedBy && card.claimedBy !== currentUser && (
          <button className="fu-inline-link" onClick={() => onAction('release')} disabled={busy}>
            Release {card.claimedBy.split(' ')[0]}'s claim
          </button>
        )}
        {open && (
          <button className="fu-inline-link fu-link-danger" onClick={() => setConfirmRemove(true)} disabled={busy}>
            Remove from follow-up
          </button>
        )}
      </div>
    </div>
  )
}

// ── A posted note, laid out like the activity rows ──────────────────
const FEED_PREVIEW = 10
function listJoin(xs) {
  return xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

function NoteItem({ note: n, currentUser, targets = [] }) {
  const who = n.author && n.author === currentUser ? 'You' : (n.author || 'Leader')
  return (
    <div className="hist-item hist-note">
      {n.followup
        ? <span className="hist-icon hist-icon-fu"><Check size={14} strokeWidth={3} /></span>
        : <span className="hist-icon hist-icon-author" style={{ background: authorColor(n.author) }}>{authorInitials(n.author)}</span>}
      <span className="hist-text">
        <strong>{who}</strong>{n.followup ? ' followed up' : ''}: {splitMentions(n.body, targets).map((part, i) => part.target
          ? <span key={i} className={`mention${part.target.type === 'leader' && part.target.label === currentUser ? ' mention-me' : ''}`}>{part.text}</span>
          : part.text)}
      </span>
      <span className="note-time">{formatNoteDate(n.createdAt)}</span>
    </div>
  )
}

// ── One follow-up workflow event in the feed (card received, claimed, texted…) ──
const HISTORY_ICONS = {
  received:  { Icon: Inbox,        cls: 'hist-received' },
  claimed:   { Icon: Hand,         cls: 'hist-claimed' },
  released:  { Icon: Undo2,        cls: 'hist-muted' },
  texted:    { Icon: MessageCircle, cls: 'hist-done' },
  completed: { Icon: CircleCheck,  cls: 'hist-done' },
  removed:   { Icon: CircleMinus,  cls: 'hist-muted' },
  note:      { Icon: Workflow,     cls: 'hist-muted' },
}
function HistoryItem({ item, currentUser }) {
  const { Icon, cls } = HISTORY_ICONS[item.event] || HISTORY_ICONS.note
  const text = item.who && item.who === currentUser ? item.text.replace(item.who, 'you') : item.text
  return (
    <div className={`hist-item ${cls}`}>
      <span className="hist-icon"><Icon size={14} strokeWidth={2.4} /></span>
      <span className="hist-text">{text}</span>
      <span className="note-time">{formatNoteDate(item.createdAt)}</span>
    </div>
  )
}
