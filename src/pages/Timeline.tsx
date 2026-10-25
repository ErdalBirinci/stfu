import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessagesSquare, Pin, Tag, X } from 'lucide-react'
import { Composer } from '../components/Composer'
import { PostCard } from '../components/PostCard'
import { EmptyState, ErrorNote, LoadingRows, PageHeader } from '../components/Ui'
import { fetchFeed } from '../lib/api'
import { useAuth } from '../lib/auth'
import { accent, categoryCount, useCategories } from '../lib/categories'
import { cn } from '../lib/cn'
import { greeting } from '../lib/format'
import { useAsyncData } from '../lib/hooks'

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

  const posts = data ?? []
  // On a label page the pinned post gets its own card, so the feed begins below it.
  const pinnedPost = activeSlug ? (posts.find((post) => post.pinned_at) ?? null) : null
  const feed = pinnedPost ? posts.filter((post) => post.id !== pinnedPost.id) : posts

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
        <Composer onPosted={() => reload()} />
      )}

      {error ? <ErrorNote message={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <LoadingRows />
      ) : pinnedPost || feed.length > 0 ? (
        <div className="space-y-5">
          {pinnedPost ? (
            <section aria-label="Pinned post">
              <div className="mb-2 flex items-center gap-1.5 px-1">
                <Pin className="size-3.5 fill-current text-[#b07c12]" />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#9a6a12]">
                  Pinned{active ? ` in ${active.name}` : ''}
                </p>
              </div>
              <PostCard post={pinnedPost} featured onDeleted={handleDeleted} />
            </section>
          ) : null}

          {feed.length > 0 ? (
            <section className="space-y-3">
              {pinnedPost ? (
                <p className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
                  Everything else
                </p>
              ) : null}
              <div className="stagger space-y-3">
                {feed.map((post) => (
                  <PostCard key={post.id} post={post} onDeleted={handleDeleted} />
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
    </>
  )
}

function activeCount(categories: ReturnType<typeof useCategories>['items'], id: string): string {
  const category = categories.find((item) => item.id === id)
  const count = category ? categoryCount(category) : 0
  return `${count} ${count === 1 ? 'post' : 'posts'} filed under this label.`
}
