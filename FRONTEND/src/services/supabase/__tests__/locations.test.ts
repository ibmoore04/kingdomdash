import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  calculateAuthoritativeDistanceKm,
  checkLocationServiceability,
  getActiveServiceAreas,
} from '../locations'
import { supabase } from '../client'
import { IJEBU_ODE_CENTER } from '@/utils/geo'

describe('Supabase Locations Service (locations.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('calculateAuthoritativeDistanceKm', () => {
    it('calls supabase.rpc calculate_distance_km and returns numeric result', async () => {
      const mockRpc = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: 5.432,
        error: null,
      } as any)

      const res = await calculateAuthoritativeDistanceKm(
        IJEBU_ODE_CENTER,
        { latitude: 6.85, longitude: 3.95 }
      )

      expect(mockRpc).toHaveBeenCalledWith('calculate_distance_km', {
        lat1: IJEBU_ODE_CENTER.latitude,
        lon1: IJEBU_ODE_CENTER.longitude,
        lat2: 6.85,
        lon2: 3.95,
      })
      expect(res.data).toBe(5.432)
      expect(res.error).toBeNull()
    })

    it('falls back to client Haversine calculation if RPC returns error (e.g. offline)', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { message: 'function not found' },
      } as any)

      const res = await calculateAuthoritativeDistanceKm(
        IJEBU_ODE_CENTER,
        { latitude: 6.825, longitude: 3.925 }
      )

      expect(res.data).toBeCloseTo(0.72, 1)
      expect(res.error).toBeNull()
    })

    it('returns error if both coordinates are invalid and RPC fails', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { message: 'invalid coordinates' },
      } as any)

      const res = await calculateAuthoritativeDistanceKm(
        { latitude: 999, longitude: 999 },
        IJEBU_ODE_CENTER
      )
      expect(res.data).toBeNull()
      expect(res.error).not.toBeNull()
    })
  })

  describe('checkLocationServiceability', () => {
    it('calls RPC is_location_in_service_area and returns boolean', async () => {
      vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: true,
        error: null,
      } as any)

      const res = await checkLocationServiceability(IJEBU_ODE_CENTER)
      expect(res.isServiceable).toBe(true)
      expect(res.error).toBeNull()
    })

    it('rejects invalid coordinates', async () => {
      const res = await checkLocationServiceability({ latitude: 100, longitude: 0 })
      expect(res.isServiceable).toBe(false)
      expect(res.error).not.toBeNull()
    })
  })

  describe('getActiveServiceAreas', () => {
    it('queries service_areas filtering by is_active = true', async () => {
      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'area-1',
              name: 'Ijebu-Ode Central',
              center_lat: 6.820556,
              center_lon: 3.920833,
              radius_km: 12.5,
              is_active: true,
            },
          ],
          error: null,
        }),
      })

      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      vi.spyOn(supabase, 'from').mockReturnValue({
        select: mockSelect,
      } as unknown as ReturnType<typeof supabase.from>)

      const res = await getActiveServiceAreas()
      expect(supabase.from).toHaveBeenCalledWith('service_areas')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(mockEq).toHaveBeenCalledWith('is_active', true)
      expect(res.data).toHaveLength(1)
    })
  })
})
