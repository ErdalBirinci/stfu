import { MEDIA_BUCKET, supabase } from './supabase'
import type { MediaItem, MediaKind } from './types'

const SIGNED_TTL_SECONDS = 60 * 60
const CACHE_TTL_MS = 45 * 60 * 1000
const MAX_IMAGE_EDGE = 1920
const COMPRESS_OVER_BYTES = 500 * 1024

const urlCache = new Map<string, { url: string; expires: number }>()
const inflight = new Map<string, Promise<string | null>>()

export function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

/**
 * Photos straight from a phone are often 5–10 MB. Downscaling them in the
 * browser keeps the free storage bucket usable and uploads much faster.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  if (file.size <= COMPRESS_OVER_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close?.()
      return file
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.82),
    )
    if (!blob || blob.size >= file.size) return file

    const name = `${file.name.replace(/\.[^.]+$/, '')}.webp`
    return new File([blob], name, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  }
}

/** A 24px preview used as an instant blurred placeholder while a photo loads. */
async function makeBlurData(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return null
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 24 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    return canvas.toDataURL('image/webp', 0.4)
  } catch {
    return null
  }
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

async function uploadOne(ownerId: string, original: File): Promise<Omit<MediaItem, 'id' | 'post_id' | 'comment_id' | 'memory_id' | 'created_at'>> {
  const file = await compressImage(original)
  const kind = kindOf(file)
  if (!kind) throw storageError(`"${original.name}" is not a photo, video or audio file.`)

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
    blur_data: await makeBlurData(file),
  }
}

export async function uploadMediaFiles(
  ownerId: string,
  files: File[],
  target: { post_id?: string; comment_id?: string; memory_id?: string },
  onProgress?: (done: number, total: number) => void,
): Promise<MediaItem[]> {
  if (files.length === 0) return []

  const created: MediaItem[] = []
  for (const [index, file] of files.entries()) {
    const base = await uploadOne(ownerId, file)
    const { data, error } = await supabase
      .from('media')
      .insert({
        ...base,
        post_id: target.post_id ?? null,
        comment_id: target.comment_id ?? null,
        memory_id: target.memory_id ?? null,
      })
      .select(
        'id, owner_id, kind, storage_path, file_name, mime_type, size_bytes, post_id, comment_id, memory_id, created_at, blur_data',
      )
      .single()
    if (error) throw error
    created.push(data as MediaItem)
    onProgress?.(index + 1, files.length)
  }
  return attachMediaUrls(created)
}

export async function uploadAvatar(ownerId: string, original: File): Promise<string> {
  const file = await compressImage(original)
  const path = `${ownerId}/avatars/${crypto.randomUUID()}.${extensionOf(file)}`
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function uploadCover(ownerId: string, original: File): Promise<string> {
  const file = await compressImage(original)
  const path = `${ownerId}/covers/${crypto.randomUUID()}.${extensionOf(file)}`
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function uploadEventCover(ownerId: string, original: File): Promise<string> {
  const file = await compressImage(original)
  const path = `${ownerId}/events/${crypto.randomUUID()}.${extensionOf(file)}`
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
