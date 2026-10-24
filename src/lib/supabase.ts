import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

/** True when the build was given a Supabase project. The app shows setup help otherwise. */
export const isConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient = isConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : (createClient('https://placeholder.supabase.co', 'placeholder-anon-key') as SupabaseClient)

export const MEDIA_BUCKET = 'media'
