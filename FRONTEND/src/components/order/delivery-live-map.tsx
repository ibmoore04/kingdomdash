import { useMemo } from 'react'
import {
  Bike,
  Store,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DeliveryLiveMapProps {
  status: string
  vendorName?: string
  deliveryAddress?: string
  riderName?: string
  riderPhone?: string
  estimatedMinutes?: number
  distanceKm?: number | null
  className?: string
  showContactActions?: boolean
}

export function DeliveryLiveMap({
  status,
  vendorName = 'Restaurant Kitchen',
  deliveryAddress = 'Delivery Destination',
  riderName = 'Babatunde A.',
  riderPhone = '+2348077958755',
  estimatedMinutes = 22,
  distanceKm = 3.2,
  className,
  showContactActions = true,
}: DeliveryLiveMapProps) {
  const isPreparing = status === 'preparing' || status === 'payment_confirmed'
  const isReady = status === 'ready' || status === 'ready_for_pickup'
  const isInTransit = status === 'picked_up' || status === 'in_transit' || status === 'delivering'
  const isDelivered = status === 'delivered'
  const isCancelled = status === 'cancelled'

  // Rider position along the SVG route curve (0 = vendor, 1 = customer)
  const riderProgress = useMemo(() => {
    if (isDelivered) return 1
    if (isInTransit) return 0.62
    if (isReady) return 0.18
    if (isPreparing) return 0.05
    return 0
  }, [status, isDelivered, isInTransit, isReady, isPreparing])

  // Calculated coordinates along an aesthetic cubic bezier curve
  // Curve from (70, 160) to (530, 80) with control points (200, 240) and (400, 40)
  const riderCoordinates = useMemo(() => {
    const t = riderProgress
    // Cubic bezier interpolation
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
  }, [status, isCancelled, isDelivered, isInTransit, isReady, isPreparing])

  return (
    <div
      data-testid="delivery-live-map"
      className={cn(
        'relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#0C0E12] shadow-2xl text-white',
        className
      )}
    >
      {/* Top Floating HUD: Live Status & Telemetry */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3">
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

        {/* ETA & Distance Pill */}
        {!isCancelled && !isDelivered && (
          <div className="flex items-center gap-2 rounded-full border border-neutral-700/80 bg-neutral-900/90 px-3.5 py-1.5 backdrop-blur-md shadow-lg text-xs font-semibold text-neutral-200">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>ETA ~{estimatedMinutes} mins</span>
            {distanceKm && (
              <>
                <span className="text-neutral-600">•</span>
                <span className="text-neutral-400">{distanceKm.toFixed(1)} km</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stylized Vector Map Viewport */}
      <div className="relative h-64 sm:h-72 w-full select-none overflow-hidden bg-[#0A0C10]">
        {/* Grid and Road Topology Vector Pattern */}
        <svg
          className="absolute inset-0 h-full w-full opacity-35"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="map-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            </pattern>
            {/* Background street lines */}
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#E50914" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />

          {/* Background Secondary Streets */}
          <path
            d="M -20 60 Q 180 120 320 30 T 650 140"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          <path
            d="M 120 -20 Q 240 180 200 320"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          <path
            d="M 420 -20 Q 380 160 480 320"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
        </svg>

        {/* Dynamic Route & Waypoints Canvas */}
        <svg
          viewBox="0 0 600 280"
          className="absolute inset-0 h-full w-full preserve-3d"
          fill="none"
        >
          {/* Base Route Shadow */}
          <path
            d="M 70 160 C 220 250, 380 40, 530 80"
            stroke="rgba(0,0,0,0.6)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Base Route Inactive Path */}
          <path
            d="M 70 160 C 220 250, 380 40, 530 80"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Animated Active Glowing Trajectory */}
          {!isCancelled && (
            <path
              d="M 70 160 C 220 250, 380 40, 530 80"
              stroke="url(#routeGradient)"
              strokeWidth="5"
              strokeDasharray="8 6"
              strokeLinecap="round"
              className="animate-[dash_20s_linear_infinite]"
            />
          )}

          {/* Origin Point: Restaurant / Kitchen */}
          <g transform="translate(70, 160)">
            {/* Soft Ambient Glow */}
            <circle r="22" fill="rgba(245, 158, 11, 0.15)" />
            <circle r="14" fill="#181A20" stroke="#F59E0B" strokeWidth="2.5" />
            <circle r="5" fill="#F59E0B" />
          </g>

          {/* Destination Point: Customer Home */}
          <g transform="translate(530, 80)">
            <circle r="24" fill="rgba(229, 9, 20, 0.2)" />
            <circle r="15" fill="#181A20" stroke="#E50914" strokeWidth="2.5" />
            <circle r="6" fill="#E50914" />
          </g>

          {/* Rider Icon Along Bezier Curve */}
          {!isCancelled && (
            <g
              transform={`translate(${riderCoordinates.x}, ${riderCoordinates.y})`}
              className="transition-all duration-700 ease-out"
            >
              {/* Radar Beacon Wave Rings */}
              {isInTransit && (
                <>
                  <circle
                    r="28"
                    fill="none"
                    stroke="rgba(229, 9, 20, 0.4)"
                    strokeWidth="1.5"
                    className="animate-ping origin-center"
                  />
                  <circle
                    r="18"
                    fill="none"
                    stroke="rgba(229, 9, 20, 0.6)"
                    strokeWidth="1.5"
                  />
                </>
              )}
              {/* Rider Badge Base */}
              <circle
                r="16"
                fill="#E50914"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                className="shadow-xl"
              />
            </g>
          )}
        </svg>

        {/* Floating HTML Pins for Tooltips & High-DPI Icons */}
        {/* 1. Restaurant Pin Card */}
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ left: '11.6%', top: '57%' }}
        >
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-neutral-900/90 px-2.5 py-1 text-[11px] font-bold text-amber-300 shadow-md backdrop-blur-xs">
            <Store className="h-3 w-3 text-amber-400" />
            <span className="truncate max-w-[120px]">{vendorName}</span>
          </div>
        </div>

        {/* 2. Rider Vehicle Marker Icon */}
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

        {/* 3. Customer Destination Pin Card */}
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ left: '88.3%', top: '28%' }}
        >
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-neutral-900/90 px-2.5 py-1 text-[11px] font-bold text-primary shadow-md backdrop-blur-xs">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="truncate max-w-[130px]">{deliveryAddress}</span>
          </div>
        </div>
      </div>

      {/* Bottom Dispatch & Rider Handover Telemetry Bar */}
      <div className="border-t border-neutral-800/80 bg-neutral-900/90 p-4 sm:p-5 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Dispatch Rider Avatar & Details */}
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
              <p className="text-xs text-neutral-400">
                {isInTransit
                  ? 'Traveling towards your address • Please be on standby'
                  : isDelivered
                  ? 'Delivery completed successfully'
                  : 'Assigned to your dispatch order'}
              </p>
            </div>
          </div>

          {/* Quick Communication Actions */}
          {showContactActions && !isDelivered && !isCancelled && (
            <div className="flex items-center gap-2">
              <a
                href={`tel:${riderPhone}`}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white"
              >
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>Call Rider</span>
              </a>
              <a
                href={`https://wa.me/${riderPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Hello, I am tracking my KingdomDash order from ${vendorName}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
