// YA First-Time Guest Follow-Up — the PCO workflow every YA Connection Card lands in.
//
// The workflow card is the source of record:
//   Waiting for Claim step  → not claimed yet
//   Reach Out step          → claimed (by whoever the latest "Claimed by …" note names)
//   completed               → contacted ("Texted by …" note names who)
//
// Cards stay assigned to the Toolkit's own PCO account; leaders never need PCO
// access. Who did what lives in the card notes, which the Zapier text flow also
// writes in the same "Claimed by <Name> …" form.
import { pcoFetch, pcoFetchAll, pcoAction } from './pco.js'

export const WORKFLOW_ID  = '806472'
export const STEP_WAITING = '2247268'   // Waiting for Claim
export const STEP_REACH   = '2247270'   // Reach Out
const RECENT_DAYS = 30                   // how far back completed cards are listed

const cardPath = id => `/people/v2/workflows/${WORKFLOW_ID}/cards/${id}`

// ── Notes → who claimed / released / texted ─────────────────────
// Accepts both formats:
//   "Claimed by Vinny Diaz in YA Toolkit."                         (Toolkit)
//   "Claimed by Vinny Diaz (+14255550100) by text reply CLAIM 1234." (old Zapier flow)
const NOTE_RE = /^(Claimed|Released|Texted) by (.+?)(?: \(| in YA Toolkit| by text|\.?$)/

export function readNotes(notes) {
  let claimedBy = null, claimedAt = null, contactedBy = null
  const sorted = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const n of sorted) {
    const m = (n.note || '').match(NOTE_RE)
    if (!m) continue
    const [, kind, who] = m
    if (kind === 'Claimed')  { claimedBy = who.trim(); claimedAt = n.createdAt }
    if (kind === 'Released') { claimedBy = null; claimedAt = null }
    if (kind === 'Texted')   { contactedBy = who.trim(); if (!claimedBy) { claimedBy = contactedBy; claimedAt = n.createdAt } }
  }
  return { claimedBy, claimedAt, contactedBy }
}

async function getNotes(cardId) {
  const { data } = await pcoFetch(`${cardPath(cardId)}/notes?per_page=100`)
  return (data || []).map(n => ({ note: n.attributes?.note || '', createdAt: n.attributes?.created_at || '' }))
}

export async function addNote(cardId, note) {
  await pcoFetch(`${cardPath(cardId)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ data: { type: 'WorkflowCardNote', attributes: { note } } }),
  })
}

export async function getCard(cardId) {
  const { data } = await pcoFetch(cardPath(cardId))
  return data
}

const cardAction = (cardId, action) => pcoAction(`${cardPath(cardId)}/${action}`)
export const promote = id => cardAction(id, 'promote')
export const goBack  = id => cardAction(id, 'go_back')

// Where a card stands: 'waiting' | 'claimed' | 'contacted' | 'removed'
export function cardState(card) {
  const a = card.attributes || {}
  if (a.removed_at || a.stage === 'removed') return 'removed'
  if (a.completed_at || a.stage === 'completed') return 'contacted'
  const step = card.relationships?.current_step?.data?.id
  return step === STEP_REACH ? 'claimed' : 'waiting'
}

// Run fn over items with at most `limit` in flight (keeps PCO rate limits happy).
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]) }
  }))
  return out
}

// Open cards + cards completed in the last RECENT_DAYS, each with who/when from notes.
export async function listCards() {
  const [open, snoozed, done] = await Promise.all([
    pcoFetchAll(`/people/v2/workflows/${WORKFLOW_ID}/cards?where%5Bstage%5D=ready&per_page=100`),
    pcoFetchAll(`/people/v2/workflows/${WORKFLOW_ID}/cards?where%5Bstage%5D=snoozed&per_page=100`),
    pcoFetch(`/people/v2/workflows/${WORKFLOW_ID}/cards?where%5Bstage%5D=completed&order=-completed_at&per_page=100`),
  ])
  const cutoff = Date.now() - RECENT_DAYS * 86_400_000
  const recentDone = (done.data || []).filter(c => new Date(c.attributes?.completed_at || 0).getTime() >= cutoff)
  const cards = [...open.data, ...snoozed.data, ...recentDone]

  return mapLimit(cards, 6, async c => {
    const state = cardState(c)
    // Waiting cards have nobody to name yet — skip their notes request.
    const who = state === 'waiting' ? {} : readNotes(await getNotes(c.id))
    const a = c.attributes || {}
    return {
      cardId:      c.id,
      personId:    c.relationships?.person?.data?.id,
      state,
      submittedAt: a.created_at,
      claimedBy:   who.claimedBy || null,
      claimedAt:   who.claimedAt || (state !== 'waiting' ? a.moved_to_step_at : null),
      contactedBy: who.contactedBy || null,
      contactedAt: state === 'contacted' ? a.completed_at : null,
      overdue:     !!a.overdue,
    }
  })
}

// ── Actions (all re-read the card first; the card is the source of truth) ──
export class CardError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

async function loadForAction(cardId) {
  const card = await getCard(cardId)
  if (String(card?.relationships?.workflow?.data?.id) !== WORKFLOW_ID) {
    throw new CardError(404, 'That card is not in the YA follow-up workflow.')
  }
  const state = cardState(card)
  const who = state === 'waiting' ? {} : readNotes(await getNotes(cardId))
  return { card, state, who }
}

export async function claimCard(cardId, leader) {
  const { state, who } = await loadForAction(cardId)
  if (state === 'claimed' && who.claimedBy === leader) return { ok: true }
  if (state !== 'waiting') {
    throw new CardError(409, who.claimedBy ? `Already claimed by ${who.claimedBy}.` : 'This guest was already claimed.')
  }
  await promote(cardId)
  // If someone else promoted at the same moment, the card may have jumped past
  // Reach Out — step it back so a claim never counts as "contacted".
  if (cardState(await getCard(cardId)) === 'contacted') await goBack(cardId)
  await addNote(cardId, `Claimed by ${leader} in YA Toolkit.`)
  return { ok: true }
}

export async function releaseCard(cardId, leader) {
  const { state, who } = await loadForAction(cardId)
  if (state !== 'claimed') throw new CardError(409, 'Only a claimed guest can be released.')
  if (who.claimedBy && who.claimedBy !== leader) throw new CardError(403, `Only ${who.claimedBy} can release this guest.`)
  await goBack(cardId)
  await addNote(cardId, `Released by ${leader} in YA Toolkit.`)
  return { ok: true }
}

export async function markTexted(cardId, leader) {
  const { state, who } = await loadForAction(cardId)
  if (state === 'contacted') return { ok: true }
  if (state === 'claimed' && who.claimedBy && who.claimedBy !== leader) {
    throw new CardError(409, `${who.claimedBy} has claimed this guest.`)
  }
  if (state === 'waiting') {
    await promote(cardId)
    await addNote(cardId, `Claimed by ${leader} in YA Toolkit.`)
  }
  await promote(cardId)   // Reach Out is the last step → completes the card
  await addNote(cardId, `Texted by ${leader} in YA Toolkit.`)
  return { ok: true }
}
