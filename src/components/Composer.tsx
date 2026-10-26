import { useEffect, useState } from 'react'
import { ArrowUpRight, ListChecks, PenLine, Plus, Tag, X } from 'lucide-react'
import { createPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import { accent, useCategories } from '../lib/categories'
import { cn } from '../lib/cn'
import { MentionInput } from '../lib/mentions'
import type { PickedFile } from '../lib/types'
import { Avatar } from './Avatar'
import { MediaPicker, releasePickedFiles } from './MediaPicker'
import { Spinner } from './Ui'
import { useToast } from './Toast'

export interface ComposerSeed {
  title?: string
  body?: string
  stamp?: number
}

export function Composer({ onPosted, seed }: { onPosted: (postId: string) => void; seed?: ComposerSeed }) {
  const { profile } = useAuth()
  const { items: categories } = useCategories()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [files, setFiles] = useState<PickedFile[]>([])
  const [pollOpen, setPollOpen] = useState(false)
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (!seed) return
    setOpen(true)
    if (seed.title !== undefined) setTitle(seed.title)
    if (seed.body !== undefined) setBody(seed.body)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.stamp])

  function reset() {
    setTitle('')
    setBody('')
    setCategoryId(null)
    setPollOpen(false)
    setPollOptions(['', ''])
    releasePickedFiles(files)
    setFiles([])
    setOpen(false)
  }

  async function submit() {
    const options = pollOptions.map((option) => option.trim()).filter(Boolean)
    // Nothing is required beyond having something to say: a title, some text or
    // an attachment is enough on its own.
    if (!title.trim() && !body.trim() && files.length === 0 && options.length === 0) {
      toast('Add something first — a title, a few words or a file.', 'error')
      return
    }
    if (pollOpen && options.length < 2) {
      toast('A poll needs at least two options.', 'error')
      return
    }
    setSaving(true)
    try {
      const postId = await createPost({
        title,
        body,
        files: files.map((item) => item.file),
        pollOptions: pollOpen ? options : [],
        categoryId,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      reset()
      toast('Shared with the circle.', 'success')
      onPosted(postId)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not publish your post.', 'error')
    } finally {
      setProgress(null)
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card group mb-4 flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:shadow-lift"
      >
        <Avatar name={profile?.display_name ?? 'Me'} path={profile?.avatar_url} size={36} />
        <span className="flex-1 text-[14px] text-faint">Share something with the circle…</span>
        <span className="grid size-8 place-items-center rounded-full bg-[#f2f2f6] text-muted transition group-hover:bg-accent-soft group-hover:text-accent">
          <PenLine className="size-3.5" />
        </span>
      </button>
    )
  }

  return (
    <div className="card mb-4 overflow-hidden">
      <div className="flex items-start gap-3 p-4 pb-2">
        <Avatar name={profile?.display_name ?? 'Me'} path={profile?.avatar_url} size={36} />
        <div className="min-w-0 flex-1">
          <MentionInput
            as="input"
            autoFocus
            value={title}
            onChange={setTitle}
            placeholder="A title for your post (optional)"
            maxLength={140}
            className="w-full border-0 bg-transparent p-0 text-[16.5px] font-semibold tracking-[-0.02em] outline-none placeholder:font-semibold placeholder:text-[#b3b3ba]"
          />
          <MentionInput
            value={body}
            onChange={setBody}
            placeholder="Say more, add context, or drop a memory… Use @ to bring someone in."
            rows={3}
            maxLength={8000}
            className="mt-1.5 w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-relaxed text-[#33333a] outline-none placeholder:text-[#a9a9b0]"
          />
        </div>
      </div>

      {pollOpen ? (
        <div className="mx-4 mb-2 rounded-2xl border border-hair bg-[#fbfbfd] p-2.5">
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
              <ListChecks className="size-3.5" />
              Poll
            </span>
            <button
              type="button"
              onClick={() => {
                setPollOpen(false)
                setPollOptions(['', ''])
              }}
              className="rounded-full p-1 text-faint transition hover:bg-white hover:text-ink"
              aria-label="Remove the poll"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {pollOptions.map((option, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <input
                  value={option}
                  onChange={(event) =>
                    setPollOptions((current) =>
                      current.map((item, position) => (position === index ? event.target.value : item)),
                    )
                  }
                  placeholder={`Option ${index + 1}`}
                  maxLength={80}
                  className="field !rounded-xl !py-1.5 !text-[13px]"
                />
                {pollOptions.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition hover:bg-white hover:text-danger"
                    aria-label={`Remove option ${index + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {pollOptions.length < 4 ? (
            <button
              type="button"
              onClick={() => setPollOptions((current) => [...current, ''])}
              className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-accent transition hover:bg-accent-soft"
            >
              <Plus className="size-3" />
              Add option
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="px-4 pb-1.5">
        <MediaPicker files={files} onChange={setFiles} />
        {!pollOpen ? (
          <button
            type="button"
            onClick={() => setPollOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-hair bg-white px-2.5 py-1 text-[11.5px] font-medium text-muted transition hover:border-[#cfd8e6] hover:text-ink"
          >
            <ListChecks className="size-3.5" />
            Add a poll
          </button>
        ) : null}
      </div>

      {categories.length > 0 ? (
        <div className="px-4 pb-2.5">
          <div className="flex items-center gap-1.5">
            <Tag className="size-3.5 text-faint" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">
              Label
            </span>
            <span className="text-[10.5px] text-faint">optional</span>
          </div>
          <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              aria-pressed={categoryId === null}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition',
                categoryId === null
                  ? 'border-transparent bg-ink text-white'
                  : 'border-hair bg-white text-muted hover:text-ink',
              )}
            >
              No label
            </button>
            {categories.map((category) => {
              const palette = accent(category.accent)
              const on = categoryId === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(on ? null : category.id)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition',
                    on
                      ? cn('border-transparent ring-1', palette.chip, palette.ring)
                      : 'border-hair bg-white text-muted hover:text-ink',
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', palette.dot)} />
                  {category.name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-hair/70 bg-[#fcfcfe] px-4 py-2.5">
        <span className="text-[11.5px] text-faint">{body.length}/8000</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={reset} className="btn btn-ghost !px-3 !py-1.5" disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            className="btn btn-primary !px-4 !py-1.5 !text-[13px]"
            disabled={saving}
          >
            {saving ? <Spinner /> : <ArrowUpRight className="size-3.5" />}
            {saving ? (progress ? `Uploading ${progress.done}/${progress.total}…` : 'Sharing…') : 'Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
