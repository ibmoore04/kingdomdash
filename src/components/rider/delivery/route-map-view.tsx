import { LocationMap } from '@/components/map/location-map'
import type { Coordinates } from '@/types'

interface RouteMapViewProps {
  pickupCoords: Coordinates | null
  deliveryCoords: Coordinates | null
  deliveryStatus: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  className?: string
}

export function RouteMapView({
  pickupCoords,
  deliveryCoords,
  deliveryStatus,
  className = '',
}: RouteMapViewProps) {
  // Center on pickup location if before pickup; center on delivery location once in transit
  const isPostPickup = ['picked_up', 'in_transit', 'delivered'].includes(deliveryStatus)
  const activeCenter = (isPostPickup && deliveryCoords) ? deliveryCoords : (pickupCoords || deliveryCoords)

  const activeMarker = activeCenter
    ? {
        coords: activeCenter,
        label: isPostPickup ? 'Customer Dropoff' : 'Merchant Pickup',
      }
    : undefined

  return (
    <div className={`overflow-hidden rounded-2xl border border-border shadow-sm ${className}`}>
      <LocationMap
        center={activeCenter}
        marker={activeMarker}
        zoom={15}
        height={260}
      />
    </div>
  )
}
