import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchMemberNames } from './api'
import { initials } from './format'

type MemberName = { id: string; display_name: string }

let cached: MemberName[] | null = null
let pending: Promise<MemberName[]> | null = null

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Approved member names, fetched once per session and shared by every field. */
export function useMemberNames(): MemberName[] {
  const [names, setNames] = useState<MemberName[]>(cached ?? [])

  useEffect(() => {
    if (cached) return
    let alive = true
    if (!pending) pending = fetchMemberNames()
    void pending.then((rows) => {
      cached = rows
      if (alive) setNames(rows)
    })
    return () => {
      alive = false
    }
  }, [])

  return names
}

/** Text with every "@Display Name" wrapped in a soft highlight. */
export function MentionText({ text }: { text: string }) {
  const names = useMemberNames()

  const pattern = useMemo(() => {
    if (names.length === 0) return null
    const parts = names
      .map((member) => member.display_name.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeForRegex)
    if (parts.length === 0) return null
    return new RegExp(`@(?:${parts.join('|')})`, 'gi')
  }, [names])

  if (!pattern) return <>{text}</>

  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) nodes.push(text.slice(cursor, start))
    nodes.push(
      <span
        key={`${start}-${match[0]}`}
        className="rounded-[5px] bg-accent-soft px-0.5 font-medium text-accent-deep"
      >
        {match[0]}
      </span>,
    )
    cursor = start + match[0].length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))

  return <>{nodes}</>
}

/**
 * A textarea that offers names the moment someone types "@". The suggestion
 * list lives below the field so it never covers the words being typed.
 */
export function MentionInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  className,
  autoFocus,
  id,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
  autoFocus?: boolean
  id?: string
}) {
  const names = useMemberNames()
  const [query, setQuery] = useState<string | null>(null)

  const suggestions = useMemo(() => {
    if (query === null) return []
    const clean = query.trim().toLowerCase()
    if (!clean) return names.slice(0, 5)
    return names.filter((member) => member.display_name.toLowerCase().includes(clean)).slice(0, 5)
  }, [names, query])

  function handleChange(next: string) {
    onChange(next)
    const at = next.lastIndexOf('@')
    if (at < 0) {
      setQuery(null)
      return
    }
    const fragment = next.slice(at + 1)
    setQuery(/[\n]/.test(fragment) ? null : fragment)
  }

  function insert(name: string) {
    const at = value.lastIndexOf('@')
    if (at < 0) return
    const next = `${value.slice(0, at)}@${name} `
    onChange(next)
    setQuery(null)
  }

  const open = query !== null && suggestions.length > 0

  return (
    <div className="relative">
      <textarea
        id={id}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => setQuery(null)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={className}
      />
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-hair bg-white p-1 shadow-lift">
          <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
            Mention
          </p>
          {suggestions.map((member) => (
            <button
              key={member.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insert(member.display_name)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f5f6fa]"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[9px] font-bold text-accent-deep">
                {initials(member.display_name)}
              </span>
              <span className="truncate text-[12.5px] font-medium">{member.display_name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
