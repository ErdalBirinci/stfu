import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBodyLock } from '../lib/hooks'
import { cn } from '../lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, description, children, footer, width }: ModalProps) {
  useBodyLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-[#101018]/35 backdrop-blur-[3px]"
        style={{ animation: 'rise 160ms ease-out both' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] border border-hair bg-surface p-6 shadow-lift sm:rounded-[26px]',
          width ?? 'sm:max-w-[560px]',
        )}
        style={{ animation: 'rise 220ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        <div className="mb-5 flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[19px] font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-[#f1f1f5] hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
