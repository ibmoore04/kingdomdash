import { supabase } from './client'

// Scaffold compatibility: cast to untyped client until `npm run db:types` generates real types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getRiderProfile() {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: authError }
  return db.from('riders').select('*').eq('profile_id', user.id).single() as Promise<{ data: unknown; error: unknown }>
}

/**
 * Update the calling rider's availability status.
 *
 * Routes through the `update_rider_availability` SECURITY DEFINER RPC
 * (migration 014) — this is the only permitted path for riders to toggle
 * their own `is_available` field. Direct UPDATE on the `riders` table by
 * authenticated users is no longer allowed (policy dropped in migration 014).
 *
 * The `id` parameter is accepted for caller convenience but is NOT sent to
 * the RPC — the server resolves the rider via `auth.uid()`.
 */
export async function updateRiderAvailability(_id: string, available: boolean) {
  return db.rpc('update_rider_availability', {
    p_is_available: available,
  }) as Promise<{ data: unknown; error: unknown }>
}

/**
 * Accept a delivery assignment.
 *
 * Routes through the `accept_delivery_assignment` SECURITY DEFINER RPC
 * (migration 014). Validates rider ownership and transitions status
 * from 'assigned' → 'accepted' only. Any other current status is rejected.
 */
export async function acceptDeliveryAssignment(assignmentId: string) {
  return db.rpc('accept_delivery_assignment', {
    p_assignment_id: assignmentId,
  }) as Promise<{ data: unknown; error: unknown }>
}

/**
 * Reject a delivery assignment.
 *
 * Routes through the `reject_delivery_assignment` SECURITY DEFINER RPC
 * (migration 014). Validates rider ownership and transitions status
 * from 'assigned' → 'rejected' only.
 */
export async function rejectDeliveryAssignment(assignmentId: string) {
  return db.rpc('reject_delivery_assignment', {
    p_assignment_id: assignmentId,
  }) as Promise<{ data: unknown; error: unknown }>
}
