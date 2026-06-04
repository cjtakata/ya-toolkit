// Single source of truth for how each PCO list maps to a crew/demographic.
// The crew shown on a person is derived from the list they were pulled from,
// NOT from the (sometimes stale) PCO "Crew" custom field.
export const LIST_META = {
  college:     { crew: 'College Life',        badgeCls: 'badge-college' },
  earlycareer: { crew: 'Early Career',        badgeCls: 'badge-early' },
  youngpro:    { crew: 'Young Professionals',  badgeCls: 'badge-youngpro' },
}

// Crew choices for filters and the profile-bar crew picker. 'all' = every crew.
export const CREW_OPTIONS = [
  { key: 'all',         label: 'All crews' },
  { key: 'college',     label: 'College Life' },
  { key: 'earlycareer', label: 'Early Career' },
  { key: 'youngpro',    label: 'Young Professionals' },
]

export const CREW_LABEL = Object.fromEntries(CREW_OPTIONS.map(o => [o.key, o.label]))
