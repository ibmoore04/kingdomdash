import { LocationMap } from '@/components/map/location-map'
import type { Coordinates } from '@/types'
import { isValidCoordinates } from '@/utils/geo'

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
  const hasValidPickup = pickupCoords && isValidCoordinates(pickupCoords)
  const hasValidDelivery = deliveryCoords && isValidCoordinates(deliveryCoords)

  // If no GPS coordinates exist for this trip, suppress rendering rather than showing an unpinned world view
  if (!hasValidPickup && !hasValidDelivery) {
    return null
  }

  // Center on pickup location if before pickup; center on delivery location once in transit
  const isPostPickup = ['picked_up', 'in_transit', 'delivered'].includes(deliveryStatus)
  const activeCenter = (isPostPickup && hasValidDelivery)
    ? deliveryCoords
    : (pickupCoords || deliveryCoords)

  const activeMarker = activeCenter
    ? {
        coords: activeCenter,
        label: isPostPickup ? 'Customer Dropoff' : 'Merchant Pickup',
      }
    : undefined

  return (
    <div className={`isolate relative z-0 overflow-hidden rounded-2xl border border-border shadow-sm ${className}`}>
      <LocationMap
        center={activeCenter}
        marker={activeMarker}
        zoom={15}
        height={260}
      />
    </div>
  )
}
