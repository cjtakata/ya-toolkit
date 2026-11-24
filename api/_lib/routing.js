// New guest routing: a new card in the follow-up workflow → tell that crew's
// leaders. Ported from the Zapier "YA New Guest Routing" workflow.
//
// For each new card:
//   1. Crew: the one on their profile wins; otherwise from their age
//      (ministry.config.js crewByAge). Saved to Planning Center if blank.
//   2. Only if the card is still Waiting for Claim and it's the guest's only
//      open card (a second one means leaders were already told), and only
//      once per card: tell that crew's leaders (no crew → admins).
//
// NEW_GUEST_ROUTING (Vercel env):
//   unset / "push"  push notifications only; Zapier still sets the crew and
//                   sends the texts (no double texts during the switch)
//   "app"           the app also sets the crew and texts through Clearstream
//                   (turn the Zapier workflow off at the same time)
// With texting off (ministry.config.js) the Zapier workflow is off too, so the
// app always sets the crew, sends no texts and logs them as "off".
import { pcoFetch, getFieldOptions, setDatum, FIELD } from './pco.js'
import { crewToList } from './person.js'
import { adminIds } from './auth.js'
import { WORKFLOW_ID, STEP_WAITING } from './cards.js'
import { textingOn, clearstreamReady, loadLeaders, plain, personLink, sendText } from './texting.js'
import { pushReady, pushTo, badgeContext, firstTime, startLog, logLine, saveLog } from './push.js'
import { MINISTRY } from '../../ministry.config.js'

const LABEL = Object.fromEntries(MINISTRY.crews.map(c => [c.key, c.label]))
export const routingMode = () => (String(process.env.NEW_GUEST_ROUTING || '').trim().toLowerCase() === 'app' ? 'app' : 'push')

// Age on a given day (yyyy-mm-dd in the ministry's time zone). null if unknown.
export function ageOn(birthdate, todayIso) {
  const m = String(birthdate || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const [ty, tm, td] = todayIso.slice(0, 10).split('-').map(Number)
  let age = ty - y
  if (tm < mo || (tm === mo && td < d)) age -= 1
  return age
}
export function crewForAge(age) {
  if (age === null) return null
  return MINISTRY.crewByAge.find(b => age >= b.min && age <= b.max)?.crew || null
}
const todayThere = () => new Date().toLocaleDateString('en-CA', { timeZone: MINISTRY.texting.quietHours.timeZone })

// Crew guests → that crew's leaders; no crew → the admins.
export function leadersFor(leaders, crew, admins = adminIds()) {
  return crew ? leaders.filter(l => l.crew === crew) : leaders.filter(l => admins.includes(l.id))
}

// "Levi Taggart (College Life) filled out a card. Claim & text them: <link>"
export function newGuestText(guestName, crew, age, personId) {
  const where = crew ? LABEL[crew] : age !== null && age < (MINISTRY.crewByAge[0]?.min ?? 0) ? `age ${age}, needs a crew` : 'no birthday, needs a crew'
  return plain(`${guestName} (${where}) filled out a card. Claim & text them: ${personLink(personId)}`)
}

// → a summary of what happened (logged by the webhook)
export async function routeNewCard({ cardId, personId, workflowId }) {
  if (String(workflowId || WORKFLOW_ID) !== WORKFLOW_ID) return { skipped: 'other-workflow' }
  if (!/^\d+$/.test(String(cardId)) || !/^\d+$/.test(String(personId))) return { skipped: 'missing-ids' }
  const mode = routingMode()

  // The card now, and any other open cards this guest has in the workflow.
  const [cardRes, allRes, personRes, crewDatum] = await Promise.all([
    pcoFetch(`/people/v2/workflows/${WORKFLOW_ID}/cards/${cardId}`).catch(() => null),
    pcoFetch(`/people/v2/people/${personId}/workflow_cards?per_page=100`),
    pcoFetch(`/people/v2/people/${personId}`),
    pcoFetch(`/people/v2/people/${personId}/field_data?where%5Bfield_definition_id%5D=${FIELD.crew}&per_page=1`),
  ])
  const card = cardRes?.data
  const otherOpen = (allRes.data || []).filter(x => String(x.id) !== String(cardId)
    && String(x.relationships?.workflow?.data?.id) === WORKFLOW_ID && !x.attributes?.completed_at && !x.attributes?.removed_at)

  const a = personRes.data?.attributes || {}
  const guest = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'A new guest'
  const age = ageOn(a.birthdate, todayThere())
  const existing = crewToList(crewDatum.data?.[0]?.attributes?.value)
  const existingCrew = existing === 'unassigned' ? null : existing
  const crew = existingCrew || crewForAge(age)
  const base = { cardId: String(cardId), guest, age, crew, crewFrom: existingCrew ? 'profile' : crew ? 'age' : 'none', mode }

  // Save the crew from their age (Zapier does it otherwise, until it's off).
  let crewSet = false
  if ((mode === 'app' || !textingOn()) && !existingCrew && crew) {
    const opts = await getFieldOptions(FIELD.crew).catch(() => [])
    const value = opts.find(o => String(o).trim().toLowerCase() === LABEL[crew].toLowerCase()) || LABEL[crew]
    crewSet = await setDatum(String(personId), FIELD.crew, value).then(() => true).catch(err => { console.error('set crew failed:', err.message); return false })
  }

  if (!card) return { ...base, crewSet, skipped: 'card-not-found' }
  const ca = card.attributes || {}
  if (ca.removed_at || ca.completed_at) return { ...base, crewSet, skipped: ca.removed_at ? 'card-removed' : 'card-completed' }
  if (String(card.relationships?.current_step?.data?.id) !== STEP_WAITING) return { ...base, crewSet, skipped: 'not-waiting-for-claim' }
  if (otherOpen.length) return { ...base, crewSet, skipped: 'guest-already-has-open-card' }

  const leaders = await loadLeaders()
  const intended = leadersFor(leaders, crew)
  if (!intended.length) return { ...base, crewSet, skipped: 'no-leaders-for-crew' }

  // Once per card, even if Planning Center delivers the event again.
  if (!(await firstTime(`newguest-${cardId}`, { personId: String(personId) }))) return { ...base, crewSet, skipped: 'already-notified' }

  if (mode === 'app' && textingOn() && !clearstreamReady()) console.warn('NEW_GUEST_ROUTING=app but CLEARSTREAM_API_KEY is not set: no new-guest texts were sent')
  const log = startLog('newguest', `New guest: ${guest} (${crew ? LABEL[crew] : 'needs a crew'})`, { personId: String(personId) })
  const appTexts = mode === 'app' && clearstreamReady()
  // Until the switchover, Zapier's "YA New Guest Routing" sends these texts.
  if (!appTexts) for (const l of intended) logLine(log, l, { channel: 'text', result: textingOn() ? 'zapier' : 'off' })
  const [texted, pushed] = await Promise.all([
    appTexts ? textLeaders(intended, guest, crew, age, personId, log) : Promise.resolve(null),
    pushReady() ? pushLeaders(intended, guest, crew, personId, cardId, log) : Promise.resolve(null),
  ])
  await saveLog(log).catch(err => console.error('notification log failed:', err.message))
  return { ...base, crewSet, intended: intended.map(l => l.name), texted, pushed }
}

async function textLeaders(intended, guest, crew, age, personId, log) {
  const seen = new Set()
  for (const l of intended) if (!l.mobile) logLine(log, l, { channel: 'text', result: 'no-mobile' })
  const to = intended.filter(l => l.mobile && !seen.has(l.mobile) && seen.add(l.mobile))
  let body = newGuestText(guest, crew, age, personId)
  const testTo = process.env.CLEARSTREAM_TEST_TO
  const outgoing = testTo
    ? [{ name: 'TEST', mobile: testTo, body: plain(`[TEST>${to.map(l => l.first).join(',') || 'none'}] ${body}`) }]
    : to.map(l => ({ name: l.name, mobile: l.mobile, body }))
  let sent = 0
  for (const [i, o] of outgoing.entries()) {
    const r = await sendText(o.mobile, o.body, MINISTRY.texting.newGuestHeader).catch(e => ({ ok: false, error: e.message }))
    if (r.ok) sent++
    else console.error('new guest text failed:', o.name, r.status, r.error)
    if (testTo) for (const l of to) logLine(log, l, { channel: 'text', result: r.ok ? 'test-number' : 'failed' })
    else logLine(log, to[i], { channel: 'text', result: r.ok ? 'sent' : 'failed' })
  }
  return { sent, of: outgoing.length, test: !!testTo }
}

async function pushLeaders(intended, guest, crew, personId, cardId, log) {
  const countFor = await badgeContext().catch(() => null)
  const counts = await Promise.all(intended.map(l => pushTo(l.id, {
    title: `New guest: ${guest}`,
    body: crew ? `${LABEL[crew]} · filled out a connection card. Tap to claim.` : 'Needs a crew · filled out a connection card. Tap to claim.',
    url: `/people#/person/${personId}`, tag: `newguest-${cardId}`,
    badgeFor: countFor ? d => countFor(l.name, d.crew) : undefined,
    log, logName: l.name,
  }).catch(err => { console.error('new guest push failed:', l.id, err.message); return 0 })))
  return { leaders: counts.filter(n => n > 0).length }
}

// The YA Connect connection card couldn't add a follow-up card for someone
// (Planning Center refused it), so no leader was told. Tell the admins, once
// per person per day, so the guest isn't silently missed.
export async function alertMissingCard({ personId, name }) {
  if (!/^\d+$/.test(String(personId))) return { skipped: 'bad-person' }
  const guest = String(name || 'A guest').replace(/\s+/g, ' ').trim().slice(0, 80) || 'A guest'
  const day = new Date().toLocaleDateString('en-CA', { timeZone: MINISTRY.texting.quietHours.timeZone })
  if (!(await firstTime(`cardalert-${personId}-${day}`))) return { skipped: 'already-alerted' }
  const leaders = await loadLeaders()
  const admins = leadersFor(leaders, null)
  const log = startLog('alert', `No follow-up card for ${guest}`, { personId: String(personId) })
  const reached = pushReady() ? await Promise.all(admins.map(l => pushTo(l.id, {
    log, logName: l.name,
    title: `No follow-up card: ${guest}`,
    body: 'They filled out a connection card, but Planning Center didn’t add a follow-up card. Add one so a leader reaches out.',
    url: `/people#/person/${personId}`, tag: `cardalert-${personId}`,
  }).catch(() => 0))) : []
  await saveLog(log).catch(err => console.error('notification log failed:', err.message))
  return { admins: admins.length, reached: reached.filter(n => n > 0).length }
}
