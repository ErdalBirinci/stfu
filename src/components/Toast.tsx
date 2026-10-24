import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

type Tone = 'default' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  tone: Tone
}

type PushToast = (message: string, tone?: Tone) => void

const ToastContext = createContext<PushToast>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback<PushToast>((message, tone = 'default') => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list, { id, message, tone }])
    window.setTimeout(() => {
      setItems((list) => list.filter((item) => item.id !== id))
    }, 4200)
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end">
        {items.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl border border-hair bg-surface/95 px-4 py-3 text-sm text-ink shadow-lift backdrop-blur"
            style={{ animation: 'rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
          >
            {item.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" />
            ) : item.tone === 'error' ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : null}
            <span className="leading-snug">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): PushToast {
  return useContext(ToastContext)
}
