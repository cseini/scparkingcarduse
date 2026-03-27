import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.parking_service_role?.trim() || ''

export const supabaseAdmin = (supabaseUrl && serviceRoleKey)
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : createClient(supabaseUrl || 'https://placeholder.supabase.co', 'placeholder-key', { auth: { persistSession: false } })
