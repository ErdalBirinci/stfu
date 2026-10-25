import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchProfile } from './api'
import { describeError } from './media'
import { supabase } from './supabase'
import type { Profile } from './types'

interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  recovery: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  applyProfile: (profile: Profile) => void
  updatePassword: (password: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  endRecovery: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const activeUserId = useRef<string | null>(null)

  const loadProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null)
      return
    }
    try {
      const next = await fetchProfile(userId)
      if (activeUserId.current === userId) setProfile(next)
    } catch {
      if (activeUserId.current === userId) setProfile(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      activeUserId.current = data.session?.user.id ?? null
      setSession(data.session)
      await loadProfile(data.session?.user.id ?? null)
      if (mounted) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      activeUserId.current = nextSession?.user.id ?? null
      setSession(nextSession)
      void loadProfile(nextSession?.user.id ?? null)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(describeError(error))
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    })
    if (error) throw new Error(describeError(error))
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refresh = useCallback(async () => {
    const userId = activeUserId.current
    if (userId) await loadProfile(userId)
  }, [loadProfile])

  const applyProfile = useCallback((next: Profile) => setProfile(next), [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(describeError(error))
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    })
    if (error) throw new Error(describeError(error))
  }, [])

  const endRecovery = useCallback(() => setRecovery(false), [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      recovery,
      signIn,
      signUp,
      signOut,
      refresh,
      applyProfile,
      updatePassword,
      requestPasswordReset,
      endRecovery,
    }),
    [
      session,
      profile,
      loading,
      recovery,
      signIn,
      signUp,
      signOut,
      refresh,
      applyProfile,
      updatePassword,
      requestPasswordReset,
      endRecovery,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
