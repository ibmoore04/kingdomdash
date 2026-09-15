import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getGeocodingProvider,
  MockGeocodingProvider,
  NominatimGeocodingProvider,
  setGeocodingProvider,
} from '../index'

describe('Geocoding Provider Layer', () => {
  afterEach(() => {
    setGeocodingProvider(null)
    vi.restoreAllMocks()
  })

  describe('MockGeocodingProvider', () => {
    const mock = new MockGeocodingProvider()

    it('returns candidate matches for known landmarks in Ijebu-Ode', async () => {
      const results = await mock.forwardGeocode('Awujale Palace')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].city).toBe('Ijebu-Ode')
      expect(results[0].coordinates.latitude).toBeCloseTo(6.825, 2)
      expect(results[0].coordinates.longitude).toBeCloseTo(3.925, 2)
    })

    it('returns empty array for empty or short queries', async () => {
      expect(await mock.forwardGeocode('')).toEqual([])
      expect(await mock.forwardGeocode(' a ')).toEqual([])
    })

    it('respects the limit option', async () => {
      const results = await mock.forwardGeocode('Ijebu', { limit: 1 })
      expect(results.length).toBe(1)
    })

    it('performs reverse geocoding for coordinates', async () => {
      const result = await mock.reverseGeocode({ latitude: 6.825, longitude: 3.925 })
      expect(result).not.toBeNull()
      expect(result?.city).toBe('Ijebu-Ode')
      expect(result?.provider).toBe('mock')
    })

    it('returns null on invalid coordinates during reverse geocoding', async () => {
      const result = await mock.reverseGeocode({ latitude: 95, longitude: 0 })
      expect(result).toBeNull()
    })
  })

  describe('NominatimGeocodingProvider', () => {
    let provider: NominatimGeocodingProvider

    beforeEach(() => {
      provider = new NominatimGeocodingProvider('https://mock-nominatim.test')
    })

    it('maps successful API responses into GeocodeResult objects', async () => {
      const mockApiResponse = [
        {
          lat: '6.820556',
          lon: '3.920833',
          display_name: 'Ijebu-Ode, Ogun State, Nigeria',
          importance: 0.85,
          address: {
            city: 'Ijebu-Ode',
            state: 'Ogun State',
            country: 'Nigeria',
            road: 'Awujale Street',
          },
        },
      ]

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)

      const results = await provider.forwardGeocode('Awujale')
      expect(results).toHaveLength(1)
      expect(results[0].coordinates.latitude).toBe(6.820556)
      expect(results[0].coordinates.longitude).toBe(3.920833)
      expect(results[0].streetName).toBe('Awujale Street')
      expect(results[0].city).toBe('Ijebu-Ode')
      expect(results[0].provider).toBe('nominatim')
    })

    it('handles HTTP 429 rate limit gracefully without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response)

      const results = await provider.forwardGeocode('Ijebu-Ode')
      expect(results).toEqual([])
    })

    it('handles network error gracefully without throwing', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      const results = await provider.forwardGeocode('Ijebu-Ode')
      expect(results).toEqual([])
    })

    it('reverse geocodes coordinates properly', async () => {
      const mockReverse = {
        lat: '6.822000',
        lon: '3.918000',
        display_name: 'Folagbade Street, Ijebu-Ode, Ogun State, Nigeria',
        address: {
          road: 'Folagbade Street',
          city: 'Ijebu-Ode',
          state: 'Ogun State',
          country: 'Nigeria',
        },
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockReverse,
      } as Response)

      const result = await provider.reverseGeocode({ latitude: 6.822, longitude: 3.918 })
      expect(result).not.toBeNull()
      expect(result?.streetName).toBe('Folagbade Street')
      expect(result?.city).toBe('Ijebu-Ode')
      expect(result?.provider).toBe('nominatim')
    })
  })

  describe('Provider Factory & Switching', () => {
    it('returns default mock provider in test environment', () => {
      const provider = getGeocodingProvider()
      expect(provider.name).toBe('mock')
    })

    it('allows overriding provider instance', () => {
      const custom = new NominatimGeocodingProvider()
      setGeocodingProvider(custom)
      expect(getGeocodingProvider().name).toBe('nominatim')
    })
  })
})
