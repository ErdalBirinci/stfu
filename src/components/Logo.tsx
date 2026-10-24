import { cn } from '../lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid place-items-center rounded-[13px] bg-gradient-to-br from-[#4a93ff] to-[#0857c9] text-white shadow-[0_6px_14px_-8px_rgba(8,87,201,0.9)]',
        className ?? 'size-9',
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-[62%]" fill="none">
        <circle
          cx="16"
          cy="16"
          r="8.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="38 15"
        />
        <circle cx="16" cy="7.5" r="2.6" fill="currentColor" />
      </svg>
    </span>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.03em]">Dobby</span>
    </span>
  )
}
