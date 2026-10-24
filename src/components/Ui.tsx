import type { ReactNode } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '../lib/cn'

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  eyebrow?: string
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{eyebrow}</p>
        ) : null}
        <h1 className="text-[26px] font-semibold leading-tight sm:text-[30px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />
}

export function LoadingRows({ count = 3, height = 132 }: { count?: number; height?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card overflow-hidden p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="skeleton size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <span className="skeleton block h-2.5 w-28 rounded-full" />
              <span className="skeleton block h-2 w-16 rounded-full" />
            </div>
          </div>
          <span className="skeleton mb-2 block h-3 w-3/5 rounded-full" />
          <span className="skeleton block rounded-lg" style={{ height }} />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-[#f4f4f8] text-muted">{icon}</span>
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-[#f3d6d3] bg-[#fff7f6] px-4 py-3">
      <p className="text-[13px] text-[#8f2b22]">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-quiet !px-3 !py-1.5 !text-[12.5px]">
          <RefreshCw className="size-3.5" />
          Try again
        </button>
      ) : null}
    </div>
  )
}
