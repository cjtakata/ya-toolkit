import { requireAuth } from './_lib/auth.js'
import { pcoFetch } from './_lib/pco.js'
import { personHistory } from './_lib/cards.js'
import { checkMentions, notifyMentions } from './_lib/mentions.js'
import { storeReady, kvRead, kvWrite } from './_lib/push.js'
import { MINISTRY } from '../ministry.config.js'

// Texting up to 25 leaders one by one can take a few seconds.
export const config = { maxDuration: 30 }

const CATEGORY_NAME = MINISTRY.pco.noteCategory
const NOTE_MAX = 10000
const likesPath = personId => `likes/${personId}.json`

// Resolve the "Young Adults" note category ID by name, cached briefly.
let _catId = null
let _catAt = 0
async function getYANoteCategoryId() {
  if (_catId && Date.now() - _catAt < 10 * 60_000) return _catId
  const { data } = await pcoFetch('/people/v2/note_categories?per_page=100')
  const cat = (data || []).find(c => c.attributes?.name === CATEGORY_NAME)
  if (!cat) throw new Error(`"${CATEGORY_NAME}" note category not found in PCO`)
  _catId = cat.id
  _catAt = Date.now()
  return _catId
}

// POST also takes mentions: [{type:'leader', id} | {type:'crew', key}] (see _lib/mentions.js).

// Notes are authored under the shared API account, so the leader's name is
// embedded as a "[Name] body" prefix. Parse it back out for display.
function parseNote(raw) {
  const text = raw || ''
  const m = text.match(/^\[([^\]]+)\]\s*([\s\S]*)$/)
  const author = m ? m[1] : null
  let body     = m ? m[2] : text
  // Follow-up notes are stored as "[Name] Followed up: …" — detect + strip the marker.
  let followup = false
  const fm = body.match(/^Followed up:\s*([\s\S]*)$/)
  if (fm) { followup = true; body = fm[1] }
  return { author, body, followup }
}

export default async function handler(req, res) {
  // Viewers may post notes (and @mention individual leaders, not whole crews);
  // every other change stays refused.
  const user = await requireAuth(req, res, { viewerMayPost: true })
  if (!user) return

  try {
    const catId = await getYANoteCategoryId()

    // ── List notes for a person ───────────────────────────────
    if (req.method === 'GET') {
      const { personId } = req.query
      if (!/^\d+$/.test(String(personId))) {
        return res.status(400).json({ error: 'Invalid person id' })
      }

      const [result, history] = await Promise.all([
        pcoFetch(`/people/v2/people/${personId}/notes?per_page=100&order=-created_at`),
        // Follow-up workflow events (card received, claimed, texted…) for the same feed
        req.query.history ? personHistory(personId).catch(err => { console.error('history:', err.message); return [] }) : [],
      ])
      const notes = (result.data || [])
        .filter(n => String(n.attributes?.note_category_id) === String(catId))
        .map(n => {
          const { author, body, followup } = parseNote(n.attributes?.note)
          return { id: n.id, kind: 'note', author, body, followup, createdAt: n.attributes?.created_at }
        })
      // Likes live in the app's own private store, one file per person.
      const likes = storeReady() ? ((await kvRead(likesPath(personId)))?.notes || {}) : {}
      for (const n of notes) {
        const by = likes[n.id] || []
        n.likes = by.map(x => x.name)
        n.likedByMe = by.some(x => x.id === String(user.id))
      }

      if (!req.query.history) return res.json(notes)
      const feed = [...notes, ...history.map(h => ({ ...h, createdAt: h.at }))]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      return res.json(feed)
    }

    // ── Like / unlike a note ──────────────────────────────────
    // POST { action: 'like', personId, noteId, like: true|false }
    if (req.method === 'POST' && req.body?.action === 'like') {
      const { personId, noteId } = req.body
      if (!/^\d+$/.test(String(personId)) || !/^\d+$/.test(String(noteId))) return res.status(400).json({ error: 'Invalid note' })
      if (!storeReady()) return res.status(503).json({ error: 'Likes aren’t set up yet.' })
      // Only real notes on this person, in the YA category.
      const { data: note } = await pcoFetch(`/people/v2/people/${personId}/notes/${noteId}`).catch(() => ({ data: null }))
      if (!note || String(note.attributes?.note_category_id) !== String(catId)) return res.status(404).json({ error: 'Note not found' })
      const rec = (await kvRead(likesPath(personId))) || { notes: {} }
      const me = { id: String(user.id), name: user.global_name || user.username || 'Leader' }
      const by = (rec.notes[noteId] || []).filter(x => x.id !== me.id)
      if (req.body.like !== false) by.push({ ...me, at: new Date().toISOString() })
      if (by.length) rec.notes[noteId] = by; else delete rec.notes[noteId]
      await kvWrite(likesPath(personId), rec)
      return res.json({ likes: by.map(x => x.name), likedByMe: req.body.like !== false })
    }

    // ── Create a note on a person ─────────────────────────────
    if (req.method === 'POST') {
      const viewer = user.role === 'viewer'
      const { personId, body, mentions, urgent } = req.body || {}
      const followup = !viewer && req.body?.followup
      if (!/^\d+$/.test(String(personId))) {
        return res.status(400).json({ error: 'Invalid person id' })
      }
      const text = String(body || '').trim()
      if (!text) return res.status(400).json({ error: 'Note cannot be empty' })
      if (text.length > NOTE_MAX) {
        return res.status(422).json({ error: `Note too long (max ${NOTE_MAX} characters)` })
      }

      const author   = user.global_name || user.username || 'Leader'
      const noteBody = followup ? `[${author}] Followed up: ${text}` : `[${author}] ${text}`

      const created = await pcoFetch(`/people/v2/people/${personId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'Note',
            attributes: { note: noteBody },
            relationships: {
              note_category: { data: { type: 'NoteCategory', id: catId } },
            },
          },
        }),
      })

      const n = created.data

      // @mentions → text the leaders (Clearstream directly, or the Zapier "YA Mention" workflow).
      // The note is already saved; a failed notification only gets logged.
      // Viewers can @mention individual leaders, but not whole crews.
      const allowed = viewer && Array.isArray(mentions) ? mentions.filter(m => m?.type === 'leader') : mentions
      const tagged = await checkMentions(text, allowed, user.id).catch(err => {
        console.error('mention check failed:', err.message)
        return { leaders: [], crews: [] }
      })
      let notified = null
      if (tagged.leaders.length || tagged.crews.length) {
        const r = await notifyMentions({
          noteId:     n.id,
          personId:   String(personId),
          authorId:   String(user.id),
          authorName: author,
          leaderIds:  tagged.leaders.map(l => l.id),
          crews:      tagged.crews.map(c => c.key),
          urgent:     urgent === true,   // "Send now": skip quiet hours (9pm–8am Pacific)
          quote:      text,              // what the leaders' text quotes (the note minus "[Author]")
        })
        notified = { ...r, leaders: tagged.leaders.map(l => l.name), crews: tagged.crews.map(c => c.label) }
      }

      return res.json({
        id:        n.id,
        author,
        body:      text,
        followup:  !!followup,
        createdAt: n.attributes?.created_at,
        notified,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (err) {
    console.error('notes.js error:', err)
    return res.status(500).json({ error: "Couldn't reach Planning Center notes. Try again." })
  }
}
