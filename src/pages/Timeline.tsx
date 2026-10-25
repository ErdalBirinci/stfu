import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUp, MessagesSquare, Pin, Tag, X } from 'lucide-react'
import { Composer } from '../components/Composer'
import type { ComposerSeed } from '../components/Composer'
import { OnThisDay } from '../components/OnThisDay'
import { PostCard } from '../components/PostCard'
import { RitualCard } from '../components/RitualCard'
import { EmptyState, ErrorNote, LoadingRows, PageHeader } from '../components/Ui'
import { fetchFeed } from '../lib/api'
import { useAuth } from '../lib/auth'
import { accent, categoryCount, useCategories } from '../lib/categories'
import { cn } from '../lib/cn'
import { dayKey, greeting } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import type { Post } from '../lib/types'

const PINNED_LIMIT = 3

export function TimelinePage() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const activeSlug = params.get('category')
  const { items: categories } = useCategories()
  const active = categories.find((category) => category.slug === activeSlug) ?? null

  const { data, loading, error, reload, setData } = useAsyncData(
    () => fetchFeed(40, activeSlug ?? undefined),
    [activeSlug],
  )

  const handleDeleted = useCallback(
    (postId: string) => {
      if (!data) return
      setData(data.filter((post) => post.id !== postId))
    },
    [data, setData],
  )

  const [showAllPinned, setShowAllPinned] = useState(false)
  const [seed, setSeed] = useState<ComposerSeed | undefined>(undefined)
  const [fresh, setFresh] = useState(0)

  // New posts arrive without yanking the page: a small pill counts them instead.
  useEffect(() => {
    const channel = supabase
      .channel('timeline-fresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        setFresh((count) => count + 1)
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const posts = data ?? []
  // Pinned posts get their own strip above the feed, so the timeline reads like
  // a noticeboard: what the admin pinned first, then the normal run of posts.
  const pinnedPosts = posts.filter((post) => post.pinned_at)
  const feed = posts.filter((post) => !post.pinned_at)
  const shownPinned = showAllPinned ? pinnedPosts : pinnedPosts.slice(0, PINNED_LIMIT)
  const hiddenPinned = pinnedPosts.length - shownPinned.length

  return (
    <>
      <PageHeader
        eyebrow={active ? 'Label' : 'Timeline'}
        title={active ? active.name : greeting(profile?.display_name ?? 'friend')}
        subtitle={
          active
            ? activeCount(categories, active.id)
            : 'Everything the circle is talking about right now.'
        }
        action={
          activeSlug ? (
            <Link to="/" className="btn btn-quiet !px-3 !py-1.5 !text-[12.5px]">
              <X className="size-3.5" />
              Clear label
            </Link>
          ) : undefined
        }
      />

      {categories.length > 0 ? (
        <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <Link
            to="/"
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
              activeSlug
                ? 'border-hair bg-white text-muted hover:text-ink'
                : 'border-transparent bg-ink text-white',
            )}
          >
            All
          </Link>
          {categories.map((category) => {
            const palette = accent(category.accent)
            const on = category.slug === activeSlug
            return (
              <Link
                key={category.id}
                to={`/?category=${encodeURIComponent(category.slug)}`}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
                  on
                    ? cn('border-transparent ring-1', palette.chip, palette.ring)
                    : 'border-hair bg-white text-muted hover:text-ink',
                )}
              >
                <span className={cn('size-1.5 rounded-full', palette.dot)} />
                {category.name}
              </Link>
            )
          })}
        </div>
      ) : null}

      {activeSlug ? (
        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-hair/70 bg-white/70 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted">
          <Tag className="mt-0.5 size-3.5 shrink-0 text-faint" />
          Labels are filed by Dobby. Fresh posts wait here unfiled until they get one.
        </p>
      ) : (
        <>
          <Composer onPosted={() => reload()} seed={seed} />
          <OnThisDay />
          <RitualCard onAnswer={(prompt) => setSeed({ body: prompt, stamp: Date.now() })} />
        </>
      )}

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <LoadingRows />
      ) : pinnedPosts.length > 0 || feed.length > 0 ? (
        <div className="space-y-5">
          {pinnedPosts.length > 0 ? (
            <section aria-label="Pinned posts" className="space-y-3">
              <div className="flex items-center gap-1.5 px-1">
                <Pin className="size-3.5 fill-current text-[#b07c12]" />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#9a6a12]">
                  Pinned{active ? ` in ${active.name}` : ''}
                </p>
              </div>
              {shownPinned.map((post) => (
                <PostCard key={post.id} post={post} featured onDeleted={handleDeleted} />
              ))}
              {hiddenPinned > 0 || (showAllPinned && pinnedPosts.length > PINNED_LIMIT) ? (
                <button
                  type="button"
                  onClick={() => setShowAllPinned((open) => !open)}
                  aria-expanded={showAllPinned}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#f0e0bd] bg-white/80 px-3 py-1.5 text-[11.5px] font-semibold text-[#9a6a12] transition hover:bg-[#fffaf0]"
                >
                  {hiddenPinned > 0 ? `+${hiddenPinned} more` : 'Show less'}
                </button>
              ) : null}
            </section>
          ) : null}

          {feed.length > 0 ? (
            <section className="space-y-3">
              {pinnedPosts.length > 0 ? (
                <p className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
                  Everything else
                </p>
              ) : null}
              <div className="stagger space-y-3">
                {groupByDay(feed).map((group) => (
                  <div key={group.key} className="space-y-3">
                    <p className="px-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
                      {group.label}
                    </p>
                    {group.posts.map((post) => (
                      <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : !error ? (
        <EmptyState
          icon={activeSlug ? <Tag className="size-5" /> : <MessagesSquare className="size-5" />}
          title={activeSlug ? 'Nothing filed under this label yet' : 'The timeline is quiet'}
          description={
            activeSlug
              ? 'Once a post is labelled it shows up here. Try another label, or head back to everything.'
              : 'Start the first thread: a question, a plan, a photo from last weekend — whatever you want the circle to see.'
          }
          action={
            activeSlug ? (
              <Link to="/" className="btn btn-quiet">
                Back to everything
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {fresh > 0 ? (
        <button
          type="button"
          onClick={() => {
            setFresh(0)
            reload()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="fixed bottom-[86px] left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_16px_36px_-18px_rgba(20,20,43,0.9)] transition hover:bg-[#2c2c2f] lg:bottom-8"
        >
          <ArrowUp className="size-3.5" />
          {fresh === 1 ? '1 new post' : `${fresh} new posts`}
        </button>
      ) : null}
    </>
  )
}

function groupByDay(posts: Post[]): Array<{ key: string; label: string; posts: Post[] }> {
  const groups: Array<{ key: string; label: string; posts: Post[] }> = []
  for (const post of posts) {
    const created = new Date(post.created_at)
    const key = dayKey(created)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.posts.push(post)
    } else {
      groups.push({ key, label: dayLabel(created), posts: [post] })
    }
  }
  return groups
}

function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dayKey(date) === dayKey(today)) return 'Today'
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function activeCount(categories: ReturnType<typeof useCategories>['items'], id: string): string {
  const category = categories.find((item) => item.id === id)
  const count = category ? categoryCount(category) : 0
  return `${count} ${count === 1 ? 'post' : 'posts'} filed under this label.`
}
