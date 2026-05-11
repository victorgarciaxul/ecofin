import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(url && key)

let _client = null
if (isSupabaseConfigured) {
  try {
    _client = createClient(url, key)
  } catch (_) {
    // env vars inválidas — modo demo
  }
}

export const supabase = _client
