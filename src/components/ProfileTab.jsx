import { useState, useRef, useEffect } from 'react'
import { Check, LogOut, MessageCircle, Camera } from 'lucide-react'
import { CREW_OPTIONS, CREW_LABEL } from './listMeta.js'
import { DEFAULT_MESSAGE, PLACEHOLDERS, renderMessage } from './cardMeta.js'

// Profile: who's signed in, which crew the app focuses on, and sign out.
export default function ProfileTab({ user, myCrew = 'all', onChooseCrew, onLogout, onSaveMessage, onSaveProfile }) {
  const name     = user.global_name || user.username || 'Leader'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
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

        <NicknameField user={user} onSave={onSaveProfile} />

        <section className="home-section">
          <div className="home-section-head">
            <h2>Your crew</h2>
          </div>
          <p className="profile-hint">Home and People focus on this crew. Saved on this device.</p>
          <div className="settings-group" role="radiogroup" aria-label="Your crew">
            {CREW_OPTIONS.map(o => {
              const on = (myCrew || 'all') === o.key
              return (
                <button key={o.key} className={`settings-row${on ? ' selected' : ''}`}
                  role="radio" aria-checked={on} onClick={() => onChooseCrew(o.key)}>
                  <span>{o.label}</span>
                  {on && <Check size={16} />}
                </button>
              )
            })}
          </div>
        </section>

        <MessageEditor user={user} myCrew={myCrew} onSave={onSaveMessage} />

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
  const ref = useRef(null)

  useEffect(() => { setText(saved || DEFAULT_MESSAGE) }, [saved])
  // Grow the box to fit. Re-measure when it becomes visible — while the Profile
  // tab is hidden its scrollHeight reads 0.
  function fit() {
    const el = ref.current
    if (el && el.offsetParent) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }
  useEffect(fit, [text])
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fit())
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [])

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
      setTimeout(() => setStatus(''), 2000)
    } catch (err) {
      setStatus(err.message)
    }
  }

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Your text message</h2>
        {status === 'saving' && <span className="save-indicator saving">Saving…</span>}
        {status === 'saved'  && <span className="save-indicator saved"><Check size={12} />Saved</span>}
      </div>
      <p className="profile-hint">
        What opens in Messages when you tap <strong>Text</strong> on a new guest. You can still tweak it before sending.
        Saved to your Planning Center profile, so it's the same on every device.
      </p>
      <div className="msg-editor">
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

// ── "What should we call you?" — saved as the PCO nickname ─────────────
function NicknameField({ user, onSave }) {
  const [value, setValue]   = useState(user.nickname || '')
  const [status, setStatus] = useState('')
  useEffect(() => { setValue(user.nickname || '') }, [user.nickname])
  const dirty = value.trim() !== (user.nickname || '')

  async function save() {
    setStatus('saving')
    try {
      await onSave({ nickname: value.trim() })
      setStatus('saved'); setTimeout(() => setStatus(''), 2000)
    } catch (err) { setStatus(err.message) }
  }

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>What should we call you?</h2>
        {status === 'saving' && <span className="save-indicator saving">Saving…</span>}
        {status === 'saved'  && <span className="save-indicator saved"><Check size={12} />Saved</span>}
      </div>
      <p className="profile-hint">Used in the greeting and your profile here. It's only for this app; it won't change your name anywhere else in Planning Center.</p>
      <form className="nickname-row" onSubmit={e => { e.preventDefault(); if (dirty) save() }}>
        <input className="login-input" value={value} maxLength={40}
          placeholder={(user.global_name || '').split(' ')[0] || 'Nickname'}
          onChange={e => { setValue(e.target.value); if (!['saving'].includes(status)) setStatus('') }} />
        <button className="login-btn" type="submit" disabled={!dirty || status === 'saving'}>Save</button>
      </form>
      {status && !['saving', 'saved'].includes(status) && <div className="login-error" style={{ marginTop: 8 }}>{status}</div>}
    </section>
  )
}
