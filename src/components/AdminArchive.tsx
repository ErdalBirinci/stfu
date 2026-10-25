import { useState } from 'react'
import JSZip from 'jszip'
import { Archive, Download, FileText, Images } from 'lucide-react'
import { fetchArchive } from '../lib/api'
import { MEDIA_BUCKET, supabase } from '../lib/supabase'
import { fileSize } from '../lib/format'
import type { ArchivePayload } from '../lib/types'
import { Spinner } from './Ui'
import { useToast } from './Toast'

interface Progress {
  done: number
  total: number
}

function safeName(value: string): string {
  return value.replace(/[^\w.\- ]+/g, '_').slice(0, 80)
}

/**
 * Everything the circle ever wrote or uploaded, in one zip the admin keeps.
 * Text first, then every file, then the manifest that ties them together.
 */
export function AdminArchive() {
  const toast = useToast()
  const [payload, setPayload] = useState<ArchivePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)

  async function inspect() {
    setLoading(true)
    try {
      const data = await fetchArchive()
      setPayload(data)
      toast('Archive is ready to download.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not read the archive.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function download() {
    if (!payload) return
    setLoading(true)
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(payload, null, 2))

    const media = payload.media ?? []
    setProgress({ done: 0, total: media.length })
    try {
      const paths = media.map((item) => item.storage_path)
      const signed = new Map<string, string>()
      for (let index = 0; index < paths.length; index += 40) {
        const chunk = paths.slice(index, index + 40)
        const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(chunk, 900)
        for (const entry of data ?? []) {
          if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl)
        }
      }

      let done = 0
      for (const item of media) {
        const url = signed.get(item.storage_path)
        const folder =
          item.kind === 'image' ? 'photos' : item.kind === 'video' ? 'videos' : 'voice-notes'
        if (url) {
          try {
            const response = await fetch(url)
            if (response.ok) {
              zip.file(`${folder}/${safeName(item.file_name) || `${item.storage_path.split('/').pop()}`}`, await response.blob())
            }
          } catch {
            // A single unreachable file should not abort the whole archive.
          }
        }
        done += 1
        setProgress({ done, total: media.length })
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `stfu-archive-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(href), 4000)
      toast('Archive downloaded.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not build the archive.', 'error')
    } finally {
      setProgress(null)
      setLoading(false)
    }
  }

  const mediaBytes = (payload?.media ?? []).reduce((sum, item) => sum + item.size_bytes, 0)

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-hair/70 px-4 py-3.5">
        <h2 className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <Archive className="size-4 text-muted" />
          The archive
        </h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          Download everything the circle ever wrote or uploaded: posts, replies, memories, events and
          every file, with a manifest that ties them together.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
        <button
          type="button"
          onClick={() => void inspect()}
          disabled={loading}
          className="btn btn-quiet !px-3 !py-1.5 !text-[12px]"
        >
          {loading && !progress ? <Spinner /> : <FileText className="size-3.5" />}
          Check the contents
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={!payload || loading}
          className="btn btn-primary !px-3 !py-1.5 !text-[12px]"
        >
          {progress ? <Spinner /> : <Download className="size-3.5" />}
          {progress ? `Packing ${progress.done}/${progress.total}…` : 'Download the zip'}
        </button>
      </div>

      {payload ? (
        <div className="grid grid-cols-2 gap-2 border-t border-hair/70 bg-[#fbfbfd] px-4 py-3 sm:grid-cols-4">
          {[
            { label: 'Posts', value: payload.posts.length },
            { label: 'Memories', value: payload.memories.length },
            { label: 'Replies', value: payload.comments.length },
            { label: 'Files', value: payload.media.length },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">
                {stat.label}
              </p>
              <p className="text-[16px] font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
          <p className="col-span-2 inline-flex items-center gap-1.5 text-[11px] text-faint sm:col-span-4">
            <Images className="size-3" />
            {fileSize(mediaBytes)} of media in total. The zip is built in this browser, so leave the
            tab open while it packs.
          </p>
        </div>
      ) : null}
    </section>
  )
}
