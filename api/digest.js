import { getFieldDefinitions } from './_lib/pco.js'
import { normalizePerson, fetchPeopleByIds } from './_lib/person.js'
import { listCards } from './_lib/cards.js'

// Crew → its Discord channel + embed color
const CREWS = {
  college:     { channel: '1510873915189231698', label: 'College Life',       color: 0x0ea5e9 },
  earlycareer: { channel: '1510874986322198689', label: 'Early Career',       color: 0x8b5cf6 },
  youngpro:    { channel: '1510875026570875030', label: 'Young Professional',  color: 0xf59e0b },
}

const APP_URL = 'https://ya-toolkit.vercel.app'

function daysSince(iso) {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

function formatPhone(raw) {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  const ten = d.length === 11 && d[0] === '1' ? d.slice(1) : d
  return ten.length === 10 ? `(${ten.slice(0,3)}) ${ten.slice(3,6)}-${ten.slice(6)}` : raw
}

async function postEmbed(channelId, embed) {
  const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://ya-toolkit.vercel.app, 1.0)',
    },
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
  })
  if (!r.ok) console.error('digest post failed:', channelId, r.status, await r.text())
  return r.ok
}

export default async function handler(req, res) {
  // Secured for Vercel Cron (sends Authorization: Bearer <CRON_SECRET>).
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!process.env.DISCORD_BOT_TOKEN) {
    return res.status(500).json({ error: 'DISCORD_BOT_TOKEN not set' })
  }

  // ?dryRun=1 builds the embeds and returns them WITHOUT posting to Discord.
  const dryRun = !!(req.query && req.query.dryRun)
  const force  = !!(req.query && req.query.force)

  // Only post on Mondays (Pacific) — guards against the cron firing more often
  // than intended on Hobby. ?force=1 or ?dryRun=1 bypasses for manual runs.
  const isMonday = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }) === 'Mon'
  if (!dryRun && !force && !isMonday) {
    return res.json({ ok: true, skipped: 'not Monday (Pacific)' })
  }

  try {
    // Connection-card follow-ups from the PCO workflow (the source of record).
    const cards = (await listCards()).filter(c => c.personId && (c.state === 'waiting' || c.state === 'claimed'))

    // Guest name / crew / phone, batched.
    const ids = [...new Set(cards.map(c => c.personId))]
    const fieldDefs = await getFieldDefinitions()
    const { data, included } = ids.length ? await fetchPeopleByIds(ids) : { data: [], included: [] }
    const people = Object.fromEntries(data.map(p => [p.id, normalizePerson(p, included, fieldDefs)]))

    const byCrew = { college: { waiting: [], claimed: [] }, earlycareer: { waiting: [], claimed: [] }, youngpro: { waiting: [], claimed: [] } }
    let noCrew = 0
    for (const c of cards) {
      const p = people[c.personId]
      if (!p) continue
      if (!byCrew[p.list]) { noCrew++; continue }
      byCrew[p.list][c.state].push({
        id: p.id, name: p.name, phone: formatPhone(p.phone),
        days: daysSince(c.state === 'waiting' ? c.submittedAt : c.claimedAt),
        claimedBy: c.claimedBy,
      })
    }

    const results = {}
    for (const [key, crew] of Object.entries(CREWS)) {
      const waiting = byCrew[key].waiting.sort((a, b) => b.days - a.days)
      const claimed = byCrew[key].claimed.sort((a, b) => b.days - a.days)
      const ago = d => d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'}`
      const link = p => `**[${p.name}](${APP_URL}/people#/person/${p.id})**`

      let embed
      if (waiting.length === 0 && claimed.length === 0) {
        embed = {
          color: 0x23a55a,
          title: `🎉 All caught up — ${crew.label}`,
          description: 'Every connection card has been claimed and texted. Great work, team!',
          footer: { text: 'YA Toolkit · weekly connection cards' },
        }
      } else {
        const parts = []
        if (waiting.length) parts.push(
          `**🙋 Not claimed (${waiting.length})** — open one and tap **Claim**:\n` +
          waiting.map(p => `${p.days >= 2 ? '⚠️ ' : ''}${link(p)} · card ${ago(p.days)}`).join('\n'))
        if (claimed.length) parts.push(
          `**💬 Claimed, not texted yet (${claimed.length})**:\n` +
          claimed.map(p => `${p.days >= 3 ? '⚠️ ' : ''}${link(p)} · ${p.claimedBy || 'a leader'} · claimed ${ago(p.days)}`).join('\n'))
        embed = {
          color: crew.color,
          title: `📋 Connection Cards — ${crew.label}`,
          description: parts.join('\n\n') + '\n\nTap a name to open them in the YA Toolkit. 🙌',
          footer: { text: 'YA Toolkit · weekly connection cards' },
        }
      }
      results[key] = dryRun ? embed : (await postEmbed(crew.channel, embed) ? 'posted' : 'failed')
    }

    return res.json({ ok: true, dryRun, openCards: cards.length, noCrew, results })

  } catch (err) {
    console.error('digest error:', err)
    return res.status(500).json({ error: 'Digest failed', detail: err.message })
  }
}
