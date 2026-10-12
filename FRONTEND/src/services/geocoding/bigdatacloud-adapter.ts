import type { Coordinates } from '@/types'
import { isValidCoordinates } from '@/utils/geo'
import type { GeocodeOptions, GeocodeResult, GeocodingProvider } from './types'

/**
 * BigDataCloud Free Client Reverse Geocoding Adapter
 * 
 * Free client-side reverse geocoding endpoint requiring NO API key.
 * Resolves locality, city, state/subdivision, and country dynamically
 * in under 300ms directly in the user's browser without circular radius math.
 */
export class BigDataCloudGeocodingProvider implements GeocodingProvider {
  readonly name = 'bigdatacloud'
  private readonly fallbackProvider?: GeocodingProvider

  constructor(fallbackProvider?: GeocodingProvider) {
    this.fallbackProvider = fallbackProvider
  }

  async forwardGeocode(query: string, options?: GeocodeOptions): Promise<GeocodeResult[]> {
    if (this.fallbackProvider) {
      return this.fallbackProvider.forwardGeocode(query, options)
    }
    return []
  }

  async reverseGeocode(coords: Coordinates, options?: GeocodeOptions): Promise<GeocodeResult | null> {
    if (!isValidCoordinates(coords)) return null

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)
      const signal = options?.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal

      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        coords.latitude
      )}&longitude=${encodeURIComponent(coords.longitude)}&localityLanguage=en`

      const res = await fetch(url, { signal })
      clearTimeout(timeoutId)

      if (!res.ok) {
        if (this.fallbackProvider) {
          return this.fallbackProvider.reverseGeocode(coords, options)
        }
        return null
      }

      interface BigDataCloudResponse {
        locality?: string
        city?: string
        principalSubdivision?: string
        countryName?: string
        localityInfo?: {
          administrative?: Array<{
            name?: string
            adminLevel?: number
            description?: string
          }>
        }
      }

      const data = (await res.json()) as BigDataCloudResponse
      if (!data) return null

      const locality = (data.locality || '').trim()
      const city = (data.city || data.locality || '').trim()
      const state = (data.principalSubdivision || '').trim()
      const country = (data.countryName || 'Nigeria').trim()

      const parts = [locality, city !== locality ? city : null, state, country].filter(Boolean)
      const formattedAddress = parts.join(', ')

      return {
        coordinates: coords,
        formattedAddress,
        streetName: locality || undefined,
        neighborhood: locality || undefined,
        city: city || locality,
        state,
        country,
        provider: this.name,
      }
    } catch {
      if (this.fallbackProvider) {
        return this.fallbackProvider.reverseGeocode(coords, options)
      }
      return null
    }
  }
}
