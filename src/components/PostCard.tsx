import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, MoreHorizontal, Pin, Trash2 } from 'lucide-react'
import { commentCount, deletePost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { accent } from '../lib/categories'
import { cn } from '../lib/cn'
import { relativeTime } from '../lib/format'
import { MentionText } from '../lib/mentions'
import type { MediaItem, Post } from '../lib/types'
import { Avatar } from './Avatar'
import { Lightbox } from './Lightbox'
import { MediaGrid } from './MediaGrid'
import { Modal } from './Modal'
import { PollCard } from './Poll'
import { ReactionBar } from './ReactionBar'
import { useToast } from './Toast'

export function PostCard({
  post,
  onDeleted,
  featured,
}: {
  post: Post
  onDeleted?: (id: string) => void
  /** Lifted out of the feed, e.g. the pinned post on a label page. */
  featured?: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  const author = post.author
  const count = commentCount(post)
  const canDelete = profile?.id === post.author_id || profile?.role === 'admin'
  const visuals = (post.media ?? []).filter((item) => item.kind !== 'audio')

  async function remove() {
    setRemoving(true)
    try {
      await deletePost(post.id)
      setMenuOpen(false)
      onDeleted?.(post.id)
      toast('Post deleted.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete the post.', 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <article
      className={cn(
        'card group/card p-5 transition-shadow duration-300 hover:shadow-[0_2px_4px_rgba(20,20,43,0.05),0_18px_40px_-22px_rgba(20,20,43,0.24)]',
        featured &&
          'border-[#f2e2ba] bg-[linear-gradient(180deg,#fffdf6_0%,#ffffff_58%)] shadow-[0_14px_36px_-26px_rgba(154,106,18,0.55)]',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={author?.display_name ?? 'Member'} path={author?.avatar_url} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold leading-tight">
            {author?.display_name ?? 'Member'}
          </p>
          <p className="mt-0.5 text-[11.5px] text-faint">{relativeTime(post.created_at)}</p>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-8 place-items-center rounded-full text-faint opacity-0 transition hover:bg-[#f2f2f6] hover:text-ink group-hover/card:opacity-100 focus-visible:opacity-100"
            aria-label="Post options"
          >
            <MoreHorizontal className="size-4" />
          </button>
        ) : null}
      </div>

      {post.pinned_at || post.category ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {post.hidden_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f3f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
              Hidden
            </span>
          ) : null}
          {post.pinned_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff6e6] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#9a6a12]">
              <Pin className="size-2.5 fill-current" />
              Pinned
            </span>
          ) : null}
          {post.category ? (
            <Link
              to={`/?category=${encodeURIComponent(post.category.slug)}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] transition hover:opacity-80',
                accent(post.category.accent).chip,
              )}
            >
              <span className={cn('size-1.5 rounded-full', accent(post.category.accent).dot)} />
              {post.category.name}
            </Link>
          ) : null}
        </div>
      ) : null}

      <Link
        to={`/post/${post.id}`}
        className={cn('block', post.pinned_at || post.category ? 'mt-2' : 'mt-3')}
      >
        {post.title ? (
          <h2 className="text-[17.5px] font-semibold leading-snug tracking-[-0.022em]">{post.title}</h2>
        ) : null}
        {post.body ? (
          <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[14px] leading-relaxed text-[#3c3c41]">
            <MentionText text={post.body} />
          </p>
        ) : null}
      </Link>

      {post.poll && post.poll.length >= 2 ? <PollCard postId={post.id} options={post.poll} /> : null}

      {(post.media ?? []).length > 0 ? (
        <div className="mt-3">
          <MediaGrid
            items={post.media ?? []}
            compact
            onOpen={(_items: MediaItem[], index: number) => setLightboxIndex(index)}
          />
        </div>
      ) : null}

      <ReactionBar postId={post.id} reactions={post.reactions} />

      <div className="mt-3.5 flex items-center gap-1 border-t border-hair/70 pt-2.5">
        <button
          type="button"
          onClick={() => navigate(`/post/${post.id}`)}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-[#f4f4f8] hover:text-ink"
        >
          <MessageCircle className="size-[15px]" />
          {count === 0 ? 'Join the conversation' : `${count} ${count === 1 ? 'reply' : 'replies'}`}
        </button>
        <Link
          to={`/post/${post.id}`}
          className="ml-auto rounded-full px-2 py-1.5 text-[12.5px] font-medium text-accent transition hover:bg-accent-soft"
        >
          Open
        </Link>
      </div>

      {lightboxIndex !== null && visuals.length > 0 ? (
        <Lightbox
          items={visuals}
          index={Math.min(lightboxIndex, visuals.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Delete this post?"
        description="The post and everything attached to it will be removed for everyone."
        width="sm:max-w-[420px]"
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setMenuOpen(false)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn !bg-[#c8332b] text-white hover:!bg-[#a92a23]"
              onClick={() => void remove()}
              disabled={removing}
            >
              <Trash2 className="size-3.5" />
              {removing ? 'Deleting…' : 'Delete post'}
            </button>
          </>
        }
      >
        <p className="rounded-xl bg-[#f7f7fa] px-3.5 py-3 text-[13px] text-muted">
          {post.title || post.body || 'A post with an attachment'}
        </p>
      </Modal>
    </article>
  )
}
