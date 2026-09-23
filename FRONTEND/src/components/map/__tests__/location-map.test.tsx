import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LocationMap, LocationPickerMap, MapFallback } from '../index'

describe('Map Components', () => {
  describe('MapFallback', () => {
    it('renders coordinates and service area name correctly', () => {
      render(
        <MapFallback
          center={{ latitude: 6.820556, longitude: 3.920833 }}
          serviceAreaName="Ijebu-Ode Central"
          isServiceable={true}
        />
      )

      expect(screen.getByTestId('map-fallback')).toBeInTheDocument()
      expect(screen.getByText(/6.8206° N, 3.9208° E/i)).toBeInTheDocument()
      expect(screen.getByText(/Zone: Ijebu-Ode Central/i)).toBeInTheDocument()
      expect(screen.getByText(/Serviceable/i)).toBeInTheDocument()
    })

    it('renders outside zone status when isServiceable is false', () => {
      render(
        <MapFallback
          center={{ latitude: 6.5244, longitude: 3.3792 }}
          serviceAreaName="Ijebu-Ode Central"
          isServiceable={false}
        />
      )

      expect(screen.getByText(/Outside Zone/i)).toBeInTheDocument()
    })
  })

  describe('LocationMap & LocationPickerMap (Graceful Headless Handling)', () => {
    it('renders without crashing in jsdom test environment', () => {
      const { container } = render(
        <LocationMap
          center={{ latitude: 6.820556, longitude: 3.920833 }}
          serviceArea={{
            center: { latitude: 6.820556, longitude: 3.920833 },
            radiusKm: 12.5,
            name: 'Ijebu-Ode Central',
          }}
        />
      )
      expect(container).toBeInTheDocument()
    })

    it('renders LocationPickerMap without crashing in jsdom test environment', () => {
      const { container } = render(
        <LocationPickerMap
          value={{ latitude: 6.820556, longitude: 3.920833 }}
          onChange={() => {}}
          serviceArea={{
            center: { latitude: 6.820556, longitude: 3.920833 },
            radiusKm: 12.5,
            name: 'Ijebu-Ode Central',
          }}
        />
      )
      expect(container).toBeInTheDocument()
    })
  })
})
