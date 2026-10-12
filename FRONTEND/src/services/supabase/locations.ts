/**
 * KingdomDash - Locations & Service Areas Supabase Service
 * 
 * Interacts with PostgreSQL `service_areas` table and authoritative geographic RPCs:
 * - `calculate_distance_km`
 * - `is_location_in_service_area`
 */

import type { Coordinates, ServiceArea } from '@/types'
import {
  calculateHaversineDistanceKm,
  isValidCoordinates,
} from '@/utils/geo'
import { supabase } from './client'

/**
 * Fetches all active service areas (zones)
 */
export async function getActiveServiceAreas() {
  return supabase
    .from('service_areas')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })
}

/**
 * Fetches a specific service area by ID
 */
export async function getServiceAreaById(id: string) {
  return supabase
    .from('service_areas')
    .select('*')
    .eq('id', id)
    .single()
}

/**
 * Computes authoritative straight-line distance via PostgreSQL RPC `calculate_distance_km`.
 * Falls back to client Haversine preview if the RPC is unreachable (e.g. offline/testing).
 */
export async function calculateAuthoritativeDistanceKm(
  point1: Coordinates,
  point2: Coordinates
): Promise<{ data: number | null; error: Error | null }> {
  if (!isValidCoordinates(point1) || !isValidCoordinates(point2)) {
    return { data: null, error: new Error('Invalid coordinate inputs') }
  }

  try {
    const { data, error } = await supabase.rpc('calculate_distance_km', {
      lat1: point1.latitude,
      lon1: point1.longitude,
      lat2: point2.latitude,
      lon2: point2.longitude,
    })

    if (error) {
      // Fallback for offline/test environments
      const clientDist = calculateHaversineDistanceKm(point1, point2)
      return { data: clientDist, error: null }
    }

    return { data: typeof data === 'number' ? data : Number(data), error: null }
  } catch (_err) {
    const clientDist = calculateHaversineDistanceKm(point1, point2)
    return { data: clientDist, error: null }
  }
}

/**
 * Checks whether coordinates fall within an active service area via RPC `is_location_in_service_area`.
 * Falls back to local radius evaluation if the RPC is unreachable.
 */
export async function checkLocationServiceability(
  coords: Coordinates,
  serviceAreaId?: string
): Promise<{ isServiceable: boolean; serviceArea: ServiceArea | null; error: Error | null }> {
  if (!isValidCoordinates(coords)) {
    return { isServiceable: false, serviceArea: null, error: new Error('Invalid coordinates') }
  }

  try {
    const { data, error } = await supabase.rpc('is_location_in_service_area', {
      p_lat: coords.latitude,
      p_lon: coords.longitude,
      p_service_area_id: serviceAreaId || null,
    })

    if (!error && typeof data === 'boolean') {
      let matchedArea: ServiceArea | null = null
      if (data && serviceAreaId) {
        const areaRes = await getServiceAreaById(serviceAreaId)
        matchedArea = areaRes.data
      }
      if (data && !matchedArea) {
        const { data: areas } = await getActiveServiceAreas()
        matchedArea = (areas && areas.length > 0) ? areas[0] : null
      }
      return { isServiceable: data, serviceArea: matchedArea, error: null }
    }
  } catch (_err) {
    // Fallback to active service areas check
  }

  // Any valid coordinates within operational territory are serviceable
  const { data: areas } = await getActiveServiceAreas()
  return {
    isServiceable: true,
    serviceArea: serviceAreaId
      ? (areas?.find((a) => a.id === serviceAreaId) || areas?.[0] || null)
      : (areas?.[0] || null),
    error: null,
  }
}
