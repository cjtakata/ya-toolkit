import { useState } from 'react'
import { MINISTRY } from '../../ministry.config.js'

const LOGO = <img src="/ya.svg" alt="YA" />

// Errors passed back from the emailed sign-in link (api/auth/magic-verify.js)
const LINK_ERRORS = {
  expired_token: 'That sign-in link has expired. Request a new code below.',
  invalid_token: 'That sign-in link is invalid. Request a new code below.',
  missing_token: 'That sign-in link is incomplete. Request a new code below.',
}

export default function LoginScreen() {
  const linkError = LINK_ERRORS[new URLSearchParams(window.location.search).get('error')]

  const [step, setStep]           = useState('email')   // 'email' | 'code'
  const [email, setEmail]         = useState('')
  const [code, setCode]           = useState('')
  const [challenge, setChallenge] = useState(null)
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState(linkError || null)

  async function requestCode(e) {
    e?.preventDefault()
    if (!email.trim() || busy) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/auth/magic-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.')
      setChallenge(d.challenge)
      setCode('')
      setStep('code')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(e) {
    e?.preventDefault()
    if (code.length !== 6 || busy) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/auth/magic-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge, code }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.')
      window.location.replace('/people' + window.location.hash)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">{LOGO}</div>
        <div>
          <div className="login-title">YA Toolkit</div>
          <div className="login-tagline">For {MINISTRY.name} leaders</div>
        </div>

        {step === 'email' ? (
          <form className="login-form" onSubmit={requestCode}>
            <div className="login-subtitle">
              Enter the email you use in Planning Center and we'll send you a sign-in code.
            </div>
            <input
              className="login-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
            />
            {error && <div className="login-error">{error}</div>}
            <button className="login-btn" type="submit" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={verifyCode}>
            <div className="login-subtitle">
              If <strong>{email.trim()}</strong> belongs to a YA leader, a 6-digit code is on its way. It expires in 15 minutes.
            </div>
            <input
              className="login-input login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            {error && <div className="login-error">{error}</div>}
            <button className="login-btn" type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="login-links">
              <button type="button" className="login-link" onClick={requestCode} disabled={busy}>
                Resend code
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" className="login-link"
                onClick={() => { setStep('email'); setError(null) }} disabled={busy}>
                Use a different email
              </button>
            </div>
          </form>
        )}

        <div className="login-note">
          <strong>Leaders only.</strong> Access is for people marked as a YA Leader in Planning Center. No password needed.
        </div>
      </div>
    </div>
  )
}
