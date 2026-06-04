const LOGO = <img src="/ya.svg" alt="YA" />

export default function LoginScreen() {
  const params = new URLSearchParams(window.location.search)
  const error  = params.get('error')

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">{LOGO}</div>
        <div>
          <div className="login-title">YA People</div>
          <div className="login-tagline">Ministry leader portal</div>
        </div>
        <div className="login-subtitle">
          Sign in with Discord to access the YA People directory. Only members of the YA Leaders server can log in.
        </div>
        {error && (
          <div className="login-error">
            {error === 'not_member'
              ? 'You must be a member of the YA Leaders Discord server to access this app.'
              : 'Sign-in failed. Please try again.'}
          </div>
        )}
        <a className="discord-btn" href="/api/auth/discord">
          <svg className="discord-icon" viewBox="0 -15.39 127.14 127.14" fill="currentColor">
            <path fillRule="evenodd" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
          Sign in with Discord
        </a>
        <div className="login-note">
          <strong>Leaders only.</strong> You must be a member of the YA Leaders Discord server to access this app. No password required — your Discord account is your login.
        </div>
      </div>
    </div>
  )
}
