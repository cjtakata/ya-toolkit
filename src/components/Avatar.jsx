// A person's picture: their PCO photo if they have one, otherwise a stock
// guy / girl / neutral silhouette (from their PCO gender) with a border.
// PCO's auto-generated "initials" images are treated as no photo (see api/_lib/person.js).
export default function Avatar({ person, className = 'avatar' }) {
  const name = person?.name || ''
  if (person?.avatar) {
    return (
      <div className={className}>
        <img src={person.avatar} alt={name} />
      </div>
    )
  }
  const g = (person?.gender || '').trim().toLowerCase()
  const kind = g === 'male' || g === 'm' ? 'male' : g === 'female' || g === 'f' ? 'female' : 'neutral'
  return (
    <div className={`${className} avatar-stock avatar-${kind}`} role="img" aria-label={name}>
      <svg viewBox="0 0 40 40" aria-hidden="true">
        {kind === 'female' && (
          // long hair, behind the head
          <path className="avatar-hair" d="M11.6 17.2c0-6 3.7-10.2 8.4-10.2s8.4 4.2 8.4 10.2v7.6c-2 1.5-5 2.2-8.4 2.2s-6.4-.7-8.4-2.2z" />
        )}
        <circle className="avatar-face" cx="20" cy="16.4" r="6" />
        <path className="avatar-fig" d="M6.5 40c.9-7.6 6.3-12 13.5-12s12.6 4.4 13.5 12z" />
        {kind === 'male' && (
          // short hair
          <path className="avatar-hair" d="M13.5 15.4c-.4-5 2.6-8.4 6.5-8.4s7 3.4 6.5 8.3c-1.4-2.4-3.6-3.6-6.5-3.6s-5.1 1.3-6.5 3.7z" />
        )}
      </svg>
    </div>
  )
}
