import { requireAuth } from './_lib/auth.js'
import { getFieldDefinitions } from './_lib/pco.js'
import { normalizePerson, fetchPeopleByIds } from './_lib/person.js'
import { listCards, claimCard, releaseCard, markTexted, CardError } from './_lib/cards.js'

// GET  /api/cards                      → connection-card follow-ups (open + last 30 days)
// POST /api/cards {cardId, action}     → action: 'claim' | 'release' | 'texted'
//
// Short in-memory cache so several leaders opening Home doesn't hammer PCO.
let _cache = null, _cacheAt = 0
const CACHE_MS = 20_000

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  const leader = user.global_name || user.username || 'Leader'

  try {
    if (req.method === 'GET') {
      if (_cache && Date.now() - _cacheAt < CACHE_MS && !req.query?.fresh) {
        return res.json(_cache)
      }
      const cards = (await listCards()).filter(c => c.state !== 'removed' && c.personId)

      // Attach each guest's profile (name, phone, crew, status…) in batched calls.
      const ids = [...new Set(cards.map(c => c.personId))]
      const fieldDefs = await getFieldDefinitions()
      const { data, included } = ids.length ? await fetchPeopleByIds(ids) : { data: [], included: [] }
      const people = Object.fromEntries(data.map(p => [p.id, normalizePerson(p, included, fieldDefs)]))

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
      const fn = { claim: claimCard, release: releaseCard, texted: markTexted }[action]
      if (!fn) return res.status(400).json({ error: 'Unknown action' })
      await fn(String(cardId), leader)
      _cache = null   // next GET reflects the change
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    if (err instanceof CardError) return res.status(err.status).json({ error: err.message })
    console.error('cards.js error:', err)
    return res.status(500).json({ error: 'Failed to reach the PCO workflow' })
  }
}
