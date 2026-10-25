import { useEffect, useState } from 'react'
import { useAuth } from './auth'
import { supabase } from './supabase'
import type { OnlineMember } from './types'

const CHANNEL = 'presence:circle'

interface PresenceMeta {
  user_id?: string
  display_name?: string
  avatar_url?: string | null
}

/**
 * Live list of approved members with the app open. Supabase Realtime tracks
 * join/leave for us, so nothing is written to the database.
 */
export function usePresence(): OnlineMember[] {
  const { profile, session } = useAuth()
  const userId = profile?.id ?? null
  const approved = profile?.status === 'approved'
  const ready = Boolean(approved && userId && session)

  const [online, setOnline] = useState<OnlineMember[]>([])

  useEffect(() => {
    if (!ready || !userId) {
      setOnline([])
      return
    }

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    let fallback: number | undefined

    const merge = () => {
      if (!channel) return
      const state = channel.presenceState<PresenceMeta>()
      const seen = new Map<string, OnlineMember>()
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (!entry.user_id) continue
          seen.set(entry.user_id, {
            id: entry.user_id,
            display_name: entry.display_name ?? 'Member',
            avatar_url: entry.avatar_url ?? null,
          })
        }
      }
      const next = [...seen.values()].sort((a, b) => a.display_name.localeCompare(b.display_name))
      setOnline((current) =>
        current.length === next.length && next.every((member, index) => member.id === current[index].id)
          ? current
          : next,
      )
    }

    const connect = (isPrivate: boolean) => {
      channel = supabase.channel(isPrivate ? CHANNEL : `${CHANNEL}:open`, {
        config: { private: isPrivate, presence: { key: userId } },
      })

      channel
        .on('presence', { event: 'sync' }, merge)
        .on('presence', { event: 'join' }, merge)
        .on('presence', { event: 'leave' }, merge)
        .subscribe((status) => {
          if (cancelled || !channel) return
          if (status === 'SUBSCRIBED') {
            void channel.track({
              user_id: userId,
              display_name: profile?.display_name ?? 'Member',
              avatar_url: profile?.avatar_url ?? null,
            })
            return
          }
          // Private presence needs the access token on the realtime socket and a
          // policy on realtime.messages; fall back to an open channel if either
          // is missing so the list never silently dies.
          if (isPrivate && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
            const dead = channel
            channel = null
            void supabase.removeChannel(dead)
            fallback = window.setTimeout(() => {
              if (!cancelled) connect(false)
            }, 400)
          }
        })
    }

    const start = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) {
        try {
          await supabase.realtime.setAuth(token)
        } catch {
          // Older clients set the token themselves on sign-in.
        }
      }
      if (!cancelled) connect(true)
    }

    void start()

    return () => {
      cancelled = true
      if (fallback) window.clearTimeout(fallback)
      if (channel) {
        void channel.untrack()
        void supabase.removeChannel(channel)
      }
      channel = null
    }
  }, [ready, userId, profile?.display_name, profile?.avatar_url])

  return online
}
