import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { fetchMemberNames } from './api'
import { initials } from './format'

type MemberName = { id: string; display_name: string }

let cached: MemberName[] | null = null
let pending: Promise<MemberName[]> | null = null

// Only one list may be open at a time: the composer has a title field and a
// body field, and two lists stacked on top of each other read as a glitch.
const openMenus = new Map<symbol, () => void>()

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

interface Anchor {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

/**
 * A textarea that offers names the moment someone types "@".
 *
 * The list is rendered into <body> as a fixed layer: the composer and the
 * memory form sit inside rounded cards with `overflow: hidden`, which used to
 * clip the suggestions — on a phone the list was invisible, so "@" looked
 * broken.
 *
 * Placement follows the *visual* viewport, not the window: when a phone
 * keyboard opens Chrome keeps the layout viewport at full height and covers
 * the bottom of the screen, so a list placed "below the field" landed behind
 * the keyboard and never showed up. Measuring the visual viewport makes the
 * list flip above the field and shrink to the space that is actually visible.
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
  as = 'textarea',
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
  autoFocus?: boolean
  id?: string
  as?: 'textarea' | 'input'
}) {
  const names = useMemberNames()
  const [query, setQuery] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const closeTimer = useRef<number | null>(null)
  const owner = useRef(Symbol('mention'))

  const suggestions = useMemo(() => {
    if (query === null) return []
    const clean = query.trim().toLowerCase()
    if (!clean) return names.slice(0, 5)
    return names.filter((member) => member.display_name.toLowerCase().includes(clean)).slice(0, 5)
  }, [names, query])

  const open = query !== null && suggestions.length > 0

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const mine = owner.current
    for (const [key, close] of openMenus) {
      if (key !== mine) close()
    }
    openMenus.set(mine, () => setQuery(null))
    return () => {
      openMenus.delete(mine)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const viewport = window.visualViewport

    function place() {
      const rect = areaRef.current?.getBoundingClientRect()
      if (!rect) return
      const visibleTop = viewport?.offsetTop ?? 0
      const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight)
      const roomBelow = visibleBottom - rect.bottom
      const roomAbove = rect.top - visibleTop
      const above = roomBelow < 220 && roomAbove > roomBelow
      const width = Math.min(rect.width, window.innerWidth - 16)
      setAnchor({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        // The layer is fixed to the layout viewport, so anchoring from the
        // window's bottom edge puts it above the field even when the keyboard
        // is only shrinking the visual viewport.
        ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
        maxHeight: Math.max(120, Math.min(280, (above ? roomAbove : roomBelow) - 16)),
      })
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    viewport?.addEventListener('resize', place)
    viewport?.addEventListener('scroll', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      viewport?.removeEventListener('resize', place)
      viewport?.removeEventListener('scroll', place)
    }
  }, [open])

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
    onChange(`${value.slice(0, at)}@${name} `)
    setQuery(null)
  }

  // A tap on a suggestion blurs the field first on touch screens; closing a
  // moment later lets the tap land before the list disappears.
  function closeSoon() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setQuery(null), 150)
  }

  const menu =
    open && anchor
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              zIndex: 80,
              left: anchor.left,
              width: anchor.width,
              top: anchor.top,
              bottom: anchor.bottom,
              maxHeight: anchor.maxHeight,
            }}
            className="overflow-y-auto overscroll-contain rounded-xl border border-hair bg-white p-1 shadow-lift"
          >
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
          </div>,
          document.body,
        )
      : null

  const shared = {
    id,
    autoFocus,
    value,
    onChange: (event: { target: { value: string } }) => handleChange(event.target.value),
    onBlur: closeSoon,
    onFocus: () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    },
    placeholder,
    maxLength,
    className,
  }

  return (
    <div className="relative">
      {as === 'input' ? (
        <input ref={areaRef as unknown as RefObject<HTMLInputElement>} {...shared} />
      ) : (
        <textarea ref={areaRef} rows={rows} {...shared} />
      )}
      {menu}
    </div>
  )
}
