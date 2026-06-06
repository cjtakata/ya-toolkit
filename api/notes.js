import { requireAuth } from './_lib/auth.js'
import { pcoFetch } from './_lib/pco.js'

const CATEGORY_NAME = 'Young Adults'
const NOTE_MAX = 10000

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
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const catId = await getYANoteCategoryId()

    // ── List notes for a person ───────────────────────────────
    if (req.method === 'GET') {
      const { personId } = req.query
      if (!/^\d+$/.test(String(personId))) {
        return res.status(400).json({ error: 'Invalid person id' })
      }

      const result = await pcoFetch(
        `/people/v2/people/${personId}/notes?per_page=100&order=-created_at`
      )
      const notes = (result.data || [])
        .filter(n => String(n.attributes?.note_category_id) === String(catId))
        .map(n => {
          const { author, body, followup } = parseNote(n.attributes?.note)
          return { id: n.id, author, body, followup, createdAt: n.attributes?.created_at }
        })

      return res.json(notes)
    }

    // ── Create a note on a person ─────────────────────────────
    if (req.method === 'POST') {
      const { personId, body, followup } = req.body || {}
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
      return res.json({
        id:        n.id,
        author,
        body:      text,
        followup:  !!followup,
        createdAt: n.attributes?.created_at,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (err) {
    console.error('notes.js error:', err)
    return res.status(500).json({ error: 'Failed to reach PCO notes', detail: err.message })
  }
}
