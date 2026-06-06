import { requireAuth } from './_lib/auth.js'
import { pcoFetch, pcoFetchAll, getFieldDefinitions, avatarColor, calcAge, fmtSince } from './_lib/pco.js'

// YA Status values shown in the app's care list.
// Active = engaged, Missing = drifted but still pursuing,
// TBD = under evaluation / not yet categorised.
// Friend, Alumni, Moved On are excluded (they drop off the care list).
const ACTIVE_STATUSES = new Set(['Active', 'Missing', 'TBD', 'Leader'])


function extractFieldValues(personId, included, fieldDefs) {
  const crewDefId        = fieldDefs[process.env.PCO_FIELD_CREW]
  const needsFollowupId  = fieldDefs[process.env.PCO_FIELD_NEEDS_FOLLOWUP]
  const notesDefId       = fieldDefs[process.env.PCO_FIELD_NOTES]
  const statusDefId      = fieldDefs[process.env.PCO_FIELD_STATUS]

  const defIdToKey = {}
  if (crewDefId)       defIdToKey[crewDefId]       = 'crew'
  if (needsFollowupId) defIdToKey[needsFollowupId] = 'needsFollowup'
  if (notesDefId)      defIdToKey[notesDefId]       = 'notes'
  if (statusDefId)     defIdToKey[statusDefId]      = 'status'

  const values  = {}
  const dataIds = {}

  for (const item of included) {
    if (item.type !== 'FieldDatum') continue
    if (item.relationships?.customizable?.data?.id !== personId) continue

    const defId = item.relationships?.field_definition?.data?.id
    const key   = defIdToKey[defId]
    if (!key) continue

    dataIds[key] = item.id
    const raw    = item.attributes.value

    if (key === 'needsFollowup') {
      values[key] = raw === 'true' || raw === true || raw === 'Yes' || raw === 'yes'
    } else {
      values[key] = raw || ''
    }
  }

  return { values, dataIds }
}

function extractPhone(personId, included) {
  const phones = included.filter(
    i => i.type === 'PhoneNumber' && i.relationships?.person?.data?.id === personId
  )
  const primary = phones.find(p => p.attributes.primary) || phones[0]
  return primary?.attributes?.number || null
}

function extractEmail(personId, included) {
  const emails = included.filter(
    i => i.type === 'Email' && i.relationships?.person?.data?.id === personId
  )
  const primary = emails.find(e => e.attributes.primary) || emails[0]
  return primary?.attributes?.address || ''
}

// Map a Crew custom field value to the list key used in the frontend.
// Normalized (trim + lowercase) because PCO's stored values can carry stray
// whitespace — e.g. the "College Life " option includes a trailing space.
function crewToList(value) {
  const v = (value || '').trim().toLowerCase()
  if (v === 'college life')  return 'college'
  if (v === 'early career')  return 'earlycareer'
  if (v === 'young professional' || v === 'young professionals') return 'youngpro'
  return 'unassigned'
}

function normalizePerson(raw, included, fieldDefs) {
  const a  = raw.attributes
  const id = raw.id

  const { values, dataIds } = extractFieldValues(id, included, fieldDefs)

  const firstName = a.first_name || ''
  const lastName  = a.last_name  || ''
  const name      = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
  const age       = calcAge(a.birthdate)

  // Determine list/group from Crew custom field only (normalized lookup)
  const list = crewToList(values.crew)
  const listNames    = { college: 'College Life', earlycareer: 'Early Career', youngpro: 'Young Professional', unassigned: 'Unassigned' }

  return {
    id,
    name,
    email:          extractEmail(id, included),
    phone:          extractPhone(id, included),
    age,
    gender:         a.gender || null,
    since:          fmtSince(a.created_at),
    avatar:         a.avatar || null,
    color:          avatarColor(name),
    list,
    listName:       listNames[list],
    crew:           values.crew         || '',
    needsFollowup:  values.needsFollowup ?? false,
    notes:          values.notes        || '',
    status:         values.status       || '',
    _fieldDataIds:  dataIds,
  }
}

// Fetch people in batches by IDs using PCO's where[id] param
async function fetchPeopleByIds(ids) {
  const BATCH = 50
  const allData     = []
  const allIncluded = []

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch  = ids.slice(i, i + BATCH)
    const idList = batch.join(',')
    // URL-encode brackets so Node fetch doesn't choke on them
    const { data, included } = await pcoFetchAll(
      `/people/v2/people?where%5Bid%5D=${idList}&include=phone_numbers,emails,field_data&per_page=100`
    )
    allData.push(...data)
    allIncluded.push(...included)
  }

  return { data: allData, included: allIncluded }
}

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
