import { useState, useRef, useEffect } from 'react'
import { CREW_OPTIONS, CREW_LABEL } from './listMeta.js'

// ── App-specific icons (white on slate #374151) ───────────────
const IconPeople = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3.5" fill="white"/>
    <path d="M4.5 20c0-4 3.358-7 7.5-7s7.5 3 7.5 7"
      stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="white" strokeWidth="1.7"/>
    <path d="M3 10h18" stroke="white" strokeWidth="1.7"/>
    <path d="M8 3v4M16 3v4" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
    <circle cx="8"  cy="15" r="1.1" fill="white"/>
    <circle cx="12" cy="15" r="1.1" fill="white"/>
    <circle cx="16" cy="15" r="1.1" fill="white"/>
  </svg>
)
const IconDiscord = () => (
  <svg viewBox="0 -15.39 127.14 127.14" fill="white">
    <path fillRule="evenodd" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
  </svg>
)

const APPS = [
  {
    key:     'people',
    name:    'People',
    desc:    'Crew & follow-up',
    href:    '/people',
    icon:    <IconPeople />,
    bg:      '#374151',
    current: true,
  },
  {
    key:  'calendar',
    name: 'Calendar',
    desc: 'Events & schedule',
    href: '/calendar',           // same domain — stays in PWA
    icon: <IconCalendar />,
    bg:   '#374151',
  },
  {
    key:  'discord',
    name: 'Discord',
    desc: 'Community home',
    href: 'https://discord.com/channels/1503595068722778154',
    icon: <IconDiscord />,
    bg:   '#5865F2',
  },
]

export default function AppHeader({ user, onLogout, listCount, myCrew, onChooseCrew }) {
  const initials = (user.global_name || user.username || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const [appOpen,  setAppOpen]  = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const appRef  = useRef(null)
  const userRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (appRef.current  && !appRef.current.contains(e.target))  setAppOpen(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const crewLabel = myCrew && myCrew !== 'all' ? CREW_LABEL[myCrew] : null

  function pickCrew(key) {
    onChooseCrew(key)
    setUserOpen(false)
  }

  return (
    <header className="app-header">
      <div className="header-left">

        {/* ── App switcher (replaces the logo tile) ── */}
        <div className="app-switcher-wrap" ref={appRef}>
          <button
            className={`app-switcher-btn${appOpen ? ' open' : ''}`}
            onClick={() => setAppOpen(o => !o)}
            title="Switch app"
            aria-haspopup="true"
            aria-expanded={appOpen}
          >
            <div className="sw-grid">
              <span/><span/><span/>
              <span/><span/><span/>
              <span/><span/><span/>
            </div>
          </button>

          {appOpen && (
            <div className="app-switcher-dropdown" role="menu">
              <div className="sw-label">YA Tools</div>
              <div className="sw-apps">
                {APPS.map(app => (
                  <a
                    key={app.key}
                    className={`sw-app${app.current ? ' current' : ''}`}
                    href={app.href}
                    target={app.href.startsWith('http') ? '_blank' : undefined}
                    rel={app.href.startsWith('http') ? 'noreferrer' : undefined}
                    onClick={() => setAppOpen(false)}
                  >
                    <div className="sw-app-icon" style={{ background: app.bg }}>
                      {app.icon}
                    </div>
                    <div>
                      <div className="sw-app-name">{app.name}</div>
                      <div className="sw-app-desc">{app.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
              <div className="sw-divider" />
              <a className="sw-hub-link" href="/">
                ⊞ &nbsp;YA Hub — all tools
              </a>
            </div>
          )}
        </div>

        <div>
          <div className="app-title">YA People</div>
          <div className="app-subtitle">Planning Center · {listCount} people</div>
        </div>
      </div>

      <div className="header-right">
        {/* ── User / crew picker ── */}
        <div className="user-menu" ref={userRef}>
          <button
            className="user-chip"
            onClick={() => setUserOpen(o => !o)}
            aria-haspopup="true"
            aria-expanded={userOpen}
          >
            <div className="user-avatar">
              {user.avatar ? <img src={user.avatar} alt={initials} /> : initials}
            </div>
            <div className="user-chip-text">
              <span className="user-name">{user.global_name || user.username}</span>
              {crewLabel && <span className="user-crew">{crewLabel}</span>}
            </div>
            <span className="user-chip-caret">▾</span>
          </button>

          {userOpen && (
            <div className="user-dropdown" role="menu">
              <div className="user-dropdown-label">Your crew</div>
              {CREW_OPTIONS.map(o => (
                <button
                  key={o.key}
                  className={`user-dropdown-item${(myCrew || 'all') === o.key ? ' selected' : ''}`}
                  onClick={() => pickCrew(o.key)}
                  role="menuitemradio"
                  aria-checked={(myCrew || 'all') === o.key}
                >
                  <span className="check">{(myCrew || 'all') === o.key ? '✓' : ''}</span>
                  {o.label}
                </button>
              ))}
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item signout" onClick={onLogout} role="menuitem">
                Sign out
              </button>
            </div>
          )}
        </div>

        <button className="logout-btn" onClick={onLogout}>Sign out</button>
      </div>
    </header>
  )
}
