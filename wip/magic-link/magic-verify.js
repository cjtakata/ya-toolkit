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
    id:          payload.pcoId,
    username:    payload.email,
    global_name: payload.name,
    avatar:      null,
    crews:       payload.crews || [],
  })
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

    const expected = payload.codeHash || ''
    const actual   = hashCode(String(code).trim())
    const ok = expected.length === actual.length &&
               timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
    if (!ok) return res.status(401).json({ error: 'Incorrect code. Double-check and try again.' })

    res.setHeader('Set-Cookie', await sessionFrom(payload))
    return res.json({ ok: true })
  }

  // ── Link click from the email (desktop / same-browser) ──
  const { token } = req.query
  if (!token) return res.redirect('/people?error=missing_token')
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!payload.pcoId || !payload.name) return res.redirect('/people?error=invalid_token')
    res.setHeader('Set-Cookie', await sessionFrom(payload))
    return res.redirect('/people')
  } catch {
    return res.redirect('/people?error=expired_token')
  }
}
