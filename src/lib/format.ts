const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function eventRange(startsAt: string, endsAt: string | null, allDay: boolean): string {
  const start = new Date(startsAt)
  const dateText = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  if (allDay) return `${dateText} · All day`
  if (!endsAt) return `${dateText} · ${clockTime(startsAt)}`
  const end = new Date(endsAt)
  const sameDay = start.toDateString() === end.toDateString()
  return sameDay
    ? `${dateText} · ${clockTime(startsAt)} – ${clockTime(endsAt)}`
    : `${dateText} · ${clockTime(startsAt)} → ${shortDate(endsAt)} ${clockTime(endsAt)}`
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Accounts made with a bare username live on this internal domain. */
export const INTERNAL_EMAIL_DOMAIN = 'stfu.local'

export function normalizeEmail(value: string): string {
  const clean = value.trim().toLowerCase()
  return clean.includes('@') ? clean : `${clean}@${INTERNAL_EMAIL_DOMAIN}`
}

export function displayEmail(email?: string | null): string {
  if (!email) return ''
  const [local, domain] = email.split('@')
  return domain === INTERNAL_EMAIL_DOMAIN ? local : email
}

export function greeting(name: string): string {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name.split(' ')[0]}`
}
