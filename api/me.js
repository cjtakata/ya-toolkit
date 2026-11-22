import { requireAuth } from './_lib/auth.js'
import { pcoFetch } from './_lib/pco.js'

// The signed-in leader, plus their personal text-message template.
//   GET  /api/me                      → { id, username, global_name, avatar, crews, textMessage }
//   POST /api/me { textMessage }      → saves it ('' resets to the app default)
//
// The template lives on the leader's OWN PCO profile ("YA Text Message", YA Details
// tab), so it follows them across devices. A leader can only change their own.
const TEXT_MESSAGE_DEF = '1151583'
const MAX_LEN = 1000

async function findDatum(personId) {
  const { data } = await pcoFetch(
    `/people/v2/people/${personId}/field_data?where%5Bfield_definition_id%5D=${TEXT_MESSAGE_DEF}&per_page=1`
  )
  return data?.[0] || null
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  const personId = String(user.id || '')
  const isPcoId = /^\d+$/.test(personId)

  if (req.method === 'POST') {
    if (!isPcoId) return res.status(400).json({ error: 'No Planning Center profile for this sign-in' })
    const text = String(req.body?.textMessage ?? '').trim()
    if (text.length > MAX_LEN) return res.status(422).json({ error: `Keep it under ${MAX_LEN} characters` })
    try {
      const existing = await findDatum(personId)
      if (!text) {
        if (existing) await pcoFetch(`/people/v2/field_data/${existing.id}`, { method: 'DELETE' }).catch(() => {})
      } else if (existing) {
        await pcoFetch(`/people/v2/field_data/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ data: { type: 'FieldDatum', id: existing.id, attributes: { value: text } } }),
        })
      } else {
        await pcoFetch(`/people/v2/people/${personId}/field_data`, {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'FieldDatum',
              attributes: { value: text },
              relationships: { field_definition: { data: { type: 'FieldDefinition', id: TEXT_MESSAGE_DEF } } },
            },
          }),
        })
      }
      return res.json({ ok: true, textMessage: text })
    } catch (err) {
      console.error('me.js save error:', err)
      return res.status(500).json({ error: "Couldn't save your message to Planning Center" })
    }
  }

  let textMessage = ''
  if (isPcoId) {
    try { textMessage = (await findDatum(personId))?.attributes?.value || '' }
    catch (err) { console.error('me.js read error:', err.message) }   // fall back to the default message
  }

  res.json({
    id:          user.id,
    username:    user.username,
    global_name: user.global_name,
    avatar:      user.avatar,
    // From the leader's PCO Crew field at sign-in (see auth/magic-request.js).
    crews:       user.crews || [],
    textMessage,
  })
}
