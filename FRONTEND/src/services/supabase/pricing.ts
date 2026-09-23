import { supabase } from './client'
import type { DeliveryFeePreviewResult } from '@/types'

export interface GetDeliveryFeePreviewParams {
  vendorId: string
  deliveryAddressId: string
  serviceType: 'food' | 'grocery'
}

/**
 * Request server-authoritative delivery fee preview from PostgreSQL.
 *
 * Calls the `calculate_delivery_fee_preview` SECURITY DEFINER RPC installed in Migration 018.
 * The database independently validates customer address ownership, service area
 * point-in-radius containment, vendor coordinates, geodesic straight-line distance,
 * and resolves the deterministic 4-tier pricing rule.
 *
 * ZERO CLIENT FINANCIAL AUTHORITY INVARIANT:
 * This preview is strictly informational for the UI. No client-side pricing fallback
 * is used to calculate an authoritative fee. The real delivery fee is computed
 * and snapshotted by `create_order_secure()` inside the PostgreSQL order transaction.
 */
export async function getDeliveryFeePreview(
  params: GetDeliveryFeePreviewParams
): Promise<{ data: DeliveryFeePreviewResult | null; error: unknown }> {
  try {
    const { data, error } = await supabase.rpc('calculate_delivery_fee_preview', {
      p_vendor_id: params.vendorId,
      p_delivery_address_id: params.deliveryAddressId,
      p_service_type: params.serviceType,
    })

    if (error) {
      return { data: null, error }
    }

    const preview = data as unknown as DeliveryFeePreviewResult
    return { data: preview, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to compute delivery fee preview'),
    }
  }
}
