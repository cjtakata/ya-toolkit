// Browser side of push notifications: register the service worker, ask
// permission, and hand the subscription to /api/push.

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// What this device can do right now:
//   'unsupported'   browser can't do push at all
//   'needs-install' iPhone/iPad in Safari: push only works from the home-screen app
//   'denied'        the person blocked notifications for this app
//   'ready'         can be turned on
export function pushSupport() {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'ready'
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

// The current subscription on this device, if any.
export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

function keyBytes(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function deviceLabel() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || isIOS()) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'This device'
}

const post = body => fetch('/api/push', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(async r => {
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.')
  return j
})

// Must run from a tap (iOS only shows the permission prompt after one).
export async function turnOn(publicKey) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Notifications are blocked for this app. Turn them on in your phone’s Settings → Notifications.'
    : 'Notifications weren’t turned on.')
  const reg = await registration()
  await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
  await post({ action: 'subscribe', subscription: sub.toJSON(), label: deviceLabel() })
  return sub
}

export async function turnOff() {
  const sub = await currentSubscription()
  if (!sub) return
  await post({ action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

export const sendTest = () => post({ action: 'test' })
