// Top navigation (works the same in Safari and the installed app — nothing is
// pinned to the bottom, so Safari's own toolbar keeps the bottom of the screen):
//   large title · avatar (opens Profile sheet) · Home / People segmented control
const SEGMENTS = [
  { key: 'home',   label: 'Home' },
  { key: 'search', label: 'People' },
]

export default function AppTopBar({ tab, onChange, user, badge = 0, title: titleProp, subtitle, onSubtitleClick, onOpenProfile }) {
  const name     = user.global_name || user.username || '?'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const title    = titleProp || SEGMENTS.find(s => s.key === tab)?.label || 'Home'

  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="topbar-titles">
          <h1 className="topbar-title">{title}</h1>
          {subtitle && (onSubtitleClick
            ? <button className="topbar-sub topbar-sub-link" onClick={onSubtitleClick}>{subtitle} ›</button>
            : <div className="topbar-sub">{subtitle}</div>)}
        </div>
        <button className="topbar-avatar" onClick={onOpenProfile} aria-label="Your profile">
          {user.avatar ? <img src={user.avatar} alt="" /> : initials}
        </button>
      </div>
      <div className="segmented" role="tablist" aria-label="Sections">
        {SEGMENTS.map(s => (
          <button key={s.key} role="tab" aria-selected={tab === s.key}
            className={`segment${tab === s.key ? ' active' : ''}`} onClick={() => onChange(s.key)}>
            {s.label}
            {s.key === 'home' && badge > 0 && <span className="segment-badge">{badge > 99 ? '99+' : badge}</span>}
          </button>
        ))}
      </div>
    </header>
  )
}
