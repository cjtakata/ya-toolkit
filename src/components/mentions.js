// @mentions in notes: "@Vinny Diaz" (one leader) or "@College Life" (every
// leader in that crew). The note itself stays plain text in Planning Center;
// the ids/keys of what was picked travel alongside it to /api/notes, which
// checks them and asks Zapier to text the people mentioned.
import { LIST_META } from './listMeta.js'

export const CREW_TARGETS = Object.entries(LIST_META).map(([key, m]) => ({
  type: 'crew', key, label: m.crew, sub: 'All crew leaders',
}))

// Everything that can be mentioned: crews first, then leaders A–Z.
export function mentionTargets(leaders = []) {
  const people = [...leaders]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(l => ({ type: 'leader', id: l.id, label: l.name, sub: l.crewLabel || 'Leader' }))
  return [...CREW_TARGETS, ...people]
}

// The "@query" being typed just before the caret, or null. A query may hold
// spaces (full names) but not a newline, and the @ must start a word.
export function activeQuery(text, caret) {
  const before = text.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at < 0) return null
  if (at > 0 && !/\s/.test(before[at - 1])) return null
  const q = before.slice(at + 1)
  if (q.length > 30 || /\n/.test(q) || /\s{2}/.test(q)) return null
  return { start: at, query: q }
}

export function matchTargets(targets, query, limit = 6) {
  const q = query.trim().toLowerCase()
  if (!q) return targets.slice(0, limit)
  return targets
    .filter(t => t.label.toLowerCase().split(/\s+/).some(w => w.startsWith(q)) || t.label.toLowerCase().startsWith(q))
    .slice(0, limit)
}

// Only the picks whose "@Label" is still in the text, deduped.
export function mentionsInText(text, picked) {
  const seen = new Set()
  return picked.filter(t => {
    const k = t.type === 'crew' ? `c:${t.key}` : `l:${t.id}`
    if (seen.has(k) || !text.includes(`@${t.label}`)) return false
    seen.add(k)
    return true
  }).map(t => (t.type === 'crew' ? { type: 'crew', key: t.key } : { type: 'leader', id: t.id }))
}

// Split a note body into text and mention pieces for display.
// mine(t) → true when the mention includes the viewer (them, or their crew).
export function splitMentions(body, targets) {
  if (!body || !targets.length) return [{ text: body || '' }]
  const labels = [...new Set(targets.map(t => t.label))].sort((a, b) => b.length - a.length)
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`@(${labels.map(esc).join('|')})(?![\\w])`, 'g')
  const out = []
  let last = 0, m
  while ((m = re.exec(body))) {
    if (m.index > last) out.push({ text: body.slice(last, m.index) })
    out.push({ text: m[0], target: targets.find(t => t.label === m[1]) })
    last = m.index + m[0].length
  }
  if (last < body.length) out.push({ text: body.slice(last) })
  return out
}
