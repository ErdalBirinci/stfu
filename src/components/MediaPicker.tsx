import { useRef } from 'react'
import { ImagePlus, Music2, Paperclip, Video, X } from 'lucide-react'
import { kindOf } from '../lib/media'
import { fileSize } from '../lib/format'
import type { PickedFile } from '../lib/types'
import { useToast } from './Toast'
import { cn } from '../lib/cn'

const MAX_FILES = 10
const MAX_BYTES = 50 * 1024 * 1024

export function MediaPicker({
  files,
  onChange,
  label = 'Add photos, video or audio',
  compact = false,
}: {
  files: PickedFile[]
  onChange: (files: PickedFile[]) => void
  label?: string
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const accepted: PickedFile[] = []
    for (const file of Array.from(list)) {
      const kind = kindOf(file)
      if (!kind) {
        toast(`"${file.name}" is not a photo, video or audio file.`, 'error')
        continue
      }
      if (file.size > MAX_BYTES) {
        toast(`"${file.name}" is over 50 MB, which is the upload limit.`, 'error')
        continue
      }
      accepted.push({
        key: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        kind,
      })
    }
    const merged = [...files, ...accepted].slice(0, MAX_FILES)
    if (files.length + accepted.length > MAX_FILES) {
      toast(`Up to ${MAX_FILES} files per post.`, 'error')
    }
    onChange(merged)
    if (inputRef.current) inputRef.current.value = ''
  }

  function remove(key: string) {
    const target = files.find((item) => item.key === key)
    if (target) URL.revokeObjectURL(target.previewUrl)
    onChange(files.filter((item) => item.key !== key))
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={(event) => addFiles(event.target.files)}
      />

      {files.length > 0 ? (
        <div className={cn('mb-2.5 grid gap-2', compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4')}>
          {files.map((item) => (
            <div
              key={item.key}
              className="group relative aspect-square overflow-hidden rounded-xl border border-hair bg-[#f7f7fa]"
            >
              {item.kind === 'image' ? (
                <img src={item.previewUrl} alt="" className="size-full object-cover" />
              ) : item.kind === 'video' ? (
                <video src={item.previewUrl} className="size-full object-cover" muted playsInline />
              ) : (
                <div className="grid size-full place-items-center gap-1 p-2 text-center">
                  <Music2 className="mx-auto size-5 text-muted" />
                  <span className="line-clamp-2 text-[10px] leading-tight text-muted">{item.file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(item.key)}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Remove ${item.file.name}`}
              >
                <X className="size-3.5" />
              </button>
              <span className="absolute inset-x-1 bottom-1 truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                {fileSize(item.file.size)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-[#f1f2f6] hover:text-ink"
        >
          <ImagePlus className="size-4" />
          Photo
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-[#f1f2f6] hover:text-ink"
        >
          <Video className="size-4" />
          Video
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-[#f1f2f6] hover:text-ink"
        >
          <Music2 className="size-4" />
          Audio
        </button>
        {label ? (
          <span className="ml-auto hidden items-center gap-1 text-[11px] text-faint sm:inline-flex">
            <Paperclip className="size-3" />
            up to 50 MB each
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function releasePickedFiles(files: PickedFile[]) {
  files.forEach((item) => URL.revokeObjectURL(item.previewUrl))
}
