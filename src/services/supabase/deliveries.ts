import { supabase } from './client'

// Scaffold compatibility: cast to untyped client until `npm run db:types` generates real types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getDeliveriesByStatus(status: string) {
  return db.from('deliveries').select('*').eq('status', status) as Promise<{ data: unknown; error: unknown }>
}

export async function getDeliveryById(id: string) {
  return db
    .from('deliveries')
    .select('*, delivery_assignments(*), delivery_status_updates(*)')
    .eq('id', id)
    .single() as Promise<{ data: unknown; error: unknown }>
}
