import { requireAuth } from './_lib/auth.js'
import { pcoFetchAll, FIELD } from './_lib/pco.js'
import { peopleById } from './_lib/person.js'

// GET /api/people[?fresh=1] → everyone with one of these YA Statuses. Archived
// people are included; the People list hides them unless its filter asks.
// (Older values still stored in PCO, e.g. "Missing", stay off the list.)
const STATUSES = new Set(['Active', 'Serving', 'Leader', 'Archived'])

// Short in-memory cache so several leaders opening the app doesn't hammer PCO.
// Pull-to-refresh asks for ?fresh=1; the app applies its own saves locally.
let _cache = null, _cacheAt = 0
const CACHE_MS = 30_000

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    if (!_cache || Date.now() - _cacheAt > CACHE_MS || req.query?.fresh) {
      const { data } = await pcoFetchAll(`/people/v2/field_data?where%5Bfield_definition_id%5D=${FIELD.status}&per_page=100`)
      const ids = [...new Set(data.filter(d => STATUSES.has(d.attributes.value)).map(d => d.relationships.customizable.data.id))]
      _cache = Object.values(await peopleById(ids)).sort((a, b) => a.name.localeCompare(b.name))
      _cacheAt = Date.now()
    }
    res.setHeader('Cache-Control', 'private, no-store')
    res.json(_cache)
  } catch (err) {
    console.error('people.js error:', err)
    res.status(500).json({ error: "Couldn't load people from Planning Center" })
  }
}
