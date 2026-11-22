import { requireAuth } from './_lib/auth.js'
import { pcoFetchAll } from './_lib/pco.js'

// Summary for the Hub home page: how many people are waiting for a leader to
// claim their follow-up (Needs Follow-Up = true AND Assigned Leader is blank),
// broken down by crew. Same population as the People list (active YA statuses).

const FOLLOWUP_DEF = '1065427'  // Needs Follow-Up? (boolean)
const STATUS_DEF   = '1065431'  // YA Status (select)
const CREW_DEF     = '431524'   // Crew (select)
const ASSIGNED_DEF = '1067887'  // Assigned Leader (text)
const ACTIVE_STATUSES = new Set(['Active', 'Missing', 'TBD', 'Leader', 'First Time Guest'])

function crewToKey(v) {
  const s = (v || '').trim().toLowerCase()
  if (s === 'college life') return 'college'
  if (s === 'early career') return 'earlycareer'
  if (s === 'young professional' || s === 'young professionals') return 'youngpro'
  return 'unassigned'
}

function daysSince(iso) {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    // 1. Everyone flagged Needs Follow-Up = true, and when they were flagged.
    const { data: fuData } = await pcoFetchAll(
      `/people/v2/field_data?where%5Bfield_definition_id%5D=${FOLLOWUP_DEF}&per_page=100`
    )
    const flaggedAt = {}
    for (const d of fuData) {
      const v = String(d.attributes?.value || '').toLowerCase()
      if (v === 'true' || v === 'yes') {
        const pid = d.relationships?.customizable?.data?.id
        if (pid) flaggedAt[pid] = d.attributes?.updated_at || d.attributes?.created_at
      }
    }
    const ids = Object.keys(flaggedAt)

    const byCrew = { college: 0, earlycareer: 0, youngpro: 0, unassigned: 0 }
    let total = 0, claimed = 0, oldestDays = 0

    // 2. Their status / crew / assigned leader, batched.
    const BATCH = 50
    for (let i = 0; i < ids.length; i += BATCH) {
      const idList = ids.slice(i, i + BATCH).join(',')
      const { data, included } = await pcoFetchAll(
        `/people/v2/people?where%5Bid%5D=${idList}&include=field_data&per_page=100`
      )
      const fields = {}   // personId → { defId: value }
      for (const inc of included) {
        if (inc.type !== 'FieldDatum') continue
        const pid = inc.relationships?.customizable?.data?.id
        const def = inc.relationships?.field_definition?.data?.id
        if (!pid || !def) continue
        ;(fields[pid] ||= {})[def] = inc.attributes?.value || ''
      }

      for (const p of data) {
        const f = fields[p.id] || {}
        if (!ACTIVE_STATUSES.has(f[STATUS_DEF])) continue
        if ((f[ASSIGNED_DEF] || '').trim()) { claimed++; continue }
        total++
        byCrew[crewToKey(f[CREW_DEF])]++
        oldestDays = Math.max(oldestDays, daysSince(flaggedAt[p.id]))
      }
    }

    res.setHeader('Cache-Control', 'private, no-store')
    res.json({ total, byCrew, claimed, oldestDays })
  } catch (err) {
    console.error('followups.js error:', err)
    res.status(500).json({ error: 'Failed to load follow-ups' })
  }
}
