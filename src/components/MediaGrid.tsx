import type { CSSProperties } from 'react'
import { Music2 } from 'lucide-react'
import type { MediaItem } from '../lib/types'
import { cn } from '../lib/cn'

/** The 24px preview sits behind the photo so the frame is never empty. */
export function blurStyle(item: MediaItem): CSSProperties | undefined {
  if (!item.blur_data) return undefined
  return {
    backgroundImage: `url(${item.blur_data})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}

export function MediaGrid({
  items,
  onOpen,
  compact = false,
}: {
  items: MediaItem[]
  onOpen?: (items: MediaItem[], index: number) => void
  compact?: boolean
}) {
  if (items.length === 0) return null

  const visuals = items.filter((item) => item.kind !== 'audio')
  const audio = items.filter((item) => item.kind === 'audio')

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      {visuals.length > 0 ? (
        <div
          className={cn(
            'grid gap-1.5 overflow-hidden rounded-2xl',
            visuals.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {visuals.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen?.(visuals, index)}
              className={cn(
                'group relative overflow-hidden bg-[#f0f0f4]',
                visuals.length === 1 ? 'aspect-[4/3] rounded-2xl' : 'aspect-square',
                visuals.length === 3 && index === 0 && 'col-span-2 aspect-[16/10]',
              )}
            >
              {item.kind === 'image' ? (
                item.url ? (
                  <img
                    src={item.url}
                    alt={item.file_name}
                    loading="lazy"
                    className="size-full bg-[#f0f0f4] object-cover transition duration-500 group-hover:scale-[1.02]"
                    style={blurStyle(item)}
                  />
                ) : (
                  <span className="skeleton block size-full" />
                )
              ) : item.url ? (
                <video
                  src={item.url}
                  className="size-full object-cover"
                  preload="metadata"
                  playsInline
                />
              ) : (
                <span className="skeleton block size-full" />
              )}
              {item.kind === 'video' ? (
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="grid size-11 place-items-center rounded-full bg-black/45 backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" className="ml-0.5 size-4 fill-white">
                      <path d="M8 5.14v13.72L19 12z" />
                    </svg>
                  </span>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {audio.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-2xl border border-hair bg-[#fafafc] px-3.5 py-2.5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Music2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-ink">{item.file_name}</p>
            {item.url ? (
              <audio src={item.url} controls preload="none" className="mt-1 h-8 w-full" />
            ) : (
              <span className="skeleton mt-1 block h-8 w-full rounded-md" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
