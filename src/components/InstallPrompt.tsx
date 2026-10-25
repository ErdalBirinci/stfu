import { useState } from 'react'
import { Download, Share, Smartphone, SquarePlus } from 'lucide-react'
import { isIos, useInstallState } from '../lib/pwa'
import { cn } from '../lib/cn'
import { Modal } from './Modal'

export function InstallEntry({ variant = 'sidebar' }: { variant?: 'sidebar' | 'card' }) {
  const { canInstall, installed, install } = useInstallState()
  const [helpOpen, setHelpOpen] = useState(false)
  const ios = isIos()

  if (installed) return null

  function start() {
    if (canInstall) {
      void install()
      return
    }
    setHelpOpen(true)
  }

  const button =
    variant === 'sidebar' ? (
      <button
        type="button"
        onClick={start}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-muted transition hover:bg-white/60 hover:text-ink"
      >
        <Download className="size-4" />
        Install app
      </button>
    ) : (
      <button
        type="button"
        onClick={start}
        className="btn btn-quiet !px-3 !py-1.5 !text-[12px]"
      >
        <Download className="size-3.5" />
        Install
      </button>
    )

  return (
    <>
      {button}
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Put STFU on your home screen"
        description="Installed, the circle opens full screen like any other app — and it can send push notifications."
        width="sm:max-w-[440px]"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setHelpOpen(false)}>
            Got it
          </button>
        }
      >
        <ol className="space-y-3 text-[13px] leading-relaxed text-[#3c3c41]">
          <li className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f2f4f8] text-muted">
              <Smartphone className="size-3.5" />
            </span>
            <span>
              <span className="font-semibold">iPhone / iPad:</span> open this site in Safari, tap the{' '}
              <Share className="inline size-3.5 -translate-y-px" /> Share button, then choose{' '}
              <span className="font-semibold">Add to Home Screen</span>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f2f4f8] text-muted">
              <SquarePlus className="size-3.5" />
            </span>
            <span>
              <span className="font-semibold">Android:</span> open the browser menu and pick{' '}
              <span className="font-semibold">Install app</span> (or “Add to Home screen” in older
              versions).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f2f4f8] text-muted">
              <Download className="size-3.5" />
            </span>
            <span>
              <span className="font-semibold">Desktop:</span> use the install icon in the address bar, or
              the menu → <span className="font-semibold">Install STFU</span>.
            </span>
          </li>
        </ol>
        <p className={cn('mt-4 rounded-xl bg-[#f7f7fa] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted')}>
          {ios
            ? 'Notifications arrive once STFU is on your home screen — iOS only allows them for installed apps.'
            : 'After installing, open STFU from its icon and turn on notifications in Me → Notifications.'}
        </p>
      </Modal>
    </>
  )
}
