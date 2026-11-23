import { useState, useRef, useEffect } from 'react'
import { Check, LogOut, MessageCircle, Camera, Pencil, ChevronDown, ChevronRight, BookOpen, ChartNoAxesColumn } from 'lucide-react'
import PickerRow from './PickerRow.jsx'
import { initialsOf } from './Avatar.jsx'
import { CREW_OPTIONS, CREW_LABEL } from './listMeta.js'
import { DEFAULT_MESSAGE, PLACEHOLDERS, renderMessage } from './cardMeta.js'

// Profile: who's signed in, which crew the app focuses on, and sign out.
export default function ProfileTab({ onOpenHelp, onOpenTeam, user, myCrew = 'all', onChooseCrew, onLogout, onSaveMessage, onSaveProfile }) {
  const name     = user.global_name || user.username || 'Leader'
  const initials = initialsOf(name)
  const email    = user.username && user.username.includes('@') ? user.username : null
  const fileRef  = useRef(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr]   = useState('')

  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''                      // let the same photo be picked again later
    if (!file) return
    setPhotoBusy(true); setPhotoErr('')
    try {
      const photo = await squarePhoto(file)
      await onSaveProfile({ photo })
    } catch (err) {
      setPhotoErr(err.message || "Couldn't update your photo")
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <div className="profile-sheet">
        <div className="profile-card">
          <button type="button" className={`profile-avatar profile-avatar-edit${photoBusy ? ' busy' : ''}`}
            onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label="Change your photo">
            {user.avatar ? <img src={user.avatar} alt="" /> : initials}
            <span className="profile-avatar-badge" aria-hidden="true"><Camera size={14} strokeWidth={2.4} /></span>
            {photoBusy && <span className="profile-avatar-spin" aria-hidden="true" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          {photoErr && <div className="profile-photo-err">{photoErr}</div>}
          <div className="profile-name">{user.nickname || name}</div>
          {user.nickname && <div className="profile-email">{name}</div>}
          {email && <div className="profile-email">{email}</div>}
          <div className="profile-role">YA Leader</div>
        </div>

        <section className="home-section">
          <div className="home-section-head">
            <h2>About you</h2>
          </div>
          <div className="attr-group">
            <NicknameRow user={user} onSave={onSaveProfile} />
            <PickerRow label="Crew" value={CREW_LABEL[myCrew || 'all']} allowEmpty={false}
              options={CREW_OPTIONS.map(o => o.label)}
              onChange={label => onChooseCrew(CREW_OPTIONS.find(o => o.label === label)?.key || 'all')} />
          </div>
          <p className="profile-hint attr-hint">
            Your nickname is only used in this app. Home and People focus on your crew.
          </p>
        </section>

        <MessageEditor user={user} myCrew={myCrew} onSave={onSaveMessage} />

        {onOpenHelp && (
          <section className="home-section">
            <div className="settings-group">
              {onOpenTeam && (
                <button className="settings-row" onClick={onOpenTeam}>
                  <span className="help-entry"><ChartNoAxesColumn size={17} />Leader reach-outs</span>
                  <ChevronRight size={16} />
                </button>
              )}
              <button className="settings-row" onClick={onOpenHelp}>
                <span className="help-entry"><BookOpen size={17} />How the YA Toolkit works</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        <section className="home-section">
          <div className="settings-group">
            <button className="settings-row settings-danger" onClick={onLogout}>
              <span>Sign out</span>
              <LogOut size={15} />
            </button>
          </div>
        </section>
    </div>
  )
}

// ── "Your text message": the leader's own greeting for new guests ─────
function MessageEditor({ user, myCrew, onSave }) {
  const saved = user.textMessage || ''
  const [text, setText]     = useState(saved || DEFAULT_MESSAGE)
  const [status, setStatus] = useState('')        // '' | 'saving' | 'saved' | error message
  const [open, setOpen]     = useState(false)     // composer collapsed until they tap Edit
  const ref = useRef(null)

  useEffect(() => { setText(saved || DEFAULT_MESSAGE) }, [saved])
  // Grow the box to fit. Re-measure when it becomes visible — while the Profile
  // tab is hidden its scrollHeight reads 0.
  function fit() {
    const el = ref.current
    if (el && el.offsetParent) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }
  useEffect(fit, [text, open])
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fit())
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [open])

  const dirty     = text.trim() !== (saved || DEFAULT_MESSAGE).trim()
  const isDefault = text.trim() === DEFAULT_MESSAGE
  const crew      = myCrew && myCrew !== 'all' ? CREW_LABEL[myCrew] : 'College Life'
  const preview   = renderMessage(text, {
    guestFirst: 'Levi', leaderFirst: (user.global_name || '').split(' ')[0], crew,
  })

  function insert(token) {
    const el = ref.current
    const at = el ? el.selectionStart : text.length
    const next = text.slice(0, at) + token + text.slice(el ? el.selectionEnd : at)
    setText(next)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length) })
  }

  async function save(value) {
    setStatus('saving')
    try {
      // Saving the default text stores nothing, so future default tweaks reach this leader.
      await onSave(value.trim() === DEFAULT_MESSAGE ? '' : value)
      setStatus('saved')
      setOpen(false)
      setTimeout(() => setStatus(''), 2000)
    } catch (err) {
      setStatus(err.message)
    }
  }

  const savedPreview = renderMessage(saved || DEFAULT_MESSAGE, {
    guestFirst: 'Levi', leaderFirst: (user.global_name || '').split(' ')[0], crew,
  })

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Your text message</h2>
        {status === 'saving' && <span className="save-indicator saving">Saving…</span>}
        {status === 'saved'  && <span className="save-indicator saved"><Check size={12} />Saved</span>}
      </div>
      <div className={`attr-group msg-group${open ? ' open' : ''}`}>
        <button type="button" className="msg-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <span className="msg-toggle-text">
            <span className="picker-label">{saved ? 'Custom message' : 'Default message'}</span>
            {!open && <span className="msg-toggle-sub">{savedPreview}</span>}
          </span>
          <span className="msg-toggle-action">{open ? 'Close' : 'Edit'}<ChevronDown size={15} /></span>
        </button>
      {open && (
      <div className="msg-editor">
        <p className="profile-hint">
          What opens in Messages when you tap <strong>Text</strong> on a new guest. You can still tweak it before sending.
          Saved to your Planning Center profile, so it's the same on every device.
        </p>
        <textarea ref={ref} className="msg-input" rows={4} maxLength={1000}
          value={text} onChange={e => { setText(e.target.value); setStatus('') }} />
        <div className="msg-tokens">
          <span>Insert:</span>
          {PLACEHOLDERS.map(p => (
            <button key={p.token} type="button" className="msg-token" title={p.label} onClick={() => insert(p.token)}>
              {p.token}
            </button>
          ))}
        </div>
        <div className="msg-preview">
          <div className="msg-preview-label"><MessageCircle size={13} /> Preview for a guest named Levi</div>
          <div className="msg-bubble">{preview}</div>
        </div>
        {status && !['saving', 'saved'].includes(status) && <div className="login-error">{status}</div>}
        <div className="msg-actions">
          {!isDefault && (
            <button type="button" className="msg-reset" onClick={() => { setText(DEFAULT_MESSAGE); setStatus('') }}>
              Reset to default
            </button>
          )}
          <button type="button" className="login-btn msg-save" disabled={!dirty || status === 'saving' || !text.trim()}
            onClick={() => save(text)}>
            Save message
          </button>
        </div>
      </div>
      )}
      </div>
    </section>
  )
}

// Square-crop and shrink a picked photo on the phone (512px JPEG) before upload —
// keeps it fast and well under upload limits.
function squarePhoto(file, size = 512) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      canvas.getContext('2d').drawImage(img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.86))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a photo we can use")) }
    img.src = url
  })
}

// ── Nickname: a row (Nickname · Connor ✎) that expands into the editor —
// same pattern as the text message. Saved to "YA Nickname" on their PCO
// profile, never PCO's own nickname.
function NicknameRow({ user, onSave }) {
  const [open, setOpen]     = useState(false)
  const [value, setValue]   = useState(user.nickname || '')
  const [status, setStatus] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { if (!open) setValue(user.nickname || '') }, [user.nickname, open])
  const dirty = value.trim() !== (user.nickname || '')

  async function save(e) {
    e?.preventDefault()
    if (!dirty) return
    setStatus('saving')
    try {
      await onSave({ nickname: value.trim() })
      setStatus(''); setOpen(false)
    } catch (err) { setStatus(err.message) }
  }
  function close() { setValue(user.nickname || ''); setStatus(''); setOpen(false) }

  return (
    <div className={`attr-expand${open ? ' open' : ''}`}>
      <button type="button" className="msg-toggle" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <span className="picker-label">Nickname</span>
        {open
          ? <span className="msg-toggle-action">Close<ChevronDown size={15} /></span>
          : <span className={`picker-value${user.nickname ? '' : ' empty'}`}>{user.nickname || 'Add'}<Pencil size={14} /></span>}
      </button>
      {open && (
        <form className="attr-panel" onSubmit={save}>
          <div className="attr-prompt">What should we call you?</div>
          <p className="profile-hint">Used in the greeting and your profile here. It's only for this app; it won't change your name anywhere else in Planning Center.</p>
          <div className="nickname-row">
            <input ref={inputRef} className="login-input" value={value} maxLength={40}
              placeholder={(user.global_name || '').split(' ')[0] || 'Nickname'}
              onChange={e => { setValue(e.target.value); setStatus('') }}
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); close() } }} />
            <button className="login-btn" type="submit" disabled={!dirty || status === 'saving'}>
              {status === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
          {status && status !== 'saving' && <div className="login-error attr-error">{status}</div>}
        </form>
      )}
    </div>
  )
}
