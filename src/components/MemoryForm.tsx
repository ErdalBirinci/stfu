import { useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { createMemory, updateMemory } from '../lib/api'
import { MentionInput } from '../lib/mentions'
import type { Memory, PickedFile } from '../lib/types'
import { MediaPicker, releasePickedFiles } from './MediaPicker'
import { Spinner } from './Ui'
import { useToast } from './Toast'

export function MemoryForm({
  memory,
  eventId,
  onSaved,
  onCancel,
}: {
  memory?: Memory | null
  eventId?: string | null
  onSaved: () => void
  onCancel?: () => void
}) {
  const toast = useToast()
  const editing = Boolean(memory)
  const [title, setTitle] = useState(memory?.title ?? '')
  const [description, setDescription] = useState(memory?.description ?? '')
  const [takenOn, setTakenOn] = useState(memory?.taken_on ?? '')
  const [unlockOn, setUnlockOn] = useState((memory?.publish_at ?? '').slice(0, 10))
  const [files, setFiles] = useState<PickedFile[]>([])
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function submit() {
    if (title.trim().length < 3) {
      toast('Give this memory a name.', 'error')
      return
    }
    setSaving(true)
    try {
      if (memory) {
        await updateMemory({
          memoryId: memory.id,
          title,
          description,
          takenOn: takenOn || null,
          publishAt: unlockOn ? new Date(`${unlockOn}T09:00:00`).toISOString() : null,
          eventId: eventId !== undefined ? eventId : undefined,
        })
        toast('Memory updated.', 'success')
      } else {
        await createMemory({
          title,
          description,
          takenOn: takenOn || null,
          publishAt: unlockOn ? new Date(`${unlockOn}T09:00:00`).toISOString() : null,
          eventId: eventId ?? null,
          files: files.map((item) => item.file),
          onProgress: (done, total) => setProgress({ done, total }),
        })
        releasePickedFiles(files)
        toast('Memory saved.', 'success')
      }
      onSaved()
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : editing
            ? 'Could not update the memory.'
            : 'Could not save the memory.',
        'error',
      )
    } finally {
      setProgress(null)
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3.5">
      <div>
        <label className="label" htmlFor="memory-title">
          Name
        </label>
        <MentionInput
          as="input"
          id="memory-title"
          className="field"
          value={title}
          onChange={setTitle}
          placeholder="Summer at the lake house"
          maxLength={120}
        />
      </div>

      <div>
        <label className="label" htmlFor="memory-date">
          When was it? <span className="font-normal text-faint">optional</span>
        </label>
        <input
          id="memory-date"
          type="date"
          className="field"
          value={takenOn}
          onChange={(event) => setTakenOn(event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="memory-seal">
          Keep it sealed until <span className="font-normal text-faint">optional</span>
        </label>
        <input
          id="memory-seal"
          type="date"
          className="field"
          value={unlockOn}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setUnlockOn(event.target.value)}
        />
        <p className="mt-1 text-[11px] text-faint">
          A time capsule: only you can see the album until that morning, then it opens for everyone.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="memory-description">
          Story <span className="font-normal text-faint">optional</span>
        </label>
        <MentionInput
          id="memory-description"
          className="field resize-none"
          rows={3}
          value={description}
          onChange={setDescription}
          placeholder="A few lines to remember it by… Use @ to bring someone in."
          maxLength={4000}
        />
      </div>

      {editing ? null : (
        <div>
          <span className="label">Photos, video or audio</span>
          <div className="rounded-2xl border border-dashed border-[#dcdce4] p-2.5">
            <MediaPicker files={files} onChange={setFiles} />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
          {saving ? <Spinner /> : editing ? <Save className="size-4" /> : <Plus className="size-4" />}
          {saving
            ? progress
              ? `Uploading ${progress.done}/${progress.total}…`
              : 'Saving…'
            : editing
              ? 'Save changes'
              : 'Save memory'}
        </button>
      </div>
    </div>
  )
}
