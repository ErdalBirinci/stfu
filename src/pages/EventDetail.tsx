import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock, MapPin, Trash2, Users } from 'lucide-react'
import { clearRsvp, deleteEvent, fetchEvent, setRsvp } from '../lib/api'
import { useAuth } from '../lib/auth'
import { eventRange, relativeTime } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import type { RsvpStatus } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { ErrorNote, LoadingRows, Spinner } from '../components/Ui'

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
  const { data: event, loading, error, reload } = useAsyncData(() => fetchEvent(id), [id])

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
        <div className="border-b border-hair/70 bg-gradient-to-br from-[#f7faff] to-white px-5 py-6">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-accent-deep shadow-[0_1px_2px_rgba(20,20,43,0.06)]">
            <CalendarDays className="size-3" />
            {event.all_day ? 'All-day event' : 'Event'}
          </p>
          <h1 className="text-[27px] font-semibold leading-tight tracking-[-0.032em]">{event.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
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
