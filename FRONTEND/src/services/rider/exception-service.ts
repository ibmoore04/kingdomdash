import { supabase } from '@/services/supabase/client'
import type { OperationalIssueType } from '@/types/rider'
import { mapRiderRpcError } from './error-mapper'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function reportDeliveryIssue(
  deliveryId: string,
  issueType: OperationalIssueType,
  notes: string
): Promise<{
  success: boolean
  error: Error | null
}> {
  try {
    const { error } = await db.rpc('report_delivery_issue', {
      p_delivery_id: deliveryId,
      p_issue_type: issueType,
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
