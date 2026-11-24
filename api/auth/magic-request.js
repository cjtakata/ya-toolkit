import { randomInt, randomUUID } from 'node:crypto'
import { pcoFetch, getDatum, FIELD } from '../_lib/pco.js'
import { hashCode, sealChallenge, signLink, signInRole } from '../_lib/auth.js'
import { crewToList } from '../_lib/person.js'

// POST /api/auth/magic-request { email } → { challenge }
// Emails a 6-digit code (and a sign-in link for desktop) to a YA Leader, or a
// Viewer (view-only access; see ministry.config.js statuses.viewer).
//
// Every email gets the same reply and moves on to the code screen, so this
// can't be used to learn who's in PCO or who's a leader: emails that aren't a
// leader's get an encrypted decoy challenge (no email, any code fails),
// indistinguishable from a real one and returned after a similar delay.

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const pause = ms => new Promise(r => setTimeout(r, ms))

// Every PCO person with this email address (households often share one).
async function peopleWithEmail(email) {
  const { data } = await pcoFetch(`/people/v2/emails?where%5Baddress%5D=${encodeURIComponent(email)}&per_page=10`)
  return [...new Set((data || []).map(r => r.relationships?.person?.data?.id).filter(Boolean))]
}

function sendCode({ to, first, code, link }) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    process.env.RESEND_FROM || 'YA Toolkit <onboarding@resend.dev>',
      to,
      subject: 'Your YA Toolkit sign-in code',
      text:
        `Hey ${first},\n\nYour YA Toolkit sign-in code is: ${code}\n\n` +
        `Enter it in the app to sign in. The code expires in 15 minutes.\n\n` +
        `Signing in on a computer? You can also use this link:\n${link}\n\n` +
        `If you didn't request this, you can safely ignore this email.`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h1 style="font-size:22px;font-weight:800;color:#1a1d23;margin:0 0 8px;">Hey ${esc(first)} 👋</h1>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px;">Enter this code in the YA Toolkit to sign in. It expires in 15 minutes.</p>
          <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1a1d23;background:#f4f4f7;border-radius:10px;padding:16px 0;text-align:center;margin:0 0 24px;">${code}</div>
          <p style="font-size:13px;color:#444;line-height:1.6;margin:0;">Signing in on a computer? You can also <a href="${esc(link)}" style="color:#4f46e5;">tap here to sign in</a>.</p>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px;line-height:1.6;">If you didn't request this, you can safely ignore it.</p>
        </div>`,
    }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Email is required' })

  const started = Date.now()
  const decoy = async () => {
    await pause(Math.max(0, 600 - (Date.now() - started)) + randomInt(0, 300))
    return res.json({ ok: true, challenge: await sealChallenge({ jti: randomUUID(), codeHash: hashCode(randomUUID()) }) })
  }

  try {
    // A YA Leader with this email (else a Viewer)
    let leaderId = null, role = null
    for (const id of await peopleWithEmail(email)) {
      const r = await signInRole(id)
      if (r === 'leader') { leaderId = id; role = r; break }
      if (r === 'viewer' && !leaderId) { leaderId = id; role = r }
    }
    if (!leaderId) return decoy()

    const [{ data: person }, crewDatum] = await Promise.all([
      pcoFetch(`/people/v2/people/${leaderId}`),
      getDatum(leaderId, FIELD.crew).catch(() => null),
    ])
    const a = person?.attributes || {}
    const crew = crewToList(crewDatum?.attributes?.value)
    const identity = {
      pcoId: leaderId,
      name:  [a.first_name, a.last_name].filter(Boolean).join(' '),
      email,
      crews: crew === 'unassigned' ? ['*'] : [crew],
      role,
    }

    // 6-digit code typed into the app (works inside the iOS home-screen app),
    // plus a link token for clicking through on a computer.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const challenge = await sealChallenge({ ...identity, jti: randomUUID(), codeHash: hashCode(code) })
    const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}`
    const link = `${appUrl}/api/auth/magic-verify?token=${await signLink(identity)}`

    const sent = await sendCode({ to: email, first: a.first_name || 'there', code, link })
    if (!sent.ok) {
      console.error('Resend error:', await sent.text())
      return res.status(500).json({ error: "Couldn't send the email. Try again." })
    }
    return res.json({ ok: true, challenge })
  } catch (err) {
    console.error('magic-request error:', err)
    return res.status(500).json({ error: 'Something went wrong. Try again.' })
  }
}
