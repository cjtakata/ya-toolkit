import { requireAuth } from './_lib/auth.js'
import { loadYaPeople } from './_lib/person.js'
import { withVisits } from './_lib/visits.js'

// GET /api/people[?fresh=1] → everyone on the YA list (see loadYaPeople),
// each with `visits`: their check-in dates, newest first (_lib/visits.js).

// Short in-memory cache so several leaders opening the app doesn't hammer PCO.
// Pull-to-refresh asks for ?fresh=1; the app applies its own saves locally.
let _cache = null, _cacheAt = 0
const CACHE_MS = 30_000

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    if (!_cache || Date.now() - _cacheAt > CACHE_MS || req.query?.fresh) {
      _cache = await withVisits(await loadYaPeople())
      _cacheAt = Date.now()
    }
    res.setHeader('Cache-Control', 'private, no-store')
    res.json(_cache)
  } catch (err) {
    console.error('people.js error:', err)
    res.status(500).json({ error: "Couldn't load people from Planning Center" })
  }
}
