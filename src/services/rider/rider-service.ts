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

export async function updateRiderContactInfo(
  phone: string,
  whatsappNumber?: string | null
): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const cleanPhone = phone.trim()
    const cleanWa = (whatsappNumber && whatsappNumber.trim()) || cleanPhone

    // 1. Try authoritative RPC
    const { error: rpcError } = await db.rpc('update_rider_contact_info', {
      p_phone: cleanPhone,
      p_whatsapp_number: cleanWa,
    })

    if (!rpcError) {
      return { success: true, error: null }
    }

    // 2. Direct fallback update to profiles & riders
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id
    if (userId) {
      await db
        .from('profiles')
        .update({ phone: cleanPhone, whatsapp_number: cleanWa })
        .eq('id', userId)

      await db
        .from('riders')
        .update({ whatsapp_number: cleanWa })
        .eq('profile_id', userId)
    }

    return { success: true, error: null }
  } catch (err) {
    return {
      success: false,
      error: new Error(mapRiderRpcError(err)),
    }
  }
}
