import { activeRegistration, registerServiceWorker, swUrl } from './pwa'

/** Public VAPID key — safe to ship in the bundle, the private half lives on the server. */
export const VAPID_PUBLIC_KEY =
  'BA13cg_APIZTeol3bxcWitfJLCrhfi4u8ouPt5l0EH48hZDRoH0aZwzmy6p_APN4s2D1wjYpJ7vcmfnH87GpO9Q'

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on'

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  )
}

function decodeKey(base64: string): ArrayBuffer {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(padded)
  const buffer = new ArrayBuffer(raw.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return buffer
}

function encodeKey(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('This browser cannot install the app.')
  registerServiceWorker()
  const existing = await activeRegistration()
  if (existing) return navigator.serviceWorker.ready
  await navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL })
  return navigator.serviceWorker.ready
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await activeRegistration()
  if (!registration) return null
  return registration.pushManager.getSubscription()
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

/** The three strings the server needs, whether or not toJSON() gives the keys. */
export function subscriptionPayload(subscription: PushSubscription): {
  endpoint: string
  p256dh: string
  auth: string
} {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh ?? encodeKey(subscription.getKey('p256dh'))
  const auth = json.keys?.auth ?? encodeKey(subscription.getKey('auth'))
  if (!p256dh || !auth) throw new Error('This browser returned an incomplete subscription.')
  return { endpoint: subscription.endpoint, p256dh, auth }
}

/** Asks the browser for permission, subscribes and hands the keys to the app. */
export async function enablePush(save: (payload: {
  endpoint: string
  p256dh: string
  auth: string
}, userAgent: string) => Promise<void>): Promise<PushState> {
  if (!pushSupported()) throw new Error('This browser cannot receive notifications.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission === 'denied' ? 'blocked' : 'off'
  }

  const registration = await readyRegistration()
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(VAPID_PUBLIC_KEY),
    }))

  const keys = subscriptionPayload(subscription)

  await save(keys, navigator.userAgent)
  return 'on'
}

export async function disablePush(remove: (endpoint: string) => Promise<void>): Promise<PushState> {
  const subscription = await currentSubscription()
  if (!subscription) return 'off'
  try {
    await remove(subscription.endpoint)
  } finally {
    await subscription.unsubscribe()
  }
  return 'off'
}
