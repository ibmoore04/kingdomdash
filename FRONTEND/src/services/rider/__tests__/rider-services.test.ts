import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/services/supabase/client'
import {
  getRiderOperationalProfile,
  updateRiderAvailability,
} from '../rider-service'
import {
  getRiderAssignmentInbox,
  acceptDeliveryAssignment,
  rejectDeliveryAssignment,
} from '../assignment-service'
import {
  getRiderActiveDelivery,
  markDeliveryPickedUp,
  markDeliveryInTransit,
  markDeliveryDelivered,
} from '../custody-service'
import { reportDeliveryIssue } from '../exception-service'
import { getRiderDeliveryHistory } from '../history-service'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

describe('Rider Service Layer Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rider-service', () => {
    it('getRiderOperationalProfile returns profile on success', async () => {
      const mockProfile = {
        id: 'rider-1',
        profile_id: 'user-1',
        vehicle_type: 'motorcycle',
        rating: 4.95,
        total_deliveries: 42,
        is_available: true,
        is_verified: true,
        is_active: true,
      }
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: mockProfile, error: null } as any)

      const res = await getRiderOperationalProfile()
      expect(supabase.rpc).toHaveBeenCalledWith('get_rider_operational_profile')
      expect(res.data).toEqual(mockProfile)
      expect(res.error).toBeNull()
    })

    it('updateRiderAvailability executes update_rider_availability RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any)

      const res = await updateRiderAvailability(true)
      expect(supabase.rpc).toHaveBeenCalledWith('update_rider_availability', {
        p_is_available: true,
      })
      expect(res.success).toBe(true)
      expect(res.error).toBeNull()
    })

    it('updateRiderAvailability handles unverified error KD403', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { code: 'KD403', message: 'Rider is not verified or active' },
      } as any)

      const res = await updateRiderAvailability(true)
      expect(res.success).toBe(false)
      expect(res.error?.message).toContain('not yet verified or has been suspended')
    })
  })

  describe('assignment-service', () => {
    it('getRiderAssignmentInbox returns privacy-safe inbox items', async () => {
      const mockInbox = [
        {
          assignment_id: 'assign-1',
          delivery_id: 'del-1',
          service_type: 'food',
          pickup_address: '14 Folagbade St',
          delivery_area: 'Molipa',
          estimated_distance_km: 3.5,
          vendor_name: 'Mama Put',
          status: 'assigned',
          assigned_at: '2026-09-06T12:00:00Z',
        },
      ]
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: mockInbox, error: null } as any)

      const res = await getRiderAssignmentInbox()
      expect(supabase.rpc).toHaveBeenCalledWith('get_rider_assignment_inbox')
      expect(res.data).toHaveLength(1)
      expect(res.data[0].delivery_area).toBe('Molipa')
      // Pre-acceptance privacy guarantee: no customer PII returned
      expect((res.data[0] as any).customer_phone).toBeUndefined()
      expect((res.data[0] as any).customer_name).toBeUndefined()
    })

    it('acceptDeliveryAssignment calls accept_delivery_assignment RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any)

      const res = await acceptDeliveryAssignment('assign-1')
      expect(supabase.rpc).toHaveBeenCalledWith('accept_delivery_assignment', {
        p_assignment_id: 'assign-1',
      })
      expect(res.success).toBe(true)
    })

    it('rejectDeliveryAssignment calls reject_delivery_assignment RPC with reason', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any)

      const res = await rejectDeliveryAssignment('assign-1', 'too_far')
      expect(supabase.rpc).toHaveBeenCalledWith('reject_delivery_assignment', {
        p_assignment_id: 'assign-1',
        p_reason: 'too_far',
      })
      expect(res.success).toBe(true)
    })
  })

  describe('custody-service', () => {
    it('getRiderActiveDelivery returns active delivery with full unmasked details', async () => {
      const mockActive = {
        delivery_id: 'del-1',
        assignment_id: 'assign-1',
        service_type: 'food',
        delivery_status: 'assigned',
        assignment_status: 'accepted',
        order_status: 'ready_for_pickup',
        customer_name: 'Adekunle Gold',
        customer_phone: '+2348012345678',
        delivery_address: '10 Obalende Way, Ijebu-Ode',
        items: [{ id: 'item-1', product_name: 'Jollof Rice', quantity: 2 }],
      }
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: mockActive, error: null } as any)

      const res = await getRiderActiveDelivery()
      expect(supabase.rpc).toHaveBeenCalledWith('get_rider_active_delivery')
      expect(res.data?.customer_name).toBe('Adekunle Gold')
      expect(res.data?.customer_phone).toBe('+2348012345678')
    })

    it('markDeliveryPickedUp calls mark_delivery_picked_up RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any)

      const res = await markDeliveryPickedUp('del-1', 'Order packed well')
      expect(supabase.rpc).toHaveBeenCalledWith('mark_delivery_picked_up', {
        p_delivery_id: 'del-1',
        p_notes: 'Order packed well',
      })
      expect(res.success).toBe(true)
    })

    it('markDeliveryInTransit calls mark_delivery_in_transit RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any)

      const res = await markDeliveryInTransit('del-1')
      expect(supabase.rpc).toHaveBeenCalledWith('mark_delivery_in_transit', {
        p_delivery_id: 'del-1',
        p_notes: null,
      })
      expect(res.success).toBe(true)
    })

    it('markDeliveryDelivered calls mark_delivery_delivered RPC with optional pin', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any)

      const res = await markDeliveryDelivered('del-1', 'Handed to customer', '4921')
      expect(supabase.rpc).toHaveBeenCalledWith('mark_delivery_delivered', {
        p_delivery_id: 'del-1',
        p_notes: 'Handed to customer',
        p_pin: '4921',
      })
      expect(res.success).toBe(true)
    })
  })

  describe('exception-service', () => {
    it('reportDeliveryIssue calls report_delivery_issue RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any)

      const res = await reportDeliveryIssue('del-1', 'customer_unreachable', 'Gate locked')
      expect(supabase.rpc).toHaveBeenCalledWith('report_delivery_issue', {
        p_delivery_id: 'del-1',
        p_issue_type: 'customer_unreachable',
        p_notes: 'Gate locked',
      })
      expect(res.success).toBe(true)
    })
  })

  describe('history-service', () => {
    it('getRiderDeliveryHistory calls get_rider_delivery_history RPC', async () => {
      const mockHistory = [
        {
          assignment_id: 'assign-1',
          delivery_id: 'del-1',
          order_id: 'order-1',
          service_type: 'food',
          vendor_name: 'Mama Put',
          pickup_area: 'Folagbade',
          delivery_area: 'Molipa',
          delivered_at: '2026-09-05T14:30:00Z',
          assignment_status: 'completed',
          delivery_status: 'delivered',
        },
      ]
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: mockHistory, error: null } as any)

      const res = await getRiderDeliveryHistory(25, 0)
      expect(supabase.rpc).toHaveBeenCalledWith('get_rider_delivery_history', {
        p_limit: 25,
        p_offset: 0,
      })
      expect(res.data).toEqual(mockHistory)
    })
  })
})
