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

  describe('Google Maps Integration (LocationMap & LocationPickerMap)', () => {
    it('renders Google Maps LocationMap with Google Maps branding and iframe', () => {
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
      expect(screen.getByTestId('google-location-map')).toBeInTheDocument()
      expect(screen.getByTitle(/Google Maps Location Preview/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Google Maps/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('link', { name: /Open in Google Maps/i })).toHaveAttribute(
        'href',
        expect.stringContaining('google.com/maps')
      )
    })

    it('renders Google Maps LocationPickerMap with doorstep pin controls and Google branding', () => {
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
      expect(screen.getByTestId('google-location-picker-map')).toBeInTheDocument()
      expect(screen.getByTitle(/Google Maps Pinpoint/i)).toBeInTheDocument()
      expect(screen.getByText(/Doorstep Pin/i)).toBeInTheDocument()
      expect(screen.getByTitle(/Nudge pin North/i)).toBeInTheDocument()
      expect(screen.getByTitle(/Reset pin to Ijebu-Ode center/i)).toBeInTheDocument()
    })
  })
})
