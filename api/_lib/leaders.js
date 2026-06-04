// Crew assignment for the "My Crew" view, driven primarily by DISCORD ROLES.
//
// Map each Discord ROLE ID to the crew it represents. Manage crews by assigning
// these roles in Discord — add a leader to the "Early Career Leader" role and
// they automatically get that crew in the app the next time they sign in.
//
// Crew keys: 'college' | 'earlycareer' | 'youngpro'.
// Use '*' for a leadership/admin role that should see ALL crews.
//
// Find a role ID: Discord → Server Settings → Roles → (role) → ⋯ → Copy Role ID
// (requires Developer Mode: Settings → Advanced → Developer Mode).

export const ROLE_CREWS = {
  '1509450239092719738': 'college',       // College Life Leader
  '1509450549706362991': 'earlycareer',   // Early Career Leader
  '1509450582488780820': 'youngpro',      // Young Professionals Leader
  // '<role id>': '*',                     // (optional) YA Leadership / admin → all crews
}

// Optional manual override by Discord USER ID, for anyone who should have a
// crew without a matching role (merged with whatever their roles give them).
export const LEADER_OVERRIDES = {
  // '123456789012345678': ['*'],
}

const VALID_CREWS = new Set(['college', 'earlycareer', 'youngpro'])

// Given a user's guild role IDs (+ their Discord user id), resolve their crews:
// ['*'] for all-crew overseers, a list of crew keys, or [] if unassigned.
export function resolveCrews({ roleIds = [], discordId } = {}) {
  const crews = new Set()
  for (const roleId of roleIds) {
    const crew = ROLE_CREWS[roleId]
    if (crew) crews.add(crew)
  }
  for (const crew of (LEADER_OVERRIDES[discordId] || [])) crews.add(crew)

  if (crews.has('*')) return ['*']
  return [...crews].filter(c => VALID_CREWS.has(c))
}
