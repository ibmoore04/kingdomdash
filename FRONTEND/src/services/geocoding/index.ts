import { MockGeocodingProvider } from './mock-adapter'
import { NominatimGeocodingProvider } from './nominatim-adapter'
import { BigDataCloudGeocodingProvider } from './bigdatacloud-adapter'
import { GoogleGeocodingProvider } from './google-adapter'
import type { GeocodingProvider } from './types'

export * from './types'
export * from './mock-adapter'
export * from './nominatim-adapter'
export * from './bigdatacloud-adapter'
export * from './google-adapter'

let activeProvider: GeocodingProvider | null = null

/**
 * Returns the currently active GeocodingProvider.
 * Defaults to GoogleGeocodingProvider (Google Maps API with BigDataCloud and Nominatim fallback),
 * or MockGeocodingProvider in test environment.
 */
export function getGeocodingProvider(): GeocodingProvider {
  if (activeProvider) {
    return activeProvider
  }

  // Use mock adapter in test environment (Vitest)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    activeProvider = new MockGeocodingProvider()
    return activeProvider
  }

  activeProvider = new GoogleGeocodingProvider(
    new BigDataCloudGeocodingProvider(new NominatimGeocodingProvider())
  )
  return activeProvider
}

/**
 * Allows switching or overriding the active geocoding provider
 * (useful for tests or switching between Google Maps, Radar, Nominatim)
 */
export function setGeocodingProvider(provider: GeocodingProvider | null): void {
  activeProvider = provider
}
