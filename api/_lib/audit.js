const FIELD_LABELS = {
  crew:          'Crew',
  needsFollowup: 'Needs Follow-Up?',
  notes:         'YA Notes',
}

function fmtValue(key, value) {
  if (key === 'needsFollowup') return value ? 'Yes' : 'No'
  if (key === 'notes') {
    const s = String(value || '')
    if (!s) return '(cleared)'
    return `"${s.length > 80 ? s.slice(0, 80) + '…' : s}"`
  }
  return value ? String(value) : '(none)'
}

// Posts an audit line to a private Discord channel. No-op if the webhook
// env var isn't set, so the app works fine without it configured.
export async function logEdit({ actor, personId, personName, changes }) {
  const url = process.env.DISCORD_AUDIT_WEBHOOK
  if (!url) return

  const who     = actor || 'Unknown leader'
  const subject = personName ? `${personName}` : `person ${personId}`
  const lines   = Object.entries(changes)
    .map(([k, v]) => `• ${FIELD_LABELS[k] || k} → ${fmtValue(k, v)}`)

  const link    = `https://ya-toolkit.vercel.app/people#/person/${personId}`
  const content = `📝 **${who}** updated **${subject}**\n${lines.join('\n')}\n<${link}>`

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions parse:[] ensures a note containing @something
      // can never ping anyone in the audit channel.
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })
  } catch (err) {
    console.error('audit webhook failed:', err.message)
  }
}
