import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeliveryLiveMap } from '../delivery-live-map'

describe('DeliveryLiveMap component', () => {
  it('renders correctly with vendor name, delivery address, and telemetry', () => {
    render(
      <DeliveryLiveMap
        status="in_transit"
        vendorName="Bisi Eatery"
        deliveryAddress="14 Stadium Road, Ijebu-Ode"
        riderName="Babatunde A."
        estimatedMinutes={18}
        distanceKm={2.8}
      />
    )

    expect(screen.getByTestId('delivery-live-map')).toBeDefined()
    expect(screen.getByText(/Rider en route to your doorstep/i)).toBeDefined()
    expect(screen.getByText(/ETA ~18 mins/i)).toBeDefined()
    expect(screen.getByText(/2.8 km/i)).toBeDefined()
    expect(screen.getByText('Bisi Eatery')).toBeDefined()
    expect(screen.getByText('14 Stadium Road, Ijebu-Ode')).toBeDefined()
    expect(screen.getByText('Babatunde A.')).toBeDefined()
  })

  it('displays preparing state when order status is preparing', () => {
    render(
      <DeliveryLiveMap
        status="preparing"
        vendorName="Mama Cass Kitchen"
        deliveryAddress="Molipa Expressway"
      />
    )

    expect(screen.getByText(/Kitchen is preparing your order/i)).toBeDefined()
  })

  it('displays delivered status and hides call actions when delivered', () => {
    render(
      <DeliveryLiveMap
        status="delivered"
        vendorName="Mama Cass Kitchen"
        deliveryAddress="Molipa Expressway"
      />
    )

    expect(screen.getByText(/Package Delivered/i)).toBeDefined()
    expect(screen.queryByText(/Call Rider/i)).toBeNull()
  })
})
