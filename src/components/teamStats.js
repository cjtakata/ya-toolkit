// Leader reach-out numbers for the admin dashboard, from /api/cards?stats=1.
// Each record: { state, submittedAt, claimedBy, claimedAt, contactedBy, contactedAt }.

export const RANGES = [
  { key: '7',   label: '7 days',  days: 7 },
  { key: '30',  label: '30 days', days: 30 },
  { key: '90',  label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
]

const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 3_600_000

export function median(nums) {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// 0.4 → "24m", 5.2 → "5h", 60 → "3d"  (null → "—")
export function formatHours(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

// leaderNames: every current YA Leader, so people with no reach-outs still show.
export function teamStats(records, leaderNames = [], days = 30, now = Date.now()) {
  const since = days == null ? -Infinity : now - days * 86_400_000
  const inRange = iso => !!iso && new Date(iso).getTime() >= since

  const texted = records.filter(r => r.state === 'contacted' && inRange(r.contactedAt))
  const team = {
    newCards:   records.filter(r => inRange(r.submittedAt)).length,
    texted:     texted.length,
    medianHrs:  median(texted.map(r => hoursBetween(r.submittedAt, r.contactedAt))),
    unclaimed:  records.filter(r => r.state === 'waiting').length,
  }

  const by = new Map()
  const row = name => {
    if (!by.has(name)) by.set(name, { name, texted: 0, hours: [], open: 0, oldestOpen: null })
    return by.get(name)
  }
  leaderNames.forEach(row)
  let unrecorded = 0
  for (const r of texted) {
    if (!r.contactedBy) { unrecorded++; continue }
    const x = row(r.contactedBy)
    x.texted++
    x.hours.push(hoursBetween(r.submittedAt, r.contactedAt))
  }
  // Claimed and not texted yet: a current snapshot, not limited to the range.
  for (const r of records) {
    if (r.state !== 'claimed' || !r.claimedBy) continue
    const x = row(r.claimedBy)
    x.open++
    if (!x.oldestOpen || r.submittedAt < x.oldestOpen) x.oldestOpen = r.submittedAt
  }

  const all = [...by.values()].map(({ hours, ...x }) => ({
    ...x,
    medianHrs: median(hours),
    waitingHrs: x.oldestOpen ? hoursBetween(x.oldestOpen, new Date(now).toISOString()) : null,
  }))
  const active = all.filter(x => x.texted || x.open)
    .sort((a, b) => b.texted - a.texted || b.open - a.open || a.name.localeCompare(b.name))
  const quiet = all.filter(x => !x.texted && !x.open).map(x => x.name).sort((a, b) => a.localeCompare(b))
  return { team, active, quiet, unrecorded }
}
