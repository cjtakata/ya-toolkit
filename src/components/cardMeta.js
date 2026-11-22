// Helpers for connection-card follow-ups (PCO workflow cards; see api/_lib/cards.js).

export const CARD_STATES = {
  waiting:   { label: 'Not claimed', cls: 'cardchip-waiting' },
  claimed:   { label: 'Claimed',     cls: 'cardchip-claimed' },
  contacted: { label: 'Texted',      cls: 'cardchip-contacted' },
}

export function timeAgo(iso) {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins || 1}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export function duration(fromIso, toIso) {
  if (!fromIso || !toIso) return ''
  const mins = Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000))
  if (mins < 60) return `${mins || 1}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h`
  return `${Math.round(hrs / 24)}d`
}

export function shortDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Hours a card has been waiting at its current stage (for "getting old" warnings).
export function hoursSince(iso) {
  return iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : 0
}

// The text leaders can send — prefilled in Messages, fully editable before sending.
export function welcomeText({ guestFirst, leaderFirst, crew }) {
  const where = crew ? `${crew} crew` : 'one of our crews'
  return `Hey ${guestFirst || 'there'}! It's ${leaderFirst || 'a leader'} from Venture YA 👋 ` +
    `So glad you filled out a connection card! I'd love to grab coffee or get you connected with ${where}. ` +
    `What does your week look like?`
}

// sms: link that opens Messages with the number + body filled in.
// iOS wants "&body=", everything else "?body=".
export function smsHref(phone, body) {
  const num = String(phone || '').replace(/[^\d+]/g, '')
  const sep = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? '&' : '?'
  return `sms:${num}${sep}body=${encodeURIComponent(body)}`
}
