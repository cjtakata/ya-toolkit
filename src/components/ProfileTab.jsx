import { Check, LogOut, ExternalLink } from 'lucide-react'
import { CREW_OPTIONS } from './listMeta.js'

const DISCORD_URL = 'https://discord.com/channels/1503595068722778154'

// Profile: who's signed in, which crew the app focuses on, and sign out.
export default function ProfileTab({ user, myCrew = 'all', onChooseCrew, onLogout }) {
  const name     = user.global_name || user.username || 'Leader'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const email    = user.username && user.username.includes('@') ? user.username : null

  return (
    <div className="home-scroll">
      <div className="home-inner">
        <div className="profile-card">
          <div className="profile-avatar">
            {user.avatar ? <img src={user.avatar} alt="" /> : initials}
          </div>
          <div className="profile-name">{name}</div>
          {email && <div className="profile-email">{email}</div>}
          <div className="profile-role">YA Leader</div>
        </div>

        <section className="home-section">
          <div className="home-section-head">
            <h2>Your crew</h2>
          </div>
          <p className="profile-hint">Home and People focus on this crew. Saved on this device.</p>
          <div className="settings-group" role="radiogroup" aria-label="Your crew">
            {CREW_OPTIONS.map(o => {
              const on = (myCrew || 'all') === o.key
              return (
                <button key={o.key} className={`settings-row${on ? ' selected' : ''}`}
                  role="radio" aria-checked={on} onClick={() => onChooseCrew(o.key)}>
                  <span>{o.label}</span>
                  {on && <Check size={16} />}
                </button>
              )
            })}
          </div>
        </section>

        <section className="home-section">
          <div className="settings-group">
            <a className="settings-row" href={DISCORD_URL} target="_blank" rel="noreferrer">
              <span>YA Leaders Discord</span>
              <ExternalLink size={15} />
            </a>
            <button className="settings-row settings-danger" onClick={onLogout}>
              <span>Sign out</span>
              <LogOut size={15} />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
