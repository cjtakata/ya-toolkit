// Texting leaders through Clearstream, straight from the app (no Zapier).
// Ported from the Zapier "YA Mention" workflow so texts read exactly the same.
//
// Clearstream API: POST https://api.getclearstream.com/v1/texts with header
// X-Api-Key and fields to / from / text_header / text_body
// (https://api-docs.clearstream.io, "Send a Text").
//
// Env (Vercel):
//   CLEARSTREAM_API_KEY  secret; without it the app keeps using Zapier
//   CLEARSTREAM_TEST_TO  optional; when set, every text goes to this number
//                        instead, labelled "[TEST>Vinny,Ana]"
import { pcoFetchAll, FIELD } from './pco.js'
import { fetchPeopleByIds, crewToList } from './person.js'
import { MINISTRY } from '../../ministry.config.js'

const CLEARSTREAM_TEXTS = 'https://api.getclearstream.com/v1/texts'
const T = MINISTRY.texting

export const clearstreamReady = () => !!process.env.CLEARSTREAM_API_KEY

const asText = v => (v === null || v === undefined ? '' : String(v).trim())

function e164(n) {
  const d = asText(n).replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return d ? `+${d}` : ''
}

// Everyone with YA Status = Leader, with their crew and the number to text:
// primary mobile/cell, else any mobile/cell, else primary, else the first one.
export async function loadLeaders() {
  const { data } = await pcoFetchAll(
    `/people/v2/field_data?where%5Bfield_definition_id%5D=${FIELD.status}&where%5Bvalue%5D=${encodeURIComponent(MINISTRY.statuses.leader)}&per_page=100`)
  const ids = [...new Set(data.map(d => asText(d?.relationships?.customizable?.data?.id)).filter(Boolean))]
  if (!ids.length) return []
  const { data: people, included } = await fetchPeopleByIds(ids)
  return people.map(p => {
    const id = asText(p.id)
    const phones = included.filter(i => i.type === 'PhoneNumber' && asText(i?.relationships?.person?.data?.id) === id)
    const mobile = x => /mobile|cell/i.test(asText(x.attributes?.location))
    const phone = phones.find(x => x.attributes?.primary && mobile(x)) ?? phones.find(mobile)
      ?? phones.find(x => x.attributes?.primary) ?? phones[0]
    const crewDatum = included.find(i => i.type === 'FieldDatum'
      && asText(i?.relationships?.customizable?.data?.id) === id
      && asText(i?.relationships?.field_definition?.data?.id) === FIELD.crew)
    const first = asText(p.attributes?.first_name)
    const crew = crewToList(crewDatum?.attributes?.value)
    return {
      id,
      name: [first, asText(p.attributes?.last_name)].filter(Boolean).join(' '),
      first,
      mobile: e164(phone?.attributes?.e164 || phone?.attributes?.number),
      crew: crew === 'unassigned' ? null : crew,
    }
  })
}

// ── Keep every text to ONE SMS segment ──────────────────────────────────
// 160 characters of the basic (GSM-7) alphabet; one emoji drops the limit to
// 70, so texts are kept to plain characters. Clearstream puts the header in
// front ("Header: body"), so it counts too.
const SMS_LIMIT = 160
export function plain(s) {
  return s
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/→/g, '>').replace(/•/g, '-')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // José -> Jose
    .replace(/[^\n\x20-\x7E]/g, '')
}
const bodyRoom = header => SMS_LIMIT - header.length - 2
const firstName = name => name.trim().split(/\s+/)[0] || name

export function personLink(personId) {
  const base = (process.env.APP_URL || 'https://ya-toolkit.vercel.app').replace(/\/+$/, '')
  return /^\d+$/.test(String(personId)) ? `${base}/p/${personId}` : base
}

// Is it quiet hours right now (in the ministry's time zone)?
export function inQuietHours(date = new Date()) {
  const { from, until, timeZone } = T.quietHours
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(date))
  return !(h < from && h >= until)
}

// "Connor mentioned you on Levi: "can you take..." https://…/p/123"
export function mentionText({ authorName, guestName, via, quote, personId, prefix = '' }) {
  const room = bodyRoom(T.mentionHeader)
  const quoteText = plain(quote.replace(/\s+/g, ' ').trim())
  const head = plain(`${prefix}${firstName(authorName)} mentioned ${via} on ${firstName(guestName)}`)
  const link = ` ${personLink(personId)}`
  const left = room - head.length - link.length - 4            // ': "' + '"'
  if (left < 12) return head + link
  const q = quoteText.length > left ? quoteText.slice(0, left - 3).trimEnd() + '...' : quoteText
  return `${head}: "${q}"${link}`
}

// Who a note's mentions reach: each mentioned leader directly, every leader of
// each mentioned crew, never the author, one text per phone number (a direct
// mention wins over a crew one). Leaders without a mobile are reported.
export function recipients(leaders, { leaderIds, crews, authorId }) {
  const byMobile = new Map(), noPhone = new Set()
  const add = (l, via) => {
    if (l.id === String(authorId)) return
    if (!l.mobile) { noPhone.add(l.name); return }
    if (!byMobile.has(l.mobile) || via === 'you') byMobile.set(l.mobile, { leader: l, via })
  }
  const labels = Object.fromEntries(MINISTRY.crews.map(c => [c.key, c.label]))
  for (const c of crews) for (const l of leaders.filter(x => x.crew === c)) add(l, labels[c])
  for (const id of leaderIds) { const l = leaders.find(x => x.id === String(id)); if (l) add(l, 'you') }
  return { to: [...byMobile.values()].slice(0, T.maxRecipients), noPhone: [...noPhone] }
}

// One text through Clearstream. Retries once on rate limit / server error.
export async function sendText(to, body, header = T.mentionHeader) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(CLEARSTREAM_TEXTS, {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.CLEARSTREAM_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to, from: T.from, text_header: header, text_body: body }),
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) return { ok: true, status: (await r.json().catch(() => ({})))?.data?.status || null }
    if (attempt === 0 && (r.status === 429 || r.status >= 500)) { await new Promise(res => setTimeout(res, 1500)); continue }
    return { ok: false, status: r.status, error: (await r.text().catch(() => '')).slice(0, 200) }
  }
}
