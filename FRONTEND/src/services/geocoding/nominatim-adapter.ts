import type { Coordinates } from '@/types'
import { isValidCoordinates } from '@/utils/geo'
import type { GeocodeOptions, GeocodeResult, GeocodingProvider } from './types'

/**
 * OpenStreetMap Nominatim Geocoding Adapter
 * 
 * Provides forward address search and reverse geocoding with:
 * - Nigeria country code scoping
 * - Southwestern Nigeria / Ijebu-Ode viewbox preference
 * - 8000ms default timeout enforcement via AbortSignal
 * - Resilient error handling (returns empty array / null on rate limit or network error)
 */
export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly name = 'nominatim'
  private readonly baseUrl: string
  private readonly userAgent: string

  constructor(
    baseUrl = 'https://nominatim.openstreetmap.org',
    userAgent = 'KingdomDash-LocationService/1.0 (Contact@kingdomdash.net)'
  ) {
    this.baseUrl = baseUrl
    this.userAgent = userAgent
  }

  /**
   * Forward geocoding: searches for candidates matching an address string
   */
  async forwardGeocode(
    query: string,
    options?: GeocodeOptions
  ): Promise<GeocodeResult[]> {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      return []
    }

    const limit = options?.limit ?? 5
    const countryCode = options?.countryCode ?? 'ng'

    const params = new URLSearchParams({
      q: trimmed,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit),
      countrycodes: countryCode,
    })

    // Bias search to Southwestern Nigeria / Ijebu-Ode corridor (minLon, minLat, maxLon, maxLat)
    if (options?.bounded !== false) {
      params.set('viewbox', '3.5,6.5,4.3,7.2')
      params.set('bounded', '0') // 0 = prefer inside viewbox, don't strictly exclude
    }

    const url = `${this.baseUrl}/search?${params.toString()}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const signal = options?.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[Nominatim] Rate limited (HTTP 429). Using fallback.')
        } else {
          console.warn(`[Nominatim] Geocoding request failed with status ${response.status}`)
        }
        return []
      }

      interface NominatimItem {
        lat: string
        lon: string
        display_name: string
        importance?: number
        address?: {
          road?: string
          pedestrian?: string
          suburb?: string
          neighbourhood?: string
          quarter?: string
          residential?: string
          city?: string
          town?: string
          village?: string
          county?: string
          state?: string
          country?: string
        }
      }

      const data = (await response.json()) as NominatimItem[]
      if (!Array.isArray(data)) {
        return []
      }

      return data.map((item) => {
        const lat = parseFloat(item.lat)
        const lon = parseFloat(item.lon)
        const addr = item.address || {}

        return {
          coordinates: { latitude: lat, longitude: lon },
          formattedAddress: item.display_name,
          streetName: addr.road || addr.pedestrian || undefined,
          neighborhood:
            addr.suburb ||
            addr.neighbourhood ||
            addr.quarter ||
            addr.residential ||
            undefined,
          city: addr.city || addr.town || addr.village || addr.county || 'Ijebu-Ode',
          state: addr.state || 'Ogun State',
          country: addr.country || 'Nigeria',
          confidence: typeof item.importance === 'number' ? item.importance : undefined,
          provider: this.name,
        }
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        // Intentionally aborted or timed out during debounced autocomplete
        console.debug('[Nominatim] Geocoding request was cancelled or timed out.')
      } else {
        console.warn('[Nominatim] Geocoding network error:', err)
      }
      return []
    }
  }

  /**
   * Reverse geocoding: returns structured address details for a coordinate pair
   */
  async reverseGeocode(
    coords: Coordinates,
    options?: GeocodeOptions
  ): Promise<GeocodeResult | null> {
    if (!isValidCoordinates(coords)) {
      return null
    }

    const params = new URLSearchParams({
      lat: String(coords.latitude),
      lon: String(coords.longitude),
      format: 'jsonv2',
      addressdetails: '1',
    })

    const url = `${this.baseUrl}/reverse?${params.toString()}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const signal = options?.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.warn(`[Nominatim] Reverse geocode failed with status ${response.status}`)
        return null
      }

      interface NominatimReverseItem {
        lat: string
        lon: string
        display_name: string
        address?: {
          road?: string
          pedestrian?: string
          suburb?: string
          neighbourhood?: string
          quarter?: string
          residential?: string
          city?: string
          town?: string
          village?: string
          county?: string
          state?: string
          country?: string
        }
      }

      const item = (await response.json()) as NominatimReverseItem
      if (!item || !item.lat || !item.lon) {
        return null
      }

      const addr = item.address || {}

      return {
        coordinates: {
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        },
        formattedAddress: item.display_name,
        streetName: addr.road || addr.pedestrian || undefined,
        neighborhood:
          addr.suburb ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.residential ||
          undefined,
        city: addr.city || addr.town || addr.village || addr.county || 'Ijebu-Ode',
        state: addr.state || 'Ogun State',
        country: addr.country || 'Nigeria',
        provider: this.name,
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        console.debug('[Nominatim] Reverse geocode was cancelled or timed out.')
      } else {
        console.warn('[Nominatim] Reverse geocode error:', err)
      }
      return null
    }
  }
}
