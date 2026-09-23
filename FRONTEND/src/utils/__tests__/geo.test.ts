import { describe, expect, it } from 'vitest'
import {
  calculateHaversineDistanceKm,
  formatCoordinates,
  formatDistanceKm,
  IJEBU_ODE_CENTER,
  isValidCoordinates,
  isValidLatitude,
  isValidLongitude,
  isWithinRadiusKm,
} from '../geo'

describe('Geographic Utilities (geo.ts)', () => {
  describe('Coordinate Validation', () => {
    it('validates latitudes within [-90, 90]', () => {
      expect(isValidLatitude(0)).toBe(true)
      expect(isValidLatitude(6.820556)).toBe(true)
      expect(isValidLatitude(90)).toBe(true)
      expect(isValidLatitude(-90)).toBe(true)
      expect(isValidLatitude(90.001)).toBe(false)
      expect(isValidLatitude(-90.1)).toBe(false)
      expect(isValidLatitude(NaN)).toBe(false)
      expect(isValidLatitude(Infinity)).toBe(false)
      expect(isValidLatitude('6.8')).toBe(false)
      expect(isValidLatitude(null)).toBe(false)
    })

    it('validates longitudes within [-180, 180]', () => {
      expect(isValidLongitude(0)).toBe(true)
      expect(isValidLongitude(3.920833)).toBe(true)
      expect(isValidLongitude(180)).toBe(true)
      expect(isValidLongitude(-180)).toBe(true)
      expect(isValidLongitude(180.001)).toBe(false)
      expect(isValidLongitude(-180.1)).toBe(false)
      expect(isValidLongitude(NaN)).toBe(false)
      expect(isValidLongitude(Infinity)).toBe(false)
      expect(isValidLongitude('3.9')).toBe(false)
      expect(isValidLongitude(undefined)).toBe(false)
    })

    it('validates coordinate pairs correctly', () => {
      expect(isValidCoordinates({ latitude: 6.820556, longitude: 3.920833 })).toBe(true)
      expect(isValidCoordinates({ latitude: -91, longitude: 3.92 })).toBe(false)
      expect(isValidCoordinates({ latitude: 6.82, longitude: 181 })).toBe(false)
      expect(isValidCoordinates(null)).toBe(false)
      expect(isValidCoordinates({})).toBe(false)
      expect(isValidCoordinates({ latitude: 6.82 })).toBe(false)
    })
  })

  describe('Haversine Distance Calculation', () => {
    it('returns 0 for identical points', () => {
      const dist = calculateHaversineDistanceKm(IJEBU_ODE_CENTER, IJEBU_ODE_CENTER)
      expect(dist).toBe(0)
    })

    it('calculates known distance accurately (Ijebu-Ode to Lagos ~70-75 km)', () => {
      const lagosCenter = { latitude: 6.5244, longitude: 3.3792 }
      const dist = calculateHaversineDistanceKm(IJEBU_ODE_CENTER, lagosCenter)
      // Straight-line distance between Ijebu-Ode and Lagos center is approx 67 - 70 km
      expect(dist).toBeGreaterThan(60)
      expect(dist).toBeLessThan(75)
    })

    it('calculates short distance within Ijebu-Ode correctly', () => {
      // Degun to Awujale Palace (~2 km)
      const degun = { latitude: 6.818, longitude: 3.910 }
      const awujale = { latitude: 6.825, longitude: 3.925 }
      const dist = calculateHaversineDistanceKm(degun, awujale)
      expect(dist).toBeGreaterThan(1.5)
      expect(dist).toBeLessThan(2.5)
    })

    it('throws error on invalid coordinates', () => {
      expect(() =>
        calculateHaversineDistanceKm(
          { latitude: 100, longitude: 0 },
          { latitude: 0, longitude: 0 }
        )
      ).toThrow()
    })
  })

  describe('Service Area Radius Check', () => {
    it('returns true when point is within radius', () => {
      const nearbyPoint = { latitude: 6.821, longitude: 3.921 }
      expect(isWithinRadiusKm(nearbyPoint, IJEBU_ODE_CENTER, 12.5)).toBe(true)
    })

    it('returns false when point is far outside radius', () => {
      const abeokuta = { latitude: 7.1475, longitude: 3.3619 }
      expect(isWithinRadiusKm(abeokuta, IJEBU_ODE_CENTER, 12.5)).toBe(false)
    })

    it('returns false on invalid inputs or non-positive radius', () => {
      expect(isWithinRadiusKm(IJEBU_ODE_CENTER, IJEBU_ODE_CENTER, 0)).toBe(false)
      expect(isWithinRadiusKm(IJEBU_ODE_CENTER, IJEBU_ODE_CENTER, -5)).toBe(false)
    })
  })

  describe('Formatting Utilities', () => {
    it('formats coordinates with cardinal directions', () => {
      expect(formatCoordinates({ latitude: 6.820556, longitude: 3.920833 })).toBe(
        '6.8206° N, 3.9208° E'
      )
      expect(formatCoordinates({ latitude: -12.3456, longitude: -45.6789 })).toBe(
        '12.3456° S, 45.6789° W'
      )
    })

    it('handles invalid coordinates gracefully in formatCoordinates', () => {
      expect(formatCoordinates({ latitude: 100, longitude: 0 })).toBe('Invalid Coordinates')
    })

    it('formats distances cleanly in meters and kilometers', () => {
      expect(formatDistanceKm(0.35)).toBe('350 m')
      expect(formatDistanceKm(0.05)).toBe('50 m')
      expect(formatDistanceKm(1.24)).toBe('1.2 km')
      expect(formatDistanceKm(15.78)).toBe('15.8 km')
      expect(formatDistanceKm(-1)).toBe('0 m')
    })
  })
})
