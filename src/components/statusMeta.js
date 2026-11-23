// YA Status → badge class. Older values still stored in PCO fall back to the plain badge.
const STATUS_CLASS = {
  active:   'badge-status-active',
  serving:  'badge-status-serving',
  leader:   'badge-status-leader',
  archived: 'badge-status-archived',
}

export function statusClass(status) {
  return STATUS_CLASS[(status || '').trim().toLowerCase()] || 'badge-crew'
}
