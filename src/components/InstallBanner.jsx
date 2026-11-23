import { useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { isStandalone, isIOS, useInstallPrompt, bannerDismissed, dismissBanner, INSTALL_PATH } from './install.js'

// A small, dismissible nudge on Home for leaders using the app in a browser tab
// instead of from their home screen. Hidden once installed or dismissed.
export default function InstallBanner() {
  const { canPrompt, prompt } = useInstallPrompt()
  const [hidden, setHidden] = useState(bannerDismissed)
  if (hidden || isStandalone() || !(isIOS() || canPrompt)) return null

  const close = () => { dismissBanner(); setHidden(true) }
  return (
    <div className="install-banner" role="note">
      <Smartphone size={18} className="install-banner-icon" />
      <div className="install-banner-text">
        <b>Add YA Toolkit to your home screen</b>
        <span>One tap to open, and notifications when you're @mentioned.</span>
        <div className="install-banner-actions">
          {canPrompt
            ? <button className="home-link" onClick={async () => { if ((await prompt()) === 'accepted') setHidden(true) }}>Install</button>
            : <a className="home-link" href={INSTALL_PATH}>Show me how</a>}
        </div>
      </div>
      <button className="install-banner-x" onClick={close} aria-label="Dismiss"><X size={16} /></button>
    </div>
  )
}
