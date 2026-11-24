// Loading and shaping people for /api/people and /api/cards.
import { pcoFetchAll, FIELD } from './pco.js'
import { MINISTRY } from '../../ministry.config.js'

// Crew field value → the key the app uses. Normalized because PCO's stored
// values can carry stray whitespace (the "College Life " option has a trailing space).
const norm = s => (s || '').trim().toLowerCase()
const CREW_BY_VALUE = new Map(MINISTRY.crews.flatMap(c => [c.label, ...c.also].map(v => [norm(v), c.key])))
export function crewToList(value) {
  return CREW_BY_VALUE.get(norm(value)) || 'unassigned'
}

const GENDER = { M: 'Male', F: 'Female' }

function age(birthdate) {
  return birthdate ? Math.floor((Date.now() - new Date(birthdate).getTime()) / (365.25 * 86_400_000)) : null
}

// PCO's generated initials image isn't a real photo
export const realAvatar = url => (url && !/\/uploads\/initials\//.test(url) ? url : null)

export function normalizePerson(raw, included) {
  const a = raw.attributes, id = raw.id
  const mine = (type, key) => included.filter(i => i.type === type && i.relationships?.[key]?.data?.id === id)
  const primary = list => list.find(x => x.attributes.primary) || list[0]

  let crew = '', status = '', lastSeen = ''
  for (const d of mine('FieldDatum', 'customizable')) {
    const def = d.relationships?.field_definition?.data?.id
    if (def === FIELD.crew)   crew   = d.attributes.value || ''
    if (def === FIELD.status) status = d.attributes.value || ''
    if (def === FIELD.lastSeen) lastSeen = d.attributes.value || ''
  }

  return {
    id,
    name:   [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Unknown',
    email:  primary(mine('Email', 'person'))?.attributes?.address || '',
    phone:  primary(mine('PhoneNumber', 'person'))?.attributes?.number || null,
    age:    age(a.birthdate),
    gender: GENDER[a.gender] || a.gender || null,
    // When their Planning Center profile was created (not church membership)
    since:  a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null,
    avatar: realAvatar(a.avatar),
    list:   crewToList(crew),
    crew,
    status,
    lastSeen,   // raw Last Seen field (see _lib/visits.js)
  }
}

// People by id, 50 per request (PCO's where[id] limit), requests in parallel.
export async function fetchPeopleByIds(ids) {
  const batches = []
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50))
  const pages = await Promise.all(batches.map(b =>
    pcoFetchAll(`/people/v2/people?where%5Bid%5D=${b.join(',')}&include=phone_numbers,emails,field_data&per_page=100`)))
  return { data: pages.flatMap(p => p.data), included: pages.flatMap(p => p.included) }
}

// Shape a batch of people by id → { id: person }
export async function peopleById(ids) {
  if (!ids.length) return {}
  const { data, included } = await fetchPeopleByIds(ids)
  return Object.fromEntries(data.map(p => [p.id, normalizePerson(p, included)]))
}

// Everyone on the YA list: one of these YA Statuses. Archived people are
// included; the People list hides them unless its filter asks. (Older values
// still stored in PCO, e.g. "Missing", stay off the list.)
const YA_STATUSES = new Set(MINISTRY.statuses.all)
export async function loadYaPeople() {
  const { data } = await pcoFetchAll(`/people/v2/field_data?where%5Bfield_definition_id%5D=${FIELD.status}&per_page=100`)
  const ids = [...new Set(data.filter(d => YA_STATUSES.has(d.attributes.value)).map(d => d.relationships.customizable.data.id))]
  return Object.values(await peopleById(ids)).sort((a, b) => a.name.localeCompare(b.name))
}
