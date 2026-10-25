import { useEffect, useState } from 'react'
import { BellRing, BellOff, Download, Send, ShieldAlert, Smartphone } from 'lucide-react'
import { removePushSubscription, savePushSubscription, sendPushSelfTest } from '../lib/api'
import { disablePush, enablePush, pushState, pushSupported, type PushState } from '../lib/push'
import { isIos, isStandalone } from '../lib/pwa'
import { cn } from '../lib/cn'
import { InstallEntry } from './InstallPrompt'
import { Spinner } from './Ui'
import { useToast } from './Toast'

function statusLine(state: PushState | 'loading', installed: boolean): string {
  if (state === 'loading') return 'Checking this device…'
  if (state === 'unsupported') return 'This browser cannot receive push notifications.'
  if (state === 'blocked') return 'Notifications are blocked in your browser settings for this site.'
  if (state === 'on') return 'On — this device buzzes for posts, replies, events and reminders.'
  if (!installed && isIos())
    return 'On iPhone and iPad, add STFU to your home screen first; Safari only sends notifications to installed apps.'
  return 'Off — turn it on to hear about new posts, replies and plans right away.'
}

export function DeviceSettings() {
  const toast = useToast()
  const [state, setState] = useState<PushState | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const installed = isStandalone()

  useEffect(() => {
    let alive = true
    void pushState()
      .then((next) => {
        if (alive) setState(next)
      })
      .catch(() => {
        if (alive) setState('unsupported')
      })
    return () => {
      alive = false
    }
  }, [])

  async function turnOn() {
    setBusy(true)
    try {
      const next = await enablePush(savePushSubscription)
      setState(next)
      if (next === 'on') toast('Notifications are on for this device.', 'success')
      else if (next === 'blocked')
        toast('Your browser blocked notifications. Allow them in the site settings.', 'error')
      else toast('Permission was dismissed — nothing changed.', 'error')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not turn on notifications.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      const next = await disablePush(removePushSubscription)
      setState(next)
      toast('Notifications are off for this device.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not turn off notifications.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setTesting(true)
    try {
      const devices = await sendPushSelfTest()
      if (devices === 0) {
        toast('No device is registered yet — turn notifications on first.', 'error')
        return
      }
      toast(`Test sent to ${devices} ${devices === 1 ? 'device' : 'devices'}. Watch the phone.`, 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not send the test.', 'error')
    } finally {
      setTesting(false)
    }
  }

  const supported = pushSupported()

  return (
    <section className="card mt-3.5 p-5">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-muted" />
        <h2 className="text-[15px] font-semibold">App &amp; notifications</h2>
      </div>

      <p
        className={cn(
          'mt-2 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] leading-relaxed',
          state === 'on' ? 'bg-[#f0faf4] text-[#217a4c]' : 'bg-[#f7f7fa] text-muted',
        )}
      >
        {state === 'blocked' ? (
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
        ) : state === 'on' ? (
          <BellRing className="mt-0.5 size-3.5 shrink-0" />
        ) : (
          <BellOff className="mt-0.5 size-3.5 shrink-0" />
        )}
        {statusLine(state, installed)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {supported ? (
          state === 'on' ? (
            <button type="button" className="btn btn-quiet" onClick={() => void turnOff()} disabled={busy}>
              {busy ? <Spinner /> : <BellOff className="size-3.5" />}
              Turn off on this device
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void turnOn()}
              disabled={busy || state === 'loading' || state === 'blocked'}
            >
              {busy ? <Spinner /> : <BellRing className="size-3.5" />}
              Turn on notifications
            </button>
          )
        ) : null}

        {installed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-white px-2.5 py-1 text-[11.5px] font-semibold text-muted">
            <Download className="size-3.5" />
            Installed on this device
          </span>
        ) : (
          <InstallEntry variant="card" />
        )}
      </div>

      {state === 'on' ? (
        <div className="mt-2.5 rounded-xl bg-[#f7f7fa] px-3 py-2.5">
          <p className="text-[11.5px] leading-relaxed text-muted">
            Keep the app open, then send one to this phone. If nothing arrives, check STFU&apos;s
            notification permission in the phone&apos;s settings and that the ringer is not silent.
          </p>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={testing}
            className="btn btn-quiet mt-2 !px-3 !py-1.5 !text-[12px]"
          >
            {testing ? <Spinner /> : <Send className="size-3.5" />}
            {testing ? 'Sending…' : 'Send a test notification'}
          </button>
        </div>
      ) : null}

      {state !== 'on' && supported && installed && isIos() ? (
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          iOS delivers notifications only for apps added to the home screen, and only after you tap
          Allow when prompted.
        </p>
      ) : null}
    </section>
  )
}
