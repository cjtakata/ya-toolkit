import { requireAuth } from './_lib/auth.js'
import { getFieldOptions, FIELD } from './_lib/pco.js'

// GET /api/meta → the Crew and YA Status options, straight from PCO, so the
// pickers always match what /api/person will accept.
export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  try {
    const [crewOptions, statusOptions] = await Promise.all([getFieldOptions(FIELD.crew), getFieldOptions(FIELD.status)])
    res.json({ crewOptions, statusOptions })
  } catch (err) {
    console.error('meta.js error:', err)
    res.status(500).json({ error: "Couldn't load options from Planning Center" })
  }
}
