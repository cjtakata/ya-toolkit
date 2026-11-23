// Planning Center API client + the custom-field ids this app reads and writes.
const PCO_BASE = 'https://api.planningcenteronline.com'

import { MINISTRY } from '../../ministry.config.js'

// Custom fields the app reads (writes are only ever allowed to these).
// Ids live in ministry.config.js.
export const FIELD = MINISTRY.pco.fields

export function authHeader() {
  return 'Basic ' + Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64')
}

// Errors keep PCO's details for the server log; endpoints never send them to the browser.
async function failure(res, url) {
  return new Error(`PCO ${res.status} ${url}: ${(await res.text()).slice(0, 300)}`)
}

export async function pcoFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${PCO_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) throw await failure(res, url)
  return res.json()
}

// Body-less POST for PCO action endpoints (promote, go_back, …). PCO rejects a
// JSON content type with an empty body, and these may answer with no JSON.
export async function pcoAction(path) {
  const url = `${PCO_BASE}${path}`
  const res = await fetch(url, { method: 'POST', headers: { Authorization: authHeader() } })
  if (!res.ok) throw await failure(res, url)
  const text = await res.text()
  try { return text ? JSON.parse(text) : null } catch { return null }
}

// Every page of a list, with `included` collected too.
export async function pcoFetchAll(path) {
  const data = [], included = []
  let url = `${PCO_BASE}${path}`
  while (url) {
    const page = await pcoFetch(url)
    data.push(...(page.data || []))
    if (page.included) included.push(...page.included)
    url = page.links?.next || null
  }
  return { data, included }
}

// One custom-field value on a person, or null.
export async function getDatum(personId, fieldId) {
  const { data } = await pcoFetch(
    `/people/v2/people/${personId}/field_data?where%5Bfield_definition_id%5D=${fieldId}&per_page=1`
  )
  return data?.[0] || null
}

// Create / update / clear one custom-field value on a person. Updates go to the
// TOP-LEVEL field_data endpoint: the nested /people/{id}/field_data/{id} PATCH
// mishandles select fields with a spurious "field datum already exists" 422.
export async function setDatum(personId, fieldId, value) {
  const existing = await getDatum(personId, fieldId)
  if (!value) {
    if (existing) await pcoFetch(`/people/v2/field_data/${existing.id}`, { method: 'DELETE' })
    return null
  }
  if (existing) {
    await pcoFetch(`/people/v2/field_data/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'FieldDatum', id: existing.id, attributes: { value } } }),
    })
    return existing.id
  }
  const created = await pcoFetch(`/people/v2/people/${personId}/field_data`, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'FieldDatum',
        attributes: { value },
        relationships: { field_definition: { data: { type: 'FieldDefinition', id: fieldId } } },
      },
    }),
  })
  return created.data?.id || null
}

// The valid option labels for a select-type field, cached briefly.
const _fieldOptions = {}
export async function getFieldOptions(fieldId) {
  const cached = _fieldOptions[fieldId]
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.opts
  const { data } = await pcoFetchAll(`/people/v2/field_definitions/${fieldId}/field_options?per_page=100`)
  const opts = data.map(o => o.attributes.value)
  _fieldOptions[fieldId] = { opts, at: Date.now() }
  return opts
}
