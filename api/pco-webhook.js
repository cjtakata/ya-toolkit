import { createHmac, timingSafeEqual } from 'node:crypto'
import { routeNewCard } from './_lib/routing.js'
import { recordVisit } from './_lib/visits.js'
import { storeReady } from './_lib/push.js'

// POST /api/pco-webhook: Planning Center webhook deliveries.
//
// Set up in Planning Center (https://api.planningcenteronline.com/webhooks):
// subscribe this URL to the workflow card "created" event. Each subscription
// has an authenticity secret; put it in Vercel as PCO_WEBHOOK_SECRET
// (comma-separate several if you add more subscriptions).
//
// Every delivery is signed: X-PCO-Webhooks-Authenticity = HMAC-SHA256 of the
// raw body with that secret. Unsigned or wrongly signed requests are refused.
// Only "…workflow_card.created" deliveries do anything (see _lib/routing.js).
//
// The same URL also takes check-ins from the YA Connect kiosk (ya-connect
// project): X-YA-Checkin-Signature = HMAC-SHA256 of the raw body with
// CHECKIN_SYNC_KEY (set to the same value in both Vercel projects).
// Body: { personId, date: "yyyy-mm-dd", at: ISO time }. See _lib/visits.js.

export const config = { maxDuration: 30, api: { bodyParser: false } }

async function rawBody(req) {
  if (typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)) return Buffer.from(req.rawBody)
  const chunks = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks)
}

export function signatureOk(body, signature, secrets = process.env.PCO_WEBHOOK_SECRET) {
  const sig = String(signature || '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(sig)) return false
  return String(secrets || '').split(',').map(s => s.trim()).filter(Boolean).some(secret => {
    const mac = createHmac('sha256', secret).update(body).digest('hex')
    return timingSafeEqual(Buffer.from(mac), Buffer.from(sig))
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.headers['x-ya-checkin-signature'] !== undefined) return checkin(req, res)
  if (!process.env.PCO_WEBHOOK_SECRET) return res.status(503).json({ error: 'Webhook not configured' })

  const body = await rawBody(req)
  if (!signatureOk(body, req.headers['x-pco-webhooks-authenticity'])) {
    console.warn('pco-webhook: bad or missing signature, length', body.length)
    return res.status(401).json({ error: 'Bad signature' })
  }

  let deliveries
  try { deliveries = JSON.parse(body.toString('utf8')).data || [] } catch { return res.status(400).json({ error: 'Bad JSON' }) }

  const results = []
  try {
    for (const d of Array.isArray(deliveries) ? deliveries : [deliveries]) {
      const name = String(d?.attributes?.name || '')
      if (!/\.workflow_card\.created$/.test(name)) { results.push({ name, ignored: true }); continue }
      const payload = typeof d.attributes.payload === 'string' ? JSON.parse(d.attributes.payload) : d.attributes.payload
      const card = payload?.data
      const r = await routeNewCard({
        cardId: card?.id,
        personId: card?.relationships?.person?.data?.id,
        workflowId: card?.relationships?.workflow?.data?.id,
      })
      results.push({ name, attempt: d?.attributes?.attempt, ...r })
    }
  } catch (err) {
    // Planning Center retries failed deliveries; routing is safe to retry
    // (each card notifies its leaders at most once).
    console.error('pco-webhook failed:', err.message)
    return res.status(500).json({ error: 'Failed, will retry' })
  }
  console.log('pco-webhook:', JSON.stringify(results.map(({ guest, ...r }) => r)))   // no guest names in logs
  return res.json({ ok: true, handled: results.length })
}

// A check-in from the kiosk. Signed, and only accepted within 10 minutes of
// when it happened (so a captured request can't be replayed later).
const SKEW_MS = 10 * 60_000
async function checkin(req, res) {
  if (!process.env.CHECKIN_SYNC_KEY || !storeReady()) return res.status(503).json({ error: 'Check-in sync not configured' })
  const body = await rawBody(req)
  if (!signatureOk(body, req.headers['x-ya-checkin-signature'], process.env.CHECKIN_SYNC_KEY)) {
    console.warn('checkin sync: bad signature')
    return res.status(401).json({ error: 'Bad signature' })
  }
  let v
  try { v = JSON.parse(body.toString('utf8')) } catch { return res.status(400).json({ error: 'Bad JSON' }) }
  const at = Date.parse(v?.at)
  if (!Number.isFinite(at) || Math.abs(Date.now() - at) > SKEW_MS) return res.status(400).json({ error: 'Stale check-in' })
  try {
    await recordVisit(String(v.personId), String(v.date))
  } catch (err) {
    if (err.message === 'bad visit') return res.status(400).json({ error: 'Bad check-in' })
    console.error('checkin sync failed:', err.message)
    return res.status(500).json({ error: 'Failed' })
  }
  return res.json({ ok: true })
}
