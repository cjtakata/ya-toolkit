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
import { put, get } from '@vercel/blob'
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
}
const store = () => _store || blobStore
const storeReady = () => !!(_store || process.env.BLOB_READ_WRITE_TOKEN)

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
  if (!devices.length) return 0
  // Each device gets its own badge number (its crew choice can differ).
  const payloadFor = d => {
    const badge = note.badgeFor ? note.badgeFor(d) : undefined
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
