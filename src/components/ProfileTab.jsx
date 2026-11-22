import { useState, useRef, useEffect } from 'react'
import { Check, LogOut, ExternalLink, MessageCircle } from 'lucide-react'
import { CREW_OPTIONS, CREW_LABEL } from './listMeta.js'
import { DEFAULT_MESSAGE, PLACEHOLDERS, renderMessage } from './cardMeta.js'

const DISCORD_URL = 'https://discord.com/channels/1503595068722778154'

// Profile: who's signed in, which crew the app focuses on, and sign out.
export default function ProfileTab({ user, myCrew = 'all', onChooseCrew, onLogout, onSaveMessage }) {
  const name     = user.global_name || user.username || 'Leader'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const email    = user.username && user.username.includes('@') ? user.username : null

  return (
    <div className="profile-sheet">
        <div className="profile-card">
          <div className="profile-avatar">
            {user.avatar ? <img src={user.avatar} alt="" /> : initials}
          </div>
          <div className="profile-name">{name}</div>
          {email && <div className="profile-email">{email}</div>}
          <div className="profile-role">YA Leader</div>
        </div>

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
            <a className="settings-row" href={DISCORD_URL} target="_blank" rel="noreferrer">
              <span>YA Leaders Discord</span>
              <ExternalLink size={15} />
            </a>
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
