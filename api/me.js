import { requireAuth } from './_lib/auth.js'
import { pcoFetch } from './_lib/pco.js'

// The signed-in leader, plus their personal text-message template.
//   GET  /api/me                      → { id, username, global_name, nickname, avatar, crews, textMessage }
//   POST /api/me { textMessage }      → saves it ('' resets to the app default)
//   POST /api/me { nickname }         → saves their "YA Nickname" ('' clears it) — a YA Details
//                                        field, NOT PCO's own nickname, so it never shows elsewhere in PCO
//   POST /api/me { photo }            → photo = data: URL (JPEG/PNG, resized on the phone);
//                                        uploaded to PCO and set as their profile photo
//
// The template lives on the leader's OWN PCO profile ("YA Text Message", YA Details
// tab), so it follows them across devices. A leader can only change their own.
const TEXT_MESSAGE_DEF = '1151583'
const NICKNAME_DEF     = '1151595'   // "YA Nickname" (YA Details tab) — app-only
const MAX_LEN = 1000
const NICKNAME_MAX = 40
const PHOTO_MAX_BYTES = 2_500_000

// PCO's generated "initials" image isn't a real photo — treat it as none
const realAvatar = url => (url && !/\/uploads\/initials\//.test(url) ? url : null)

async function getPerson(personId) {
  const { data } = await pcoFetch(`/people/v2/people/${personId}`)
  return data?.attributes || {}
}

async function setPerson(personId, attributes) {
  const { data } = await pcoFetch(`/people/v2/people/${personId}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { type: 'Person', id: personId, attributes } }),
  })
  return data?.attributes || {}
}

// PCO photos: upload the file to PCO's upload service, then point the person's
// avatar at the returned file id.
async function uploadPhoto(personId, dataUrl) {
  const m = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!m) throw Object.assign(new Error('Unsupported image'), { status: 400 })
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > PHOTO_MAX_BYTES) throw Object.assign(new Error('Photo is too large'), { status: 413 })
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: m[1] }), `avatar.${m[1].split('/')[1]}`)
  const creds = Buffer.from(`${process.env.PCO_APP_ID}:${process.env.PCO_SECRET}`).toString('base64')
  const up = await fetch('https://upload.planningcenteronline.com/v2/files', {
    method: 'POST', headers: { Authorization: `Basic ${creds}` }, body: form,
  })
  if (!up.ok) throw new Error(`PCO upload ${up.status}: ${(await up.text()).slice(0, 200)}`)
  const file = (await up.json()).data
  const fileId = (Array.isArray(file) ? file[0] : file)?.id
  if (!fileId) throw new Error('PCO upload returned no file id')
  const attrs = await setPerson(personId, { avatar: fileId })
  return realAvatar(attrs.avatar)
}

async function findDatum(personId, defId = TEXT_MESSAGE_DEF) {
  const { data } = await pcoFetch(
    `/people/v2/people/${personId}/field_data?where%5Bfield_definition_id%5D=${defId}&per_page=1`
  )
  return data?.[0] || null
}

// Create / update / clear one custom-field value on the leader's own profile
async function setDatum(personId, defId, value) {
  const existing = await findDatum(personId, defId)
  if (!value) {
    if (existing) await pcoFetch(`/people/v2/field_data/${existing.id}`, { method: 'DELETE' }).catch(() => {})
  } else if (existing) {
    await pcoFetch(`/people/v2/field_data/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { type: 'FieldDatum', id: existing.id, attributes: { value } } }),
    })
  } else {
    await pcoFetch(`/people/v2/people/${personId}/field_data`, {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'FieldDatum',
          attributes: { value },
          relationships: { field_definition: { data: { type: 'FieldDefinition', id: defId } } },
        },
      }),
    })
  }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  const personId = String(user.id || '')
  const isPcoId = /^\d+$/.test(personId)

  if (req.method === 'POST' && isPcoId && req.body?.photo !== undefined) {
    try {
      const avatar = await uploadPhoto(personId, req.body.photo)
      return res.json({ ok: true, avatar })
    } catch (err) {
      console.error('me.js photo error:', err.message)
      return res.status(err.status || 500).json({ error: err.status ? err.message : "Couldn't update your photo in Planning Center" })
    }
  }

  if (req.method === 'POST' && isPcoId && req.body?.nickname !== undefined) {
    const nickname = String(req.body.nickname || '').trim().replace(/\s+/g, ' ')
    if (nickname.length > NICKNAME_MAX) return res.status(422).json({ error: `Keep it under ${NICKNAME_MAX} characters` })
    try {
      await setDatum(personId, NICKNAME_DEF, nickname)
      return res.json({ ok: true, nickname })
    } catch (err) {
      console.error('me.js nickname error:', err.message)
      return res.status(500).json({ error: "Couldn't save your nickname" })
    }
  }

  if (req.method === 'POST') {
    if (!isPcoId) return res.status(400).json({ error: 'No Planning Center profile for this sign-in' })
    const text = String(req.body?.textMessage ?? '').trim()
    if (text.length > MAX_LEN) return res.status(422).json({ error: `Keep it under ${MAX_LEN} characters` })
    try {
      await setDatum(personId, TEXT_MESSAGE_DEF, text)
      return res.json({ ok: true, textMessage: text })
    } catch (err) {
      console.error('me.js save error:', err)
      return res.status(500).json({ error: "Couldn't save your message to Planning Center" })
    }
  }

  let textMessage = '', nickname = '', avatar = user.avatar || null
  if (isPcoId) {
    const [datum, nick, person] = await Promise.all([
      findDatum(personId).catch(err => { console.error('me.js read error:', err.message); return null }),
      findDatum(personId, NICKNAME_DEF).catch(() => null),
      getPerson(personId).catch(err => { console.error('me.js person error:', err.message); return {} }),
    ])
    textMessage = datum?.attributes?.value || ''
    nickname    = nick?.attributes?.value || ''
    avatar      = realAvatar(person.avatar) || avatar
  }

  res.json({
    id:          user.id,
    username:    user.username,
    global_name: user.global_name,   // full name — the identity used on claims and notes
    nickname,                        // "YA Nickname" — what they like to be called in this app
    avatar,
    // From the leader's PCO Crew field at sign-in (see auth/magic-request.js).
    crews:       user.crews || [],
    textMessage,
  })
}
