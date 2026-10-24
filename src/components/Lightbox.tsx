import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { MediaItem } from '../lib/types'
import { useBodyLock } from '../lib/hooks'

export function Lightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: MediaItem[]
  index: number
  onClose: () => void
  onIndexChange: (next: number) => void
}) {
  useBodyLock(true)
  const item = items[index]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % items.length)
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + items.length) % items.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, items.length, onClose, onIndexChange])

  if (!item) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0b0b0f]/92 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="text-[12.5px] tabular-nums">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close viewer"
        >
          <X className="size-4.5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-3">
        {items.length > 1 ? (
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + items.length) % items.length)}
            className="absolute left-2 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
            aria-label="Previous"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : null}

        {item.kind === 'video' ? (
          item.url ? (
            <video
              key={item.id}
              src={item.url}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-xl bg-black"
            />
          ) : null
        ) : item.url ? (
          <img
            key={item.id}
            src={item.url}
            alt={item.file_name}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        ) : null}

        {items.length > 1 ? (
          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % items.length)}
            className="absolute right-2 z-10 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
            aria-label="Next"
          >
            <ChevronRight className="size-5" />
          </button>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
          {items.map((thumb, thumbIndex) => (
            <button
              key={thumb.id}
              type="button"
              onClick={() => onIndexChange(thumbIndex)}
              className={`size-14 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                thumbIndex === index ? 'ring-white' : 'ring-transparent opacity-60 hover:opacity-100'
              }`}
              aria-label={`Show item ${thumbIndex + 1}`}
            >
              {thumb.kind === 'image' && thumb.url ? (
                <img src={thumb.url} alt="" className="size-full object-cover" />
              ) : (
                <video src={thumb.url} className="size-full object-cover" muted preload="metadata" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
