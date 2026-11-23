import { House, Users } from 'lucide-react'
import { initialsOf } from './Avatar.jsx'

// Top bar = app chrome only: YA mark · Home / People switcher · avatar.
// Everything below it belongs to the section you're on. Nothing is pinned to
// the bottom, so Safari's own toolbar keeps the bottom of the screen.
const LOGO = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}ya.svg`   // /people/ya.svg

const SEGMENTS = [
  { key: 'home',   label: 'Home',      Icon: House },
  { key: 'search', label: 'People',    Icon: Users },
]

export default function AppTopBar({ tab, onChange, user, badge = 0, onOpenProfile }) {
  const name     = user.global_name || user.username || '?'
  const initials = initialsOf(name)

  return (
    <header className="topbar">
      <div className="topbar-row">
        <button className="topbar-mark" onClick={() => onChange('home')} aria-label="YA Toolkit home">
          <img src={LOGO} alt="" />
        </button>

        <div className="segmented" role="tablist" aria-label="Sections">
          {SEGMENTS.map(({ key, label, Icon }) => {
            const on = tab === key
            return (
              <button key={key} role="tab" aria-selected={on}
                className={`segment${on ? ' active' : ''}`} onClick={() => onChange(key)}>
                <Icon size={16} strokeWidth={on ? 2.4 : 2} />
                <span>{label}</span>
                {key === 'home' && badge > 0 && <span className="segment-badge">{badge > 99 ? '99+' : badge}</span>}
              </button>
            )
          })}
        </div>

        <button className="topbar-avatar" onClick={onOpenProfile} aria-label="Your profile">
          {user.avatar ? <img src={user.avatar} alt="" /> : initials}
        </button>
      </div>
    </header>
  )
}
