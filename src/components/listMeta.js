// How each crew key maps to its display label + badge (crews are defined in
// ministry.config.js). Each person's key comes from their PCO "Crew" field
// (see crewToList in api/_lib/person.js).
import { MINISTRY } from '../../ministry.config.js'

export const LIST_META = Object.fromEntries(
  MINISTRY.crews.map(c => [c.key, { crew: c.label, badgeCls: c.badge }]),
)

// Crew choices for filters and the profile-bar crew picker. 'all' = every crew.
export const CREW_OPTIONS = [
  { key: 'all',         label: 'All crews' },
  ...MINISTRY.crews.map(c => ({ key: c.key, label: c.label })),
]

export const CREW_LABEL = Object.fromEntries(CREW_OPTIONS.map(o => [o.key, o.label]))
