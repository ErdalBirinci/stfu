export type Role = 'admin' | 'member'
export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type MediaKind = 'image' | 'video' | 'audio'
export type RsvpStatus = 'going' | 'maybe' | 'declined'
export type ReactionEmoji = 'heart' | 'shush' | 'laugh' | 'fire'
export type CategoryAccent = 'blue' | 'violet' | 'green' | 'amber' | 'rose' | 'slate'
export type NotificationKind = 'comment' | 'reaction' | 'post' | 'event' | 'memory' | 'reminder'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  role: Role
  status: MemberStatus
  created_at: string
  approved_at: string | null
}

export interface Member extends Profile {
  email: string | null
}

export interface MediaItem {
  id: string
  owner_id: string
  kind: MediaKind
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  post_id: string | null
  comment_id: string | null
  memory_id: string | null
  created_at: string
  url?: string
}

export interface PostReaction {
  emoji: ReactionEmoji
  user_id: string
}

export interface Category {
  id: string
  name: string
  slug: string
  accent: CategoryAccent
  position: number
  created_at: string
  posts?: { count: number }[]
}

export interface Post {
  id: string
  author_id: string
  title: string
  body: string
  category_id: string | null
  created_at: string
  updated_at: string
  author?: Profile | null
  category?: Pick<Category, 'id' | 'name' | 'slug' | 'accent'> | null
  media?: MediaItem[]
  reactions?: PostReaction[]
  comments?: { count: number }[]
}

export interface OnlineMember {
  id: string
  display_name: string
  avatar_url: string | null
}

export interface AppNotification {
  id: string
  user_id: string
  actor_id: string | null
  kind: NotificationKind
  entity_id: string | null
  post_id: string | null
  memory_id?: string | null
  body: string | null
  read_at: string | null
  created_at: string
  actor?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface SearchHit {
  kind: 'post' | 'comment' | 'memory' | 'event'
  id: string
  post_id: string | null
  title: string
  snippet: string
  created_at: string
  author_name: string
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  body: string
  created_at: string
  author?: Profile | null
  media?: MediaItem[]
}

export interface CircleEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  created_by: string
  created_at: string
  creator?: Profile | null
  attendees?: EventAttendee[]
}

export interface EventAttendee {
  event_id: string
  user_id: string
  status: RsvpStatus
  created_at: string
  profile?: Profile | null
}

export interface Memory {
  id: string
  title: string
  description: string | null
  taken_on: string | null
  created_by: string
  created_at: string
  creator?: Profile | null
  media?: MediaItem[]
}

export interface MemoryComment {
  id: string
  memory_id: string
  author_id: string
  body: string
  created_at: string
  author?: Profile | null
  media?: MediaItem[]
}

export interface PickedFile {
  key: string
  file: File
  previewUrl: string
  kind: MediaKind
}

export interface AdminStats {
  members: number
  pending: number
  posts: number
  events: number
  memories: number
}

export interface AdminStorage {
  file_count: number
  total_bytes: number
  image_bytes: number
  video_bytes: number
  audio_bytes: number
  bucket_bytes: number
}

export interface AuditEntry {
  id: number
  actor_id: string | null
  target_id: string | null
  action: 'status' | 'role'
  detail: string | null
  created_at: string
  actor?: Pick<Profile, 'id' | 'display_name'> | null
  target?: Pick<Profile, 'id' | 'display_name'> | null
}

export interface ProfileOverview {
  posts: Post[]
  postCount: number
  memories: Memory[]
  memoryCount: number
}
