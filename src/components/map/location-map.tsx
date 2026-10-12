import React, { useState } from 'react'
import type { Coordinates } from '@/types'
import { IJEBU_ODE_CENTER, isValidCoordinates } from '@/utils/geo'
import { appConfig } from '@/config/app.config'
import { GoogleMapView } from './google-map-view'
import { ExternalLink } from 'lucide-react'

export interface LocationMapProps {
  center?: Coordinates | null
  zoom?: number
  marker?: {
    coords: Coordinates
    label?: string
  }
  serviceArea?: {
    center: Coordinates
    radiusKm: number
    name?: string
  }
  height?: string | number
  className?: string
  readOnly?: boolean
}

export const LocationMap: React.FC<LocationMapProps> = ({
  center,
  zoom = 15,
  marker,
  serviceArea,
  height = 240,
  className = '',
}) => {
  const [googleJsApiError, setGoogleJsApiError] = useState(false)
  const apiKey = appConfig.maps.googleMapsApiKey

  const effectiveCenter: Coordinates =
    center && isValidCoordinates(center)
      ? center
      : marker && isValidCoordinates(marker.coords)
      ? marker.coords
      : IJEBU_ODE_CENTER

  const targetCoords = marker && isValidCoordinates(marker.coords)
    ? marker.coords
    : effectiveCenter

  const styleHeight = typeof height === 'number' ? `${height}px` : height

  // 1. If Google Maps API key is configured and hasn't errored, use interactive Google Maps JS API
  if (apiKey && !googleJsApiError) {
    return (
      <GoogleMapView
        center={effectiveCenter}
        zoom={zoom}
        marker={marker}
        serviceArea={serviceArea}
        height={height}
        className={className}
        onError={() => setGoogleJsApiError(true)}
      />
    )
  }

  // 2. Official Google Maps Embed with interactive overlay (Zero non-Google maps)
  const embedUrl = `https://maps.google.com/maps?q=${targetCoords.latitude},${targetCoords.longitude}&z=${zoom}&output=embed`
  const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${targetCoords.latitude},${targetCoords.longitude}`

  return (
    <div
      style={{ height: styleHeight, width: '100%' }}
      className={`relative rounded-xl overflow-hidden shadow-xs border border-neutral-200 bg-neutral-100 dark:bg-slate-900 ${className}`}
      data-testid="google-location-map"
    >
      <iframe
        title="Google Maps Location Preview"
        src={embedUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full h-full pointer-events-auto"
      />

      {/* Google Maps Brand Badge */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 dark:bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-neutral-800 dark:text-neutral-100 shadow-md backdrop-blur-xs border border-neutral-200/80 dark:border-slate-700/80 pointer-events-none">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
          <circle cx="12" cy="9" r="2.5" fill="#FFFFFF" />
        </svg>
        <span>Google Maps</span>
      </div>

      {/* Floating Coordinates & External Link Button */}
      <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5">
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg bg-white/95 dark:bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-md hover:bg-white transition-colors border border-neutral-200/80 dark:border-slate-700/80"
          title="Open exact pin in Google Maps"
        >
          <span>Open in Google Maps</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
