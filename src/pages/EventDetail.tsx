import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Clock,
  Images,
  MapPin,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { clearRsvp, deleteEvent, fetchEvent, fetchMemoriesForEvent, setRsvp } from '../lib/api'
import { cn } from '../lib/cn'
import { useAuth } from '../lib/auth'
import { eventRange, relativeTime } from '../lib/format'
import { downloadEventIcs } from '../lib/ics'
import { useAsyncData, useSignedUrl } from '../lib/hooks'
import type { Memory, RsvpStatus } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { blurStyle } from '../components/MediaGrid'
import { MemoryForm } from '../components/MemoryForm'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { ErrorNote, LoadingRows, Spinner } from '../components/Ui'

function countdownLabel(startsAt: string): string | null {
  const diff = new Date(startsAt).getTime() - Date.now()
  if (diff <= 0) return null
  const hours = diff / 3_600_000
  if (hours < 1) return `in ${Math.max(1, Math.round(diff / 60_000))} minutes`
  if (hours < 24) return `in ${Math.round(hours)} hours`
  const days = Math.round(hours / 24)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

const OPTIONS: Array<{ value: RsvpStatus; label: string }> = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't go" },
]

export function EventDetailPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)
  const { data: event, loading, error, reload } = useAsyncData(() => fetchEvent(id), [id])
  const album = useAsyncData<Memory[]>(
    () => (event ? fetchMemoriesForEvent(event.id) : Promise.resolve([])),
    [event?.id],
  )
  const coverUrl = useSignedUrl(event?.cover_path ?? null)

  if (loading && !event) return <LoadingRows count={1} height={200} />
  if (error) return <ErrorNote message={error} onRetry={reload} />
  if (!event) return null

  const attendees = event.attendees ?? []
  const mine = attendees.find((attendee) => attendee.user_id === profile?.id)
  const canDelete = profile?.id === event.created_by || profile?.role === 'admin'
  const groups = OPTIONS.map((option) => ({
    ...option,
    people: attendees.filter((attendee) => attendee.status === option.value),
  }))
  const albumMemories = album.data ?? []
  const countdown = countdownLabel(event.starts_at)

  async function choose(status: RsvpStatus) {
    setSaving(true)
    try {
      if (mine?.status === status) {
        await clearRsvp(event!.id)
      } else {
        await setRsvp(event!.id, status)
      }
      reload()
    } catch (rsvpError) {
      toast(rsvpError instanceof Error ? rsvpError.message : 'Could not save your reply.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    try {
      await deleteEvent(event!.id)
      toast('Event removed.', 'success')
      navigate('/calendar')
    } catch (deleteError) {
      toast(deleteError instanceof Error ? deleteError.message : 'Could not delete the event.', 'error')
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/calendar"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-white hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Calendar
        </Link>
        {canDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] font-medium text-faint transition hover:bg-white hover:text-danger"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        ) : null}
      </div>

      <article className="card overflow-hidden">
        <div className="relative border-b border-hair/70 bg-gradient-to-br from-[#f7faff] to-white">
          {coverUrl ? (
            <>
              <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101018]/85 via-[#101018]/45 to-[#101018]/15" />
            </>
          ) : null}
          <div className={cn('relative px-5', coverUrl ? 'pb-6 pt-16 text-white' : 'py-6')}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <p
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-[0_1px_2px_rgba(20,20,43,0.06)]',
                  coverUrl ? 'bg-white/20 text-white backdrop-blur' : 'bg-white text-accent-deep',
                )}
              >
                <CalendarDays className="size-3" />
                {event.all_day ? 'All-day event' : 'Event'}
              </p>
              {countdown ? (
                <p
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    coverUrl ? 'bg-white/20 text-white backdrop-blur' : 'bg-[#eef5ff] text-accent-deep',
                  )}
                >
                  {countdown}
                </p>
              ) : null}
            </div>
            <h1 className="text-[27px] font-semibold leading-tight tracking-[-0.032em]">{event.title}</h1>
            <div
              className={cn(
                'mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]',
                coverUrl ? 'text-white/85' : 'text-muted',
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {eventRange(event.starts_at, event.ends_at, event.all_day)}
              </span>
              {event.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {event.location}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => downloadEventIcs(event)}
              className={cn(
                'btn mt-3.5 !px-3 !py-1.5 !text-[12px]',
                coverUrl ? '!bg-white/20 text-white backdrop-blur hover:!bg-white/30' : 'btn-quiet',
              )}
            >
              <CalendarPlus className="size-3.5" />
              Add to calendar
            </button>
          </div>
        </div>

        <div className="px-5 py-5">
          {event.description ? (
            <p className="whitespace-pre-line text-[14px] leading-[1.7] text-[#33333a]">{event.description}</p>
          ) : (
            <p className="text-[13px] text-faint">No extra details were added.</p>
          )}

          <div className="mt-5 flex items-center gap-2 border-t border-hair/70 pt-3">
            <Avatar
              name={event.creator?.display_name ?? 'Member'}
              path={event.creator?.avatar_url}
              size={26}
            />
            <p className="text-[11.5px] text-muted">
              Opened by{' '}
              <span className="font-medium text-ink">{event.creator?.display_name ?? 'a member'}</span> ·{' '}
              {relativeTime(event.created_at)}
            </p>
          </div>
        </div>
      </article>

      <section className="card mt-3.5 p-5">
        <h2 className="text-[15px] font-semibold">Are you in?</h2>
        <p className="mt-1 text-[12.5px] text-muted">Tap your answer — the others see it right away.</p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {OPTIONS.map((option) => {
            const active = mine?.status === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => void choose(option.value)}
                disabled={saving}
                className={`rounded-xl border px-2 py-2.5 text-[12.5px] font-semibold transition ${
                  active
                    ? 'border-accent bg-accent text-white shadow-[0_8px_18px_-12px_rgba(10,108,245,0.9)]'
                    : 'border-hair bg-white text-muted hover:border-[#cfd8e6] hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        {mine ? (
          <p className="mt-2 text-[11px] text-faint">
            {mine.status === 'going'
              ? 'You are on the list. Tap again to undo.'
              : mine.status === 'maybe'
                ? 'Marked as maybe. Tap again to undo.'
                : 'Marked as not going. Tap again to undo.'}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-faint">You have not answered yet.</p>
        )}
      </section>

      <section className="card mt-3.5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Images className="size-4 text-faint" />
            Memories from this night
          </h2>
          <button
            type="button"
            onClick={() => setAlbumOpen(true)}
            className="btn btn-quiet !px-3 !py-1.5 !text-[12px]"
          >
            <Plus className="size-3.5" />
            Add photos
          </button>
        </div>

        {albumMemories.length === 0 ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Nothing here yet. Once the night happens, this is where the photos land.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {albumMemories.map((memory) => {
              const cover = (memory.media ?? []).find((item) => item.kind === 'image')
              return (
                <Link
                  key={memory.id}
                  to={`/memories/${memory.id}`}
                  className="group overflow-hidden rounded-xl border border-hair bg-white transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="block aspect-[4/3] overflow-hidden bg-[#f1f1f5]">
                    {cover?.url ? (
                      <img
                        src={cover.url}
                        alt=""
                        loading="lazy"
                        className="size-full bg-[#f1f1f5] object-cover transition duration-500 group-hover:scale-[1.03]"
                        style={blurStyle(cover)}
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-[#b6b6c0]">
                        <Images className="size-5" />
                      </span>
                    )}
                  </span>
                  <span className="block truncate px-2.5 py-1.5 text-[12px] font-medium">
                    {memory.title}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="card mt-3.5 p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Users className="size-4 text-faint" />
          Who's coming
        </h2>

        {attendees.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted">No answers yet. Be the first.</p>
        ) : (
          <div className="mt-3 space-y-3.5">
            {groups
              .filter((group) => group.people.length > 0)
              .map((group) => (
                <div key={group.value}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                    {group.label} · {group.people.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.people.map((attendee) => (
                      <span
                        key={attendee.user_id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-[#fbfbfd] py-1 pl-1 pr-2.5"
                      >
                        <Avatar
                          name={attendee.profile?.display_name ?? 'Member'}
                          path={attendee.profile?.avatar_url}
                          size={22}
                        />
                        <span className="text-[11.5px] font-medium">
                          {attendee.profile?.display_name ?? 'Member'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
        {saving ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-faint">
            <Spinner className="size-3" /> Saving…
          </p>
        ) : null}
      </section>

      <Modal
        open={albumOpen}
        onClose={() => setAlbumOpen(false)}
        title={`Memories from ${event.title}`}
        description="Start an album for this night and the whole circle can add to it."
        width="sm:max-w-[480px]"
      >
        <MemoryForm
          eventId={event.id}
          onSaved={() => {
            setAlbumOpen(false)
            album.reload()
          }}
          onCancel={() => setAlbumOpen(false)}
        />
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this event?"
        description="It disappears from everyone's calendar."
        width="sm:max-w-[420px]"
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn !bg-[#c8332b] text-white hover:!bg-[#a92a23]"
              onClick={() => void remove()}
            >
              <Trash2 className="size-3.5" />
              Delete event
            </button>
          </>
        }
      >
        <p className="rounded-xl bg-[#f7f7fa] px-3.5 py-3 text-[13px] text-muted">{event.title}</p>
      </Modal>
    </div>
  )
}
