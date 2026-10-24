import { initials } from '../lib/format'
import { useSignedUrl } from '../lib/hooks'
import { cn } from '../lib/cn'

interface AvatarProps {
  name: string
  path?: string | null
  size?: number
  className?: string
  ring?: boolean
}

export function Avatar({ name, path, size = 38, className, ring }: AvatarProps) {
  const url = useSignedUrl(path)
  const dimension = { width: size, height: size }

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={dimension}
        className={cn(
          'shrink-0 rounded-full object-cover',
          ring && 'ring-2 ring-white',
          className,
        )}
        loading="lazy"
      />
    )
  }

  return (
    <span
      style={{ ...dimension, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e9eef7] to-[#d8e2f2] font-semibold text-[#41506b]',
        ring && 'ring-2 ring-white',
        className,
      )}
      aria-hidden
    >
      {initials(name) || '·'}
    </span>
  )
}
