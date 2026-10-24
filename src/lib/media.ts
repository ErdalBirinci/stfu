import { MEDIA_BUCKET, supabase } from './supabase'
import type { MediaItem, MediaKind } from './types'

const SIGNED_TTL_SECONDS = 60 * 60
const CACHE_TTL_MS = 45 * 60 * 1000

const urlCache = new Map<string, { url: string; expires: number }>()
const inflight = new Map<string, Promise<string | null>>()

export function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

function extensionOf(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : ''
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  const fromType = file.type.split('/')[1]
  return (fromType ?? 'bin').toLowerCase()
}

function storageError(message: string): Error {
  return new Error(message)
}

/** Signed URL for one object, memoised so lists do not re-sign the same file. */
export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const hit = urlCache.get(path)
  if (hit && hit.expires > Date.now()) return hit.url

  const pending = inflight.get(path)
  if (pending) return pending

  const task = supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS)
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) return null
      urlCache.set(path, { url: data.signedUrl, expires: Date.now() + CACHE_TTL_MS })
      return data.signedUrl
    })
    .finally(() => {
      inflight.delete(path)
    })

  inflight.set(path, task)
  return task
}

export function forgetSignedUrl(path: string) {
  urlCache.delete(path)
}

/** Resolve URLs for a batch of media rows in a single request. */
export async function attachMediaUrls(items: MediaItem[]): Promise<MediaItem[]> {
  if (items.length === 0) return items
  const unique = [...new Set(items.map((item) => item.storage_path))]
  const missing = unique.filter((path) => {
    const hit = urlCache.get(path)
    return !hit || hit.expires <= Date.now()
  })

  if (missing.length > 0) {
    const { data } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(missing, SIGNED_TTL_SECONDS)
    const expires = Date.now() + CACHE_TTL_MS
    for (const entry of data ?? []) {
      if (entry.signedUrl && entry.path) {
        urlCache.set(entry.path, { url: entry.signedUrl, expires })
      }
    }
  }

  return items.map((item) => ({ ...item, url: urlCache.get(item.storage_path)?.url ?? undefined }))
}

async function uploadOne(ownerId: string, file: File): Promise<Omit<MediaItem, 'id' | 'post_id' | 'comment_id' | 'memory_id' | 'created_at'>> {
  const kind = kindOf(file)
  if (!kind) throw storageError(`"${file.name}" is not a photo, video or audio file.`)

  const path = `${ownerId}/${kind}/${crypto.randomUUID()}.${extensionOf(file)}`
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw error

  return {
    owner_id: ownerId,
    kind,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
  }
}

export async function uploadMediaFiles(
  ownerId: string,
  files: File[],
  target: { post_id?: string; comment_id?: string; memory_id?: string },
): Promise<MediaItem[]> {
  if (files.length === 0) return []

  const created: MediaItem[] = []
  for (const file of files) {
    const base = await uploadOne(ownerId, file)
    const { data, error } = await supabase
      .from('media')
      .insert({
        ...base,
        post_id: target.post_id ?? null,
        comment_id: target.comment_id ?? null,
        memory_id: target.memory_id ?? null,
      })
      .select('id, owner_id, kind, storage_path, file_name, mime_type, size_bytes, post_id, comment_id, memory_id, created_at')
      .single()
    if (error) throw error
    created.push(data as MediaItem)
  }
  return attachMediaUrls(created)
}

export async function uploadAvatar(ownerId: string, file: File): Promise<string> {
  const path = `${ownerId}/avatars/${crypto.randomUUID()}.${extensionOf(file)}`
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeStorageObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await supabase.storage.from(MEDIA_BUCKET).remove(paths)
  paths.forEach(forgetSignedUrl)
}

export function describeError(error: unknown): string {
  if (!error) return 'Something went wrong.'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  const maybe = error as { message?: string; error_description?: string; details?: string }
  return maybe.message ?? maybe.error_description ?? maybe.details ?? 'Something went wrong.'
}
