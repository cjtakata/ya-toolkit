// Maps a YA Status value to its tag CSS class. Keyed by a normalized form
// (lowercased, spaces stripped) so "Moved On" → "movedon".
const STATUS_CLASS = {
  active:  'badge-status-active',
  missing: 'badge-status-missing',
  friend:  'badge-status-friend',
  alumni:  'badge-status-alumni',
  movedon: 'badge-status-movedon',
}

export function statusClass(status) {
  const key = (status || '').toLowerCase().replace(/\s+/g, '')
  return STATUS_CLASS[key] || 'badge-crew'
}
