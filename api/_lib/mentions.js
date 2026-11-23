// @mentions in notes. The note is plain text in Planning Center; the client also
// sends what was picked ({type:'leader', id} / {type:'crew', key}). We keep only
// mentions that are real and still in the text, then hand them to the Zapier
// "YA Mention" workflow, which re-reads the note from PCO and texts the leaders.
import { pcoFetch } from './pco.js'
import { isLeaderPerson } from './auth.js'
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

// Fire the Zapier webhook. Never throws: a failed notification must not fail the note.
export async function notifyMentions(payload) {
  const url = process.env.ZAPIER_MENTION_HOOK
  if (!url) return { sent: false, reason: 'ZAPIER_MENTION_HOOK not set' }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) {
      console.error('mention webhook failed:', r.status, (await r.text()).slice(0, 200))
      return { sent: false, reason: `HTTP ${r.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.error('mention webhook failed:', err.message)
    return { sent: false, reason: err.message }
  }
}
