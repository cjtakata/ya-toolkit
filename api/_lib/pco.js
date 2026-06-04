const PCO_BASE = 'https://api.planningcenteronline.com'

function authHeader() {
  const creds = Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64')
  return `Basic ${creds}`
}

export async function pcoFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${PCO_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PCO ${res.status} ${url}: ${text}`)
  }
  return res.json()
}

// Fetches all pages, collecting both data and included arrays
export async function pcoFetchAll(path) {
  const allData     = []
  const allIncluded = []
  let url = `${PCO_BASE}${path}`
  while (url) {
    const page = await pcoFetch(url)
    allData.push(...(page.data || []))
    if (page.included) allIncluded.push(...page.included)
    url = page.links?.next || null
  }
  return { data: allData, included: allIncluded }
}

// Module-level cache (lives for the duration of a warm function invocation)
let _fieldDefs    = null
let _fieldDefsAt  = 0

export async function getFieldDefinitions() {
  if (_fieldDefs && Date.now() - _fieldDefsAt < 5 * 60_000) return _fieldDefs

  const { data } = await pcoFetchAll('/people/v2/field_definitions?per_page=100')
  _fieldDefs   = Object.fromEntries(data.map(d => [d.attributes.name, d.id]))
  _fieldDefsAt = Date.now()
  return _fieldDefs
}

// Resolve a field name from .env to its PCO field definition ID
export function resolveFieldId(fieldDefs, envVar) {
  const name = process.env[envVar]
  if (!name) return null
  return fieldDefs[name] ?? null
}

// Fetch the valid option labels for a select-type custom field, cached briefly.
const _fieldOptions = {}
export async function getFieldOptions(defId) {
  const cached = _fieldOptions[defId]
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.opts
  const { data } = await pcoFetchAll(`/people/v2/field_definitions/${defId}/field_options?per_page=100`)
  const opts = data.map(o => o.attributes.value)
  _fieldOptions[defId] = { opts, at: Date.now() }
  return opts
}

export function avatarColor(name) {
  const palette = [
    '#6366f1','#0ea5e9','#ec4899','#f59e0b','#10b981',
    '#8b5cf6','#ef4444','#14b8a6','#f97316','#84cc16','#a855f7','#3b82f6',
  ]
  let hash = 0
  for (const c of name) hash = (hash << 5) - hash + c.charCodeAt(0)
  return palette[Math.abs(hash) % palette.length]
}

export function calcAge(birthdate) {
  if (!birthdate) return null
  const diff = Date.now() - new Date(birthdate).getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}

export function fmtSince(createdAt) {
  if (!createdAt) return null
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
