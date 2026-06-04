import { requireAuth } from './_lib/auth.js'
import { getFieldOptions } from './_lib/pco.js'

// Crew and YA Status are select-type fields; their valid options live in PCO.
// Sourcing the dropdowns from here keeps the UI in lockstep with PCO and lets
// the server validate writes against the same authoritative lists.
const CREW_FIELD_ID   = '431524'
const STATUS_FIELD_ID = '1065431'

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const [crewOptions, statusOptions] = await Promise.all([
      getFieldOptions(CREW_FIELD_ID),
      getFieldOptions(STATUS_FIELD_ID),
    ])
    res.json({ crewOptions, statusOptions })
  } catch (err) {
    console.error('meta.js error:', err)
    res.status(500).json({ error: 'Failed to load metadata', detail: err.message })
  }
}
