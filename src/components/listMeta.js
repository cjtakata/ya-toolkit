// Single source of truth for how each crew key maps to its display label + badge.
// The crew key itself is derived from each person's PCO "Crew" custom field
// (see CREW_VALUE_TO_LIST in api/people.js).
export const LIST_META = {
  college:     { crew: 'College Life',       badgeCls: 'badge-college' },
  earlycareer: { crew: 'Early Career',       badgeCls: 'badge-early' },
  youngpro:    { crew: 'Young Professional', badgeCls: 'badge-youngpro' },
}

// Crew choices for filters and the profile-bar crew picker. 'all' = every crew.
export const CREW_OPTIONS = [
  { key: 'all',         label: 'All crews' },
  { key: 'college',     label: 'College Life' },
  { key: 'earlycareer', label: 'Early Career' },
  { key: 'youngpro',    label: 'Young Professional' },
]

export const CREW_LABEL = Object.fromEntries(CREW_OPTIONS.map(o => [o.key, o.label]))
