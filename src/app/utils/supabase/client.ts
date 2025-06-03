import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null

export const createClient = () => {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseClient = createSupabaseClient(supabaseUrl, supabaseAnonKey)
  return supabaseClient
} 