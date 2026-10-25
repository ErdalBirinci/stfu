import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Images, MessageCircle, MessagesSquare, Search as SearchIcon } from 'lucide-react'
import { searchCircle } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { SearchHit } from '../lib/types'
import { PageHeader, Spinner } from '../components/Ui'

const meta: Record<SearchHit['kind'], { label: string; icon: typeof SearchIcon }> = {
  post: { label: 'Post', icon: MessagesSquare },
  comment: { label: 'Reply', icon: MessageCircle },
  memory: { label: 'Memory', icon: Images },
  event: { label: 'Event', icon: CalendarDays },
}

function hrefFor(hit: SearchHit): string {
  switch (hit.kind) {
    case 'memory':
      return `/memories/${hit.id}`
    case 'event':
      return `/events/${hit.id}`
    default:
      return `/post/${hit.post_id ?? hit.id}`
  }
}

export function SearchPage() {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const clean = term.trim()
    if (clean.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const hits = await searchCircle(clean)
        if (!active) return
        setResults(hits)
        setError(null)
      } catch (searchError) {
        if (!active) return
        setResults([])
        setError(searchError instanceof Error ? searchError.message : 'Search failed.')
      } finally {
        if (active) setLoading(false)
      }
    }, 280)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [term])

  const tooShort = term.trim().length < 2

  return (
    <>
      <PageHeader
        eyebrow="Search"
        title="Find anything"
        subtitle="Posts, replies, memories and events — everything the circle ever shared."
      />

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Try a name, a place, a word…"
          aria-label="Search the circle"
          autoFocus
          className="field !py-3 !pl-10 !text-[14px]"
        />
        {loading ? <Spinner className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" /> : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-[#fff5f4] px-3.5 py-2.5 text-[12.5px] text-[#9b2c22]">{error}</p>
      ) : null}

      <div className="mt-4">
        {tooShort ? (
          <p className="card px-5 py-8 text-center text-[13px] text-muted">
            Type at least two letters to start looking.
          </p>
        ) : !loading && results.length === 0 && !error ? (
          <p className="card px-5 py-8 text-center text-[13px] text-muted">
            Nothing matched “{term.trim()}”. Try a shorter word.
          </p>
        ) : (
          <div className="stagger space-y-2">
            {results.map((hit) => {
              const Info = meta[hit.kind]
              return (
                <Link
                  key={`${hit.kind}-${hit.id}`}
                  to={hrefFor(hit)}
                  className="card flex items-start gap-3 px-4 py-3.5 transition hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-[#f3f5fa] text-muted">
                    <Info.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[13.5px] font-semibold">{hit.title || 'Untitled'}</span>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
                        {Info.label}
                      </span>
                    </span>
                    {hit.snippet ? (
                      <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-relaxed text-muted">
                        {hit.snippet}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[10.5px] text-faint">
                      {hit.author_name} · {relativeTime(hit.created_at)}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
