// Crew coverage for admins: leaders vs. people, by crew and gender.
// people: /api/people rows { name, status, list, gender }; cards: current follow-up cards.
import { LIST_META } from './listMeta.js'

export const CREWS = [...Object.keys(LIST_META), 'unassigned']
export const crewName = key => LIST_META[key]?.crew || 'No crew yet'

// People a crew's leaders look after: YA Status Active or Serving (Archived and
// Leaders themselves aren't counted).
const MEMBER = new Set(['Active', 'Serving'])
const sex = g => (g === 'Male' ? 'guys' : g === 'Female' ? 'girls' : 'unknown')

export function crewStats(people = [], cards = []) {
  const blank = () => ({ guys: [], girls: [], unknown: [] })
  const by = Object.fromEntries(CREWS.map(k => [k, { key: k, leaders: blank(), members: blank(), open: 0 }]))
  const crewOf = p => (by[p.list] ? p.list : 'unassigned')

  for (const p of people) {
    if (p.status === 'Leader') by[crewOf(p)].leaders[sex(p.gender)].push(p.name)
    else if (MEMBER.has(p.status)) by[crewOf(p)].members[sex(p.gender)].push(p.name)
  }
  for (const c of cards) {
    if (c.state === 'waiting' || c.state === 'claimed') by[crewOf(c.person || {})].open++
  }

  const load = (members, leaders) => (leaders ? members / leaders : null)
  const crews = CREWS.map(k => {
    const x = by[k], L = x.leaders, M = x.members
    return {
      key: k,
      name: crewName(k),
      leaders: { guys: L.guys.sort(), girls: L.girls.sort(), unknown: L.unknown.sort() },
      members: { guys: M.guys.length, girls: M.girls.length, unknown: M.unknown.length },
      perLeader: { guys: load(M.guys.length, L.guys.length), girls: load(M.girls.length, L.girls.length) },
      open: x.open,
    }
  })
  // "No crew yet" only matters if someone is in it.
  const shown = crews.filter(c => c.key !== 'unassigned' ||
    c.members.guys + c.members.girls + c.members.unknown + c.leaders.guys.length + c.leaders.girls.length + c.leaders.unknown.length + c.open > 0)

  // Heaviest load: the most people per leader, or any group with people and no leader.
  const groups = shown.filter(c => c.key !== 'unassigned').flatMap(c => ['guys', 'girls'].map(g => ({
    crew: c.name, group: g, people: c.members[g], leaders: c.leaders[g].length, perLeader: c.perLeader[g],
  }))).filter(g => g.people > 0)
  const uncovered = groups.filter(g => !g.leaders)
  const heaviest = [...groups.filter(g => g.leaders)].sort((a, b) => b.perLeader - a.perLeader)[0] || null

  // Leaders: everyone with Leader status. People: only those actually in a crew.
  const total = (side, g) => shown.reduce((n, c) =>
    n + (side === 'leaders' ? c.leaders[g].length : c.key === 'unassigned' ? 0 : c.members[g]), 0)
  return {
    crews: shown,
    totals: {
      leaders: { guys: total('leaders', 'guys'), girls: total('leaders', 'girls'), unknown: total('leaders', 'unknown') },
      members: { guys: total('members', 'guys'), girls: total('members', 'girls'), unknown: total('members', 'unknown') },
    },
    heaviest, uncovered,
  }
}

// 13.6 → "14", null → "—"
export const perLeaderText = n => (n == null ? '—' : String(Math.round(n)))
