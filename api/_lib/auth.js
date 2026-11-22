import { SignJWT, jwtVerify } from 'jose'
import { pcoFetch } from './pco.js'

const COOKIE = 'ya_session'

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

export function parseCookies(req) {
  const header = req.headers.cookie || ''
  return Object.fromEntries(
    header.split(';')
      .map(c => c.trim())
      .filter(Boolean)
      .map(c => {
        const i = c.indexOf('=')
        return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]
      })
  )
}

function cookieStr(name, value, options = {}) {
  const parts = [`${name}=${value}`]
  if (options.httpOnly)  parts.push('HttpOnly')
  if (options.secure)    parts.push('Secure')
  if (options.sameSite)  parts.push(`SameSite=${options.sameSite}`)
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`)
  parts.push('Path=/')
  return parts.join('; ')
}

export async function createSessionCookie(payload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret())
  const secure = process.env.VERCEL_ENV === 'production'
  return cookieStr(COOKIE, token, {
    // Lax (not Strict) so the session survives being opened from a
    // bookmark, text link, or home-screen icon on mobile — Strict
    // drops the cookie on top-level navigations from external contexts.
    httpOnly: true, secure, sameSite: 'Lax', maxAge: 30 * 24 * 3600,
  })
}

export function clearSessionCookie() {
  return cookieStr(COOKIE, '', { httpOnly: true, maxAge: 0 })
}

// Leader status is re-checked against PCO every few minutes, so removing someone's
// "Leader" YA Status ends their access within LEADER_TTL — not when their 30-day
// session runs out.
const STATUS_DEF = '1065431'
const LEADER_TTL = 5 * 60_000
const leaderCache = new Map()   // pcoId → { ok, at }
async function stillLeader(pcoId) {
  const hit = leaderCache.get(pcoId)
  if (hit && Date.now() - hit.at < LEADER_TTL) return hit.ok
  try {
    const { data } = await pcoFetch(
      `/people/v2/people/${pcoId}/field_data?where%5Bfield_definition_id%5D=${STATUS_DEF}&per_page=1`
    )
    const ok = data?.[0]?.attributes?.value === 'Leader'
    leaderCache.set(pcoId, { ok, at: Date.now() })
    if (leaderCache.size > 2000) leaderCache.clear()
    return ok
  } catch (err) {
    // PCO hiccup: keep the last known answer rather than locking everyone out
    console.error('leader re-check failed:', err.message)
    return hit ? hit.ok : true
  }
}

// ── Admins ──────────────────────────────────────────────────────
// Admins can assign a leader to a guest's card and remove a guest from the
// follow-up workflow. The list is PCO person ids, comma-separated, in the
// YA_ADMIN_PCO_IDS env var. Until that's set, Connor (83780614) is the only admin.
const DEFAULT_ADMINS = '83780614'
export function adminIds() {
  return new Set(String(process.env.YA_ADMIN_PCO_IDS || DEFAULT_ADMINS)
    .split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s)))
}
export function isAdmin(user) {
  return !!user && adminIds().has(String(user.id))
}

// Is this PCO person a current YA Leader? (same check sign-in uses, cached)
export async function isLeaderPerson(pcoId) {
  return /^\d+$/.test(String(pcoId)) && stillLeader(String(pcoId))
}

export async function requireAuth(req, res) {
  const cookies = parseCookies(req)
  const token   = cookies[COOKIE]
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  try {
    const { payload } = await jwtVerify(token, secret())
    // Only PCO-leader (email code) sessions count. Sessions from the old Discord
    // login don't, so those leaders are asked to sign in again by email.
    if (payload.auth !== 'pco') {
      res.status(401).json({ error: 'Please sign in again' })
      return null
    }
    if (!/^\d+$/.test(String(payload.id)) || !(await stillLeader(String(payload.id)))) {
      res.setHeader('Set-Cookie', clearSessionCookie())
      res.status(401).json({ error: 'Your YA Leader access has ended' })
      return null
    }
    return payload
  } catch {
    res.status(401).json({ error: 'Invalid session' })
    return null
  }
}
