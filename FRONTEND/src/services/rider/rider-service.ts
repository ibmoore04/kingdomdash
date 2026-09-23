import { supabase } from '@/services/supabase/client'
import type { RiderProfile } from '@/types/rider'
import { mapRiderRpcError } from './error-mapper'

// Untyped helper cast for dynamic RPC calling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getRiderOperationalProfile(): Promise<{
  data: RiderProfile | null
  error: Error | null
}> {
  try {
    const { data, error } = await db.rpc('get_rider_operational_profile')
    if (error) {
      return { data: null, error: new Error(mapRiderRpcError(error)) }
    }
    return { data: data as RiderProfile | null, error: null }
  } catch (err) {
    return {
      data: null,
      error: new Error(mapRiderRpcError(err)),
    }
  }
}

export async function updateRiderAvailability(available: boolean): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const { error } = await db.rpc('update_rider_availability', {
      p_is_available: available,
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
