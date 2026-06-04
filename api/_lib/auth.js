import { SignJWT, jwtVerify } from 'jose'

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

export async function requireAuth(req, res) {
  const cookies = parseCookies(req)
  const token   = cookies[COOKIE]
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload
  } catch {
    res.status(401).json({ error: 'Invalid session' })
    return null
  }
}
