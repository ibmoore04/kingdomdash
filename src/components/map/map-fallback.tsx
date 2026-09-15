import React from 'react'
import type { Coordinates } from '@/types'
import { formatCoordinates, isValidCoordinates } from '@/utils/geo'
import { MapPin, Navigation, ShieldCheck } from 'lucide-react'

export interface MapFallbackProps {
  center?: Coordinates | null
  marker?: {
    coords: Coordinates
    label?: string
  }
  serviceAreaName?: string
  isServiceable?: boolean
  className?: string
  message?: string
}

export const MapFallback: React.FC<MapFallbackProps> = ({
  center,
  marker,
  serviceAreaName = 'Ijebu-Ode Central',
  isServiceable,
  className = '',
  message,
}) => {
  const displayCoords = marker?.coords || center

  return (
    <div
      role="region"
      aria-label="Location preview map"
      data-testid="map-fallback"
      className={`relative w-full h-full min-h-[220px] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center shadow-inner select-none ${className}`}
    >
      {/* Background Radar Grid Pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50%" cy="50%" r="25%" fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="50%" cy="50%" r="45%" fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="50%" cy="50%" r="65%" fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="5 5" />
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#22c55e" strokeWidth="0.8" strokeOpacity="0.4" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#22c55e" strokeWidth="0.8" strokeOpacity="0.4" />
        <circle cx="50%" cy="50%" r="70%" fill="url(#radar-glow)" />
      </svg>

      {/* Center Radar Pin / Compass Icon */}
      <div className="relative z-10 mb-3">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 animate-pulse">
          <MapPin className="w-7 h-7 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
        </div>
      </div>

      {/* Coordinate & Location Details */}
      <div className="relative z-10 max-w-sm space-y-1.5">
        {displayCoords && isValidCoordinates(displayCoords) ? (
          <>
            <p className="text-sm font-semibold text-white tracking-wide flex items-center justify-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-emerald-400 inline" />
              {formatCoordinates(displayCoords)}
            </p>
            {marker?.label && (
              <p className="text-xs text-slate-300 font-medium line-clamp-1">
                {marker.label}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm font-medium text-slate-300">
            {message || 'Location radar standby'}
          </p>
        )}

        {/* Service Area Status Badge */}
        <div className="pt-2 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Zone: {serviceAreaName}
          </span>
          {isServiceable !== undefined && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                isServiceable
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {isServiceable ? 'Serviceable' : 'Outside Zone'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
