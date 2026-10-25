import { PenLine, Quote } from 'lucide-react'
import { fetchWeeklyPrompt } from '../lib/api'
import { useAsyncData } from '../lib/hooks'
import type { WeeklyPrompt } from '../lib/types'

/** One gentle question a week, so a quiet circle always has somewhere to start. */
export function RitualCard({ onAnswer }: { onAnswer: (prompt: string) => void }) {
  const { data } = useAsyncData<WeeklyPrompt | null>(() => fetchWeeklyPrompt(), [])
  if (!data) return null

  return (
    <section
      aria-label="This week's prompt"
      className="mb-4 overflow-hidden rounded-2xl border border-[#e3e7f3] bg-[linear-gradient(120deg,#f7faff_0%,#ffffff_55%,#f7f3ff_100%)] px-4 py-3.5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white text-accent shadow-[0_2px_10px_-6px_rgba(20,20,43,0.4)]">
          <Quote className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
            This week&apos;s prompt
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[#33333a]">{data.body}</p>
          <button
            type="button"
            onClick={() => onAnswer(data.body)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-[#2c2c2f]"
          >
            <PenLine className="size-3" />
            Answer with a post
          </button>
        </div>
      </div>
    </section>
  )
}
