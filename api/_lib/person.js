// Shared person loading/normalizing for /api/people and /api/cards.
import { pcoFetchAll, avatarColor, calcAge, fmtSince } from './pco.js'

function extractFieldValues(personId, included, fieldDefs) {
  const crewDefId           = fieldDefs[process.env.PCO_FIELD_CREW]
  const notesDefId          = fieldDefs[process.env.PCO_FIELD_NOTES]
  const statusDefId         = fieldDefs[process.env.PCO_FIELD_STATUS]

  const defIdToKey = {}
  if (crewDefId)           defIdToKey[crewDefId]           = 'crew'
  if (notesDefId)          defIdToKey[notesDefId]          = 'notes'
  if (statusDefId)         defIdToKey[statusDefId]         = 'status'

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

    values[key] = raw || ''
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
export function crewToList(value) {
  const v = (value || '').trim().toLowerCase()
  if (v === 'college life')  return 'college'
  if (v === 'early career')  return 'earlycareer'
  if (v === 'young professional' || v === 'young professionals') return 'youngpro'
  return 'unassigned'
}

export function normalizePerson(raw, included, fieldDefs) {
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
    crew:            values.crew           || '',
    notes:           values.notes          || '',
    status:          values.status         || '',
    _fieldDataIds:   dataIds,
  }
}

// Fetch people in batches by IDs using PCO's where[id] param
export async function fetchPeopleByIds(ids) {
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

