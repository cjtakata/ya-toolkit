// A person's picture: their PCO photo if they have one, otherwise their initials
// in the app's own style (PCO's auto-generated "initials" images count as no
// photo — see api/_lib/person.js).
export function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export default function Avatar({ person, className = 'avatar' }) {
  const name = person?.name || ''
  if (person?.avatar) {
    return (
      <div className={className}>
        <img src={person.avatar} alt={name} />
      </div>
    )
  }
  return (
    <div className={`${className} avatar-initials`} role="img" aria-label={name}>
      {initialsOf(name)}
    </div>
  )
}
