import { useState } from 'react'
import { ArrowUpRight, PenLine } from 'lucide-react'
import { createPost } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { PickedFile } from '../lib/types'
import { Avatar } from './Avatar'
import { MediaPicker, releasePickedFiles } from './MediaPicker'
import { Spinner } from './Ui'
import { useToast } from './Toast'

export function Composer({ onPosted }: { onPosted: (postId: string) => void }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<PickedFile[]>([])
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitle('')
    setBody('')
    releasePickedFiles(files)
    setFiles([])
    setOpen(false)
  }

  async function submit() {
    if (title.trim().length < 3) {
      toast('Give your post a title of at least 3 characters.', 'error')
      return
    }
    if (!body.trim() && files.length === 0) {
      toast('Write a few words or attach something.', 'error')
      return
    }
    setSaving(true)
    try {
      const postId = await createPost({ title, body, files: files.map((item) => item.file) })
      reset()
      toast('Shared with the circle.', 'success')
      onPosted(postId)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not publish your post.', 'error')
    } finally {
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
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="A title for your post"
            maxLength={120}
            className="w-full border-0 bg-transparent p-0 text-[16.5px] font-semibold tracking-[-0.02em] outline-none placeholder:font-semibold placeholder:text-[#b3b3ba]"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Say more, add context, or drop a memory…"
            rows={3}
            maxLength={4000}
            className="mt-1.5 w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-relaxed text-[#33333a] outline-none placeholder:text-[#a9a9b0]"
          />
        </div>
      </div>

      <div className="px-4 pb-1.5">
        <MediaPicker files={files} onChange={setFiles} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-hair/70 bg-[#fcfcfe] px-4 py-2.5">
        <span className="text-[11.5px] text-faint">{body.length}/4000</span>
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
            {saving ? 'Sharing…' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
