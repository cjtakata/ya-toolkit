import { useMemo, useState } from 'react'
import { Share, SquarePlus, CircleCheck, Copy, Check, Bell, Download, ExternalLink, Smartphone } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { MINISTRY } from '../../ministry.config.js'
import { isStandalone, isIOS, isAndroid, inAppBrowser, installUrl, useInstallPrompt, copyText } from './install.js'

// /install: a link leaders can text each other. No sign-in needed.
// Works out which device it's on and shows only the steps that apply.
export default function InstallPage() {
  const { canPrompt, prompt } = useInstallPrompt()
  const [installed, setInstalled] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = installUrl()

  async function copy() {
    if ((await copyText(url)) === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  let kind
  if (isStandalone()) kind = 'done'
  else if (installed) kind = 'installed'
  else if (inAppBrowser()) kind = 'in-app'
  else if (isIOS()) kind = 'ios'
  else if (canPrompt) kind = 'prompt'
  else if (isAndroid()) kind = 'android'
  else kind = 'desktop'

  return (
    <div className="install-screen">
      <div className="install-card">
        <div className="login-logo"><img src="/ya.svg" alt="YA" /></div>
        <h1 className="install-title">Get YA Toolkit on your phone</h1>
        <p className="install-sub">For {MINISTRY.name} leaders. It opens like an app, stays signed in, and can notify you when someone @mentions you.</p>

        {kind === 'done' && <>
          <Done title="You're all set" text="YA Toolkit is on your home screen." />
          <a className="login-btn install-btn" href="/people">Open YA Toolkit</a>
        </>}

        {kind === 'installed' && <>
          <Done title="Installed" text="Open YA Toolkit from your home screen or app list and sign in." />
          <AfterSteps />
        </>}

        {kind === 'in-app' && <>
          <div className="install-alert">
            <ExternalLink size={18} />
            <div><b>Open this page in Safari first.</b> You're viewing it inside another app, which can't add it to your home screen.
              Tap <b>•••</b> or the compass icon and choose <b>Open in Safari</b> (or Chrome), or copy the link and paste it there.</div>
          </div>
          <CopyButton copied={copied} onCopy={copy} />
        </>}

        {kind === 'ios' && <>
          <ol className="install-steps">
            <Step n={1} icon={<Share size={20} />} title="Tap the Share button">
              The square with an arrow, at the bottom of Safari. On newer iPhones it may be inside the <b>•••</b> button.
            </Step>
            <Step n={2} icon={<SquarePlus size={20} />} title="Tap “Add to Home Screen”">
              Scroll down the list to find it. If you don't see it, tap <b>View More</b>.
            </Step>
            <Step n={3} icon={<Check size={20} />} title="Tap “Add”">
              Leave <b>Open as Web App</b> switched on if you see it.
            </Step>
            <Step n={4} icon={<Smartphone size={20} />} title="Open YA Toolkit from your home screen">
              Sign in with your email. You only need to do this once.
            </Step>
          </ol>
          <AfterSteps />
        </>}

        {kind === 'prompt' && <>
          <button className="login-btn install-btn" onClick={async () => setInstalled((await prompt()) === 'accepted')}>
            <Download size={18} /> Install YA Toolkit
          </button>
          <p className="install-note">Your browser will ask you to confirm. It adds an icon to your home screen or app list.</p>
          <AfterSteps />
        </>}

        {kind === 'android' && <>
          <ol className="install-steps">
            <Step n={1} icon={<span className="install-dots">⋮</span>} title="Open your browser's menu">The three dots at the top right.</Step>
            <Step n={2} icon={<SquarePlus size={20} />} title="Tap “Install app” or “Add to Home screen”" />
            <Step n={3} icon={<Smartphone size={20} />} title="Open YA Toolkit from your home screen">Sign in with your email.</Step>
          </ol>
          <AfterSteps />
        </>}

        {kind === 'desktop' && <>
          <div className="install-qr-wrap">
            <QR text={url} />
            <p className="install-note"><b>Scan with your phone's camera</b> to open this page there, then follow the steps it shows.</p>
          </div>
          <CopyButton copied={copied} onCopy={copy} />
          <p className="install-note">On a Mac in Safari you can also choose <b>File → Add to Dock</b>.</p>
        </>}
      </div>
    </div>
  )
}

function Step({ n, icon, title, children }) {
  return (
    <li className="install-step">
      <span className="install-num" aria-hidden="true">{n}</span>
      <div className="install-step-body">
        <div className="install-step-title">{title}</div>
        {children && <div className="install-step-text">{children}</div>}
      </div>
      <span className="install-step-icon" aria-hidden="true">{icon}</span>
    </li>
  )
}

function Done({ title, text }) {
  return (
    <div className="install-done">
      <CircleCheck size={28} />
      <div><b>{title}</b><span>{text}</span></div>
    </div>
  )
}

function AfterSteps() {
  return (
    <p className="install-after"><Bell size={15} /><span>Then turn on notifications: tap your photo, then <b>Notifications → Turn on</b>.</span></p>
  )
}

function CopyButton({ copied, onCopy }) {
  return (
    <button className="install-copy" onClick={onCopy}>
      {copied ? <><Check size={16} /> Link copied</> : <><Copy size={16} /> Copy link</>}
    </button>
  )
}

function QR({ text }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M'); q.addData(text); q.make()
    return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true })
  }, [text])
  return <div className="install-qr" role="img" aria-label={`QR code for ${text}`} dangerouslySetInnerHTML={{ __html: svg }} />
}
