// Check-in history from the YA Connect kiosk (the iPad at /checkin in the
// ya-connect project).
//
// The kiosk writes today's date into each person's "Last Seen" field in
// Planning Center, which only ever holds the latest visit. So it also tells
// us about every check-in (POST /api/pco-webhook, signed with
// CHECKIN_SYNC_KEY), and we keep one empty file per visit in the private
// Blob store: checkins/<yyyy-mm-dd>/<personId>.json. The path is the record,
// so the same person checking in twice a day is one visit, and simultaneous
// check-ins never overwrite each other.
//
// A person's visits = those files + their Last Seen date (which covers
// check-ins from before this history started).
import { storeReady, kvRead, kvWrite, kvList } from './push.js'

const PREFIX = 'checkins/'
const MAX_DATES = 104   // per person, newest first
const DAY = /^\d{4}-\d{2}-\d{2}$/

export async function recordVisit(personId, date) {
  const t = DAY.test(date) ? Date.parse(`${date}T12:00:00Z`) : NaN
  const real = Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === date
  if (!/^\d+$/.test(String(personId)) || !real) throw new Error('bad visit')
  await kvWrite(`${PREFIX}${date}/${personId}.json`, { at: new Date().toISOString() })
  _cache = null
}

// { personId: Set(dates) } from the file names alone (no reads). Cached briefly.
let _cache = null, _cacheAt = 0
const CACHE_MS = 60_000
export async function visitIndex() {
  if (!storeReady()) return {}
  if (_cache && Date.now() - _cacheAt < CACHE_MS) return _cache
  const out = {}
  for (const p of await kvList(PREFIX)) {
    const m = p.match(/^checkins\/(\d{4}-\d{2}-\d{2})\/(\d+)\.json$/)
    if (m) (out[m[2]] ||= new Set()).add(m[1])
  }
  _cache = out; _cacheAt = Date.now()
  return out
}
export function __resetVisits() { _cache = null }

// Planning Center returns the date field as "11/22/2026" (or ISO) → "2026-11-22"
export function lastSeenDay(v) {
  const s = String(v || '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null
}

// → visit dates, newest first
export function visitsFor(index, personId, lastSeen) {
  const set = new Set(index[String(personId)] || [])
  const ls = lastSeenDay(lastSeen)
  if (ls) set.add(ls)
  return [...set].sort().reverse().slice(0, MAX_DATES)
}

// Add `visits` (dates, newest first) to each person. Never throws.
export async function withVisits(people) {
  const index = await visitIndex().catch(err => { console.error('visit index failed:', err.message); return {} })
  return people.map(p => (p ? { ...p, visits: visitsFor(index, p.id, p.lastSeen) } : p))
}

// A person's check-ins as events for their Notes & History feed. Kiosk
// visits carry the real time; a Last Seen date without a kiosk record (from
// before this history started) is placed at midday that day.
const FEED_VISITS = 30
export async function visitEvents(personId, lastSeen) {
  const index = await visitIndex()
  const days = visitsFor(index, personId, lastSeen).slice(0, FEED_VISITS)
  const recorded = new Set(index[String(personId)] || [])
  return Promise.all(days.map(async day => {
    const file = recorded.has(day) ? await kvRead(`${PREFIX}${day}/${personId}.json`).catch(() => null) : null
    return {
      id: `visit-${day}`, kind: 'workflow', event: 'checkin', text: 'Checked in at YA',
      at: file?.at || `${day}T20:00:00.000Z`,
    }
  }))
}
