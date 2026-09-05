import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isMockBackend =
  !url || url === 'mock' || import.meta.env.VITE_SUPABASE_URL === 'mock'

export const supabase = url && anonKey ? createClient(url, anonKey) : null

export const db = supabase
export const auth = supabase
export const storage = supabase
export const functions = supabase
export default supabase
