import { requireAuth } from './_lib/auth.js'
import { listEvents, addEvent, updateEvent, deleteEvent } from './_lib/sheets.js'

function clean(b = {}) {
  return {
    date:    String(b.date    || '').trim(),
    event:   String(b.event   || '').trim(),
    owner:   String(b.owner   || '').trim(),
    details: String(b.details || '').trim(),
    start:   String(b.start   || '').trim(),
    end:     String(b.end     || '').trim(),
    type:    String(b.type    || '').trim(),
    doc:     String(b.doc     || '').trim(),
  }
}

export default async function handler(req, res) {
  // Editing the calendar is leaders-only (same Discord session as the rest of the app).
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    if (req.method === 'GET') {
      return res.json(await listEvents())
    }

    if (req.method === 'POST') {
      const ev = clean(req.body)
      if (!ev.event || !ev.date) return res.status(400).json({ error: 'Event name and date are required' })
      return res.json(await addEvent(ev))
    }

    if (req.method === 'PUT') {
      const row = Number(req.body?.row)
      if (!Number.isInteger(row) || row < 2) return res.status(400).json({ error: 'Invalid row' })
      const ev = clean(req.body)
      if (!ev.event || !ev.date) return res.status(400).json({ error: 'Event name and date are required' })
      return res.json(await updateEvent(row, ev))
    }

    if (req.method === 'DELETE') {
      const row = Number(req.query?.row ?? req.body?.row)
      if (!Number.isInteger(row) || row < 2) return res.status(400).json({ error: 'Invalid row' })
      return res.json(await deleteEvent(row))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('calendar.js error:', err)
    return res.status(500).json({ error: 'Calendar write failed', detail: err.message })
  }
}
