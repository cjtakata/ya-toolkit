// Attendance from YA Connect check-ins. Each person carries `visits`: their
// check-in dates ("yyyy-mm-dd", Pacific), newest first (api/_lib/visits.js).
import { MINISTRY } from '../../ministry.config.js'

const DAY_MS = 86_400_000
const utc = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const iso = t => new Date(t).toISOString().slice(0, 10)

export const todayThere = (now = new Date()) =>
  now.toLocaleDateString('en-CA', { timeZone: MINISTRY.texting.quietHours.timeZone })
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY_MS)
// Monday of that date's week
export function weekOf(d) {
  const t = utc(d)
  return iso(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS)
}
export const shortDate = d => (d
  ? new Date(utc(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  : '')

// "4 check-ins · last Nov 19" (for a person's profile)
export function visitSummary(visits = []) {
  if (!visits?.length) return null
  return { count: visits.length, last: visits[0] }
}

// The last `weeks` weeks (newest first): unique people checked in, by crew.
export function weekly(people, weeks = 8, today = todayThere()) {
  const thisWeek = weekOf(today)
  const rows = Array.from({ length: weeks }, (_, i) => ({ week: iso(utc(thisWeek) - i * 7 * DAY_MS), total: 0, byCrew: {} }))
  const at = Object.fromEntries(rows.map(r => [r.week, r]))
  for (const p of people) {
    for (const w of new Set((p.visits || []).map(weekOf))) {
      const r = at[w]; if (!r) continue
      r.total++
      r.byCrew[p.list || 'unassigned'] = (r.byCrew[p.list || 'unassigned'] || 0) + 1
    }
  }
  return rows
}

// The most recent day anyone checked in, and how many came.
export function lastGathering(people) {
  let date = null
  for (const p of people) if (p.visits?.[0] && (!date || p.visits[0] > date)) date = p.visits[0]
  return date ? { date, count: people.filter(p => p.visits?.includes(date)).length } : null
}

// Regulars who've stopped coming: in a crew (Active / Serving), checked in at
// least `minVisits` times, last one `days`+ days ago. Most recent first.
export function drifting(people, today = todayThere(), { minVisits = 2, days = 21 } = {}) {
  const members = new Set(MINISTRY.statuses.members)
  return people
    .filter(p => members.has(p.status) && (p.visits?.length || 0) >= minVisits && daysBetween(p.visits[0], today) >= days)
    .map(p => ({ person: p, last: p.visits[0], count: p.visits.length, daysAway: daysBetween(p.visits[0], today) }))
    .sort((a, b) => a.daysAway - b.daysAway)
}

// Connection-card guests a leader texted in the last `days` days: who checked
// in again after the text. records come from GET /api/cards?stats=1.
export function cameBack(records, days = 90, today = todayThere()) {
  const texted = records.filter(r => r.state === 'contacted' && r.contactedAt && r.personId &&
    daysBetween(todayThere(new Date(r.contactedAt)), today) <= days)
  const byGuest = new Map()
  for (const r of texted) {
    const textedOn = todayThere(new Date(r.contactedAt))
    const after = (r.visits || []).filter(d => d > textedOn).sort()
    const prev = byGuest.get(r.personId)
    if (!prev || textedOn < prev.textedOn) byGuest.set(r.personId, { ...r, textedOn, back: after[0] || null, times: after.length })
  }
  const list = [...byGuest.values()].sort((a, b) => (b.back ? 1 : 0) - (a.back ? 1 : 0) || b.textedOn.localeCompare(a.textedOn))
  return { texted: list.length, back: list.filter(g => g.back).length, list }
}
