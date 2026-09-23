import type { Coordinates } from '@/types'

export interface GeocodeResult {
  coordinates: Coordinates
  formattedAddress: string
  streetName?: string
  neighborhood?: string
  city: string
  state: string
  country: string
  confidence?: number
  provider: string
}

export interface GeocodeOptions {
  limit?: number
  bounded?: boolean
  countryCode?: string
  signal?: AbortSignal
}

export interface GeocodingProvider {
  readonly name: string
  forwardGeocode(query: string, options?: GeocodeOptions): Promise<GeocodeResult[]>
  reverseGeocode(coords: Coordinates, options?: GeocodeOptions): Promise<GeocodeResult | null>
}
