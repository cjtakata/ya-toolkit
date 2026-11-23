// Installing the app on a home screen (see InstallPage.jsx and InstallBanner.jsx).
//
// iPhone/iPad: Apple only allows Share → Add to Home Screen, so we explain it.
// Android / desktop Chrome & Edge: the browser offers a one-tap install prompt
// ("beforeinstallprompt"), which we catch as early as possible (main.jsx) and
// show from our own button.
import { useEffect, useState } from 'react'

export const INSTALL_PATH = '/install'
export const installUrl = () => `${window.location.origin}${INSTALL_PATH}`

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isAndroid = () => /Android/.test(navigator.userAgent)
// Links opened inside Instagram, Facebook, Gmail's viewer etc. can't add to
// the home screen; they need Safari (or Chrome) first.
export const inAppBrowser = () =>
  /FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat|Twitter|LinkedInApp|MicroMessenger|GoogleApp/.test(navigator.userAgent)

// ── Android / desktop install prompt ─────────────────────────────────────
let deferred = null
const listeners = new Set()
const notify = () => listeners.forEach(fn => fn(deferred))
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
}

// → { canPrompt, prompt(): Promise<'accepted'|'dismissed'> }
export function useInstallPrompt() {
  const [evt, setEvt] = useState(deferred)
  useEffect(() => { listeners.add(setEvt); return () => listeners.delete(setEvt) }, [])
  return {
    canPrompt: !!evt,
    async prompt() {
      if (!deferred) return 'dismissed'
      const e = deferred
      e.prompt()
      const { outcome } = await e.userChoice
      deferred = null; notify()
      return outcome
    },
  }
}

// Per-device "don't show the banner again" (best effort; private windows may refuse).
const DISMISS_KEY = 'ya_install_banner_dismissed'
export function bannerDismissed() {
  try { return !!localStorage.getItem(DISMISS_KEY) } catch { return false }
}
export function dismissBanner() {
  try { localStorage.setItem(DISMISS_KEY, new Date().toISOString()) } catch { /* ignore */ }
}

// Share the install link (phone share sheet, else copy). → 'shared' | 'copied' | 'failed'
export async function shareInstallLink() {
  const url = installUrl()
  if (navigator.share) {
    try { await navigator.share({ title: 'YA Toolkit', text: 'Add YA Toolkit to your phone:', url }); return 'shared' }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  }
  return copyText(url)
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return 'copied' } catch { return 'failed' }
}
