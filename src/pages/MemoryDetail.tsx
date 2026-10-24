import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ImagePlus, Play, Trash2 } from 'lucide-react'
import { addMemoryMedia, deleteMemory, fetchMemory } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fileSize, fullDate, relativeTime, shortDate } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import { kindOf, signedUrl } from '../lib/media'
import type { MediaItem } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { Lightbox } from '../components/Lightbox'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { ErrorNote, LoadingRows, Spinner } from '../components/Ui'

export function MemoryDetailPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { data: memory, loading, error, reload } = useAsyncData(() => fetchMemory(id), [id])

  if (loading && !memory) return <LoadingRows count={1} height={220} />
  if (error) return <ErrorNote message={error} onRetry={reload} />
  if (!memory) return null

  const media = memory.media ?? []
  const visuals = media.filter((item) => item.kind !== 'audio')
  const audio = media.filter((item) => item.kind === 'audio')
  const canDelete = profile?.id === memory.created_by || profile?.role === 'admin'
  const totalSize = media.reduce((sum, item) => sum + item.size_bytes, 0)

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    const accepted: File[] = []
    for (const file of Array.from(files)) {
      if (!kindOf(file)) {
        toast(`"${file.name}" is not a photo, video or audio file.`, 'error')
        continue
      }
      if (file.size > 50 * 1024 * 1024) {
        toast(`"${file.name}" is over 50 MB.`, 'error')
        continue
      }
      accepted.push(file)
    }
    if (accepted.length === 0) return

    setUploading(true)
    try {
      await addMemoryMedia(memory!.id, accepted)
      toast(`${accepted.length} ${accepted.length === 1 ? 'item' : 'items'} added.`, 'success')
      reload()
    } catch (uploadError) {
      toast(uploadError instanceof Error ? uploadError.message : 'Upload failed.', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeAlbum() {
    try {
      await deleteMemory(memory!.id)
      toast('Memory deleted.', 'success')
      navigate('/memories')
    } catch (deleteError) {
      toast(deleteError instanceof Error ? deleteError.message : 'Could not delete.', 'error')
    }
  }

  async function openAudio(item: MediaItem) {
    const url = item.url ?? (await signedUrl(item.storage_path))
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/memories"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-white hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Memories
        </Link>
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted transition hover:bg-white hover:text-ink"
          >
            {uploading ? <Spinner className="size-3.5" /> : <ImagePlus className="size-3.5" />}
            {uploading ? 'Uploading…' : 'Add media'}
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-faint transition hover:bg-white hover:text-danger"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <header className="card px-5 py-5">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.032em]">{memory.title}</h1>
        {memory.description ? (
          <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-[#3c3c41]">
            {memory.description}
          </p>
        ) : null}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-faint">
          <span>
            {memory.taken_on ? fullDate(memory.taken_on) : `Created ${shortDate(memory.created_at)}`}
          </span>
          <span className="size-1 rounded-full bg-[#d8d8df]" />
          <span>
            {media.length} {media.length === 1 ? 'item' : 'items'}
            {totalSize > 0 ? ` · ${fileSize(totalSize)}` : ''}
          </span>
          {memory.creator ? (
            <>
              <span className="size-1 rounded-full bg-[#d8d8df]" />
              <span className="inline-flex items-center gap-1.5">
                <Avatar
                  name={memory.creator.display_name}
                  path={memory.creator.avatar_url}
                  size={20}
                />
                {memory.creator.display_name} · {relativeTime(memory.created_at)}
              </span>
            </>
          ) : null}
        </div>
      </header>

      {media.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="card mt-3.5 flex w-full flex-col items-center gap-2 border-dashed px-6 py-12 text-center transition hover:border-[#c9d3e3]"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-[#f3f4f8] text-muted">
            <ImagePlus className="size-5" />
          </span>
          <span className="text-[14px] font-semibold">This album is empty</span>
          <span className="max-w-xs text-[12.5px] leading-relaxed text-muted">
            Drop in the photos, clips and voice notes that belong here.
          </span>
        </button>
      ) : (
        <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visuals.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-[#f1f1f5]"
            >
              {item.url && item.kind === 'image' ? (
                <img
                  src={item.url}
                  alt={item.file_name}
                  loading="lazy"
                  className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : item.url ? (
                <video src={item.url} className="size-full object-cover" preload="metadata" muted playsInline />
              ) : (
                <span className="skeleton block size-full" />
              )}
              {item.kind === 'video' ? (
                <span className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="grid size-10 place-items-center rounded-full bg-black/45 backdrop-blur-sm">
                    <Play className="ml-0.5 size-4 fill-white text-white" />
                  </span>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {audio.length > 0 ? (
        <div className="mt-3.5">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            Voice notes
          </p>
          <div className="space-y-2">
            {audio.map((item) => (
              <div
                key={item.id}
                className="card flex items-center gap-3 px-3.5 py-2.5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <Play className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{item.file_name}</p>
                  <p className="text-[11px] text-faint">{fileSize(item.size_bytes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void openAudio(item)}
                  className="btn btn-quiet !px-3 !py-1.5 !text-[12px]"
                >
                  Play
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3.5 rounded-2xl border border-dashed border-[#dcdce4] bg-white/60 p-3">
        <p className="mb-2 px-1 text-[11.5px] text-faint">Add more to this album</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn btn-quiet !text-[12.5px]"
          >
            {uploading ? <Spinner /> : <ImagePlus className="size-3.5" />}
            Choose files
          </button>
          <span className="text-[11px] text-faint">Photos, video or audio · up to 50 MB each</span>
        </div>
      </div>

      {lightboxIndex !== null && visuals.length > 0 ? (
        <Lightbox
          items={visuals}
          index={Math.min(lightboxIndex, visuals.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this memory?"
        description="The album and every file inside it will be removed."
        width="sm:max-w-[420px]"
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn !bg-[#c8332b] text-white hover:!bg-[#a92a23]"
              onClick={() => void removeAlbum()}
            >
              <Trash2 className="size-3.5" />
              Delete memory
            </button>
          </>
        }
      >
        <p className="rounded-xl bg-[#f7f7fa] px-3.5 py-3 text-[13px] text-muted">{memory.title}</p>
      </Modal>
    </div>
  )
}
