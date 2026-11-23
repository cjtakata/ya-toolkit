import { jwtVerify } from 'jose'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createSessionCookie } from '../_lib/auth.js'

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET)
}
function hashCode(code) {
  return createHmac('sha256', process.env.JWT_SECRET).update(String(code)).digest('hex')
}
function sessionFrom(payload) {
  return createSessionCookie({
    auth:        'pco',           // requireAuth rejects any other session type
    id:          payload.pcoId,
    username:    payload.email,
    global_name: payload.name,
    avatar:      null,
    crews:       payload.crews || [],
  })
}

// Wrong-code limit per sign-in attempt (best-effort per warm instance; the
// Vercel firewall rate-limits /api/auth/* per IP as the hard backstop).
const MAX_TRIES = 5
const wrongTries = new Map()   // challenge id → wrong guesses
function tooManyTries(id) { return id && (wrongTries.get(id) || 0) >= MAX_TRIES }
function noteWrongTry(id) {
  if (!id) return
  wrongTries.set(id, (wrongTries.get(id) || 0) + 1)
  if (wrongTries.size > 10000) wrongTries.clear()
}

export default async function handler(req, res) {
  // ── Code entry from inside the app (works in the iOS home-screen PWA) ──
  if (req.method === 'POST') {
    const { challenge, code } = req.body || {}
    if (!challenge || !code) return res.status(400).json({ error: 'Missing code.' })

    let payload
    try {
      ({ payload } = await jwtVerify(challenge, secret()))
    } catch {
      return res.status(401).json({ error: 'That code has expired. Request a new one.' })
    }

    if (payload.typ !== 'challenge') return res.status(401).json({ error: 'That code has expired. Request a new one.' })

    if (tooManyTries(payload.jti)) {
      return res.status(429).json({ error: 'Too many tries. Request a new code.' })
    }

    const expected = payload.codeHash || ''
    const actual   = hashCode(String(code).trim())
    const ok = expected.length === actual.length &&
               timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
    if (!ok || !payload.pcoId) {
      noteWrongTry(payload.jti)
      return res.status(401).json({ error: tooManyTries(payload.jti)
        ? 'Too many tries. Request a new code.'
        : 'Incorrect code. Double-check and try again.' })
    }

    res.setHeader('Set-Cookie', await sessionFrom(payload))
    return res.json({ ok: true })
  }

  // ── Link click from the email (desktop / same-browser) ──
  const { token } = req.query
  if (!token) return res.redirect('/people?error=missing_token')
  try {
    const { payload } = await jwtVerify(token, secret())
    // Only an emailed link token may sign in here — never a challenge (which the browser can see)
    if (payload.typ !== 'link' || !payload.pcoId || !payload.name) return res.redirect('/people?error=invalid_token')
    res.setHeader('Set-Cookie', await sessionFrom(payload))
    return res.redirect('/people')
  } catch {
    return res.redirect('/people?error=expired_token')
  }
}
