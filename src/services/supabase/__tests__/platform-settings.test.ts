import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  submitExpansionWaitlist,
  fetchVendorSettings,
  updateVendorSettings,
  fetchRiderSettings,
  updateRiderSettings,
  fetchCustomerPreferences,
  updateCustomerPreferences,
  DEFAULT_PLATFORM_SETTINGS,
} from '../platform-settings'
import { supabase } from '../client'

vi.mock('../client', () => {
  const mockRpc = vi.fn()
  const mockFrom = vi.fn()
  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
    },
  }
})

describe('Platform Settings & Preferences Service (Migration 36)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchPlatformSettings', () => {
    it('returns platform settings from database when row exists', async () => {
      const mockRow = {
        id: 'default',
        platform_commission_rate: 12.5,
        base_delivery_fee_ngn: 700,
        per_km_delivery_fee_ngn: 110,
        service_fee_ngn: 150,
        max_delivery_radius_km: 30,
        maintenance_mode: false,
        auto_dispatch_riders: true,
        surge_pricing_enabled: true,
        support_email: 'help@kingdomdash.com',
        emergency_hotline: '+234 800 000 0000',
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
      })

      const res = await fetchPlatformSettings()
      expect(res.error).toBeNull()
      expect(res.data.commissionPercent).toBe(12.5)
      expect(res.data.baseDeliveryFee).toBe(700)
      expect(res.data.supportEmail).toBe('help@kingdomdash.com')
    })

    it('returns default fallback settings if table read fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Table does not exist' } }),
      })

      const res = await fetchPlatformSettings()
      expect(res.data).toEqual(DEFAULT_PLATFORM_SETTINGS)
    })
  })

  describe('updatePlatformSettings', () => {
    it('calls update_platform_settings RPC with all parameters', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.rpc as any).mockResolvedValue({ data: { success: true }, error: null })

      const res = await updatePlatformSettings(DEFAULT_PLATFORM_SETTINGS)
      expect(supabase.rpc).toHaveBeenCalledWith(
        'update_platform_settings',
        expect.objectContaining({
          p_commission_rate: DEFAULT_PLATFORM_SETTINGS.commissionPercent,
          p_base_delivery_fee: DEFAULT_PLATFORM_SETTINGS.baseDeliveryFee,
        })
      )
      expect(res.success).toBe(true)
    })
  })

  describe('submitExpansionWaitlist', () => {
    it('calls submit_expansion_waitlist RPC with city and contact', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.rpc as any).mockResolvedValue({ data: { success: true, id: 'waitlist-123' }, error: null })

      const res = await submitExpansionWaitlist('Sagamu', '08012345678')
      expect(supabase.rpc).toHaveBeenCalledWith('submit_expansion_waitlist', {
        p_city: 'Sagamu',
        p_contact: '08012345678',
      })
      expect(res.success).toBe(true)
    })
  })

  describe('Vendor, Rider & Customer settings', () => {
    it('upserts vendor settings to vendor_settings table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from as any).mockReturnValue({
        upsert: mockUpsert,
      })

      const res = await updateVendorSettings('vendor-abc', { autoAcceptOrders: false, prepTimeMinutes: 35 })
      expect(supabase.from).toHaveBeenCalledWith('vendor_settings')
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          vendor_id: 'vendor-abc',
          auto_accept_orders: false,
          prep_time_minutes: 35,
        })
      )
      expect(res.success).toBe(true)
    })

    it('upserts rider settings to rider_settings table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from as any).mockReturnValue({
        upsert: mockUpsert,
      })

      const res = await updateRiderSettings('rider-123', { navigationApp: 'apple_maps', maxDeliveryRadiusKm: 20 })
      expect(supabase.from).toHaveBeenCalledWith('rider_settings')
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          rider_id: 'rider-123',
          navigation_app: 'apple_maps',
          max_delivery_radius_km: 20,
        })
      )
      expect(res.success).toBe(true)
    })

    it('upserts customer preferences to customer_preferences table', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from as any).mockReturnValue({
        upsert: mockUpsert,
      })

      const res = await updateCustomerPreferences('profile-456', { preferredDeliveryType: 'building_security' })
      expect(supabase.from).toHaveBeenCalledWith('customer_preferences')
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          profile_id: 'profile-456',
          preferred_delivery_type: 'building_security',
        })
      )
      expect(res.success).toBe(true)
    })

    it('fetches vendor settings with defaults when record missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      const res = await fetchVendorSettings('vendor-xyz')
      expect(res.data.autoAcceptOrders).toBe(true)
    })

    it('fetches rider settings with defaults when record missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      const res = await fetchRiderSettings('rider-xyz')
      expect(res.data.navigationApp).toBe('google_maps')
    })

    it('fetches customer preferences with defaults when record missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })

      const res = await fetchCustomerPreferences('profile-xyz')
      expect(res.data.preferredDeliveryType).toBe('doorstep')
    })
  })
})

