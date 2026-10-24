import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CornerDownRight, MessageCircle, Send, Trash2 } from 'lucide-react'
import { addComment, deletePost, fetchPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { relativeTime } from '../lib/format'
import type { Comment, MediaItem, PickedFile } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { Lightbox } from '../components/Lightbox'
import { MediaGrid } from '../components/MediaGrid'
import { MediaPicker, releasePickedFiles } from '../components/MediaPicker'
import { ErrorNote, LoadingRows, Spinner } from '../components/Ui'
import { useToast } from '../components/Toast'
import { useAsyncData } from '../lib/hooks'

function CommentBubble({
  comment,
  replies,
  onReplied,
}: {
  comment: Comment
  replies: Comment[]
  onReplied: () => void
}) {
  const [replying, setReplying] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const visuals = (comment.media ?? []).filter((item) => item.kind !== 'audio')

  return (
    <div className="flex gap-3">
      <Avatar name={comment.author?.display_name ?? 'Member'} path={comment.author?.avatar_url} size={32} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-hair bg-[#fbfbfd] px-3.5 py-2.5">
          <div className="flex items-baseline gap-2">
            <p className="text-[12.5px] font-semibold">{comment.author?.display_name ?? 'Member'}</p>
            <p className="text-[11px] text-faint">{relativeTime(comment.created_at)}</p>
          </div>
          {comment.body ? (
            <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-[#3c3c41]">{comment.body}</p>
          ) : null}
          {(comment.media ?? []).length > 0 ? (
            <div className="mt-2">
              <MediaGrid
                items={comment.media ?? []}
                compact
                onOpen={(_items: MediaItem[], index: number) => setLightboxIndex(index)}
              />
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setReplying((value) => !value)}
          className="mt-1 rounded-full px-1.5 py-1 text-[11.5px] font-medium text-faint transition hover:text-ink"
        >
          Reply
        </button>

        {replying ? (
          <ReplyForm
            postId={comment.post_id}
            parentId={comment.id}
            onDone={() => {
              setReplying(false)
              onReplied()
            }}
            onCancel={() => setReplying(false)}
          />
        ) : null}

        {replies.length > 0 ? (
          <div className="mt-2.5 space-y-2.5 border-l border-hair pl-3">
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-2.5">
                <Avatar
                  name={reply.author?.display_name ?? 'Member'}
                  path={reply.author?.avatar_url}
                  size={26}
                />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-[#f7f7fa] px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[12px] font-semibold">{reply.author?.display_name ?? 'Member'}</p>
                    <p className="text-[10.5px] text-faint">{relativeTime(reply.created_at)}</p>
                  </div>
                  {reply.body ? (
                    <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-[#3c3c41]">
                      {reply.body}
                    </p>
                  ) : null}
                  {(reply.media ?? []).length > 0 ? (
                    <div className="mt-2">
                      <MediaGrid items={reply.media ?? []} compact />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {lightboxIndex !== null && visuals.length > 0 ? (
        <Lightbox
          items={visuals}
          index={Math.min(lightboxIndex, visuals.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  )
}

function ReplyForm({
  postId,
  parentId,
  onDone,
  onCancel,
}: {
  postId: string
  parentId: string | null
  onDone: () => void
  onCancel?: () => void
}) {
  const toast = useToast()
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<PickedFile[]>([])
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!body.trim() && files.length === 0) {
      toast('Write something first.', 'error')
      return
    }
    setSaving(true)
    try {
      await addComment({ postId, body, parentId, files: files.map((item) => item.file) })
      setBody('')
      releasePickedFiles(files)
      setFiles([])
      onDone()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not send your reply.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 rounded-2xl border border-hair bg-white p-2.5">
      <textarea
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Write a reply…"
        rows={2}
        className="w-full resize-none border-0 bg-transparent p-1 text-[13px] leading-relaxed outline-none placeholder:text-[#a9a9b0]"
      />
      <div className="border-t border-hair/70 pt-1.5">
        <MediaPicker files={files} onChange={setFiles} label="" compact />
      </div>
      <div className="mt-1.5 flex justify-end gap-2">
        {onCancel ? (
          <button type="button" className="btn btn-ghost !px-3 !py-1.5 !text-[12px]" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary !px-3.5 !py-1.5 !text-[12px]"
          onClick={() => void submit()}
          disabled={saving}
        >
          {saving ? <Spinner /> : <Send className="size-3.5" />}
          {saving ? 'Sending…' : 'Reply'}
        </button>
      </div>
    </div>
  )
}

export function PostDetailPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const { data, loading, error, reload } = useAsyncData(() => fetchPost(id), [id])

  async function removePost() {
    try {
      await deletePost(id)
      toast('Post deleted.', 'success')
      navigate('/')
    } catch (deleteError) {
      toast(deleteError instanceof Error ? deleteError.message : 'Could not delete the post.', 'error')
    }
  }

  if (loading && !data) return <LoadingRows count={2} height={180} />
  if (error) return <ErrorNote message={error} onRetry={reload} />
  if (!data) return null

  const { post, comments } = data
  const roots = comments.filter((comment) => !comment.parent_id)
  const repliesFor = (parentId: string) => comments.filter((comment) => comment.parent_id === parentId)
  const visuals = (post.media ?? []).filter((item) => item.kind !== 'audio')
  const canDelete = profile?.id === post.author_id || profile?.role === 'admin'

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-white hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          Timeline
        </Link>
        {canDelete ? (
          <button
            type="button"
            onClick={() => void removePost()}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] font-medium text-faint transition hover:bg-white hover:text-danger"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        ) : null}
      </div>

      <article className="card overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3">
            <Avatar name={post.author?.display_name ?? 'Member'} path={post.author?.avatar_url} size={40} />
            <div>
              <p className="text-[13.5px] font-semibold leading-tight">{post.author?.display_name ?? 'Member'}</p>
              <p className="mt-0.5 text-[11.5px] text-faint">{relativeTime(post.created_at)}</p>
            </div>
          </div>

          {post.title ? (
            <h1 className="mt-4 text-[24px] font-semibold leading-tight tracking-[-0.03em]">
              {post.title}
            </h1>
          ) : null}
          {post.body ? (
            <p className="mt-2.5 whitespace-pre-line text-[14.5px] leading-[1.7] text-[#33333a]">{post.body}</p>
          ) : null}

          {(post.media ?? []).length > 0 ? (
            <div className="mt-4">
              <MediaGrid
                items={post.media ?? []}
                onOpen={(_items: MediaItem[], index: number) => setLightboxIndex(index)}
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 border-t border-hair/70 bg-[#fcfcfe] px-5 py-2.5">
          <MessageCircle className="size-4 text-faint" />
          <span className="text-[12.5px] text-muted">
            {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </article>

      <section className="mt-4 space-y-4">
        <h2 className="flex items-center gap-2 px-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">
          <CornerDownRight className="size-3.5" />
          Conversation
        </h2>

        {roots.length === 0 ? (
          <p className="card px-5 py-6 text-center text-[13px] text-muted">
            No replies yet — be the first to say something.
          </p>
        ) : (
          <div className="space-y-4">
            {roots.map((comment) => (
              <CommentBubble
                key={comment.id}
                comment={comment}
                replies={repliesFor(comment.id)}
                onReplied={reload}
              />
            ))}
          </div>
        )}

        <div className="card p-4">
          <p className="mb-2 text-[12px] font-semibold text-muted">Add to the conversation</p>
          <ReplyForm postId={post.id} parentId={null} onDone={reload} />
        </div>
      </section>

      {lightboxIndex !== null && visuals.length > 0 ? (
        <Lightbox
          items={visuals}
          index={Math.min(lightboxIndex, visuals.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  )
}
