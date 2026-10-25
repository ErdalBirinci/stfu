import { supabase } from './supabase'
import { attachMediaUrls, removeStorageObjects, uploadMediaFiles } from './media'
import type {
  AdminStats,
  AdminStorage,
  AppNotification,
  ArchivePayload,
  AuditEntry,
  Category,
  CategoryAccent,
  CircleEvent,
  CircleRecap,
  Comment,
  MediaItem,
  Member,
  MemberStatus,
  Memory,
  MemoryComment,
  Post,
  Profile,
  ProfileOverview,
  ReactionEmoji,
  Role,
  RsvpStatus,
  SearchHit,
  WeeklyPrompt,
} from './types'

const PROFILE_FIELDS = 'id, display_name, avatar_url, cover_url, bio, role, status, created_at, approved_at'
const MEDIA_FIELDS =
  'id, owner_id, kind, storage_path, file_name, mime_type, size_bytes, post_id, comment_id, memory_id, created_at, blur_data'
const POLL_FIELDS = `poll:post_poll_options(id, label, position, votes:post_poll_votes(option_id, user_id))`
const CATEGORY_FIELDS = 'id, name, slug, accent, position, created_at'
const POST_CATEGORY = `category:categories!posts_category_id_fkey(${CATEGORY_FIELDS})`
const POST_FIELDS = `id, author_id, title, body, category_id, pinned_at, hidden_at, created_at, updated_at,
  author:profiles!posts_author_id_fkey(${PROFILE_FIELDS}),
  ${POST_CATEGORY},
  ${POLL_FIELDS},
  media(${MEDIA_FIELDS}),
  reactions:post_reactions(emoji, user_id),
  comments(count)`
const POST_FIELDS_IN_CATEGORY = `id, author_id, title, body, category_id, pinned_at, hidden_at, created_at, updated_at,
  author:profiles!posts_author_id_fkey(${PROFILE_FIELDS}),
  category:categories!posts_category_id_fkey!inner(${CATEGORY_FIELDS}),
  ${POLL_FIELDS},
  media(${MEDIA_FIELDS}),
  reactions:post_reactions(emoji, user_id),
  comments(count)`
const NOTIFICATION_FIELDS = `id, user_id, actor_id, kind, entity_id, post_id, memory_id, body, read_at, created_at,
  actor:profiles!notifications_actor_id_fkey(id, display_name, avatar_url)`
const EVENT_FIELDS = `id, title, description, location, starts_at, ends_at, all_day, created_by, created_at, cover_path,
  creator:profiles!events_created_by_fkey(${PROFILE_FIELDS}),
  attendees:event_attendees(status, user_id, created_at, profile:profiles!event_attendees_user_id_fkey(${PROFILE_FIELDS}))`
const MEMORY_FIELDS = `id, title, description, taken_on, publish_at, event_id, created_by, created_at,
  creator:profiles!memories_created_by_fkey(${PROFILE_FIELDS}),
  event:events!memories_event_id_fkey(id, title, starts_at),
  media(${MEDIA_FIELDS})`
const MEMORY_COMMENT_FIELDS = `id, memory_id, author_id, body, created_at,
  author:profiles!comments_author_id_fkey(${PROFILE_FIELDS}),
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

export async function fetchFeed(limit = 40, categorySlug?: string): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select(categorySlug ? POST_FIELDS_IN_CATEGORY : POST_FIELDS)
    // Pinned posts hold the top slot, everything else stays newest-first.
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (categorySlug) query = query.eq('category.slug', categorySlug)
  const { data, error } = await query
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
  pollOptions?: string[]
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

  const options = (input.pollOptions ?? []).map((label) => label.trim()).filter(Boolean)
  if (options.length >= 2) {
    const { error: pollError } = await supabase.from('post_poll_options').insert(
      options.map((label, index) => ({ post_id: postId, label, position: index })),
    )
    if (pollError) throw pollError
  }

  await uploadMediaFiles(authorId, input.files, { post_id: postId }, input.onProgress)
  return postId
}

/* ---------------------------------- polls -------------------------------- */

export async function votePoll(postId: string, optionId: string, current: string | null): Promise<void> {
  const userId = await currentUserId()
  if (current === optionId) {
    const { error } = await supabase
      .from('post_poll_votes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('post_poll_votes')
    .upsert({ post_id: postId, option_id: optionId, user_id: userId }, { onConflict: 'post_id,user_id' })
  if (error) throw error
}

export async function deletePost(postId: string): Promise<void> {
  const { data } = await supabase.from('media').select('storage_path').eq('post_id', postId)
  const paths = (data ?? []).map((row) => (row as { storage_path: string }).storage_path)
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error
  await removeStorageObjects(paths)
}

/* ------------------------------- categories ------------------------------ */

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(`${CATEGORY_FIELDS}, posts(count)`)
    .order('position', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Category[]
}

function categoryError(message: string): Error {
  if (/duplicate key/i.test(message)) return new Error('A label with that name already exists.')
  if (/Only an admin/i.test(message)) return new Error('Only an admin can label posts.')
  return new Error(message)
}

export async function createCategory(input: {
  name: string
  accent: CategoryAccent
}): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: input.name.trim(), accent: input.accent })
    .select(CATEGORY_FIELDS)
    .single()
  if (error) throw categoryError(error.message)
  return data as unknown as Category
}

export async function updateCategory(
  id: string,
  patch: { name?: string; accent?: CategoryAccent },
): Promise<void> {
  const { error } = await supabase.from('categories').update(patch).eq('id', id)
  if (error) throw categoryError(error.message)
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function setPostCategory(postId: string, categoryId: string | null): Promise<void> {
  const { error } = await supabase.from('posts').update({ category_id: categoryId }).eq('id', postId)
  if (error) throw categoryError(error.message)
}

export async function fetchLabelablePosts(limit = 60): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `id, author_id, title, body, category_id, pinned_at, hidden_at, created_at, updated_at,
       author:profiles!posts_author_id_fkey(id, display_name),
       ${POST_CATEGORY}`,
    )
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as Post[]
}

export async function hidePost(postId: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.rpc('hide_post', { target: postId, hidden })
  if (!error) return
  if (/Only an admin/i.test(error.message)) throw new Error('Only an admin can hide a post.')
  throw new Error(error.message)
}

export async function bulkLabel(postIds: string[], categoryId: string): Promise<number> {
  const { data, error } = await supabase.rpc('bulk_label', { targets: postIds, category: categoryId })
  if (error) throw categoryError(error.message)
  return (data as number) ?? postIds.length
}

export async function setPostPinned(postId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc('pin_post', { target: postId, pinned })
  if (!error) return
  if (/Only an admin/i.test(error.message)) throw new Error('Only an admin can pin a post.')
  throw new Error(error.message)
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
  coverPath?: string | null
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
      cover_path: input.coverPath ?? null,
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

export async function fetchMemoriesForEvent(eventId: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select(MEMORY_FIELDS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const memories = (data ?? []) as unknown as Memory[]
  await hydrateMedia(memories)
  return memories
}

/** Memories from this exact day in earlier years — the archive resurfacing. */
export async function fetchOnThisDay(): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select(MEMORY_FIELDS)
    .not('taken_on', 'is', null)
    .order('taken_on', { ascending: false })
    .limit(300)
  if (error) throw error

  const today = new Date()
  const month = today.getMonth()
  const day = today.getDate()
  const year = today.getFullYear()
  const hits = ((data ?? []) as unknown as Memory[]).filter((memory) => {
    if (!memory.taken_on) return false
    const date = new Date(`${memory.taken_on}T12:00:00`)
    return date.getMonth() === month && date.getDate() === day && date.getFullYear() < year
  })

  const latest = hits.slice(0, 5)
  await hydrateMedia(latest)
  return latest
}

/* ------------------------------- weekly prompt --------------------------- */

export async function fetchWeeklyPrompt(): Promise<WeeklyPrompt | null> {
  const { data, error } = await supabase.rpc('weekly_prompt')
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as WeeklyPrompt | null
  return row ?? null
}

/* ---------------------------- mentions and people ------------------------ */

let memberNameCache: Array<{ id: string; display_name: string }> | null = null

export async function fetchMemberNames(): Promise<Array<{ id: string; display_name: string }>> {
  if (memberNameCache) return memberNameCache
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('status', 'approved')
    .order('display_name', { ascending: true })
  if (error) return []
  memberNameCache = (data ?? []) as Array<{ id: string; display_name: string }>
  return memberNameCache
}

/* ---------------------------------- recap -------------------------------- */

export async function fetchRecap(year: number): Promise<CircleRecap> {
  const { data, error } = await supabase.rpc('circle_recap', { target_year: year })
  if (error) throw error
  return data as CircleRecap
}

/* ------------------------------ archive export --------------------------- */

export async function fetchArchive(): Promise<ArchivePayload> {
  const { data, error } = await supabase.rpc('admin_archive')
  if (error) throw error
  return data as ArchivePayload
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
  publishAt?: string | null
  eventId?: string | null
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
      publish_at: input.publishAt ?? null,
      event_id: input.eventId ?? null,
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

export async function updateMemory(input: {
  memoryId: string
  title: string
  description: string
  takenOn: string | null
  publishAt?: string | null
  eventId?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('memories')
    .update({
      title: input.title.trim(),
      description: input.description.trim() || null,
      taken_on: input.takenOn,
      ...(input.publishAt !== undefined ? { publish_at: input.publishAt } : {}),
      ...(input.eventId !== undefined ? { event_id: input.eventId } : {}),
    })
    .eq('id', input.memoryId)
  if (error) throw error
}

/* --------------------------- memory conversations ------------------------ */

export async function fetchMemoryComments(memoryId: string): Promise<MemoryComment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(MEMORY_COMMENT_FIELDS)
    .eq('memory_id', memoryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const comments = (data ?? []) as unknown as MemoryComment[]
  await hydrateMedia(comments)
  return comments
}

export async function addMemoryComment(input: {
  memoryId: string
  body: string
  files: File[]
  onProgress?: (done: number, total: number) => void
}): Promise<void> {
  const authorId = await currentUserId()
  const { data, error } = await supabase
    .from('comments')
    .insert({ memory_id: input.memoryId, author_id: authorId, body: input.body.trim() })
    .select('id')
    .single()
  if (error) throw error
  await uploadMediaFiles(
    authorId,
    input.files,
    { comment_id: (data as { id: string }).id },
    input.onProgress,
  )
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

/* ------------------------------ push devices ----------------------------- */

interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

export async function savePushSubscription(
  subscription: PushSubscriptionRow,
  userAgent: string,
): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      user_agent: userAgent.slice(0, 200),
      failed_at: null,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

export async function isPushRegistered(endpoint: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}
