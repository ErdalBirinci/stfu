import { useState } from 'react'
import { Plus, Save } from 'lucide-react'
import { createMemory, updateMemory } from '../lib/api'
import type { Memory, PickedFile } from '../lib/types'
import { MediaPicker, releasePickedFiles } from './MediaPicker'
import { Spinner } from './Ui'
import { useToast } from './Toast'

export function MemoryForm({
  memory,
  onSaved,
  onCancel,
}: {
  memory?: Memory | null
  onSaved: () => void
  onCancel?: () => void
}) {
  const toast = useToast()
  const editing = Boolean(memory)
  const [title, setTitle] = useState(memory?.title ?? '')
  const [description, setDescription] = useState(memory?.description ?? '')
  const [takenOn, setTakenOn] = useState(memory?.taken_on ?? '')
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
        })
        toast('Memory updated.', 'success')
      } else {
        await createMemory({
          title,
          description,
          takenOn: takenOn || null,
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
        <input
          id="memory-title"
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
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
        <label className="label" htmlFor="memory-description">
          Story <span className="font-normal text-faint">optional</span>
        </label>
        <textarea
          id="memory-description"
          className="field resize-none"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="A few lines to remember it by…"
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
