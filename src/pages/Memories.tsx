import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Images, Pencil, Plus } from 'lucide-react'
import { fetchMemories } from '../lib/api'
import { useAuth } from '../lib/auth'
import { shortDate } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import type { Memory } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { MemoryForm } from '../components/MemoryForm'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorNote, PageHeader } from '../components/Ui'

function coverOf(memory: Memory) {
  return (memory.media ?? []).find((item) => item.kind !== 'audio')
}

function MemoryCard({ memory, onEdit }: { memory: Memory; onEdit?: () => void }) {
  const cover = coverOf(memory)
  const count = (memory.media ?? []).length

  return (
    <div className="group relative">
      <Link
        to={`/memories/${memory.id}`}
        className="card block overflow-hidden text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-lift"
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

      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${memory.title}`}
          className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1.5 text-[11px] font-semibold text-muted shadow-[0_2px_12px_rgba(20,20,43,0.14)] transition hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Pencil className="size-3" />
          Edit
        </button>
      ) : null}
    </div>
  )
}

export function MemoriesPage() {
  const { profile } = useAuth()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Memory | null>(null)
  const { data, loading, error, reload } = useAsyncData<Memory[]>(() => fetchMemories(), [])

  const canEdit = (memory: Memory) => profile?.id === memory.created_by || profile?.role === 'admin'

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
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={canEdit(memory) ? () => setEditing(memory) : undefined}
            />
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
        <MemoryForm
          onSaved={() => {
            setFormOpen(false)
            reload()
          }}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit memory"
        description="Change the name, the story or the date. The photos stay as they are."
        width="sm:max-w-[480px]"
      >
        {editing ? (
          <MemoryForm
            memory={editing}
            onSaved={() => {
              setEditing(null)
              reload()
            }}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </>
  )
}
