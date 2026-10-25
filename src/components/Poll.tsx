import { useEffect, useMemo, useState } from 'react'
import { Check, Vote } from 'lucide-react'
import { votePoll } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'
import type { PollOption } from '../lib/types'
import { useToast } from './Toast'

/**
 * A small circle poll. One vote per member, tap again to take it back, and the
 * bars stay quiet until someone has actually voted.
 */
export function PollCard({
  postId,
  options,
  onChange,
}: {
  postId: string
  options: PollOption[]
  onChange?: () => void
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [local, setLocal] = useState<PollOption[]>(options)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocal(options)
  }, [options])

  const total = useMemo(
    () => local.reduce((sum, option) => sum + (option.votes ?? []).length, 0),
    [local],
  )
  const mine = useMemo(
    () =>
      local.find((option) => (option.votes ?? []).some((vote) => vote.user_id === profile?.id))?.id ??
      null,
    [local, profile?.id],
  )

  async function choose(optionId: string) {
    if (saving || !profile) return
    setSaving(true)
    const previous = local
    setLocal((current) =>
      current.map((option) => {
        const votes = (option.votes ?? []).filter((vote) => vote.user_id !== profile.id)
        if (option.id === optionId && mine !== optionId) {
          votes.push({ option_id: option.id, user_id: profile.id })
        }
        return { ...option, votes }
      }),
    )
    try {
      await votePoll(postId, optionId, mine)
      onChange?.()
    } catch (error) {
      setLocal(previous)
      toast(error instanceof Error ? error.message : 'Could not save your vote.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (local.length === 0) return null

  return (
    <div className="mt-3 rounded-2xl border border-hair bg-[#fbfbfd] p-2.5">
      <div className="space-y-1.5">
        {local
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((option) => {
            const votes = (option.votes ?? []).length
            const share = total === 0 ? 0 : Math.round((votes / total) * 100)
            const chosen = mine === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void choose(option.id)}
                disabled={saving}
                aria-pressed={chosen}
                className={cn(
                  'relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition',
                  chosen
                    ? 'border-accent/40 bg-white'
                    : 'border-hair bg-white hover:border-[#cfd8e6]',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-0 left-0 transition-all duration-300',
                    chosen ? 'bg-accent-soft' : 'bg-[#f2f4f9]',
                  )}
                  style={{ width: `${share}%` }}
                />
                <span className="relative flex items-center gap-2">
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded-full border',
                      chosen ? 'border-accent bg-accent text-white' : 'border-[#d4d8e0] bg-white',
                    )}
                  >
                    {chosen ? <Check className="size-2.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                    {option.label}
                  </span>
                  <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-muted">
                    {votes === 0 ? '—' : `${share}%`}
                  </span>
                </span>
              </button>
            )
          })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-faint">
        <Vote className="size-3" />
        {total === 0
          ? 'No votes yet — be the first.'
          : `${total} ${total === 1 ? 'vote' : 'votes'}${mine ? ' · tap again to undo' : ''}`}
      </p>
    </div>
  )
}
