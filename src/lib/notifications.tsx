import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchNotifications, markNotificationsRead } from './api'
import { useAuth } from './auth'
import { supabase } from './supabase'
import type { AppNotification } from './types'

interface NotificationsValue {
  items: AppNotification[]
  unread: number
  loading: boolean
  open: boolean
  setOpen: (open: boolean) => void
  markAllRead: () => Promise<void>
  refresh: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { profile, session } = useAuth()
  const userId = session?.user.id ?? null
  const approved = profile?.status === 'approved'
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (!userId || !approved) {
      setItems([])
      setUnread(0)
      setLoading(false)
      return
    }
    try {
      const rows = await fetchNotifications()
      setItems(rows)
      setUnread(rows.filter((row) => !row.read_at).length)
    } catch {
      // A failed refresh should never clear what the bell already shows.
    } finally {
      setLoading(false)
    }
  }, [userId, approved])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!userId || !approved) return
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, approved, load])

  useEffect(() => {
    function onFocus() {
      void load()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const markAllRead = useCallback(async () => {
    if (unread === 0) return
    const stamp = new Date().toISOString()
    setItems((rows) => rows.map((row) => (row.read_at ? row : { ...row, read_at: stamp })))
    setUnread(0)
    try {
      await markNotificationsRead()
    } catch {
      // Best effort: the badge already cleared locally.
    }
  }, [unread])

  const value = useMemo<NotificationsValue>(
    () => ({ items, unread, loading, open, setOpen, markAllRead, refresh: load }),
    [items, unread, loading, open, markAllRead, load],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext)
  if (!value) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return value
}

export function notificationText(notification: AppNotification): string {
  const name = notification.actor?.display_name ?? 'Someone'
  switch (notification.kind) {
    case 'post':
      return `${name} shared something new`
    case 'comment':
      return notification.memory_id ? `${name} commented on a memory` : `${name} replied on a post`
    case 'reaction':
      return `${name} reacted to your post`
    case 'event':
      return notification.body ? `${name} planned “${notification.body}”` : `${name} planned an event`
    case 'memory':
      return notification.body ? `${name} added “${notification.body}”` : `${name} added a memory`
    case 'reminder':
      return notification.body ? `Reminder: “${notification.body}” starts within a day` : 'An event starts soon'
    case 'mention':
      return `${name} mentioned you`
    default:
      return `${name} did something`
  }
}

export function notificationHref(notification: AppNotification): string {
  switch (notification.kind) {
    case 'event':
    case 'reminder':
      return notification.entity_id ? `/events/${notification.entity_id}` : '/calendar'
    case 'memory':
      return notification.entity_id ? `/memories/${notification.entity_id}` : '/memories'
    case 'comment':
    case 'mention':
      return notification.memory_id
        ? `/memories/${notification.memory_id}#comments`
        : notification.post_id
          ? `/post/${notification.post_id}`
          : '/'
    default:
      return notification.post_id ? `/post/${notification.post_id}` : '/'
  }
}
