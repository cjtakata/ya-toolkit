import { jwtVerify } from 'jose'
import { timingSafeEqual } from 'node:crypto'
import { secret, hashCode, openChallenge, createSessionCookie } from '../_lib/auth.js'

// POST /api/auth/magic-verify { challenge, code } → sets the session cookie
// GET  /api/auth/magic-verify?token=…           → emailed link: sets the cookie, opens the app

// Wrong-code limit per challenge (best-effort per warm instance; the Vercel
// firewall rate-limits /api/auth/* per IP as the hard backstop).
const MAX_TRIES = 5
const wrongTries = new Map()   // challenge id → wrong guesses
const tooMany = id => (wrongTries.get(id) || 0) >= MAX_TRIES
function noteWrong(id) {
  if (wrongTries.size > 10000) wrongTries.clear()
  wrongTries.set(id, (wrongTries.get(id) || 0) + 1)
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { challenge, code } = req.body || {}
    if (!challenge || !code) return res.status(400).json({ error: 'Missing code.' })

    let payload
    try { payload = await openChallenge(String(challenge)) } catch {
      return res.status(401).json({ error: 'That code has expired. Request a new one.' })
    }
    if (tooMany(payload.jti)) return res.status(429).json({ error: 'Too many tries. Request a new code.' })

    const expected = Buffer.from(payload.codeHash || '')
    const actual   = Buffer.from(hashCode(String(code).trim()))
    if (!payload.pcoId || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      noteWrong(payload.jti)
      return res.status(401).json({ error: tooMany(payload.jti)
        ? 'Too many tries. Request a new code.'
        : 'Incorrect code. Double-check and try again.' })
    }
    res.setHeader('Set-Cookie', await createSessionCookie(payload))
    return res.json({ ok: true })
  }

  const { token } = req.query
  if (!token) return res.redirect('/people?error=missing_token')
  try {
    const { payload } = await jwtVerify(String(token), secret())
    if (payload.typ !== 'link' || !payload.pcoId || !payload.name) return res.redirect('/people?error=invalid_token')
    res.setHeader('Set-Cookie', await createSessionCookie(payload))
    return res.redirect('/people')
  } catch {
    return res.redirect('/people?error=expired_token')
  }
}
