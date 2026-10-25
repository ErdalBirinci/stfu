import { Link } from 'react-router-dom'
import { ArrowUpRight, Camera, Sparkles } from 'lucide-react'
import { fetchOnThisDay } from '../lib/api'
import { relativeTime } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import type { Memory } from '../lib/types'
import { blurStyle } from './MediaGrid'

function coverOf(memory: Memory) {
  return (memory.media ?? []).find((item) => item.kind === 'image')
}

function yearOf(memory: Memory): string {
  return new Date(`${memory.taken_on}T12:00:00`).getFullYear().toString()
}

/** The archive resurfacing: what the circle was doing on this day in past years. */
export function OnThisDay() {
  const { data } = useAsyncData<Memory[]>(() => fetchOnThisDay(), [])
  const memories = data ?? []
  if (memories.length === 0) return null

  return (
    <section aria-label="On this day" className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <Sparkles className="size-3.5 text-[#9a6a12]" />
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#9a6a12]">
          On this day
        </p>
        <span className="text-[10.5px] text-faint">· from the archive</span>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {memories.map((memory) => {
          const cover = coverOf(memory)
          return (
            <Link
              key={memory.id}
              to={`/memories/${memory.id}`}
              className="group w-[190px] shrink-0 overflow-hidden rounded-2xl border border-[#efe3c8] bg-[linear-gradient(180deg,#fffdf6_0%,#ffffff_62%)] shadow-[0_10px_26px_-22px_rgba(154,106,18,0.6)] transition hover:-translate-y-0.5"
            >
              <div className="relative aspect-[16/10] bg-[#f1efe8]">
                {cover?.url ? (
                  <img
                    src={cover.url}
                    alt={memory.title}
                    loading="lazy"
                    className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    style={blurStyle(cover)}
                  />
                ) : (
                  <span className="grid size-full place-items-center text-[#c0bda9]">
                    <Camera className="size-5" />
                  </span>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-[#1d1d1f]/70 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
                  {memory.taken_on ? yearOf(memory) : 'then'}
                </span>
              </div>
              <div className="px-3 py-2.5">
                <p className="truncate text-[12.5px] font-semibold">{memory.title}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-faint">
                  {memory.creator?.display_name ?? 'Someone'}
                  <span className="size-0.5 rounded-full bg-[#d3d3da]" />
                  {relativeTime(memory.created_at)}
                  <ArrowUpRight className="ml-auto size-3 opacity-0 transition group-hover:opacity-100" />
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
