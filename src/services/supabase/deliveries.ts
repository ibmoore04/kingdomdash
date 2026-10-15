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

export interface AssignedRiderInfo {
  name: string
  phone: string | null
}

/**
 * Resolves the currently assigned or accepted courier rider for an order.
 * Queries `deliveries` -> `delivery_assignments` -> `riders` -> `profiles`.
 */
export async function getAssignedRiderForOrder(orderId: string): Promise<AssignedRiderInfo | null> {
  try {
    // 1. Direct Delivery & Assignment Query with nested rider + profile join
    const { data: delivery, error: delErr } = await db
      .from('deliveries')
      .select(`
        id,
        status,
        delivery_assignments (
          id,
          rider_id,
          status,
          assigned_at,
          created_at,
          riders (
            id,
            profile_id,
            profiles (
              full_name,
              phone
            )
          )
        )
      `)
      .eq('order_id', orderId)
      .maybeSingle()

    if (!delErr && delivery?.delivery_assignments) {
      const assignments = Array.isArray(delivery.delivery_assignments)
        ? delivery.delivery_assignments
        : [delivery.delivery_assignments]

      if (assignments.length > 0) {
        // Find active assignment (accepted first, then assigned, then most recent)
        const validAssignment =
          assignments.find((a: any) => a?.status === 'accepted') ||
          assignments.find((a: any) => a?.status === 'assigned') ||
          assignments[0]

        const riderProfile = validAssignment?.riders?.profiles
        if (riderProfile?.full_name) {
          return {
            name: riderProfile.full_name,
            phone: riderProfile.phone || null,
          }
        }

        // If nested join was stripped by RLS, attempt direct profile lookup via rider_id or profile_id
        const riderId = validAssignment?.rider_id || validAssignment?.riders?.id
        const profileId = validAssignment?.riders?.profile_id
        if (profileId) {
          const { data: prof } = await db
            .from('profiles')
            .select('full_name, phone')
            .eq('id', profileId)
            .maybeSingle()
          if (prof?.full_name) {
            return {
              name: prof.full_name,
              phone: prof.phone || null,
            }
          }
        } else if (riderId) {
          const { data: riderRow } = await db
            .from('riders')
            .select('profile_id, profiles(full_name, phone)')
            .eq('id', riderId)
            .maybeSingle()
          const p = riderRow?.profiles || {}
          if (p.full_name) {
            return {
              name: p.full_name,
              phone: p.phone || null,
            }
          }
        }
      }
    }

    // 2. Fallback: Query delivery_assignments directly via delivery table join
    const { data: directAssignments } = await db
      .from('delivery_assignments')
      .select(`
        id,
        rider_id,
        status,
        deliveries!inner (order_id),
        riders (
          profile_id,
          profiles (full_name, phone)
        )
      `)
      .eq('deliveries.order_id', orderId)
      .order('created_at', { ascending: false })

    if (directAssignments && directAssignments.length > 0) {
      const active =
        directAssignments.find((a: any) => a?.status === 'accepted') ||
        directAssignments.find((a: any) => a?.status === 'assigned') ||
        directAssignments[0]

      const p = active?.riders?.profiles
      if (p?.full_name) {
        return {
          name: p.full_name,
          phone: p.phone || null,
        }
      }
    }

    // 3. Fallback: Linked Personal Shopper Requests (for campus errand / custom shopper requests)
    const { data: psReq } = await db
      .from('personal_shopper_requests')
      .select('assigned_shopper_id, profiles:assigned_shopper_id(full_name, phone)')
      .eq('order_id', orderId)
      .maybeSingle()

    if (psReq?.profiles?.full_name) {
      return {
        name: psReq.profiles.full_name,
        phone: psReq.profiles.phone || null,
      }
    }

    return null
  } catch (err) {
    console.warn('[deliveries] Error getting assigned rider for order:', err)
    return null
  }
}
