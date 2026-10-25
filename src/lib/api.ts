import { supabase } from './supabase'
import { attachMediaUrls, removeStorageObjects, uploadMediaFiles } from './media'
import type {
  AdminStats,
  AdminStorage,
  AppNotification,
  AuditEntry,
  CircleEvent,
  Comment,
  MediaItem,
  Member,
  MemberStatus,
  Memory,
  Post,
  Profile,
  ProfileOverview,
  ReactionEmoji,
  Role,
  RsvpStatus,
  SearchHit,
} from './types'

const PROFILE_FIELDS = 'id, display_name, avatar_url, cover_url, bio, role, status, created_at, approved_at'
const MEDIA_FIELDS =
  'id, owner_id, kind, storage_path, file_name, mime_type, size_bytes, post_id, comment_id, memory_id, created_at'
const POST_FIELDS = `id, author_id, title, body, created_at, updated_at,
  author:profiles!posts_author_id_fkey(${PROFILE_FIELDS}),
  media(${MEDIA_FIELDS}),
  reactions:post_reactions(emoji, user_id),
  comments(count)`
const NOTIFICATION_FIELDS = `id, user_id, actor_id, kind, entity_id, post_id, body, read_at, created_at,
  actor:profiles!notifications_actor_id_fkey(id, display_name, avatar_url)`
const EVENT_FIELDS = `id, title, description, location, starts_at, ends_at, all_day, created_by, created_at,
  creator:profiles!events_created_by_fkey(${PROFILE_FIELDS}),
  attendees:event_attendees(status, user_id, created_at, profile:profiles!event_attendees_user_id_fkey(${PROFILE_FIELDS}))`
const MEMORY_FIELDS = `id, title, description, taken_on, created_by, created_at,
  creator:profiles!memories_created_by_fkey(${PROFILE_FIELDS}),
  media(${MEDIA_FIELDS})`

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Your session has expired. Please sign in again.')
  return data.user.id
}

async function hydrateMedia(rows: Array<{ media?: MediaItem[] }>): Promise<void> {
  const all = rows.flatMap((row) => row.media ?? [])
  if (all.length === 0) return
  const resolved = await attachMediaUrls(all)
  const byId = new Map(resolved.map((item) => [item.id, item]))
  for (const row of rows) {
    row.media = (row.media ?? []).map((item) => byId.get(item.id) ?? item)
  }
}

export function commentCount(post: Post): number {
  return post.comments?.[0]?.count ?? 0
}

/* ---------------------------------- feed --------------------------------- */

export async function fetchFeed(limit = 40): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_FIELDS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const posts = (data ?? []) as unknown as Post[]
  await hydrateMedia(posts)
  return posts
}

export async function fetchPost(id: string): Promise<{ post: Post; comments: Comment[] }> {
  const { data, error } = await supabase.from('posts').select(POST_FIELDS).eq('id', id).single()
  if (error) throw error
  const post = data as unknown as Post

  const { data: commentRows, error: commentError } = await supabase
    .from('comments')
    .select(
      `id, post_id, author_id, parent_id, body, created_at,
       author:profiles!comments_author_id_fkey(${PROFILE_FIELDS}),
       media(${MEDIA_FIELDS})`,
    )
    .eq('post_id', id)
    .order('created_at', { ascending: true })
  if (commentError) throw commentError

  const comments = (commentRows ?? []) as unknown as Comment[]
  await hydrateMedia([post, ...comments])
  return { post, comments }
}

export async function createPost(input: {
  title: string
  body: string
  files: File[]
  onProgress?: (done: number, total: number) => void
}): Promise<string> {
  const authorId = await currentUserId()
  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: authorId, title: input.title.trim(), body: input.body.trim() })
    .select('id')
    .single()
  if (error) throw error
  const postId = (data as { id: string }).id
  await uploadMediaFiles(authorId, input.files, { post_id: postId }, input.onProgress)
  return postId
}

export async function deletePost(postId: string): Promise<void> {
  const { data } = await supabase.from('media').select('storage_path').eq('post_id', postId)
  const paths = (data ?? []).map((row) => (row as { storage_path: string }).storage_path)
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error
  await removeStorageObjects(paths)
}

/* -------------------------------- reactions ------------------------------ */

export async function setReaction(postId: string, emoji: ReactionEmoji | null): Promise<void> {
  const userId = await currentUserId()
  if (!emoji) {
    const { error } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('post_reactions')
    .upsert({ post_id: postId, user_id: userId, emoji }, { onConflict: 'post_id,user_id' })
  if (error) throw error
}

/* ------------------------------ notifications ---------------------------- */

export async function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_FIELDS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as AppNotification[]
}

export async function markNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
}

/* --------------------------------- search -------------------------------- */

export async function searchCircle(term: string): Promise<SearchHit[]> {
  const clean = term.trim()
  if (clean.length < 2) return []
  const { data, error } = await supabase.rpc('search_circle', { term: clean })
  if (error) throw error
  return (data ?? []) as SearchHit[]
}

export async function addComment(input: {
  postId: string
  body: string
  parentId?: string | null
  files: File[]
  onProgress?: (done: number, total: number) => void
}): Promise<void> {
  const authorId = await currentUserId()
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: input.postId,
      author_id: authorId,
      parent_id: input.parentId ?? null,
      body: input.body.trim(),
    })
    .select('id')
    .single()
  if (error) throw error
  await uploadMediaFiles(
    authorId,
    input.files,
    { comment_id: (data as { id: string }).id, post_id: input.postId },
    input.onProgress,
  )
}

/* --------------------------------- events -------------------------------- */

export async function fetchEvents(fromISO: string, toISO: string): Promise<CircleEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .gte('starts_at', fromISO)
    .lte('starts_at', toISO)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as CircleEvent[]
}

export async function fetchUpcomingEvents(limit = 5): Promise<CircleEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_FIELDS)
    .gte('starts_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as CircleEvent[]
}

export async function fetchEvent(id: string): Promise<CircleEvent> {
  const { data, error } = await supabase.from('events').select(EVENT_FIELDS).eq('id', id).single()
  if (error) throw error
  return data as unknown as CircleEvent
}

export async function createEvent(input: {
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
}): Promise<string> {
  const createdBy = await currentUserId()
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: input.title.trim(),
      description: input.description.trim() || null,
      location: input.location.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      all_day: input.allDay,
      created_by: createdBy,
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
}

export async function setRsvp(eventId: string, status: RsvpStatus): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('event_attendees')
    .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' })
  if (error) throw error
}

export async function clearRsvp(eventId: string): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)
  if (error) throw error
}

/* -------------------------------- memories ------------------------------- */

export async function fetchMemories(): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select(MEMORY_FIELDS)
    .order('created_at', { ascending: false })
  if (error) throw error
  const memories = (data ?? []) as unknown as Memory[]
  await hydrateMedia(memories)
  return memories
}

export async function fetchMemory(id: string): Promise<Memory> {
  const { data, error } = await supabase.from('memories').select(MEMORY_FIELDS).eq('id', id).single()
  if (error) throw error
  const memory = data as unknown as Memory
  await hydrateMedia([memory])
  return memory
}

export async function createMemory(input: {
  title: string
  description: string
  takenOn: string | null
  files: File[]
  onProgress?: (done: number, total: number) => void
}): Promise<string> {
  const createdBy = await currentUserId()
  const { data, error } = await supabase
    .from('memories')
    .insert({
      title: input.title.trim(),
      description: input.description.trim() || null,
      taken_on: input.takenOn,
      created_by: createdBy,
    })
    .select('id')
    .single()
  if (error) throw error
  const memoryId = (data as { id: string }).id
  await uploadMediaFiles(createdBy, input.files, { memory_id: memoryId }, input.onProgress)
  return memoryId
}

export async function addMemoryMedia(
  memoryId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const userId = await currentUserId()
  await uploadMediaFiles(userId, files, { memory_id: memoryId }, onProgress)
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const { data } = await supabase.from('media').select('storage_path').eq('memory_id', memoryId)
  const paths = (data ?? []).map((row) => (row as { storage_path: string }).storage_path)
  const { error } = await supabase.from('memories').delete().eq('id', memoryId)
  if (error) throw error
  await removeStorageObjects(paths)
}

/* --------------------------------- profile ------------------------------- */

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Profile) ?? null
}

export async function updateProfile(input: {
  displayName: string
  bio: string
  avatarPath: string | null
  coverPath?: string | null
}): Promise<Profile> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: input.displayName.trim(),
      bio: input.bio.trim() || null,
      avatar_url: input.avatarPath,
      ...(input.coverPath !== undefined ? { cover_url: input.coverPath } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select(PROFILE_FIELDS)
    .single()
  if (error) throw error
  return data as unknown as Profile
}

export async function fetchProfileOverview(userId: string): Promise<ProfileOverview> {
  const [postsResult, memoriesResult] = await Promise.all([
    supabase
      .from('posts')
      .select(POST_FIELDS, { count: 'exact' })
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('memories')
      .select(MEMORY_FIELDS, { count: 'exact' })
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  if (postsResult.error) throw postsResult.error
  if (memoriesResult.error) throw memoriesResult.error

  const posts = (postsResult.data ?? []) as unknown as Post[]
  const memories = (memoriesResult.data ?? []) as unknown as Memory[]
  await hydrateMedia([...posts, ...memories])

  return {
    posts,
    postCount: postsResult.count ?? posts.length,
    memories,
    memoryCount: memoriesResult.count ?? memories.length,
  }
}

/* ---------------------------------- admin -------------------------------- */

export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase.rpc('admin_members')
  if (error) throw error
  return (data ?? []) as Member[]
}

export async function setMemberStatus(userId: string, status: MemberStatus): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    })
    .eq('id', userId)
  if (error) throw error
}

export async function setMemberRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
}

export async function fetchAdminStorage(): Promise<AdminStorage> {
  const { data, error } = await supabase.rpc('admin_storage_stats')
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as AdminStorage | null
  return (
    row ?? {
      file_count: 0,
      total_bytes: 0,
      image_bytes: 0,
      video_bytes: 0,
      audio_bytes: 0,
      bucket_bytes: 0,
    }
  )
}

export async function fetchAuditLog(limit = 25): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit')
    .select(
      `id, actor_id, target_id, action, detail, created_at,
       actor:profiles!admin_audit_actor_id_fkey(id, display_name),
       target:profiles!admin_audit_target_id_fkey(id, display_name)`,
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as AuditEntry[]
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const countOf = async (table: string, filter?: { column: string; value: string }) => {
    let query = supabase.from(table).select('id', { count: 'exact', head: true })
    if (filter) query = query.eq(filter.column, filter.value)
    const { count } = await query
    return count ?? 0
  }

  const [members, pending, posts, events, memories] = await Promise.all([
    countOf('profiles', { column: 'status', value: 'approved' }),
    countOf('profiles', { column: 'status', value: 'pending' }),
    countOf('posts'),
    countOf('events'),
    countOf('memories'),
  ])
  return { members, pending, posts, events, memories }
}
