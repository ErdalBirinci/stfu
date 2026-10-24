import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Users } from 'lucide-react'
import { createEvent, fetchEvents } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'
import { clockTime, dayKey, eventRange, monthLabel, toLocalInputValue } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import type { CircleEvent } from '../lib/types'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/Ui'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function buildGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function goingCount(event: CircleEvent): number {
  return (event.attendees ?? []).filter((attendee) => attendee.status === 'going').length
}

function EventForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [startsAt, setStartsAt] = useState(() => {
    const next = new Date()
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 2)
    return toLocalInputValue(next)
  })
  const [endsAt, setEndsAt] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (title.trim().length < 3) {
      toast('Give the event a name.', 'error')
      return
    }
    if (!startsAt) {
      toast('Pick a start time.', 'error')
      return
    }
    setSaving(true)
    try {
      await createEvent({
        title,
        description,
        location,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        allDay,
      })
      toast('Event added to the calendar.', 'success')
      onCreated()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create the event.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3.5">
      <div>
        <label className="label" htmlFor="event-title">
          Event name
        </label>
        <input
          id="event-title"
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Dinner at Mine"
          maxLength={100}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="event-start">
            Starts
          </label>
          <input
            id="event-start"
            type="datetime-local"
            className="field"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            disabled={allDay}
          />
        </div>
        <div>
          <label className="label" htmlFor="event-end">
            Ends <span className="font-normal text-faint">optional</span>
          </label>
          <input
            id="event-end"
            type="datetime-local"
            className="field"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            disabled={allDay}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-muted">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          className="size-4 rounded border-hair accent-[#0a6cf5]"
        />
        All-day event
      </label>

      <div>
        <label className="label" htmlFor="event-location">
          Where
        </label>
        <input
          id="event-location"
          className="field"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Someone's place, a park, a bar…"
          maxLength={140}
        />
      </div>

      <div>
        <label className="label" htmlFor="event-description">
          Details
        </label>
        <textarea
          id="event-description"
          className="field resize-none"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What should everyone know?"
          maxLength={2000}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
          {saving ? <Spinner /> : <Plus className="size-4" />}
          {saving ? 'Creating…' : 'Create event'}
        </button>
      </div>
    </div>
  )
}

export function CalendarPage() {
  const { profile } = useAuth()
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const [formOpen, setFormOpen] = useState(false)

  const grid = useMemo(() => buildGrid(cursor), [cursor])
  const rangeFrom = grid[0].toISOString()
  const rangeTo = useMemo(() => {
    const end = new Date(grid[41])
    end.setHours(23, 59, 59, 999)
    return end.toISOString()
  }, [grid])

  const { data, loading, error, reload } = useAsyncData<CircleEvent[]>(
    () => fetchEvents(rangeFrom, rangeTo),
    [cursor.getFullYear(), cursor.getMonth()],
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CircleEvent[]>()
    for (const event of data ?? []) {
      const key = dayKey(new Date(event.starts_at))
      map.set(key, [...(map.get(key) ?? []), event])
    }
    return map
  }, [data])

  const selectedEvents = eventsByDay.get(dayKey(selected)) ?? []
  const todayKey = dayKey(new Date())
  const upcoming = useMemo(
    () =>
      (data ?? [])
        .filter((event) => new Date(event.starts_at).getTime() >= Date.now() - 12 * 60 * 60 * 1000)
        .slice(0, 5),
    [data],
  )

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Plans with the circle"
        subtitle="Someone opens an event, everyone else can say they are in."
        action={
          <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            New event
          </button>
        }
      />

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      <div className="grid gap-3.5 lg:grid-cols-[1fr_290px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-[15px] font-semibold">{monthLabel(cursor)}</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-[#f2f2f6] hover:text-ink"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-[11.5px] font-medium text-muted transition hover:bg-[#f2f2f6] hover:text-ink"
                onClick={() => {
                  setCursor(new Date())
                  setSelected(new Date())
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-[#f2f2f6] hover:text-ink"
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-t border-hair/70 bg-[#fbfbfd] px-1 py-1.5">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-faint"
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px border-t border-hair/70 bg-hair/60 p-px">
            {grid.map((day) => {
              const key = dayKey(day)
              const inMonth = day.getMonth() === cursor.getMonth()
              const isSelected = key === dayKey(selected)
              const dayEvents = eventsByDay.get(key) ?? []
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(day)}
                  className={cn(
                    'relative flex min-h-[62px] flex-col items-start gap-1 bg-white p-1.5 text-left transition sm:min-h-[76px]',
                    !inMonth && 'bg-[#fafafc] text-faint',
                    isSelected && 'ring-1 ring-inset ring-accent/40',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-[11.5px] font-medium tabular-nums',
                      key === todayKey && 'bg-accent text-white',
                      isSelected && key !== todayKey && 'bg-[#eef2f8] text-ink',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="w-full space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className="block truncate rounded-[5px] bg-accent-soft px-1 py-0.5 text-[9.5px] font-medium leading-tight text-accent-deep"
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 ? (
                      <span className="block px-1 text-[9px] text-faint">+{dayEvents.length - 2} more</span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
              {selected.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>

            {loading && !data ? (
              <div className="mt-3 space-y-2">
                <span className="skeleton block h-14 rounded-xl" />
                <span className="skeleton block h-14 rounded-xl" />
              </div>
            ) : selectedEvents.length === 0 ? (
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                Nothing planned. A good day to invent something.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {selectedEvents.map((event) => (
                  <li key={event.id}>
                    <Link
                      to={`/events/${event.id}`}
                      className="block rounded-xl border border-hair bg-[#fbfbfd] px-3 py-2.5 transition hover:border-[#d7dee9] hover:bg-white"
                    >
                      <p className="truncate text-[13px] font-semibold">{event.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                        {event.all_day ? (
                          <CalendarDays className="size-3" />
                        ) : (
                          <Clock className="size-3" />
                        )}
                        {event.all_day ? 'All day' : clockTime(event.starts_at)}
                        {event.location ? (
                          <>
                            <span className="text-[#d5d5dc]">·</span>
                            <MapPin className="size-3" />
                            <span className="truncate">{event.location}</span>
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10.5px] text-faint">
                        <Users className="size-3" />
                        {goingCount(event)} going
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Next up</p>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-muted">No upcoming events yet.</p>
            ) : (
              <ul className="mt-2.5 space-y-2.5">
                {upcoming.map((event) => (
                  <li key={event.id}>
                    <Link to={`/events/${event.id}`} className="group flex items-start gap-2.5">
                      <span className="mt-0.5 grid w-9 shrink-0 place-items-center rounded-lg bg-[#f4f5f9] px-1 py-1 text-center">
                        <span className="text-[9px] font-semibold uppercase text-faint">
                          {new Date(event.starts_at).toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="text-[13px] font-semibold leading-none">
                          {new Date(event.starts_at).getDate()}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium group-hover:text-accent">
                          {event.title}
                        </span>
                        <span className="block truncate text-[11px] text-faint">
                          {eventRange(event.starts_at, event.ends_at, event.all_day)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {!loading && !error && (data ?? []).length === 0 ? (
        <div className="mt-3.5">
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No plans this month"
            description={`${profile?.display_name.split(' ')[0] ?? 'Someone'}, why not open the first event?`}
            action={
              <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                Create an event
              </button>
            }
          />
        </div>
      ) : null}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New event"
        description="Everyone in the circle will see it on the calendar."
      >
        <EventForm
          onCreated={() => {
            setFormOpen(false)
            reload()
          }}
        />
      </Modal>

    </>
  )
}
