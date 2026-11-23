// Helpers for connection-card follow-ups (PCO workflow cards; see api/_lib/cards.js).
import { MINISTRY } from '../../ministry.config.js'

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

// The text leaders send — prefilled in Messages, still editable before sending.
// Each leader can save their own version (Profile tab → "Your text message",
// stored on their PCO profile). Placeholders are filled in per guest:
export const PLACEHOLDERS = [
  { token: '{first}', label: "Guest's first name" },
  { token: '{me}',    label: 'Your first name' },
  { token: '{crew}',  label: `Their crew, e.g. “${MINISTRY.crews[0].label} crew”` },
]

export const DEFAULT_MESSAGE = MINISTRY.defaultTextMessage

export function renderMessage(template, { guestFirst, leaderFirst, crew }) {
  const t = (template || '').trim() || DEFAULT_MESSAGE
  return t
    .replace(/\{first\}/gi, guestFirst || 'there')
    .replace(/\{me\}/gi, leaderFirst || `a ${MINISTRY.leaderNoun}`)
    .replace(/\{crew\}/gi, crew ? `${crew} crew` : 'one of our crews')
}

// sms: link that opens Messages with the number + body filled in.
// iOS wants "&body=", everything else "?body=".
export function smsHref(phone, body) {
  const num = String(phone || '').replace(/[^\d+]/g, '')
  const sep = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? '&' : '?'
  return `sms:${num}${sep}body=${encodeURIComponent(body)}`
}
