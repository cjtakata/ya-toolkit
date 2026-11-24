// Push notifications to leaders' phones and computers (Web Push).
//
// Works for the home-screen app on iPhone (iOS 16.4+), Android, and desktop
// browsers. Each leader can turn it on per device (Profile → Notifications);
// the browser hands us a "subscription", which we keep in a private Vercel
// Blob file per leader: push/<pcoId>.json.
//
// Env (Vercel):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  the app's own push key pair
//   BLOB_READ_WRITE_TOKEN                 set by connecting the Blob store
import * as webpush from 'web-push'
import { put, get, list } from '@vercel/blob'
import { listCards } from './cards.js'
import { peopleById } from './person.js'
import { badgeCount } from '../../src/components/badgeCount.js'
import { MINISTRY } from '../../ministry.config.js'

const MAX_DEVICES = 10

export const pushReady = () =>
  !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && (process.env.BLOB_READ_WRITE_TOKEN || _store))

// ── Storage (private Blob; swappable for tests) ─────────────────────────
let _store = null
export function __setStore(s) { _store = s }
const blobStore = {
  async read(path) {
    const r = await get(path, { access: 'private', useCache: false })
    if (!r) return null
    return JSON.parse(await new Response(r.stream).text())
  },
  async write(path, obj) {
    await put(path, JSON.stringify(obj), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    })
  },
  async list(prefix) {
    const out = []
    let cursor
    do {
      const r = await list({ prefix, cursor, limit: 1000 })
      out.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : null
    } while (cursor)
    return out
  },
}
const store = () => _store || blobStore
export const storeReady = () => !!(_store || process.env.BLOB_READ_WRITE_TOKEN)
// Small JSON records in the same private store (e.g. note likes).
export const kvRead  = path => store().read(path).catch(() => null)
export const kvWrite = (path, obj) => store().write(path, obj)
export const kvList  = prefix => (store().list ? store().list(prefix) : Promise.resolve([]))

// First caller for a key gets true, later ones false (e.g. "this card's
// leaders were already told"). Without storage it can't remember: true.
export async function firstTime(key, info = {}) {
  if (!storeReady()) return true
  const path = `once/${key}.json`
  if (await store().read(path).catch(() => null)) return false
  await store().write(path, { at: new Date().toISOString(), ...info })
  return true
}
const pathFor = pcoId => `push/${pcoId}.json`

export async function devicesFor(pcoId) {
  return (await store().read(pathFor(pcoId)).catch(() => null))?.devices || []
}
async function saveDevices(pcoId, devices) {
  await store().write(pathFor(pcoId), { devices })
}

// A subscription is only what the browser gave us: an https endpoint + keys.
export function cleanSubscription(s) {
  const endpoint = String(s?.endpoint || '')
  const p256dh = String(s?.keys?.p256dh || ''), auth = String(s?.keys?.auth || '')
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 1000) return null
  if (!/^[\w-]{20,200}$/.test(p256dh) || !/^[\w-]{8,100}$/.test(auth)) return null
  return { endpoint, keys: { p256dh, auth } }
}

// The crew this device's Home focuses on (for its badge number).
const CREW_KEYS = new Set(['all', ...MINISTRY.crews.map(c => c.key)])
export const cleanCrew = c => (CREW_KEYS.has(String(c)) ? String(c) : 'all')

export async function addDevice(pcoId, subscription, label = '', crew = 'all') {
  const devices = (await devicesFor(pcoId)).filter(d => d.endpoint !== subscription.endpoint)
  devices.unshift({ ...subscription, label: String(label).slice(0, 80), crew: cleanCrew(crew), addedAt: new Date().toISOString() })
  await saveDevices(pcoId, devices.slice(0, MAX_DEVICES))
}

export async function removeDevice(pcoId, endpoint) {
  const devices = await devicesFor(pcoId)
  const left = devices.filter(d => d.endpoint !== endpoint)
  if (left.length !== devices.length) await saveDevices(pcoId, left)
}

// ── Sending ─────────────────────────────────────────────────────────────
let _send = (sub, payload, opts) => webpush.sendNotification(sub, payload, opts)
export function __setSender(fn) { _send = fn }
function configure() {
  // Apple requires a real https URL (or mailto:) as the sender contact.
  const url = (process.env.APP_URL || '').trim().replace(/\/+$/, '')
  const subject = /^https:\/\/[^/\s]+/.test(url) && !/localhost/.test(url) ? url : 'https://ya-toolkit.vercel.app'
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
}

// Send one notification to every device of one leader. Devices the push
// service says are gone (404/410) are forgotten. → number of devices reached
export async function pushTo(pcoId, note) {
  if (!pushReady()) return 0
  configure()
  const devices = await devicesFor(pcoId)
  if (!devices.length) {
    logLine(note.log, { id: pcoId, name: note.logName }, { channel: 'push', result: 'off' })
    return 0
  }
  // Each device gets its own badge number (its crew choice can differ):
  // guests waiting on them + their unread mentions.
  const unread = note.badgeFor ? (await unreadMentions(pcoId)).length : 0
  const payloadFor = d => {
    const waiting = note.badgeFor ? note.badgeFor(d) : undefined
    const badge = Number.isInteger(waiting) ? waiting + unread : undefined
    return JSON.stringify({
      title: note.title, body: note.body || '', url: note.url || '/people', tag: note.tag || undefined,
      ...(Number.isInteger(badge) ? { badge } : {}),
    })
  }
  let reached = 0
  const gone = []
  await Promise.all(devices.map(async d => {
    try {
      await _send({ endpoint: d.endpoint, keys: d.keys }, payloadFor(d), { TTL: 60 * 60 * 24, urgency: 'high' })
      reached++
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) gone.push(d.endpoint)
      else console.error('push failed:', err?.statusCode, String(err?.body || err?.message).slice(0, 200))
    }
  }))
  if (gone.length) {
    const left = (await devicesFor(pcoId)).filter(d => !gone.includes(d.endpoint))
    await saveDevices(pcoId, left).catch(() => {})
  }
  logLine(note.log, { id: pcoId, name: note.logName }, {
    channel: 'push', result: reached ? 'sent' : 'failed',
    detail: `${reached} of ${devices.length} device${devices.length === 1 ? '' : 's'}`,
  })
  return reached
}

// Many leaders at once (never throws). → { leaders reached, devices reached }
export async function pushToMany(pcoIds, note) {
  const counts = await Promise.all([...new Set(pcoIds)].map(id => pushTo(id, note).catch(err => {
    console.error('push to', id, 'failed:', err.message); return 0
  })))
  return { leaders: counts.filter(n => n > 0).length, devices: counts.reduce((a, b) => a + b, 0) }
}

// ── App-icon badge ──────────────────────────────────────────────────────
// Loads the open follow-up cards once (with each guest's crew) and returns
// (leaderName, crew) → the same number Home shows that leader.
export async function badgeContext() {
  const cards = (await listCards()).filter(c => c.state === 'waiting' || c.state === 'claimed')
  const ids = [...new Set(cards.filter(c => c.state === 'waiting').map(c => c.personId).filter(Boolean))]
  const people = ids.length ? await peopleById(ids) : {}
  const withCrew = cards.map(c => ({ ...c, person: { list: people[c.personId]?.list || 'unassigned' } }))
  return (me, crew) => badgeCount(withCrew, { me, crew })
}

// ── Unread mentions ─────────────────────────────────────────────────────
// mentions/<pcoId>.json: { unread: [{ noteId, personId, guest, author, quote, at }] }
// Added when someone @mentions a leader (or their crew); cleared when that
// leader opens the guest. Counted in the app-icon badge.
const MAX_UNREAD = 50
const unreadPath = pcoId => `mentions/${pcoId}.json`
export async function unreadMentions(pcoId) {
  if (!storeReady()) return []
  return (await kvRead(unreadPath(pcoId)))?.unread || []
}
export async function addUnreadMention(pcoIds, entry) {
  if (!storeReady()) return
  await Promise.all([...new Set(pcoIds.map(String))].map(async id => {
    const list = (await unreadMentions(id)).filter(m => m.noteId !== entry.noteId)
    list.unshift({ ...entry, at: entry.at || new Date().toISOString() })
    await kvWrite(unreadPath(id), { unread: list.slice(0, MAX_UNREAD) })
  }))
}
// Opening a guest marks every mention about them as read. → what's left
export async function markMentionsRead(pcoId, personId) {
  const list = await unreadMentions(pcoId)
  const left = list.filter(m => String(m.personId) !== String(personId))
  if (left.length !== list.length) await kvWrite(unreadPath(pcoId), { unread: left })
  return left
}

// ── Notification log ────────────────────────────────────────────────────
// One entry per thing the app notified leaders about (a mention, a new guest,
// a test), with what each leader got on each channel. Saved as its own file
// (log/<yyyy-mm-dd>/<time>-<rand>.json), so simultaneous ones never clash.
// Admins read the last 14 days in the app (Profile → Leader notifications).
//   channel: 'push' | 'text'
//   result:  'sent' | 'off' (notifications off) | 'failed' | 'held' (quiet hours)
//            | 'no-mobile' | 'zapier' (handed to the Zapier workflow) | 'test-number'
//            text 'off': texting is switched off in ministry.config.js
export function startLog(kind, summary, extra = {}) {
  return { kind, summary, at: new Date().toISOString(), ...extra, leaders: {} }
}
export function logLine(log, leader, line) {
  if (!log || !leader?.id) return
  const e = log.leaders[leader.id] ||= { id: String(leader.id), name: leader.name || '', lines: [] }
  if (leader.name && !e.name) e.name = leader.name
  e.lines.push(line)
}
export async function saveLog(log) {
  if (!log || !storeReady() || !Object.keys(log.leaders).length) return
  const day = log.at.slice(0, 10)
  await kvWrite(`log/${day}/${log.at.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`,
    { ...log, leaders: Object.values(log.leaders) })
}
export async function readLog(days = 14, max = 200) {
  if (!storeReady() || !store().list) return []
  const prefixes = Array.from({ length: days }, (_, i) => `log/${new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)}/`)
  const paths = (await Promise.all(prefixes.map(p => store().list(p).catch(() => [])))).flat()
    .sort().reverse().slice(0, max)
  return (await Promise.all(paths.map(p => kvRead(p)))).filter(Boolean)
}
