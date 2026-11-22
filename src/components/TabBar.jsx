import { House, Search } from 'lucide-react'

// Bottom tab bar: Home (left) · Search (center, raised) · Profile (right).
export default function TabBar({ tab, onChange, user, badge = 0 }) {
  const name     = user.global_name || user.username || '?'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <nav className="tabbar" aria-label="Main">
      <button
        className={`tab-btn${tab === 'home' ? ' active' : ''}`}
        onClick={() => onChange('home')}
        aria-current={tab === 'home' ? 'page' : undefined}
      >
        <span className="tab-icon">
          <House size={22} strokeWidth={tab === 'home' ? 2.4 : 1.9} />
          {badge > 0 && <span className="tab-badge">{badge > 99 ? '99+' : badge}</span>}
        </span>
        <span className="tab-label">Home</span>
      </button>

      <button
        className={`tab-btn tab-btn-search${tab === 'search' ? ' active' : ''}`}
        onClick={() => onChange('search')}
        aria-current={tab === 'search' ? 'page' : undefined}
        aria-label="Search people"
      >
        <span className="tab-search-circle"><Search size={24} strokeWidth={2.4} /></span>
      </button>

      <button
        className={`tab-btn${tab === 'profile' ? ' active' : ''}`}
        onClick={() => onChange('profile')}
        aria-current={tab === 'profile' ? 'page' : undefined}
      >
        <span className="tab-icon">
          <span className="tab-avatar">
            {user.avatar ? <img src={user.avatar} alt="" /> : initials}
          </span>
        </span>
        <span className="tab-label">Profile</span>
      </button>
    </nav>
  )
}
