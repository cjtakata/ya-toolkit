import { pcoFetch, pcoFetchAll } from './_lib/pco.js'

// Crew → its Discord channel + embed color
const CREWS = {
  college:     { channel: '1510873915189231698', label: 'College Life',       color: 0x0ea5e9 },
  earlycareer: { channel: '1510874986322198689', label: 'Early Career',       color: 0x8b5cf6 },
  youngpro:    { channel: '1510875026570875030', label: 'Young Professional',  color: 0xf59e0b },
}

const FOLLOWUP_DEF = '1065427'  // Needs Follow-Up? (boolean)
const STATUS_DEF   = '1065431'  // YA Status (select)
const CREW_DEF     = '431524'   // Crew (select)
const ACTIVE_STATUSES = new Set(['Active', 'Missing', 'TBD', 'Leader', 'First Time Guest'])
const APP_URL = 'https://ya-toolkit.vercel.app'

function crewToKey(v) {
  const s = (v || '').trim().toLowerCase()
  if (s === 'college life') return 'college'
  if (s === 'early career') return 'earlycareer'
  if (s === 'young professional' || s === 'young professionals') return 'youngpro'
  return null
}

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
    // 1. Find everyone flagged Needs Follow-Up = true, and when they were flagged.
    const { data: fuData } = await pcoFetchAll(
      `/people/v2/field_data?where%5Bfield_definition_id%5D=${FOLLOWUP_DEF}&per_page=100`
    )
    const flaggedAt = {}
    for (const d of fuData) {
      const v = (d.attributes?.value || '').toLowerCase()
      if (v === 'true' || v === 'yes') {
        const pid = d.relationships?.customizable?.data?.id
        if (pid) flaggedAt[pid] = d.attributes?.updated_at || d.attributes?.created_at
      }
    }
    const ids = Object.keys(flaggedAt)

    // 2. Fetch those people (name + status + crew + contact) in one batched call.
    const byCrew = { college: [], earlycareer: [], youngpro: [] }
    if (ids.length) {
      const BATCH = 50
      const people = [], included = []
      for (let i = 0; i < ids.length; i += BATCH) {
        const idList = ids.slice(i, i + BATCH).join(',')
        const page = await pcoFetchAll(
          `/people/v2/people?where%5Bid%5D=${idList}&include=emails,phone_numbers,field_data&per_page=100`
        )
        people.push(...page.data); included.push(...page.included)
      }

      for (const p of people) {
        const pid = p.id
        // status + crew from this person's included field_data
        let status = '', crewVal = ''
        for (const inc of included) {
          if (inc.type !== 'FieldDatum') continue
          if (inc.relationships?.customizable?.data?.id !== pid) continue
          const def = inc.relationships?.field_definition?.data?.id
          if (def === STATUS_DEF) status = inc.attributes?.value || ''
          if (def === CREW_DEF)   crewVal = inc.attributes?.value || ''
        }
        if (!ACTIVE_STATUSES.has(status)) continue
        const crewKey = crewToKey(crewVal)
        if (!crewKey) continue

        const email = included.find(i => i.type === 'Email' && i.relationships?.person?.data?.id === pid && i.attributes?.primary)?.attributes?.address
          || included.find(i => i.type === 'Email' && i.relationships?.person?.data?.id === pid)?.attributes?.address
        const phone = included.find(i => i.type === 'PhoneNumber' && i.relationships?.person?.data?.id === pid && i.attributes?.primary)?.attributes?.number
          || included.find(i => i.type === 'PhoneNumber' && i.relationships?.person?.data?.id === pid)?.attributes?.number

        byCrew[crewKey].push({
          id: pid,
          name: [p.attributes?.first_name, p.attributes?.last_name].filter(Boolean).join(' ') || 'Unknown',
          days: daysSince(flaggedAt[pid]),
          ftg: status === 'First Time Guest',
          contact: [email, formatPhone(phone)].filter(Boolean).join(' · '),
        })
      }
    }

    // 3. Build + post one embed per crew.
    const results = {}
    for (const [key, crew] of Object.entries(CREWS)) {
      const list = (byCrew[key] || []).sort((a, b) => b.days - a.days)

      let embed
      if (list.length === 0) {
        embed = {
          color: 0x23a55a,
          title: `🎉 All caught up — ${crew.label}`,
          description: "Nobody's waiting on a follow-up right now. Great work, team!",
          footer: { text: 'YA Toolkit · weekly follow-up' },
        }
      } else {
        const lines = list.map(p => {
          const link = `${APP_URL}/people#/person/${p.id}`
          const flags = `${p.ftg ? '🆕 ' : ''}${p.days >= 7 ? '⚠️ ' : ''}`
          const wait  = p.days === 0 ? 'today' : `${p.days} day${p.days === 1 ? '' : 's'}`
          const tail  = p.ftg ? ` · *First Time Guest*` : ''
          const c     = p.contact ? `\n${p.contact}` : ''
          return `${flags}**[${p.name}](${link})** · ${wait}${tail}${c}`
        })
        embed = {
          color: crew.color,
          title: `📋 Weekly Follow-Up — ${crew.label}`,
          description:
            `**${list.length} ${list.length === 1 ? 'person' : 'people'}** still need a follow-up (oldest first):\n\n`
            + lines.join('\n\n')
            + `\n\nReach out, then open their profile and tap **Log Follow-Up** to clear it. 🙌`,
          footer: { text: 'YA Toolkit · weekly follow-up' },
        }
      }
      results[key] = dryRun ? embed : (await postEmbed(crew.channel, embed) ? 'posted' : 'failed')
    }

    return res.json({ ok: true, dryRun, flaggedCount: ids.length, results })

  } catch (err) {
    console.error('digest error:', err)
    return res.status(500).json({ error: 'Digest failed', detail: err.message })
  }
}
