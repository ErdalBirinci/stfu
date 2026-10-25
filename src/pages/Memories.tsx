import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Images, Lock, Pencil, Plus } from 'lucide-react'
import { fetchMemories } from '../lib/api'
import { useAuth } from '../lib/auth'
import { shortDate } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import type { Memory } from '../lib/types'
import { cn } from '../lib/cn'
import { Avatar } from '../components/Avatar'
import { blurStyle } from '../components/MediaGrid'
import { MemoryForm } from '../components/MemoryForm'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorNote, PageHeader } from '../components/Ui'

function coverOf(memory: Memory) {
  return (memory.media ?? []).find((item) => item.kind !== 'audio')
}

function yearOf(memory: Memory): number {
  const stamp = memory.taken_on ?? memory.created_at
  return new Date(stamp.length > 10 ? stamp : `${stamp}T12:00:00`).getFullYear()
}

function isSealed(memory: Memory): boolean {
  return memory.publish_at ? new Date(memory.publish_at).getTime() > Date.now() : false
}

function MemoryCard({
  memory,
  featured = false,
  onEdit,
}: {
  memory: Memory
  featured?: boolean
  onEdit?: () => void
}) {
  const cover = coverOf(memory)
  const count = (memory.media ?? []).length
  const sealed = isSealed(memory)

  return (
    <div className="group relative">
      <Link
        to={`/memories/${memory.id}`}
        className="card block overflow-hidden text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div
          className={cn(
            'relative overflow-hidden bg-[#f1f1f5]',
            featured ? 'aspect-[16/9] sm:aspect-[2/1]' : 'aspect-[4/3]',
          )}
        >
          {sealed ? (
            <div className="grid size-full place-items-center bg-[linear-gradient(135deg,#efeafc_0%,#f7f3ff_45%,#eaf2ff_100%)] text-center">
              <div>
                <Lock className="mx-auto size-6 text-[#8a76b8]" />
                <p className="mt-1.5 px-4 text-[11.5px] font-semibold text-[#6f5f96]">
                  Sealed until{' '}
                  {memory.publish_at
                    ? new Date(memory.publish_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'later'}
                </p>
              </div>
            </div>
          ) : cover?.url && cover.kind === 'image' ? (
            <img
              src={cover.url}
              alt={memory.title}
              loading="lazy"
              className="size-full bg-[#f1f1f5] object-cover transition duration-500 group-hover:scale-[1.03]"
              style={blurStyle(cover)}
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
  const [year, setYear] = useState<number | null>(null)
  const { data, loading, error, reload } = useAsyncData<Memory[]>(() => fetchMemories(), [])

  const canEdit = (memory: Memory) => profile?.id === memory.created_by || profile?.role === 'admin'

  const years = [...new Set((data ?? []).map(yearOf))].sort((a, b) => b - a)
  const visible = year === null ? (data ?? []) : (data ?? []).filter((memory) => yearOf(memory) === year)

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

      {years.length > 1 ? (
        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {[null, ...years].map((value) => (
            <button
              key={value ?? 'all'}
              type="button"
              onClick={() => setYear(value)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
                year === value
                  ? 'border-transparent bg-ink text-white'
                  : 'border-hair bg-white text-muted hover:text-ink',
              )}
            >
              {value ?? 'All years'}
            </button>
          ))}
        </div>
      ) : null}

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
      ) : visible.length > 0 ? (
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {visible.map((memory, index) => (
            <div key={memory.id} className={index === 0 && visible.length > 2 ? 'sm:col-span-2' : ''}>
              <MemoryCard
                memory={memory}
                featured={index === 0 && visible.length > 2}
                onEdit={canEdit(memory) ? () => setEditing(memory) : undefined}
              />
            </div>
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
