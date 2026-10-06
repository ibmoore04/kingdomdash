import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  DeliveryLiveMap,
  formatRemainingDistance,
} from '@/components/order/delivery-live-map'
import type { Coordinates } from '@/types'

describe('Phase 3: Live Interactive Courier Route Map & Dynamic ETA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Distance Formatting Engine', () => {
    it('formats sub-kilometer distances in meters with clean rounding', () => {
      expect(formatRemainingDistance(0.75)).toBe('750m away')
      expect(formatRemainingDistance(0.3)).toBe('300m away')
      expect(formatRemainingDistance(0.05)).toBe('50m away')
    })

    it('formats multi-kilometer distances with one decimal place', () => {
      expect(formatRemainingDistance(2.4)).toBe('2.4 km away')
      expect(formatRemainingDistance(5.12)).toBe('5.1 km away')
    })

    it('returns null for missing, null, or invalid distance values', () => {
      expect(formatRemainingDistance(null)).toBeNull()
      expect(formatRemainingDistance(undefined)).toBeNull()
      expect(formatRemainingDistance(NaN)).toBeNull()
    })
  })

  describe('Live Haversine Telemetry & Dynamic ETA', () => {
    it('computes distance and ETA dynamically from live rider and customer coordinates', () => {
      // Coordinates approx ~1.5 km apart in Ijebu-Ode
      const riderCoords: Coordinates = { latitude: 6.815, longitude: 3.915 }
      const customerCoords: Coordinates = { latitude: 6.825, longitude: 3.925 }

      render(
        <DeliveryLiveMap
          status="in_transit"
          riderCoords={riderCoords}
          customerCoords={customerCoords}
          vendorName="TASUED Cafeteria"
          deliveryAddress="CEPEP Hostels"
          estimatedMinutes={undefined}
        />
      )

      expect(screen.getByTestId('delivery-live-map')).toBeInTheDocument()
      expect(screen.getByText(/km away/i)).toBeInTheDocument()
      expect(screen.getByText(/ETA ~/i)).toBeInTheDocument()
    })
  })

  describe('View Mode Switching (Radar vs Streets)', () => {
    it('starts in radar mode and allows toggling to OpenStreetMap streets mode', () => {
      render(
        <DeliveryLiveMap
          status="in_transit"
          initialViewMode="radar"
        />
      )

      // Initial Radar Viewport
      expect(screen.getByTestId('radar-map-viewport')).toBeInTheDocument()
      expect(screen.queryByTestId('leaflet-map-container')).not.toBeInTheDocument()

      // Toggle to Streets
      const toggleBtn = screen.getByTitle(/Toggle between Radar Trajectory/i)
      fireEvent.click(toggleBtn)

      expect(screen.getByTestId('leaflet-map-container')).toBeInTheDocument()
      expect(screen.queryByTestId('radar-map-viewport')).not.toBeInTheDocument()

      // Toggle back to Radar
      fireEvent.click(toggleBtn)
      expect(screen.getByTestId('radar-map-viewport')).toBeInTheDocument()
    })
  })

  describe('Direct Courier Communication Dock', () => {
    it('generates WhatsApp courier link with rich landmark and order context', () => {
      render(
        <DeliveryLiveMap
          status="in_transit"
          orderNumber="KD-9012"
          vendorName="Mama Put Special"
          deliveryAddress="TASUED Main Gate"
          landmark="Behind First Bank ATM"
          riderName="Segun Rider"
          riderPhone="+2348012345678"
        />
      )

      const waLink = screen.getByRole('link', { name: /WhatsApp Courier/i })
      expect(waLink).toBeInTheDocument()
      expect(waLink).toHaveAttribute('href', expect.stringContaining('wa.me/2348012345678'))
      expect(waLink).toHaveAttribute('href', expect.stringContaining('KD-9012'))
      expect(waLink).toHaveAttribute('href', expect.stringContaining('Behind%20First%20Bank%20ATM'))

      const callLink = screen.getByRole('link', { name: /Call Rider/i })
      expect(callLink).toBeInTheDocument()
      expect(callLink).toHaveAttribute('href', 'tel:+2348077958755'.replace('+2348077958755', '+2348012345678'))
    })

    it('hides communication actions when delivery is completed or cancelled', () => {
      const { rerender } = render(
        <DeliveryLiveMap
          status="delivered"
          riderPhone="+2348012345678"
        />
      )

      expect(screen.queryByRole('link', { name: /Call Rider/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /WhatsApp Courier/i })).not.toBeInTheDocument()

      rerender(
        <DeliveryLiveMap
          status="cancelled"
          riderPhone="+2348012345678"
        />
      )

      expect(screen.queryByRole('link', { name: /Call Rider/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /WhatsApp Courier/i })).not.toBeInTheDocument()
    })
  })
})
