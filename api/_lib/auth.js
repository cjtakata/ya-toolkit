import { SignJWT, jwtVerify, EncryptJWT, jwtDecrypt } from 'jose'
import { createHash, createHmac } from 'node:crypto'
import { getDatum, FIELD } from './pco.js'
import { MINISTRY } from '../../ministry.config.js'

const COOKIE = 'ya_session'

export const secret = () => new TextEncoder().encode(process.env.JWT_SECRET)
export const hashCode = code => createHmac('sha256', process.env.JWT_SECRET).update(String(code)).digest('hex')

// ── Sign-in tokens ──────────────────────────────────────────────
// The code challenge sits in the browser, so it's encrypted (not just signed):
// a real challenge and a decoy look the same from outside, and nobody can read
// who it's for. The emailed link token is signed and never reaches the page.
const challengeKey = () => createHash('sha256').update(`${process.env.JWT_SECRET}|challenge`).digest()
export const sealChallenge = payload =>
  new EncryptJWT(payload).setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }).setExpirationTime('15m').encrypt(challengeKey())
export const openChallenge = async token => (await jwtDecrypt(token, challengeKey())).payload

export const signLink = payload =>
  new SignJWT({ ...payload, typ: 'link' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('15m').sign(secret())

// ── Session cookie ──────────────────────────────────────────────
export function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim()).filter(Boolean).map(c => {
    const i = c.indexOf('=')
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]
  }))
}

function cookie(value, maxAge) {
  // Lax (not Strict) so the session survives opening the app from a text link,
  // bookmark or home-screen icon; Strict drops it on those navigations.
  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE}=${value}; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}; Path=/`
}

export async function createSessionCookie({ pcoId, email, name, crews }) {
  const token = await new SignJWT({ auth: 'pco', id: pcoId, username: email, global_name: name, crews: crews || [] })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').sign(secret())
  return cookie(token, 30 * 24 * 3600)
}
export const clearSessionCookie = () => cookie('', 0)

// ── Who's a leader ──────────────────────────────────────────────
// YA Status = "Leader" in PCO is the whole access rule.
const leaderNow = async id => (await getDatum(id, FIELD.status))?.attributes?.value === MINISTRY.statuses.leader

// Re-checked every few minutes, so removing someone's Leader status ends their
// access within LEADER_TTL, not when their 30-day session runs out. If PCO
// can't answer, keep the last known answer rather than lock everyone out.
const LEADER_TTL = 5 * 60_000
const leaderCache = new Map()   // pcoId → { ok, at }
async function stillLeader(id) {
  const hit = leaderCache.get(id)
  if (hit && Date.now() - hit.at < LEADER_TTL) return hit.ok
  try {
    const ok = await leaderNow(id)
    if (leaderCache.size > 2000) leaderCache.clear()
    leaderCache.set(id, { ok, at: Date.now() })
    return ok
  } catch (err) {
    console.error('leader re-check failed:', err.message)
    return hit ? hit.ok : true
  }
}

// For sign-in and admin assignments: fails closed (no answer = not a leader).
export async function isLeaderPerson(id) {
  if (!/^\d+$/.test(String(id))) return false
  try { return await leaderNow(String(id)) } catch (err) {
    console.error('leader check failed:', err.message)
    return false
  }
}

// ── Admins ──────────────────────────────────────────────────────
// Can assign guests to leaders, remove guests from follow-up, and grant or
// remove Leader status. PCO person ids in YA_ADMIN_PCO_IDS (comma-separated);
// until that's set, MINISTRY.defaultAdminIds (ministry.config.js).
export function isAdmin(user) {
  const ids = String(process.env.YA_ADMIN_PCO_IDS || MINISTRY.defaultAdminIds.join(',')).split(',').map(s => s.trim())
  return !!user && ids.includes(String(user.id))
}

export async function requireAuth(req, res) {
  const token = parseCookies(req)[COOKIE]
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null }
  let payload
  try {
    ({ payload } = await jwtVerify(token, secret()))
  } catch {
    res.status(401).json({ error: 'Invalid session' }); return null
  }
  // Only email-code sessions count; anything older signs in again.
  if (payload.auth !== 'pco' || !/^\d+$/.test(String(payload.id))) {
    res.status(401).json({ error: 'Please sign in again' }); return null
  }
  if (!(await stillLeader(String(payload.id)))) {
    res.setHeader('Set-Cookie', clearSessionCookie())
    res.status(401).json({ error: 'Your YA Leader access has ended' }); return null
  }
  return payload
}
