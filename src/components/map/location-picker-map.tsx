import React, { useState } from 'react'
import type { Coordinates } from '@/types'
import {
  formatCoordinates,
  IJEBU_ODE_CENTER,
  isValidCoordinates,
} from '@/utils/geo'
import {
  MapPin,
  RotateCcw,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { appConfig } from '@/config/app.config'
import { GoogleMapView } from './google-map-view'

export interface LocationPickerMapProps {
  value?: Coordinates | null
  onChange: (coords: Coordinates) => void
  serviceArea?: {
    center: Coordinates
    radiusKm: number
    name?: string
  }
  height?: string | number
  className?: string
  readOnly?: boolean
}

// Micro coordinate step in degrees (~0.0003 deg is ~33m, ideal for doorstep accuracy)
const NUDGE_STEP = 0.0003

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  value,
  onChange,
  serviceArea,
  height = 280,
  className = '',
  readOnly = false,
}) => {
  const [googleJsApiError, setGoogleJsApiError] = useState(false)
  const apiKey = appConfig.maps.googleMapsApiKey

  const activeCoords: Coordinates =
    value && isValidCoordinates(value) ? value : IJEBU_ODE_CENTER

  const isServiceable = true

  const handleResetToCenter = () => {
    const center = serviceArea?.center || IJEBU_ODE_CENTER
    onChange(center)
  }

  const handleNudge = (deltaLat: number, deltaLng: number) => {
    if (readOnly) return
    const newCoords: Coordinates = {
      latitude: Math.round((activeCoords.latitude + deltaLat) * 1000000) / 1000000,
      longitude: Math.round((activeCoords.longitude + deltaLng) * 1000000) / 1000000,
    }
    onChange(newCoords)
  }

  const styleHeight = typeof height === 'number' ? `${height}px` : height

  // 1. If Google Maps API key is configured, render full interactive Google Maps JS API
  if (apiKey && !googleJsApiError) {
    return (
      <div className={`relative ${className}`} data-testid="google-location-picker-map">
        <GoogleMapView
          center={activeCoords}
          zoom={16}
          marker={{ coords: activeCoords, label: 'Delivery Doorstep' }}
          serviceArea={serviceArea}
          height={height}
          draggableMarker={!readOnly}
          onMarkerDragEnd={(coords) => {
            onChange({
              latitude: Math.round(coords.latitude * 1000000) / 1000000,
              longitude: Math.round(coords.longitude * 1000000) / 1000000,
            })
          }}
          onMapClick={(coords) => {
            if (!readOnly) {
              onChange({
                latitude: Math.round(coords.latitude * 1000000) / 1000000,
                longitude: Math.round(coords.longitude * 1000000) / 1000000,
              })
            }
          }}
          onError={() => setGoogleJsApiError(true)}
        />

        {/* Floating coordinates badge */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-md">
          <MapPin className={`h-3.5 w-3.5 ${isServiceable ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>{formatCoordinates(activeCoords)}</span>
        </div>

        {/* Service area status pill */}
        {serviceArea && (
          <div
            className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md shadow-md ${
              isServiceable
                ? 'bg-emerald-500/90 text-white'
                : 'bg-amber-500/90 text-slate-950'
            }`}
          >
            <span>
              {isServiceable
                ? 'Within Service Area'
                : `Outside ${serviceArea.name || 'Service Area'}`}
            </span>
          </div>
        )}
      </div>
    )
  }

  // 2. Pure Google Maps Embed with interactive doorstep pinpoint controls (Zero non-Google maps)
  const embedUrl = `https://maps.google.com/maps?q=${activeCoords.latitude},${activeCoords.longitude}&z=16&output=embed`
  const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${activeCoords.latitude},${activeCoords.longitude}`

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 shadow-xs ${className}`}
      data-testid="google-location-picker-map"
      style={{ height: styleHeight, width: '100%' }}
    >
      {/* Official Google Maps Embed */}
      <iframe
        title="Google Maps Pinpoint"
        src={embedUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="w-full h-full"
      />

      {/* Centered Doorstep Pin Target Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="relative flex flex-col items-center -translate-y-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white shadow-xl ring-4 ring-white/90 animate-bounce">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="w-3 h-1.5 bg-black/40 rounded-full blur-[1px] mt-1" />
          <span className="mt-1 px-2 py-0.5 rounded bg-slate-900/90 text-[10px] font-bold text-white shadow-md border border-white/20 whitespace-nowrap">
            Doorstep Pin
          </span>
        </div>
      </div>

      {/* Google Maps Brand Badge */}
      <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-lg bg-white/95 dark:bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-neutral-800 dark:text-neutral-100 shadow-md backdrop-blur-xs border border-neutral-200/80 dark:border-slate-700/80 pointer-events-none">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
          <circle cx="12" cy="9" r="2.5" fill="#FFFFFF" />
        </svg>
        <span>Google Maps</span>
      </div>

      {/* Floating coordinates badge */}
      <div className="absolute top-10 left-2.5 z-20 flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-2.5 py-1 text-xs text-white backdrop-blur-md shadow-md pointer-events-none">
        <MapPin className={`h-3.5 w-3.5 ${isServiceable ? 'text-emerald-400' : 'text-amber-400'}`} />
        <span className="font-mono text-[11px]">{formatCoordinates(activeCoords)}</span>
      </div>

      {/* Service area status pill */}
      {serviceArea && (
        <div
          className={`absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold backdrop-blur-md shadow-md pointer-events-none ${
            isServiceable
              ? 'bg-emerald-500/90 text-white'
              : 'bg-amber-500/90 text-slate-950'
          }`}
        >
          <span>
            {isServiceable
              ? 'Within Service Area'
              : `Outside ${serviceArea.name || 'Service Area'}`}
          </span>
        </div>
      )}

      {/* Interactive Micro-Pinpoint D-Pad Controls */}
      {!readOnly && (
        <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 p-1 rounded-xl shadow-md backdrop-blur-md border border-neutral-200/80 dark:border-slate-700/80">
          <span className="text-[10px] font-bold text-neutral-500 px-1 hidden sm:inline">Nudge Pin:</span>
          <button
            type="button"
            onClick={() => handleNudge(0, -NUDGE_STEP)}
            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
            title="Nudge pin West"
            aria-label="Nudge pin West"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => handleNudge(NUDGE_STEP, 0)}
              className="p-0.5 rounded-md hover:bg-neutral-200 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              title="Nudge pin North"
              aria-label="Nudge pin North"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleNudge(-NUDGE_STEP, 0)}
              className="p-0.5 rounded-md hover:bg-neutral-200 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              title="Nudge pin South"
              aria-label="Nudge pin South"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleNudge(0, NUDGE_STEP)}
            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-slate-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
            title="Nudge pin East"
            aria-label="Nudge pin East"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Recenter & Open in Google Maps Buttons */}
      <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1.5">
        {!readOnly && (
          <button
            type="button"
            onClick={handleResetToCenter}
            className="flex items-center gap-1 rounded-lg bg-white/95 dark:bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 shadow-md hover:bg-white transition-colors border border-neutral-200/80 dark:border-slate-700/80 cursor-pointer"
            title="Reset pin to Ijebu-Ode center"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Recenter</span>
          </button>
        )}

        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg bg-white/95 dark:bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-md hover:bg-white transition-colors border border-neutral-200/80 dark:border-slate-700/80"
          title="Open in Google Maps"
        >
          <span>Google Maps</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
