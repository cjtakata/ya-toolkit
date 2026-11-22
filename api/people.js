import { requireAuth } from './_lib/auth.js'
import { pcoFetchAll, getFieldDefinitions } from './_lib/pco.js'
import { normalizePerson, fetchPeopleByIds } from './_lib/person.js'

// YA Status values shown in the app's care list.
// Active = engaged, Missing = drifted but still pursuing,
// TBD = under evaluation / not yet categorised.
// Friend, Alumni, Moved On are excluded (they drop off the care list).
const ACTIVE_STATUSES = new Set(['Active', 'Missing', 'TBD', 'Leader', 'First Time Guest'])


export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const fieldDefs = await getFieldDefinitions()

    // 1. Fetch all field_data records for the YA Status field
    const statusDefId = fieldDefs[process.env.PCO_FIELD_STATUS]
    if (!statusDefId) throw new Error('YA Status field definition not found')

    const { data: statusRecords } = await pcoFetchAll(
      `/people/v2/field_data?where%5Bfield_definition_id%5D=${statusDefId}&per_page=100`
    )

    // 2. Filter to active statuses and collect person IDs
    const personIds = statusRecords
      .filter(r => ACTIVE_STATUSES.has(r.attributes.value))
      .map(r => r.relationships.customizable.data.id)

    if (personIds.length === 0) {
      return res.json([])
    }

    // 3. Fetch full profiles for those people
    const { data, included } = await fetchPeopleByIds(personIds)

    // 4. Normalize
    const people = data.map(raw => normalizePerson(raw, included, fieldDefs))

    // Sort by name
    people.sort((a, b) => a.name.localeCompare(b.name))

    res.json(people)
  } catch (err) {
    console.error('people.js error:', err)
    const isDev = process.env.VERCEL_ENV !== 'production'
    res.status(500).json({
      error: 'Failed to fetch people from PCO',
      ...(isDev && { detail: err.message }),
    })
  }
}
