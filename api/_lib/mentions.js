// @mentions in notes. The note is plain text in Planning Center; the client also
// sends what was picked ({type:'leader', id} / {type:'crew', key}). We keep only
// mentions that are real and still in the text, then text the leaders: directly
// through Clearstream when it's set up, otherwise via the Zapier "YA Mention"
// workflow (which re-reads the note from PCO).
import { pcoFetch } from './pco.js'
import { isLeaderPerson } from './auth.js'
import { clearstreamReady, inQuietHours, loadLeaders, recipients, mentionText, sendText } from './texting.js'
import { pushReady, pushTo, badgeContext } from './push.js'
import { MINISTRY } from '../../ministry.config.js'

export const CREWS = Object.fromEntries(MINISTRY.crews.map(c => [c.key, c.label]))
export const MAX_MENTIONS = 5

async function leaderName(id) {
  const { data } = await pcoFetch(`/people/v2/people/${id}`)
  return [data?.attributes?.first_name, data?.attributes?.last_name].filter(Boolean).join(' ')
}

// → { leaders: [{id, name}], crews: [{key, label}] }
export async function checkMentions(text, raw, authorId) {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_MENTIONS * 2) : []
  const leaders = [], crews = []
  const seen = new Set()
  for (const m of list) {
    if (leaders.length + crews.length >= MAX_MENTIONS) break
    if (m?.type === 'crew' && CREWS[m.key] && !seen.has(`c:${m.key}`)) {
      seen.add(`c:${m.key}`)
      if (text.includes(`@${CREWS[m.key]}`)) crews.push({ key: m.key, label: CREWS[m.key] })
    } else if (m?.type === 'leader' && /^\d+$/.test(String(m.id)) && !seen.has(`l:${m.id}`)) {
      const id = String(m.id)
      seen.add(`l:${id}`)
      if (id === String(authorId)) continue                 // no texting yourself
      if (!(await isLeaderPerson(id))) continue
      const name = await leaderName(id).catch(() => '')
      if (name && text.includes(`@${name}`)) leaders.push({ id, name })
    }
  }
  return { leaders, crews }
}

// Notify the mentioned leaders. Never throws: a failed notification must not
// fail the note.
// Texts:
//   Clearstream key set, and not quiet hours (or "Send now"): the app texts
//     them directly through Clearstream.
//   Otherwise: hand off to the Zapier "YA Mention" workflow as before; it
//     also holds quiet-hours texts until morning.
// Push notifications (leaders who turned them on), alongside the texts:
//   sent now unless it's quiet hours without "Send now" (then the 8am text
//   is the reminder).
// payload: { noteId, personId, authorId, authorName, leaderIds, crews, urgent, quote }
export async function notifyMentions(payload) {
  const quiet = inQuietHours()
  const direct = clearstreamReady() && (payload.urgent || !quiet)
  const wantPush = pushReady() && (payload.urgent || !quiet)

  // Shared Planning Center lookups, loaded once and only if needed.
  let leaders, guest
  const lookups = () => (leaders && guest) ? Promise.resolve() : Promise.all([
    loadLeaders().then(x => { leaders = x }),
    pcoFetch(`/people/v2/people/${payload.personId}`).then(({ data }) => {
      guest = [data?.attributes?.first_name, data?.attributes?.last_name].filter(Boolean).join(' ') || 'a guest'
    }),
  ])

  const texting = direct
    ? lookups().then(() => textDirectly(payload, leaders, guest)).then(r => ({ ...r, via: 'clearstream' }))
        .catch(err => { console.error('mention texting failed:', err.message); return { sent: false, via: 'clearstream', reason: err.message } })
    : notifyViaZapier(payload)
  const pushing = wantPush
    ? lookups().then(() => pushMentions(payload, leaders, guest))
        .catch(err => { console.error('mention push failed:', err.message); return null })
    : Promise.resolve(null)

  const [text, push] = await Promise.all([texting, pushing])
  return push ? { ...text, pushed: push.leaders } : text
}

// Who a mention reaches for push: mentioned leaders + every leader of a
// mentioned crew, never the author. (Phones don't matter here.)
export function pushRecipients(leaders, { leaderIds, crews, authorId }) {
  const ids = new Set(leaderIds.map(String))
  for (const l of leaders) if (l.crew && crews.includes(l.crew)) ids.add(l.id)
  ids.delete(String(authorId))
  return [...ids].filter(id => leaders.some(l => l.id === id))
}

async function pushMentions({ noteId, personId, authorId, authorName, leaderIds, crews, quote }, leaders, guest) {
  const labels = Object.fromEntries(MINISTRY.crews.map(c => [c.key, c.label]))
  const direct = new Set(leaderIds.map(String))
  const author = authorName.trim().split(/\s+/)[0] || authorName
  const guestFirst = guest.trim().split(/\s+/)[0] || guest
  const q = quote.replace(/\s+/g, ' ').trim()
  const body = `on ${guestFirst}: "${q.length > 140 ? q.slice(0, 137).trimEnd() + '...' : q}"`
  const to = pushRecipients(leaders, { leaderIds, crews, authorId })
  // Direct mentions say "you"; crew-only ones name the crew.
  const groups = new Map()
  for (const id of to) {
    const l = leaders.find(x => x.id === id)
    const via = direct.has(id) ? 'you' : (crews.map(c => labels[c]).find((_, i) => l.crew === crews[i]) || 'your crew')
    if (!groups.has(via)) groups.set(via, [])
    groups.get(via).push(id)
  }
  const countFor = await badgeContext().catch(err => { console.error('badge count failed:', err.message); return null })
  const sends = []
  for (const [via, ids] of groups) for (const id of ids) {
    const name = leaders.find(l => l.id === id)?.name
    sends.push(pushTo(id, {
      title: `${author} mentioned ${via}`, body,
      url: `/people#/person/${personId}`, tag: `mention-${noteId}`,
      badgeFor: countFor && name ? d => countFor(name, d.crew) : undefined,
    }).catch(err => { console.error('push to', id, 'failed:', err.message); return 0 }))
  }
  const reached = (await Promise.all(sends)).filter(n => n > 0).length
  return { leaders: reached }
}

async function textDirectly({ personId, authorId, authorName, leaderIds, crews, quote }, leaders, guest) {
  const { to, noPhone } = recipients(leaders, { leaderIds, crews, authorId })
  if (!to.length) return { sent: false, reason: 'nobody-to-text', noPhone }

  // Test mode: one text to the test number, labelled with who it was for.
  const testTo = process.env.CLEARSTREAM_TEST_TO
  const outgoing = testTo
    ? [{ mobile: testTo, name: 'TEST', body: mentionText({ authorName, guestName: guest, via: 'you', quote, personId,
        prefix: `[TEST>${to.map(r => r.leader.first).join(',')}] ` }) }]
    : to.map(r => ({ mobile: r.leader.mobile, name: r.leader.name,
        body: mentionText({ authorName, guestName: guest, via: r.via, quote, personId }) }))

  const results = []
  for (const o of outgoing) results.push({ name: o.name, ...(await sendText(o.mobile, o.body).catch(e => ({ ok: false, error: e.message }))) })
  const failed = results.filter(r => !r.ok)
  console.log('mention texts:', JSON.stringify({ test: !!testTo, sent: results.length - failed.length,
    failed: failed.map(f => ({ name: f.name, status: f.status, error: f.error })), noPhone }))
  return { sent: failed.length < results.length, texted: results.length - failed.length, failed: failed.length, noPhone }
}

async function notifyViaZapier(payload) {
  const url = process.env.ZAPIER_MENTION_HOOK
  if (!url) return { sent: false, via: 'zapier', reason: 'ZAPIER_MENTION_HOOK not set' }
  const { quote, ...hook } = payload   // Zapier re-reads the note itself
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hook),
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) {
      console.error('mention webhook failed:', r.status, (await r.text()).slice(0, 200))
      return { sent: false, via: 'zapier', reason: `HTTP ${r.status}` }
    }
    return { sent: true, via: 'zapier' }
  } catch (err) {
    console.error('mention webhook failed:', err.message)
    return { sent: false, via: 'zapier', reason: err.message }
  }
}
