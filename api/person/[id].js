import { requireAuth } from '../_lib/auth.js'
import { pcoFetch, getFieldDefinitions, getFieldOptions } from '../_lib/pco.js'
import { logEdit } from '../_lib/audit.js'

const FIELD_ENV_MAP = {
  crew:          'PCO_FIELD_CREW',
  needsFollowup: 'PCO_FIELD_NEEDS_FOLLOWUP',
  notes:         'PCO_FIELD_NOTES',
  status:        'PCO_FIELD_STATUS',
}

// Hardcoded allowlist: the PCO field-definition ID each writable key resolves
// to MUST be one of these. A misconfigured env var can therefore never
// redirect a write to a different field on the profile.
const EXPECTED_FIELD_IDS = {
  crew:          '431524',
  needsFollowup: '1065427',
  notes:         '1065428',
  status:        '1065431',
}

// Select-type fields whose submitted value must match a live PCO option.
const SELECT_FIELDS = { crew: '431524', status: '1065431' }

const NOTES_MAX = 5000

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return

  const { id } = req.query

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!/^\d+$/.test(String(id))) {
    return res.status(400).json({ error: 'Invalid person id' })
  }

  try {
    const { fields, fieldDataIds, personName } = req.body || {}

    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    // Only the three known keys are ever writable.
    const keys = Object.keys(fields).filter(k => k in FIELD_ENV_MAP)
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No writable fields provided' })
    }

    const fieldDefs = await getFieldDefinitions()

    // ── Value validation ──────────────────────────────────────────
    for (const key of keys) {
      if (!(key in SELECT_FIELDS)) continue
      const val = fields[key]
      if (typeof val !== 'string') {
        return res.status(422).json({ error: `Invalid ${key}`, detail: `${key} must be text.` })
      }
      if (val !== '') {
        const options = await getFieldOptions(SELECT_FIELDS[key])
        if (!options.includes(val)) {
          return res.status(422).json({
            error: `Invalid ${key}`,
            detail: `${key} must be one of: ${options.join(', ')} (or empty).`,
          })
        }
      }
    }
    if (keys.includes('notes')) {
      const notes = fields.notes
      if (typeof notes !== 'string') {
        return res.status(422).json({ error: 'Invalid notes', detail: 'Notes must be text.' })
      }
      if (notes.length > NOTES_MAX) {
        return res.status(422).json({ error: 'Notes too long', detail: `Max ${NOTES_MAX} characters.` })
      }
    }

    // ── Write (only the fields actually provided) ─────────────────
    const written        = {}
    const updatedDataIds = { ...(fieldDataIds || {}) }

    for (const key of keys) {
      const fieldName = process.env[FIELD_ENV_MAP[key]]
      const defId     = fieldName ? fieldDefs[fieldName] : null

      if (!defId) {
        return res.status(500).json({ error: 'Field not configured', detail: `Missing PCO field for ${key}` })
      }
      if (defId !== EXPECTED_FIELD_IDS[key]) {
        return res.status(500).json({
          error: 'Field mismatch',
          detail: `Refusing write: "${key}" resolved to unexpected field ${defId}`,
        })
      }

      const rawValue   = key === 'needsFollowup' ? String(!!fields[key]) : String(fields[key] ?? '')
      const existingId = fieldDataIds?.[key]

      if (existingId) {
        // Update via the TOP-LEVEL field_data endpoint. The nested
        // /people/{id}/field_data/{id} PATCH mishandles select fields and
        // 422s with a spurious "field datum already exists" error; the
        // top-level endpoint updates the value cleanly for all field types.
        await pcoFetch(`/people/v2/field_data/${existingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: { type: 'FieldDatum', id: existingId, attributes: { value: rawValue } },
          }),
        })
        written[key]        = fields[key]
        updatedDataIds[key] = existingId
      } else {
        const created = await pcoFetch(`/people/v2/people/${id}/field_data`, {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'FieldDatum',
              attributes: { value: rawValue },
              relationships: {
                field_definition: { data: { type: 'FieldDefinition', id: defId } },
              },
            },
          }),
        })
        written[key]        = fields[key]
        updatedDataIds[key] = created.data.id
      }
    }

    // Audit log (no-op if no webhook configured). Awaited so it fires
    // before the serverless function suspends.
    await logEdit({
      actor:      user.global_name || user.username,
      personId:   id,
      personName,
      changes:    written,
    })

    res.json({ id, ...written, _fieldDataIds: updatedDataIds })
  } catch (err) {
    console.error(`person/${id} PATCH error:`, err)
    res.status(500).json({ error: 'Failed to save to PCO', detail: err.message })
  }
}
