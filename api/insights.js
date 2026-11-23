import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, isAdmin } from './_lib/auth.js'
import { loadYaPeople } from './_lib/person.js'
import { listCards } from './_lib/cards.js'
import { crewStats } from '../src/components/crewStats.js'
import { teamStats } from '../src/components/teamStats.js'

// POST /api/insights → admins: a few AI suggestions on crew leader coverage.
//
// The server builds the summary itself from Planning Center (never trusts the
// browser's numbers) and sends Claude only counts and leader names: no guest
// names, phone numbers, emails or notes. Needs ANTHROPIC_API_KEY on Vercel.

// Opus at the default effort can take ~10–30s; Vercel's default limit is lower.
export const config = { maxDuration: 60 }

const MODEL = 'claude-opus-5-5'
const CACHE_MS = 10 * 60_000          // one answer per 10 minutes unless asked fresh
let _cache = null, _cacheAt = 0

const SYSTEM = `You help the admin of Venture Young Adults, a church young-adult ministry, keep its crew leaders from being overloaded.

How the ministry works:
- People belong to one of three crews by life stage: College Life, Early Career, Young Professional.
- Crew leaders lead people of their own gender: guy leaders care for the guys, girl leaders for the girls.
- When a guest fills out a connection card, a leader claims them and texts them. "Open follow-ups" are guests not texted yet.

You get a JSON summary: per crew, the guy and girl leaders (names), how many guys and girls are in the crew (Active or Serving), people per leader, open follow-ups, plus each leader's reach-outs over the last 30 days.

Write 3 to 5 suggestions for the admin, most important first. Each one:
- is one or two short sentences (under 35 words), plain and warm, no jargon;
- is grounded only in the numbers given: name the crew, gender and leader when it helps, and quote the number that matters;
- suggests a concrete next step (recruit a leader for X, ask Y to share load with Z, follow up on open cards, fill in missing crew or gender in Planning Center).

Don't speculate about anyone's character, commitment or circumstances; you only know counts. Don't invent leaders or numbers. If the data is thin (e.g. very few reach-outs yet), say so once rather than over-reading it.

Output only the suggestions, one per line, each starting with "- ". No heading, no intro, no closing line.`

function summarize(people, cards) {
  const byId = Object.fromEntries(people.map(p => [p.id, p]))
  const withPerson = cards.map(c => ({ ...c, person: byId[c.personId] || { list: 'unassigned' } }))
  const crews = crewStats(people, withPerson)
  const leaders = people.filter(p => p.status === 'Leader')
  const team = teamStats(cards, leaders.map(p => p.name), 30)
  const reach = [...team.active.map(x => ({ leader: x.name, texted: x.texted, typicalHoursCardToText: x.medianHrs == null ? null : Math.round(x.medianHrs), claimedNotTexted: x.open })),
                 ...team.quiet.map(name => ({ leader: name, texted: 0, claimedNotTexted: 0 }))]
  return {
    crews: crews.crews.map(c => ({
      crew: c.name,
      guyLeaders: c.leaders.guys, girlLeaders: c.leaders.girls, leadersWithoutGender: c.leaders.unknown,
      guys: c.members.guys, girls: c.members.girls, peopleWithoutGender: c.members.unknown,
      guysPerGuyLeader: c.perLeader.guys == null ? null : Math.round(c.perLeader.guys * 10) / 10,
      girlsPerGirlLeader: c.perLeader.girls == null ? null : Math.round(c.perLeader.girls * 10) / 10,
      openFollowUps: c.open,
    })),
    reachOutsLast30Days: { teamTexted: team.team.texted, notClaimedNow: team.team.unclaimed, byLeader: reach },
  }
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!isAdmin(user)) return res.status(403).json({ error: 'Only YA admins can see this.' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "AI suggestions aren't set up yet (missing ANTHROPIC_API_KEY on Vercel)." })
  }
  res.setHeader('Cache-Control', 'private, no-store')
  if (_cache && Date.now() - _cacheAt < CACHE_MS && !req.body?.fresh) return res.json(_cache)

  let summary
  try {
    const [people, cards] = await Promise.all([loadYaPeople(), listCards({ allTime: true })])
    summary = summarize(people, cards.filter(c => c.state !== 'removed'))
  } catch (err) {
    console.error('insights.js PCO error:', err)
    return res.status(502).json({ error: "Couldn't load crews from Planning Center." })
  }

  try {
    const client = new Anthropic()
    // Server-side fallback: if Opus declines, the API re-runs the same request
    // on a fallback model inside this one call.
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(summary) }],
    })
    if (msg.stop_reason === 'refusal') {
      return res.status(502).json({ error: "The AI couldn't answer this time. Try again later." })
    }
    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    const suggestions = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => l.slice(2).trim()).filter(Boolean)
    if (!suggestions.length) return res.status(502).json({ error: "The AI didn't return any suggestions. Try again." })
    _cache = { suggestions: suggestions.slice(0, 5), generatedAt: new Date().toISOString() }
    _cacheAt = Date.now()
    return res.json(_cache)
  } catch (err) {
    console.error('insights.js Claude error:', err?.status, err?.message)
    if (err instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: 'The AI key on Vercel was rejected. Check ANTHROPIC_API_KEY.' })
    if (err instanceof Anthropic.RateLimitError) return res.status(503).json({ error: 'The AI is busy right now. Try again in a minute.' })
    return res.status(502).json({ error: "Couldn't reach the AI. Try again." })
  }
}
