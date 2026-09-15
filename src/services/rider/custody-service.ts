import { supabase } from '@/services/supabase/client'
import type { ActiveDeliveryDetails } from '@/types/rider'
import { mapRiderRpcError } from './error-mapper'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getRiderActiveDelivery(): Promise<{
  data: ActiveDeliveryDetails | null
  error: Error | null
}> {
  try {
    const { data, error } = await db.rpc('get_rider_active_delivery')
    if (error) {
      return { data: null, error: new Error(mapRiderRpcError(error)) }
    }
    return { data: data as ActiveDeliveryDetails | null, error: null }
  } catch (err) {
    return {
      data: null,
      error: new Error(mapRiderRpcError(err)),
    }
  }
}

export async function markDeliveryPickedUp(
  deliveryId: string,
  notes?: string
): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const { error } = await db.rpc('mark_delivery_picked_up', {
      p_delivery_id: deliveryId,
      p_notes: notes || null,
    })
    if (error) {
      return { success: false, error: new Error(mapRiderRpcError(error)) }
    }
    return { success: true, error: null }
  } catch (err) {
    return {
      success: false,
      error: new Error(mapRiderRpcError(err)),
    }
  }
}

export async function markDeliveryInTransit(
  deliveryId: string,
  notes?: string
): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const { error } = await db.rpc('mark_delivery_in_transit', {
      p_delivery_id: deliveryId,
      p_notes: notes || null,
    })
    if (error) {
      return { success: false, error: new Error(mapRiderRpcError(error)) }
    }
    return { success: true, error: null }
  } catch (err) {
    return {
      success: false,
      error: new Error(mapRiderRpcError(err)),
    }
  }
}

export async function markDeliveryDelivered(
  deliveryId: string,
  notes?: string
): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const { error } = await db.rpc('mark_delivery_delivered', {
      p_delivery_id: deliveryId,
      p_notes: notes || null,
    })
    if (error) {
      return { success: false, error: new Error(mapRiderRpcError(error)) }
    }
    return { success: true, error: null }
  } catch (err) {
    return {
      success: false,
      error: new Error(mapRiderRpcError(err)),
    }
  }
}
