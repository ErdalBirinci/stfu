import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Images, Plus } from 'lucide-react'
import { createMemory, fetchMemories } from '../lib/api'
import { shortDate } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import type { Memory, PickedFile } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { MediaPicker, releasePickedFiles } from '../components/MediaPicker'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/Ui'

function coverOf(memory: Memory) {
  return (memory.media ?? []).find((item) => item.kind !== 'audio')
}

function MemoryCard({ memory }: { memory: Memory }) {
  const cover = coverOf(memory)
  const count = (memory.media ?? []).length

  return (
    <Link
      to={`/memories/${memory.id}`}
      className="group card overflow-hidden text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f1f1f5]">
        {cover?.url && cover.kind === 'image' ? (
          <img
            src={cover.url}
            alt={memory.title}
            loading="lazy"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : cover?.url && cover.kind === 'video' ? (
          <video src={cover.url} className="size-full object-cover" preload="metadata" muted playsInline />
        ) : (
          <div className="grid size-full place-items-center text-[#b6b6c0]">
            <Camera className="size-7" />
          </div>
        )}
        {count > 0 ? (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-sm">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
        ) : null}
      </div>
      <div className="px-4 py-3.5">
        <h3 className="truncate text-[14.5px] font-semibold">{memory.title}</h3>
        <div className="mt-1 flex items-center gap-2 text-[11.5px] text-faint">
          <span>{memory.taken_on ? shortDate(memory.taken_on) : shortDate(memory.created_at)}</span>
          {memory.creator ? (
            <>
              <span className="size-1 rounded-full bg-[#d3d3da]" />
              <span className="inline-flex items-center gap-1">
                <Avatar name={memory.creator.display_name} path={memory.creator.avatar_url} size={16} />
                {memory.creator.display_name.split(' ')[0]}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function NewMemoryForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [takenOn, setTakenOn] = useState('')
  const [files, setFiles] = useState<PickedFile[]>([])
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (title.trim().length < 3) {
      toast('Give this memory a name.', 'error')
      return
    }
    setSaving(true)
    try {
      await createMemory({
        title,
        description,
        takenOn: takenOn || null,
        files: files.map((item) => item.file),
      })
      releasePickedFiles(files)
      toast('Memory saved.', 'success')
      onCreated()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save the memory.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3.5">
      <div>
        <label className="label" htmlFor="memory-title">
          Name
        </label>
        <input
          id="memory-title"
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Summer at the lake house"
          maxLength={100}
        />
      </div>

      <div>
        <label className="label" htmlFor="memory-date">
          When was it? <span className="font-normal text-faint">optional</span>
        </label>
        <input
          id="memory-date"
          type="date"
          className="field"
          value={takenOn}
          onChange={(event) => setTakenOn(event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="memory-description">
          Story <span className="font-normal text-faint">optional</span>
        </label>
        <textarea
          id="memory-description"
          className="field resize-none"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="A few lines to remember it by…"
          maxLength={2000}
        />
      </div>

      <div>
        <span className="label">Photos, video or audio</span>
        <div className="rounded-2xl border border-dashed border-[#dcdce4] p-2.5">
          <MediaPicker files={files} onChange={setFiles} />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
          {saving ? <Spinner /> : <Plus className="size-4" />}
          {saving ? 'Saving…' : 'Save memory'}
        </button>
      </div>
    </div>
  )
}

export function MemoriesPage() {
  const [formOpen, setFormOpen] = useState(false)
  const { data, loading, error, reload } = useAsyncData<Memory[]>(() => fetchMemories(), [])

  return (
    <>
      <PageHeader
        eyebrow="Memories"
        title="The archive"
        subtitle="Photos, clips and voice notes the circle keeps for later."
        action={
          <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            New memory
          </button>
        }
      />

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="card overflow-hidden">
              <span className="skeleton block aspect-[4/3]" />
              <div className="space-y-2 p-4">
                <span className="skeleton block h-3 w-2/3 rounded-full" />
                <span className="skeleton block h-2 w-1/3 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {data.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} />
          ))}
        </div>
      ) : !error ? (
        <EmptyState
          icon={<Images className="size-5" />}
          title="No memories yet"
          description="Start an album for a trip, a birthday, or an ordinary evening worth keeping."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              Create the first one
            </button>
          }
        />
      ) : null}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New memory"
        description="Create an album the whole circle can add to."
      >
        <NewMemoryForm
          onCreated={() => {
            setFormOpen(false)
            reload()
          }}
        />
      </Modal>
    </>
  )
}
