import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDeliveryFeePreview } from '../pricing'
import { supabase } from '../client'

vi.mock('../client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

describe('Pricing Service (src/services/supabase/pricing.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to calculate_delivery_fee_preview RPC with exact parameters', async () => {
    const mockResponse = {
      is_serviceable: true,
      distance_km: 4.25,
      base_fee: 500,
      distance_rate: 100,
      min_fee: null,
      max_fee: null,
      raw_fee: 925,
      delivery_fee: 925,
      pricing_tier: 4,
      pricing_rule_id: 'rule-uuid-1',
      service_area_id: 'area-uuid-1',
      service_area_name: 'Ijebu-Ode Central',
    }

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockResponse,
      error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await getDeliveryFeePreview({
      vendorId: 'vendor-uuid-1',
      deliveryAddressId: 'addr-uuid-1',
      serviceType: 'food',
    })

    expect(supabase.rpc).toHaveBeenCalledWith('calculate_delivery_fee_preview', {
      p_vendor_id: 'vendor-uuid-1',
      p_delivery_address_id: 'addr-uuid-1',
      p_service_type: 'food',
    })
    expect(result.error).toBeNull()
    expect(result.data).toEqual(mockResponse)
    expect(result.data?.delivery_fee).toBe(925)
    expect(result.data?.is_serviceable).toBe(true)
  })

  it('handles unserviceable address response from database cleanly', async () => {
    const unserviceableResponse = {
      is_serviceable: false,
      distance_km: 18.5,
      delivery_fee: null,
      error: 'Delivery address is outside the active service area',
    }

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: unserviceableResponse,
      error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await getDeliveryFeePreview({
      vendorId: 'vendor-uuid-1',
      deliveryAddressId: 'addr-uuid-outside',
      serviceType: 'grocery',
    })

    expect(result.error).toBeNull()
    expect(result.data?.is_serviceable).toBe(false)
    expect(result.data?.delivery_fee).toBeNull()
    expect(result.data?.error).toContain('outside the active service area')
  })

  it('returns { data: null, error } when RPC returns an error', async () => {
    const rpcError = { message: 'Address not found or does not belong to the current customer' }

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: rpcError,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await getDeliveryFeePreview({
      vendorId: 'vendor-uuid-1',
      deliveryAddressId: 'addr-uuid-forbidden',
      serviceType: 'food',
    })

    expect(result.data).toBeNull()
    expect(result.error).toEqual(rpcError)
  })

  it('safely catches unexpected throws without inventing client-side fallback fee', async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('Network transport failure'))

    const result = await getDeliveryFeePreview({
      vendorId: 'vendor-uuid-1',
      deliveryAddressId: 'addr-uuid-1',
      serviceType: 'food',
    })

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(Error)
    expect((result.error as Error).message).toBe('Network transport failure')
  })
})
