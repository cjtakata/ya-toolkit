import { requireAuth, isAdmin, isLeaderPerson } from './_lib/auth.js'
import { pcoFetch } from './_lib/pco.js'
import { peopleById } from './_lib/person.js'
import { listCards, claimCard, releaseCard, markTexted, removeCard, CardError } from './_lib/cards.js'

// GET  /api/cards                      → connection-card follow-ups (open + last 30 days)
// GET  /api/cards?stats=1              → admins: every card, who claimed/texted and when
//                                        (no guest details), for the reach-out dashboard
// POST /api/cards {cardId, action}     → action: 'claim' | 'release' | 'texted'
//   admins only (see _lib/auth.js):
// POST /api/cards {cardId, action: 'assign', leaderId}  → claim on that leader's behalf
// POST /api/cards {cardId, action: 'remove'}            → take the card out of the workflow
//
// Short in-memory cache so several leaders opening Home doesn't hammer PCO.
let _cache = null, _cacheAt = 0
const CACHE_MS = 20_000
let _stats = null, _statsAt = 0
const STATS_MS = 60_000

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  const leader = user.global_name || user.username || 'Leader'

  try {
    if (req.method === 'GET' && req.query?.stats) {
      if (!isAdmin(user)) return res.status(403).json({ error: 'Only YA admins can see this.' })
      if (!_stats || Date.now() - _statsAt > STATS_MS || req.query?.fresh) {
        _stats = (await listCards({ allTime: true }))
          .filter(c => c.state !== 'removed')
          .map(({ state, submittedAt, claimedBy, claimedAt, contactedBy, contactedAt }) =>
            ({ state, submittedAt, claimedBy, claimedAt, contactedBy, contactedAt }))
        _statsAt = Date.now()
      }
      res.setHeader('Cache-Control', 'private, no-store')
      return res.json(_stats)
    }

    if (req.method === 'GET') {
      if (_cache && Date.now() - _cacheAt < CACHE_MS && !req.query?.fresh) {
        return res.json(_cache)
      }
      const cards = (await listCards()).filter(c => c.state !== 'removed' && c.personId)

      // Attach each guest's profile (name, phone, crew, status…) in batched calls.
      const people = await peopleById([...new Set(cards.map(c => c.personId))])

      const out = cards
        .map(c => ({ ...c, person: people[c.personId] || null }))
        .filter(c => c.person)
      _cache = out; _cacheAt = Date.now()
      res.setHeader('Cache-Control', 'private, no-store')
      return res.json(out)
    }

    if (req.method === 'POST') {
      const { cardId, action } = req.body || {}
      if (!/^\d+$/.test(String(cardId))) return res.status(400).json({ error: 'Invalid card id' })
      const admin = isAdmin(user)

      if (action === 'assign' || action === 'remove') {
        if (!admin) return res.status(403).json({ error: 'Only YA admins can do that.' })
        if (action === 'remove') {
          await removeCard(String(cardId), leader)
        } else {
          const leaderId = String(req.body?.leaderId || '')
          if (!/^\d+$/.test(leaderId)) return res.status(400).json({ error: 'Pick a leader to assign.' })
          if (!(await isLeaderPerson(leaderId))) return res.status(422).json({ error: "Couldn't confirm that person is a YA Leader. Try again." })
          // Same name the leader signs in with (first + last), so the claim shows
          // as theirs on their own Home screen.
          const { data } = await pcoFetch(`/people/v2/people/${leaderId}`)
          const name = [data?.attributes?.first_name, data?.attributes?.last_name].filter(Boolean).join(' ')
          if (!name) return res.status(422).json({ error: "Couldn't find that leader in Planning Center." })
          // Assigning yourself reads as a plain claim (or a reassignment to you).
          await claimCard(String(cardId), name, { assignedBy: name === leader ? null : leader, byAdmin: true })
        }
        _cache = null; _stats = null
        return res.json({ ok: true })
      }

      const fn = { claim: claimCard, release: releaseCard, texted: markTexted }[action]
      if (!fn) return res.status(400).json({ error: 'Unknown action' })
      await fn(String(cardId), leader, action === 'release' ? { admin } : undefined)
      _cache = null; _stats = null   // next GET reflects the change
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    if (err instanceof CardError) return res.status(err.status).json({ error: err.message })
    console.error('cards.js error:', err)
    return res.status(500).json({ error: 'Failed to reach the PCO workflow' })
  }
}
