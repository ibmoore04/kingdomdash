/**
 * KingdomDash - Geographic Domain Utilities & Calculations
 * 
 * Provides client-side coordinate validation, formatting, and geodesic
 * distance previews.
 * 
 * NOTE: Client-side distance calculations are for UI estimation/preview only.
 * The PostgreSQL function `public.calculate_distance_km` is the sole
 * authoritative source for order pricing and backend verification.
 */

import type { Coordinates } from '@/types'

/**
 * Ijebu-Ode Municipal Center (Launch Market Reference Point)
 * Configurable launch seed point - Awujale / Central Ijebu-Ode
 */
export const IJEBU_ODE_CENTER: Readonly<Coordinates> = Object.freeze({
  latitude: 6.820556,
  longitude: 3.920833,
})

/** Default radius for Ijebu-Ode Central service area in km */
export const DEFAULT_SERVICE_RADIUS_KM = 12.5

/** Nigeria Bounding Box for Geocoding viewbox filtering */
export const NIGERIA_BOUNDS = Object.freeze({
  minLat: 4.0,
  maxLat: 14.0,
  minLon: 2.5,
  maxLon: 15.0,
})

/** Mean radius of the Earth in kilometers (WGS84 spherical model) */
export const EARTH_RADIUS_KM = 6371.009

/**
 * Validates whether a number is a valid latitude in degrees [-90.0, 90.0]
 */
export function isValidLatitude(lat: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90.0 && lat <= 90.0
}

/**
 * Validates whether a number is a valid longitude in degrees [-180.0, 180.0]
 */
export function isValidLongitude(lon: unknown): lon is number {
  return typeof lon === 'number' && Number.isFinite(lon) && lon >= -180.0 && lon <= 180.0
}

/**
 * Validates whether an object contains valid latitude and longitude coordinates
 */
export function isValidCoordinates(coords: unknown): coords is Coordinates {
  if (!coords || typeof coords !== 'object') {
    return false
  }
  const candidate = coords as Partial<Coordinates>
  return isValidLatitude(candidate.latitude) && isValidLongitude(candidate.longitude)
}

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180.0
}

/**
 * Computes straight-line (geodesic) distance in kilometers between two coordinates
 * using the Haversine formula on a spherical earth (R = 6,371.009 km).
 * 
 * NOTE: For UI preview only. PostgreSQL `calculate_distance_km` is authoritative.
 */
export function calculateHaversineDistanceKm(
  point1: Coordinates,
  point2: Coordinates
): number {
  if (!isValidCoordinates(point1) || !isValidCoordinates(point2)) {
    throw new Error('Invalid coordinates provided to calculateHaversineDistanceKm')
  }

  if (point1.latitude === point2.latitude && point1.longitude === point2.longitude) {
    return 0.0
  }

  const dLat = toRadians(point2.latitude - point1.latitude)
  const dLon = toRadians(point2.longitude - point1.longitude)
  const lat1Rad = toRadians(point1.latitude)
  const lat2Rad = toRadians(point2.latitude)

  const a =
    Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0)

  // Guard against float precision drift exceeding 1.0
  const clampedA = Math.min(1.0, Math.max(0.0, a))
  const c = 2.0 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(Math.max(0.0, 1.0 - clampedA)))
  const dist = EARTH_RADIUS_KM * c

  // Return rounded to 3 decimal places (meter precision)
  return Math.round(dist * 1000) / 1000
}

/**
 * Checks if a coordinate point is within a circular radius of a center coordinate
 */
export function isWithinRadiusKm(
  point: Coordinates,
  center: Coordinates,
  radiusKm: number
): boolean {
  if (!isValidCoordinates(point) || !isValidCoordinates(center) || radiusKm <= 0) {
    return false
  }
  const distance = calculateHaversineDistanceKm(point, center)
  return distance <= radiusKm
}

/**
 * Formats coordinates for display (e.g. "6.8206° N, 3.9208° E")
 */
export function formatCoordinates(coords: Coordinates, precision = 4): string {
  if (!isValidCoordinates(coords)) {
    return 'Invalid Coordinates'
  }

  const latDir = coords.latitude >= 0 ? 'N' : 'S'
  const lonDir = coords.longitude >= 0 ? 'E' : 'W'
  const latVal = Math.abs(coords.latitude).toFixed(precision)
  const lonVal = Math.abs(coords.longitude).toFixed(precision)

  return `${latVal}° ${latDir}, ${lonVal}° ${lonDir}`
}

/**
 * Formats a distance in kilometers for human-friendly UI display
 * - If >= 1 km: e.g. "3.2 km"
 * - If < 1 km: e.g. "450 m"
 */
export function formatDistanceKm(distanceKm: number): string {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return '0 m'
  }

  if (distanceKm >= 1.0) {
    return `${distanceKm.toFixed(1)} km`
  }

  const meters = Math.round(distanceKm * 1000)
  return `${meters} m`
}
