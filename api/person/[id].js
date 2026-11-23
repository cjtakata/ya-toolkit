import { requireAuth, isAdmin } from '../_lib/auth.js'
import { getDatum, setDatum, getFieldOptions, FIELD } from '../_lib/pco.js'

// PATCH /api/person/:id { fields: { crew?, status? } } → saves YA Details to PCO.
//
// Only Crew and YA Status are writable, each only to its own field, and only
// to a value PCO lists as an option (or empty). The field record to change is
// looked up here, never taken from the browser. YA Status "Leader" grants
// access to this app, so only admins can give it or take it away.
const WRITABLE = { crew: FIELD.crew, status: FIELD.status }

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const id = String(req.query.id || '')
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid person id' })

  const fields = req.body?.fields
  const keys = fields && typeof fields === 'object' ? Object.keys(fields).filter(k => k in WRITABLE) : []
  if (!keys.length) return res.status(400).json({ error: 'Nothing to save' })

  try {
    for (const key of keys) {
      const value = fields[key]
      if (typeof value !== 'string') return res.status(422).json({ error: `${key} must be text` })
      if (value && !(await getFieldOptions(WRITABLE[key])).includes(value)) {
        return res.status(422).json({ error: `"${value}" isn't a ${key === 'crew' ? 'Crew' : 'YA Status'} option in Planning Center` })
      }
    }

    if (keys.includes('status')) {
      const current = (await getDatum(id, FIELD.status))?.attributes?.value || ''
      const touchesLeader = (current === 'Leader') !== (fields.status === 'Leader')
      if (touchesLeader && !isAdmin(user)) {
        return res.status(403).json({ error: 'Only YA admins can make someone a Leader or remove Leader status.' })
      }
    }

    const saved = {}
    for (const key of keys) {
      await setDatum(id, WRITABLE[key], fields[key])
      saved[key] = fields[key]
    }
    res.json({ id, ...saved })
  } catch (err) {
    console.error(`person/${id} PATCH error:`, err)
    res.status(500).json({ error: "Couldn't save to Planning Center. Try again." })
  }
}
