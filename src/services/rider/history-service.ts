import { supabase } from '@/services/supabase/client'
import type { CompletedDeliveryHistoryItem } from '@/types/rider'
import { mapRiderRpcError } from './error-mapper'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getRiderDeliveryHistory(
  limit: number = 20,
  offset: number = 0
): Promise<{
  data: CompletedDeliveryHistoryItem[]
  error: Error | null
}> {
  try {
    const { data, error } = await db.rpc('get_rider_delivery_history', {
      p_limit: limit,
      p_offset: offset,
    })
    if (error) {
      return { data: [], error: new Error(mapRiderRpcError(error)) }
    }
    return {
      data: (data || []) as CompletedDeliveryHistoryItem[],
      error: null,
    }
  } catch (err) {
    return {
      data: [],
      error: new Error(mapRiderRpcError(err)),
    }
  }
}
