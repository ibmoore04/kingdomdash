import { supabase } from './client'

// Scaffold compatibility: cast to untyped client until `npm run db:types` generates real types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getCurrentProfile() {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: authError }
  return db.from('profiles').select('*').eq('id', user.id).single() as Promise<{ data: unknown; error: unknown }>
}

export async function updateProfile(id: string, updates: Record<string, unknown>) {
  if (!id || typeof id !== 'string') {
    return { data: null, error: new Error('A valid user ID is required to update profile.') }
  }
  return db.from('profiles').update(updates).eq('id', id).select().single() as Promise<{ data: unknown; error: unknown }>
}
