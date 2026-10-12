import type { Coordinates } from '@/types'
import { isValidCoordinates } from '@/utils/geo'
import type { GeocodeOptions, GeocodeResult, GeocodingProvider } from './types'
import { NominatimGeocodingProvider } from './nominatim-adapter'
import { loadGoogleMapsScript } from '@/services/maps/google-maps-loader'

/**
 * Google Maps Geocoding Provider
 * 
 * Authoritative client-side geocoding backed by the Google Maps JavaScript API Geocoder.
 * Dynamically resolves real human-readable street names, cities, and states
 * (e.g. "Mobalufon Street, Ijebu-Ode, Ogun State") without arbitrary coordinate numbers.
 */
export class GoogleGeocodingProvider implements GeocodingProvider {
  readonly name = 'google'
  private readonly fallbackProvider: GeocodingProvider

  constructor(fallbackProvider?: GeocodingProvider) {
    this.fallbackProvider = fallbackProvider || new NominatimGeocodingProvider()
  }

  private async ensureGoogleMapsLoaded(): Promise<boolean> {
    if (typeof window === 'undefined') return false
    if (window.google?.maps?.Geocoder) return true
    try {
      await loadGoogleMapsScript()
      return Boolean(window.google?.maps?.Geocoder)
    } catch {
      return false
    }
  }

  async forwardGeocode(query: string, options?: GeocodeOptions): Promise<GeocodeResult[]> {
    const isLoaded = await this.ensureGoogleMapsLoaded()
    if (isLoaded && (window as unknown as { google?: { maps?: { Geocoder: new () => { geocode: Function } } } }).google?.maps?.Geocoder) {
      try {
        const GeocoderClass = (window as unknown as { google: { maps: { Geocoder: new () => { geocode: Function } } } }).google.maps.Geocoder
        const geocoder = new GeocoderClass()
        const res = await new Promise<{ results: any[] | null }>((resolve, reject) => {
          geocoder.geocode(
            {
              address: query,
              componentRestrictions: { country: options?.countryCode || 'ng' },
            },
            (results: any, status: any) => {
              if (status === 'OK' && results) {
                resolve({ results })
              } else {
                reject(new Error(`Google Geocoder status: ${status}`))
              }
            }
          )
        })

        if (Array.isArray(res.results) && res.results.length > 0) {
          return res.results.map((r) => this.mapGoogleResult(r))
        }
      } catch (err) {
        console.warn('[GoogleGeocodingProvider] Forward geocode error, using fallback:', err)
      }
    }

    return this.fallbackProvider.forwardGeocode(query, options)
  }

  async reverseGeocode(coords: Coordinates, options?: GeocodeOptions): Promise<GeocodeResult | null> {
    if (!isValidCoordinates(coords)) return null

    const isLoaded = await this.ensureGoogleMapsLoaded()
    if (isLoaded && (window as unknown as { google?: { maps?: { Geocoder: new () => { geocode: Function } } } }).google?.maps?.Geocoder) {
      try {
        const GeocoderClass = (window as unknown as { google: { maps: { Geocoder: new () => { geocode: Function } } } }).google.maps.Geocoder
        const geocoder = new GeocoderClass()
        const res = await new Promise<{ results: any[] | null }>((resolve, reject) => {
          geocoder.geocode(
            {
              location: { lat: coords.latitude, lng: coords.longitude },
            },
            (results: any, status: any) => {
              if (status === 'OK' && results) {
                resolve({ results })
              } else {
                reject(new Error(`Google Geocoder reverse status: ${status}`))
              }
            }
          )
        })

        if (Array.isArray(res.results) && res.results.length > 0) {
          return this.mapGoogleResult(res.results[0])
        }
      } catch (err) {
        console.warn('[GoogleGeocodingProvider] Reverse geocode error, using fallback:', err)
      }
    }

    return this.fallbackProvider.reverseGeocode(coords, options)
  }

  private mapGoogleResult(item: any): GeocodeResult {
    const components = item.address_components || []

    let streetNumber = ''
    let route = ''
    let neighborhood = ''
    let city = ''
    let state = ''
    let country = 'Nigeria'

    for (const comp of components) {
      if (comp.types.includes('street_number')) streetNumber = comp.long_name
      if (comp.types.includes('route')) route = comp.long_name
      if (
        comp.types.includes('sublocality') ||
        comp.types.includes('sublocality_level_1') ||
        comp.types.includes('neighborhood')
      ) {
        neighborhood = comp.long_name
      }
      if (comp.types.includes('locality')) city = comp.long_name
      if (comp.types.includes('administrative_area_level_2') && !city) city = comp.long_name
      if (comp.types.includes('administrative_area_level_1')) state = comp.long_name
      if (comp.types.includes('country')) country = comp.long_name
    }

    // Determine clean street name
    let streetName = [streetNumber, route].filter(Boolean).join(' ') || undefined
    if (!streetName && item.formatted_address) {
      const parts = item.formatted_address.split(',')
      if (parts.length > 0 && parts[0].trim() && !parts[0].includes('+')) {
        streetName = parts[0].trim()
      }
    }

    const lat = typeof item.geometry?.location?.lat === 'function'
      ? item.geometry.location.lat()
      : Number(item.geometry?.location?.lat || 0)
    const lng = typeof item.geometry?.location?.lng === 'function'
      ? item.geometry.location.lng()
      : Number(item.geometry?.location?.lng || 0)

    const resolvedStreet = streetName || neighborhood || undefined
    const resolvedCity = city || neighborhood || ''
    const resolvedState = state || ''
    const cleanFormatted =
      (item.formatted_address || '').replace(/^[A-Z0-9\+]+\s*,\s*/i, '').trim() ||
      [resolvedStreet, resolvedCity, resolvedState, country].filter(Boolean).join(', ')

    return {
      coordinates: { latitude: lat, longitude: lng },
      formattedAddress: cleanFormatted,
      streetName: streetName || undefined,
      neighborhood: neighborhood || undefined,
      city: resolvedCity,
      state: resolvedState,
      country,
      provider: this.name,
    }
  }
}
