import type { Coordinates } from '@/types'
import { isValidCoordinates } from '@/utils/geo'
import type { GeocodeOptions, GeocodeResult, GeocodingProvider } from './types'

export interface MockGeocodeRecord {
  queryKeywords: string[]
  result: GeocodeResult
}

export const DEFAULT_MOCK_LOCATIONS: MockGeocodeRecord[] = [
  {
    queryKeywords: ['awujale', 'palace', 'oba'],
    result: {
      coordinates: { latitude: 6.825, longitude: 3.925 },
      formattedAddress: 'Awujale Palace Road, Ijebu-Ode, Ogun State, Nigeria',
      streetName: 'Awujale Palace Road',
      neighborhood: 'Arapasopo',
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      country: 'Nigeria',
      confidence: 0.95,
      provider: 'mock',
    },
  },
  {
    queryKeywords: ['folagbade', 'folagbade street'],
    result: {
      coordinates: { latitude: 6.822, longitude: 3.918 },
      formattedAddress: 'Folagbade Street, Ijebu-Ode, Ogun State, Nigeria',
      streetName: 'Folagbade Street',
      neighborhood: 'Central',
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      country: 'Nigeria',
      confidence: 0.92,
      provider: 'mock',
    },
  },
  {
    queryKeywords: ['degun', 'degun street'],
    result: {
      coordinates: { latitude: 6.818, longitude: 3.91 },
      formattedAddress: 'Degun Street, Ijebu-Ode, Ogun State, Nigeria',
      streetName: 'Degun Street',
      neighborhood: 'Degun',
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      country: 'Nigeria',
      confidence: 0.9,
      provider: 'mock',
    },
  },
  {
    queryKeywords: ['oke-aje', 'oke aje', 'market'],
    result: {
      coordinates: { latitude: 6.83, longitude: 3.935 },
      formattedAddress: 'Oke-Aje Market, Old Lagos-Ibadan Road, Ijebu-Ode, Ogun State',
      streetName: 'Old Lagos-Ibadan Road',
      neighborhood: 'Oke-Aje',
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      country: 'Nigeria',
      confidence: 0.94,
      provider: 'mock',
    },
  },
  {
    queryKeywords: ['molipa', 'molipa expressway'],
    result: {
      coordinates: { latitude: 6.812, longitude: 3.93 },
      formattedAddress: 'Molipa Area, Ijebu-Ode, Ogun State, Nigeria',
      streetName: 'Molipa Avenue',
      neighborhood: 'Molipa',
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      country: 'Nigeria',
      confidence: 0.88,
      provider: 'mock',
    },
  },
  {
    queryKeywords: ['igbeba', 'gra'],
    result: {
      coordinates: { latitude: 6.815, longitude: 3.905 },
      formattedAddress: 'GRA, Igbeba Road, Ijebu-Ode, Ogun State, Nigeria',
      streetName: 'Igbeba Road',
      neighborhood: 'GRA Igbeba',
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      country: 'Nigeria',
      confidence: 0.89,
      provider: 'mock',
    },
  },
  {
    queryKeywords: ['ikeja', 'lagos', 'outside'],
    result: {
      coordinates: { latitude: 6.5244, longitude: 3.3792 },
      formattedAddress: 'Ikeja, Lagos State, Nigeria',
      streetName: 'Obafemi Awolowo Way',
      neighborhood: 'Ikeja',
      city: 'Lagos',
      state: 'Lagos State',
      country: 'Nigeria',
      confidence: 0.99,
      provider: 'mock',
    },
  },
]

export class MockGeocodingProvider implements GeocodingProvider {
  readonly name = 'mock'
  private records: MockGeocodeRecord[]

  constructor(customRecords: MockGeocodeRecord[] = DEFAULT_MOCK_LOCATIONS) {
    this.records = customRecords
  }

  async forwardGeocode(
    query: string,
    options?: GeocodeOptions
  ): Promise<GeocodeResult[]> {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed || trimmed.length < 2) {
      return []
    }

    const matches: GeocodeResult[] = []

    for (const record of this.records) {
      const matched = record.queryKeywords.some((keyword) =>
        trimmed.includes(keyword.toLowerCase())
      )
      if (matched) {
        matches.push(record.result)
      }
    }

    // Generic Ijebu fallback if query has "ijebu" or "ode" but no landmark matched
    if (matches.length === 0 && (trimmed.includes('ijebu') || trimmed.includes('ode'))) {
      matches.push({
        coordinates: { latitude: 6.820556, longitude: 3.920833 },
        formattedAddress: `${query}, Ijebu-Ode, Ogun State, Nigeria`,
        city: 'Ijebu-Ode',
        state: 'Ogun State',
        country: 'Nigeria',
        confidence: 0.75,
        provider: this.name,
      })
    }

    const limit = options?.limit ?? 5
    return matches.slice(0, limit)
  }

  async reverseGeocode(
    coords: Coordinates,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: GeocodeOptions
  ): Promise<GeocodeResult | null> {
    if (!isValidCoordinates(coords)) {
      return null
    }

    // Find nearest mock record
    let nearest: GeocodeResult | null = null
    let minDiff = Infinity

    for (const record of this.records) {
      const diff =
        Math.abs(record.result.coordinates.latitude - coords.latitude) +
        Math.abs(record.result.coordinates.longitude - coords.longitude)
      if (diff < minDiff) {
        minDiff = diff
        nearest = record.result
      }
    }

    if (nearest && minDiff < 0.05) {
      return {
        ...nearest,
        coordinates: { latitude: coords.latitude, longitude: coords.longitude },
      }
    }

    // Generic fallback for any valid coordinate
    return {
      coordinates: { latitude: coords.latitude, longitude: coords.longitude },
      formattedAddress: `Location near (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}), Ijebu-Ode, Ogun State`,
      city: 'Ijebu-Ode',
      state: 'Ogun State',
      country: 'Nigeria',
      confidence: 0.7,
      provider: this.name,
    }
  }
}
