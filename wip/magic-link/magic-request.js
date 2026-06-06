import { SignJWT } from 'jose'
import { createHmac, randomInt } from 'node:crypto'
import { pcoFetch, getFieldDefinitions } from '../_lib/pco.js'

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET)
}
function hashCode(code) {
  return createHmac('sha256', process.env.JWT_SECRET).update(String(code)).digest('hex')
}

// Search PCO for a person by email, returns their profile or null
async function findLeaderByEmail(email) {
  const encoded = encodeURIComponent(email)
  const res = await pcoFetch(`/people/v2/emails?where%5Baddress%5D=${encoded}&per_page=1`)
  const record = res.data?.[0]
  const personId = record?.relationships?.person?.data?.id
  if (!personId) return null
  // The emails endpoint doesn't reliably populate `included`, so fetch directly.
  const personRes = await pcoFetch(`/people/v2/people/${personId}`)
  return personRes.data || null
}

// Check if a PCO person has YA Status = "Leader"
async function isLeader(personId, fieldDefs) {
  const statusDefId = fieldDefs[process.env.PCO_FIELD_STATUS]
  if (!statusDefId) return false
  const res = await pcoFetch(
    `/people/v2/people/${personId}/field_data?where%5Bfield_definition_id%5D=${statusDefId}&per_page=1`
  )
  return res.data?.[0]?.attributes?.value === 'Leader'
}

// Get the person's Crew custom field value
async function getCrewValue(personId, fieldDefs) {
  const crewDefId = fieldDefs[process.env.PCO_FIELD_CREW]
  if (!crewDefId) return null
  const res = await pcoFetch(
    `/people/v2/people/${personId}/field_data?where%5Bfield_definition_id%5D=${crewDefId}&per_page=1`
  )
  return res.data?.[0]?.attributes?.value || null
}

// Normalized crew → key (tolerates trailing space / case / plural, like people.js)
function crewToKey(value) {
  const v = (value || '').trim().toLowerCase()
  if (v === 'college life') return 'college'
  if (v === 'early career') return 'earlycareer'
  if (v === 'young professional' || v === 'young professionals') return 'youngpro'
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.body || {}
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' })
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const person = await findLeaderByEmail(normalizedEmail)
    if (!person) {
      return res.status(404).json({ error: 'No leader found with that email in Planning Center.' })
    }

    const fieldDefs = await getFieldDefinitions()
    if (!(await isLeader(person.id, fieldDefs))) {
      return res.status(403).json({ error: "That email isn't marked as a leader in Planning Center." })
    }

    const crewKey = crewToKey(await getCrewValue(person.id, fieldDefs))
    const crews   = crewKey ? [crewKey] : ['*']
    const name    = [person.attributes.first_name, person.attributes.last_name].filter(Boolean).join(' ')
    const identity = { pcoId: person.id, name, email: normalizedEmail, crews }

    // 6-digit code the leader types into the app (works inside the iOS PWA).
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')

    // Stateless challenge held by the client; carries identity + a hash of the code.
    const challenge = await new SignJWT({ ...identity, codeHash: hashCode(code) })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secret())

    // Self-contained link token for desktop click-through (sets cookie in the browser).
    const linkToken = await new SignJWT(identity)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(secret())

    const appUrl    = process.env.APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3000'
    const magicLink = `${appUrl}/api/auth/magic-verify?token=${linkToken}`
    const first     = person.attributes.first_name || 'there'

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    process.env.RESEND_FROM || 'YA Toolkit <onboarding@resend.dev>',
        to:      normalizedEmail,
        subject: 'Your YA Toolkit sign-in code',
        text:
          `Hey ${first},\n\n` +
          `Your YA Toolkit sign-in code is: ${code}\n\n` +
          `Enter it in the app to sign in. The code expires in 15 minutes.\n\n` +
          `Signing in on a computer? You can also use this link:\n${magicLink}\n\n` +
          `If you didn't request this, you can safely ignore this email.`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <h1 style="font-size:22px;font-weight:800;color:#1a1d23;margin:0 0 8px;">Hey ${first} 👋</h1>
            <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 20px;">Enter this code in the YA Toolkit to sign in. It expires in 15 minutes.</p>
            <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1a1d23;background:#f4f4f7;border-radius:10px;padding:16px 0;text-align:center;margin:0 0 24px;">${code}</div>
            <p style="font-size:13px;color:#444;line-height:1.6;margin:0;">Signing in on a computer? You can also <a href="${magicLink}" style="color:#4f46e5;">tap here to sign in</a>.</p>
            <p style="font-size:12px;color:#9ca3af;margin-top:24px;line-height:1.6;">If you didn't request this, you can safely ignore it.</p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      console.error('Resend error:', await emailRes.text())
      return res.status(500).json({ error: 'Failed to send email' })
    }

    // Return the challenge so the app can verify the typed code.
    return res.json({ ok: true, challenge })

  } catch (err) {
    console.error('magic-request error:', err)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
