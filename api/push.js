import { requireAuth } from './_lib/auth.js'
import { pushReady, cleanSubscription, addDevice, removeDevice, devicesFor, pushTo, badgeContext } from './_lib/push.js'

// GET  /api/push                                  → { enabled, publicKey, devices }
// POST /api/push { action: 'subscribe', subscription, label, crew }   (also re-sent when the crew choice changes)
// POST /api/push { action: 'unsubscribe', endpoint }
// POST /api/push { action: 'test' }               → a test notification to your own devices
// Every action only touches the signed-in leader's own devices.
export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  res.setHeader('Cache-Control', 'private, no-store')
  const me = String(user.id)

  try {
    if (req.method === 'GET') {
      if (!pushReady() || user.role === 'viewer') return res.json({ enabled: false })
      return res.json({ enabled: true, publicKey: process.env.VAPID_PUBLIC_KEY, devices: (await devicesFor(me)).length })
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    if (!pushReady()) return res.status(503).json({ error: "Notifications aren't set up yet." })

    const { action } = req.body || {}
    if (action === 'subscribe') {
      const sub = cleanSubscription(req.body?.subscription)
      if (!sub) return res.status(400).json({ error: "That device couldn't be registered." })
      await addDevice(me, sub, req.body?.label, req.body?.crew)
      return res.json({ ok: true })
    }
    if (action === 'unsubscribe') {
      await removeDevice(me, String(req.body?.endpoint || ''))
      return res.json({ ok: true })
    }
    if (action === 'test') {
      const first = (user.global_name || '').split(' ')[0]
      const countFor = await badgeContext().catch(() => null)
      const reached = await pushTo(me, {
        badgeFor: countFor ? d => countFor(user.global_name, d.crew) : undefined,
        title: 'Notifications are on',
        body: `${first ? `${first}, you'll` : "You'll"} get a notification here for new guests in your crew and @mentions.`,
        url: '/people', tag: 'test',
      })
      return res.json({ ok: true, reached })
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('push.js error:', err.message)
    return res.status(500).json({ error: 'Something went wrong with notifications. Try again.' })
  }
}
