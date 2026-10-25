import { useState } from 'react'
import { setReaction } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { PostReaction, ReactionEmoji } from '../lib/types'
import { useToast } from './Toast'
import { cn } from '../lib/cn'

const OPTIONS: Array<{ emoji: ReactionEmoji; glyph: string; label: string }> = [
  { emoji: 'heart', glyph: '❤️', label: 'Love' },
  { emoji: 'shush', glyph: '🤫', label: 'Shush' },
  { emoji: 'laugh', glyph: '😂', label: 'Laugh' },
  { emoji: 'fire', glyph: '🔥', label: 'Fire' },
]

export function ReactionBar({
  postId,
  reactions = [],
}: {
  postId: string
  reactions?: PostReaction[]
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<PostReaction[]>(reactions)
  const [busy, setBusy] = useState(false)

  const mine = profile ? rows.find((row) => row.user_id === profile.id) : undefined

  async function toggle(emoji: ReactionEmoji) {
    if (!profile || busy) return
    const previous = rows
    const next = mine?.emoji === emoji ? null : emoji
    const without = rows.filter((row) => row.user_id !== profile.id)
    setRows(next ? [...without, { emoji: next, user_id: profile.id }] : without)
    setBusy(true)
    try {
      await setReaction(postId, next)
    } catch (error) {
      setRows(previous)
      toast(error instanceof Error ? error.message : 'Could not save your reaction.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((option) => {
        const count = rows.filter((row) => row.emoji === option.emoji).length
        const active = mine?.emoji === option.emoji
        return (
          <button
            key={option.emoji}
            type="button"
            onClick={() => void toggle(option.emoji)}
            aria-pressed={active}
            aria-label={`${option.label}${count > 0 ? ` (${count})` : ''}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[12px] leading-none transition',
              active
                ? 'border-[#c9defb] bg-accent-soft text-accent-deep'
                : count > 0
                  ? 'border-hair bg-[#f7f7fa] text-muted hover:border-[#d8d8e0] hover:text-ink'
                  : 'border-transparent bg-transparent text-muted opacity-70 hover:bg-[#f4f4f8] hover:opacity-100',
            )}
          >
            <span className="text-[13px]" aria-hidden>
              {option.glyph}
            </span>
            {count > 0 ? <span className="font-semibold tabular-nums">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
