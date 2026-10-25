import { useState } from 'react'
import { CalendarHeart, Flame, Sparkles, Trophy } from 'lucide-react'
import { fetchRecap } from '../lib/api'
import { useAsyncData } from '../lib/hooks'
import type { CircleRecap } from '../lib/types'
import { cn } from '../lib/cn'

const STAT_LABELS: Array<{ key: keyof CircleRecap; label: string }> = [
  { key: 'posts', label: 'Posts' },
  { key: 'memories', label: 'Memories' },
  { key: 'media', label: 'Files' },
  { key: 'comments', label: 'Replies' },
  { key: 'events', label: 'Plans' },
]

/** The circle's year, counted up: what we said, kept and celebrated. */
export function RecapCard() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const { data, loading, error } = useAsyncData<CircleRecap>(() => fetchRecap(year), [year])

  const years = (data?.years ?? []).filter((value) => Number.isFinite(value))
  const choices = [...new Set([thisYear, ...years])].sort((a, b) => b - a).slice(0, 4)

  return (
    <section className="card mt-3.5 overflow-hidden">
      <div className="border-b border-hair/70 bg-[linear-gradient(120deg,#fff8ec_0%,#ffffff_58%,#f2f7ff_100%)] px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[#b07c12]" />
          <h2 className="text-[15px] font-semibold">The year in the circle</h2>
        </div>
        <p className="mt-1 text-[12.5px] text-muted">
          Everything you all said, kept and planned — counted up.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {choices.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setYear(value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition',
                value === year
                  ? 'border-transparent bg-ink text-white'
                  : 'border-hair bg-white/80 text-muted hover:text-ink',
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {error ? (
          <p className="text-[12.5px] text-muted">The recap is not available right now.</p>
        ) : loading && !data ? (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4].map((index) => (
              <span key={index} className="skeleton block h-14 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {STAT_LABELS.map((stat) => (
                <div key={stat.key} className="rounded-xl border border-hair bg-[#fbfbfd] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-[17px] font-semibold tabular-nums">
                    {Number(data[stat.key] ?? 0)}
                  </p>
                </div>
              ))}
            </div>

            <ul className="mt-3 space-y-1.5">
              {data.top_post ? (
                <li className="flex items-start gap-2 rounded-xl bg-[#fffaf0] px-3 py-2">
                  <Trophy className="mt-0.5 size-3.5 shrink-0 text-[#b07c12]" />
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                    <span className="text-muted">Most loved post </span>
                    <span className="font-semibold">“{data.top_post.title}”</span>
                    <span className="text-muted"> · {data.top_post.reactions} reactions</span>
                  </span>
                </li>
              ) : null}
              {data.busiest_month ? (
                <li className="flex items-start gap-2 rounded-xl bg-[#f7faf7] px-3 py-2">
                  <Flame className="mt-0.5 size-3.5 shrink-0 text-positive" />
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                    <span className="text-muted">Busiest month </span>
                    <span className="font-semibold">{data.busiest_month.month}</span>
                    <span className="text-muted"> · {data.busiest_month.posts} posts</span>
                  </span>
                </li>
              ) : null}
              {data.most_active ? (
                <li className="flex items-start gap-2 rounded-xl bg-[#f7f7fb] px-3 py-2">
                  <CalendarHeart className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                    <span className="text-muted">Most present </span>
                    <span className="font-semibold">{data.most_active.name}</span>
                    <span className="text-muted"> · {data.most_active.actions} posts</span>
                  </span>
                </li>
              ) : null}
            </ul>

            {Number(data.posts) === 0 && Number(data.memories) === 0 ? (
              <p className="mt-3 text-[12.5px] text-muted">
                Nothing in {year} yet. The year is still young.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
