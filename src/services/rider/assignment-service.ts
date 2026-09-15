import { supabase } from '@/services/supabase/client'
import type { AssignmentInboxOffer } from '@/types/rider'
import { mapRiderRpcError } from './error-mapper'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getRiderAssignmentInbox(): Promise<{
  data: AssignmentInboxOffer[]
  error: Error | null
}> {
  try {
    const { data, error } = await db.rpc('get_rider_assignment_inbox')
    if (error) {
      return { data: [], error: new Error(mapRiderRpcError(error)) }
    }
    return { data: (data || []) as AssignmentInboxOffer[], error: null }
  } catch (err) {
    return {
      data: [],
      error: new Error(mapRiderRpcError(err)),
    }
  }
}

export async function acceptDeliveryAssignment(assignmentId: string): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const { error } = await db.rpc('accept_delivery_assignment', {
      p_assignment_id: assignmentId,
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

export async function rejectDeliveryAssignment(
  assignmentId: string,
  reason?: string
): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const { error } = await db.rpc('reject_delivery_assignment', {
      p_assignment_id: assignmentId,
      p_reason: reason || null,
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
