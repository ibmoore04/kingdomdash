import { useState, useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Bike,
  Store,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  ShieldCheck,
  Compass,
  Layers,
  Map as MapIcon,
  Navigation,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Coordinates } from '@/types'
import {
  IJEBU_ODE_CENTER,
  calculateHaversineDistanceKm,
  isValidCoordinates,
} from '@/utils/geo'

export interface DeliveryLiveMapProps {
  status: string
  orderNumber?: string
  vendorName?: string
  deliveryAddress?: string
  landmark?: string
  riderName?: string
  riderPhone?: string
  estimatedMinutes?: number
  distanceKm?: number | null
  vendorCoords?: Coordinates | null
  customerCoords?: Coordinates | null
  riderCoords?: Coordinates | null
  className?: string
  showContactActions?: boolean
  initialViewMode?: 'radar' | 'streets'
}

/**
 * Formats distance with meter precision for sub-kilometer distances.
 */
export function formatRemainingDistance(km: number | null | undefined): string | null {
  if (km === null || km === undefined || isNaN(km)) return null
  if (km < 1.0) {
    return `${Math.round(km * 1000)}m away`
  }
  return `${km.toFixed(1)} km away`
}

export function DeliveryLiveMap({
  status,
  orderNumber = 'KD-8921',
  vendorName = 'Restaurant Kitchen',
  deliveryAddress = 'TASUED Main Campus Gate',
  landmark = 'Near ATM Gallery',
  riderName = 'Babatunde A.',
  riderPhone = '+2348077958755',
  estimatedMinutes = 18,
  distanceKm: initialDistanceKm = 2.4,
  vendorCoords,
  customerCoords,
  riderCoords,
  className,
  showContactActions = true,
  initialViewMode = 'radar',
}: DeliveryLiveMapProps) {
  const [viewMode, setViewMode] = useState<'radar' | 'streets'>(initialViewMode)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)

  const isPreparing = status === 'preparing' || status === 'payment_confirmed'
  const isReady = status === 'ready' || status === 'ready_for_pickup'
  const isInTransit = status === 'picked_up' || status === 'in_transit' || status === 'delivering'
  const isDelivered = status === 'delivered'
  const isCancelled = status === 'cancelled'

  // Authoritative distance calculation if live coordinates provided
  const computedDistanceKm = useMemo(() => {
    if (riderCoords && customerCoords && isValidCoordinates(riderCoords) && isValidCoordinates(customerCoords)) {
      return calculateHaversineDistanceKm(riderCoords, customerCoords)
    }
    if (vendorCoords && customerCoords && isValidCoordinates(vendorCoords) && isValidCoordinates(customerCoords)) {
      return calculateHaversineDistanceKm(vendorCoords, customerCoords)
    }
    return initialDistanceKm
  }, [riderCoords, customerCoords, vendorCoords, initialDistanceKm])

  // Dynamic ETA Calculation
  const dynamicEta = useMemo(() => {
    if (isDelivered) return 0
    if (estimatedMinutes !== undefined) return estimatedMinutes
    if (computedDistanceKm && computedDistanceKm > 0) {
      // Estimated at 25 km/h campus dispatch speed + 3 min buffer
      const estimatedFromSpeed = Math.round((computedDistanceKm / 25) * 60) + 3
      return Math.max(2, estimatedFromSpeed)
    }
    return 15
  }, [computedDistanceKm, isDelivered, estimatedMinutes])

  // Rider position along the SVG route curve (0 = vendor, 1 = customer)
  const riderProgress = useMemo(() => {
    if (isDelivered) return 1
    if (isInTransit) return 0.65
    if (isReady) return 0.2
    if (isPreparing) return 0.05
    return 0
  }, [isDelivered, isInTransit, isReady, isPreparing])

  // Calculated coordinates along an aesthetic cubic bezier curve
  const riderCoordinates = useMemo(() => {
    const t = riderProgress
    const p0 = { x: 70, y: 160 }
    const p1 = { x: 220, y: 250 }
    const p2 = { x: 380, y: 40 }
    const p3 = { x: 530, y: 80 }

    const cx = 3 * (p1.x - p0.x)
    const bx = 3 * (p2.x - p1.x) - cx
    const ax = p3.x - p0.x - cx - bx

    const cy = 3 * (p1.y - p0.y)
    const by = 3 * (p2.y - p1.y) - cy
    const ay = p3.y - p0.y - cy - by

    const x = ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p0.x
    const y = ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p0.y

    return { x, y }
  }, [riderProgress])

  const statusText = useMemo(() => {
    if (isCancelled) return 'Delivery Cancelled'
    if (isDelivered) return 'Package Delivered'
    if (isInTransit) return 'Rider en route to your doorstep'
    if (isReady) return 'Meal boxed • Rider approaching kitchen'
    if (isPreparing) return 'Kitchen is preparing your order'
    return 'Awaiting payment confirmation'
  }, [isCancelled, isDelivered, isInTransit, isReady, isPreparing])

  // Leaflet Interactive Street Map Lifecycle
  useEffect(() => {
    if (viewMode !== 'streets' || !mapContainerRef.current) return

    try {
      if (!leafletMapRef.current) {
        const centerCoords = riderCoords || customerCoords || vendorCoords || IJEBU_ODE_CENTER
        const map = L.map(mapContainerRef.current, {
          center: [centerCoords.latitude, centerCoords.longitude],
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map)

        // Vendor Marker
        const vCoords = vendorCoords || { latitude: 6.815, longitude: 3.915 }
        const vendorIcon = L.divIcon({
          className: 'kd-map-vendor-pin',
          html: `<div style="background:#F59E0B;color:#fff;padding:6px;border-radius:12px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.3);width:32px;height:32px;">🏪</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        L.marker([vCoords.latitude, vCoords.longitude], { icon: vendorIcon })
          .bindPopup(`<b>${vendorName}</b><br/>Order Pickup Location`)
          .addTo(map)

        // Customer Marker
        const cCoords = customerCoords || { latitude: 6.828, longitude: 3.928 }
        const customerIcon = L.divIcon({
          className: 'kd-map-customer-pin',
          html: `<div style="background:#E50914;color:#fff;padding:6px;border-radius:12px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.3);width:32px;height:32px;">📍</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        L.marker([cCoords.latitude, cCoords.longitude], { icon: customerIcon })
          .bindPopup(`<b>${deliveryAddress}</b><br/>Delivery Destination`)
          .addTo(map)

        // Courier Marker
        const rCoords = riderCoords || {
          latitude: (vCoords.latitude + cCoords.latitude) / 2,
          longitude: (vCoords.longitude + cCoords.longitude) / 2,
        }
        const riderIcon = L.divIcon({
          className: 'kd-map-rider-pin',
          html: `<div style="background:#10B981;color:#fff;padding:6px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(16,185,129,0.5);width:36px;height:36px;">🛵</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })
        L.marker([rCoords.latitude, rCoords.longitude], { icon: riderIcon })
          .bindPopup(`<b>${riderName}</b><br/>Current Courier Position`)
          .addTo(map)

        // Route Polyline
        L.polyline(
          [
            [vCoords.latitude, vCoords.longitude],
            [rCoords.latitude, rCoords.longitude],
            [cCoords.latitude, cCoords.longitude],
          ],
          { color: '#E50914', weight: 4, opacity: 0.8, dashArray: '6, 8' }
        ).addTo(map)

        leafletMapRef.current = map
      }

      // Smooth resize trigger
      setTimeout(() => {
        leafletMapRef.current?.invalidateSize()
      }, 150)
    } catch {
      // Safe fallback if leaflet dom elements not present
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [viewMode, vendorCoords, customerCoords, riderCoords, vendorName, deliveryAddress, riderName])

  // Formatted WhatsApp URL with campus gate context
  const whatsAppHref = useMemo(() => {
    const cleanPhone = riderPhone.replace(/[^0-9]/g, '')
    const message = `Hello ${riderName}, I am tracking my KingdomDash Order #${orderNumber} from ${vendorName}. I'm waiting at: ${deliveryAddress}${landmark ? ` (${landmark})` : ''}.`
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
  }, [riderPhone, riderName, orderNumber, vendorName, deliveryAddress, landmark])

  return (
    <div
      data-testid="delivery-live-map"
      className={cn(
        'relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#0C0E12] shadow-2xl text-white',
        className
      )}
    >
      {/* Top Floating HUD: Live Status, Telemetry & Mode Switcher */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2.5">
        {/* Status Pill */}
        <div className="flex items-center gap-2 rounded-full border border-neutral-700/80 bg-neutral-900/90 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                isCancelled
                  ? 'bg-neutral-500'
                  : isDelivered
                  ? 'bg-emerald-400'
                  : 'animate-ping bg-primary'
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2.5 w-2.5 rounded-full',
                isCancelled
                  ? 'bg-neutral-500'
                  : isDelivered
                  ? 'bg-emerald-500'
                  : 'bg-primary'
              )}
            />
          </span>
          <span className="text-xs font-bold tracking-tight text-neutral-100">
            {statusText}
          </span>
        </div>

        {/* Right HUD: ETA Pill + View Mode Switcher */}
        <div className="flex items-center gap-2">
          {!isCancelled && !isDelivered && (
            <div className="flex items-center gap-1.5 rounded-full border border-neutral-700/80 bg-neutral-900/90 px-3 py-1.5 backdrop-blur-md shadow-lg text-xs font-semibold text-neutral-200">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>ETA ~{dynamicEta} mins</span>
              {computedDistanceKm && (
                <>
                  <span className="text-neutral-600">•</span>
                  <span className="text-neutral-300 font-bold">
                    {formatRemainingDistance(computedDistanceKm)}
                  </span>
                </>
              )}
            </div>
          )}

          {/* View Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'radar' ? 'streets' : 'radar')}
            className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800/90 hover:bg-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors backdrop-blur-md cursor-pointer shadow-md"
            title="Toggle between Radar Trajectory and OpenStreetMap Streets"
          >
            {viewMode === 'radar' ? (
              <>
                <MapIcon className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Streets</span>
              </>
            ) : (
              <>
                <Compass className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Radar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Map Viewport: Dual Modes */}
      {viewMode === 'streets' ? (
        <div
          ref={mapContainerRef}
          data-testid="leaflet-map-container"
          className="relative h-64 sm:h-76 w-full bg-[#0A0C10] z-10"
        />
      ) : (
        /* Stylized Vector Radar Map Viewport */
        <div
          data-testid="radar-map-viewport"
          className="relative h-64 sm:h-76 w-full select-none overflow-hidden bg-[#0A0C10]"
        >
          {/* Grid and Road Topology Vector Pattern */}
          <svg
            className="absolute inset-0 h-full w-full opacity-35"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="map-grid-p3" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              </pattern>
              <linearGradient id="routeGradient-p3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="50%" stopColor="#E50914" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid-p3)" />

            <path d="M -20 60 Q 180 120 320 30 T 650 140" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <path d="M 120 -20 Q 240 180 200 320" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <path d="M 420 -20 Q 380 160 480 320" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          </svg>

          {/* Dynamic Route & Waypoints Canvas */}
          <svg viewBox="0 0 600 280" className="absolute inset-0 h-full w-full preserve-3d" fill="none">
            <path
              d="M 70 160 C 220 250, 380 40, 530 80"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 70 160 C 220 250, 380 40, 530 80"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {!isCancelled && (
              <path
                d="M 70 160 C 220 250, 380 40, 530 80"
                stroke="url(#routeGradient-p3)"
                strokeWidth="5"
                strokeDasharray="8 6"
                strokeLinecap="round"
                className="animate-[dash_20s_linear_infinite]"
              />
            )}

            {/* Origin Point: Restaurant / Kitchen */}
            <g transform="translate(70, 160)">
              <circle r="22" fill="rgba(245, 158, 11, 0.15)" />
              <circle r="14" fill="#181A20" stroke="#F59E0B" strokeWidth="2.5" />
              <circle r="5" fill="#F59E0B" />
            </g>

            {/* Destination Point: Customer Destination */}
            <g transform="translate(530, 80)">
              <circle r="24" fill="rgba(229, 9, 20, 0.2)" />
              <circle r="15" fill="#181A20" stroke="#E50914" strokeWidth="2.5" />
              <circle r="6" fill="#E50914" />
            </g>

            {/* Rider Beacon Marker Along Bezier Curve */}
            {!isCancelled && (
              <g
                transform={`translate(${riderCoordinates.x}, ${riderCoordinates.y})`}
                className="transition-all duration-700 ease-out"
              >
                {isInTransit && (
                  <>
                    <circle r="28" fill="none" stroke="rgba(229, 9, 20, 0.4)" strokeWidth="1.5" className="animate-ping origin-center" />
                    <circle r="18" fill="none" stroke="rgba(229, 9, 20, 0.6)" strokeWidth="1.5" />
                  </>
                )}
                <circle r="16" fill="#E50914" stroke="#FFFFFF" strokeWidth="2.5" className="shadow-xl" />
              </g>
            )}
          </svg>

          {/* Floating Waypoint HTML Pins */}
          <div className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none" style={{ left: '11.6%', top: '57%' }}>
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-neutral-900/90 px-2.5 py-1 text-[11px] font-bold text-amber-300 shadow-md backdrop-blur-xs">
              <Store className="h-3 w-3 text-amber-400" />
              <span className="truncate max-w-[120px]">{vendorName}</span>
            </div>
          </div>

          {!isCancelled && (
            <div
              className="absolute z-15 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-700 ease-out flex items-center justify-center text-white"
              style={{
                left: `${(riderCoordinates.x / 600) * 100}%`,
                top: `${(riderCoordinates.y / 280) * 100}%`,
              }}
            >
              <Bike className="h-4 w-4 drop-shadow-md text-white" />
            </div>
          )}

          <div className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none" style={{ left: '88.3%', top: '28%' }}>
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-neutral-900/90 px-2.5 py-1 text-[11px] font-bold text-primary shadow-md backdrop-blur-xs">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="truncate max-w-[130px]">{deliveryAddress}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Dispatch & Rider Handover Dock */}
      <div className="border-t border-neutral-800/80 bg-neutral-900/90 p-4 sm:p-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Dispatch Courier Details */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-800 border border-neutral-700 text-primary shadow-inner">
              <Bike className="h-5 w-5" />
              <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                <ShieldCheck className="h-2.5 w-2.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-neutral-100">{riderName}</h4>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400">
                  Verified Courier
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isInTransit
                  ? 'Delivering order to designated landmark • Be on standby'
                  : isDelivered
                  ? 'Delivery completed and PIN verified'
                  : 'Assigned to your dispatch order'}
              </p>
            </div>
          </div>

          {/* Quick Courier Communication Dock */}
          {showContactActions && !isDelivered && !isCancelled && (
            <div className="flex items-center gap-2">
              <a
                href={`tel:${riderPhone}`}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white cursor-pointer"
              >
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>Call Rider</span>
              </a>
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp Courier</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
