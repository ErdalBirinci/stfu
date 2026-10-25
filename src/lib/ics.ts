import type { CircleEvent } from './types'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function stamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function dayStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
}

/** RFC 5545 text escaping. */
function text(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Long lines have to be folded at 75 octets, otherwise Apple Calendar chokes. */
function fold(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 74))
  rest = rest.slice(74)
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 73)}`)
    rest = rest.slice(73)
  }
  return parts.join('\r\n')
}

export function eventToIcs(event: CircleEvent, origin?: string): string {
  const start = new Date(event.starts_at)
  const end = event.ends_at
    ? new Date(event.ends_at)
    : new Date(start.getTime() + (event.all_day ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//STFU//Circle Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@stfu`,
    `DTSTAMP:${stamp(new Date())}`,
    event.all_day ? `DTSTART;VALUE=DATE:${dayStamp(start)}` : `DTSTART:${stamp(start)}`,
    event.all_day ? `DTEND;VALUE=DATE:${dayStamp(end)}` : `DTEND:${stamp(end)}`,
    fold(`SUMMARY:${text(event.title)}`),
    event.description ? fold(`DESCRIPTION:${text(event.description)}`) : '',
    event.location ? fold(`LOCATION:${text(event.location)}`) : '',
    origin ? fold(`URL:${origin}`) : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return `${lines.join('\r\n')}\r\n`
}

export function downloadEventIcs(event: CircleEvent): void {
  const blob = new Blob([eventToIcs(event, window.location.href)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safeName = event.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'event'
  anchor.href = url
  anchor.download = `${safeName}.ics`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
