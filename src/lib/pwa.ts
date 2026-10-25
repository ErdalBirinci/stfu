import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let promptEvent: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    promptEvent = event as BeforeInstallPromptEvent
    listeners.forEach((listener) => listener())
  })
  window.addEventListener('appinstalled', () => {
    promptEvent = null
    listeners.forEach((listener) => listener())
  })
}

export const swUrl = `${import.meta.env.BASE_URL}sw.js`

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua)
  const touchMac = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  return (ios || touchMac) && !/crios|fxios/i.test(ua)
}

/** Registers the service worker once, after the shell has painted. */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  const start = () => {
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch(() => {
      // A failed registration only costs offline support and push.
    })
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

export async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)) || null
}

export function useInstallState() {
  const [canInstall, setCanInstall] = useState(Boolean(promptEvent))
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const sync = () => {
      setCanInstall(Boolean(promptEvent))
      setInstalled(isStandalone())
    }
    listeners.add(sync)
    sync()
    return () => {
      listeners.delete(sync)
    }
  }, [])

  async function install(): Promise<boolean> {
    if (!promptEvent) return false
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') {
      promptEvent = null
      setCanInstall(false)
      setInstalled(true)
      return true
    }
    return false
  }

  return {
    installed,
    canInstall: canInstall && !installed,
    ios: isIos() && !installed,
    install,
  }
}
