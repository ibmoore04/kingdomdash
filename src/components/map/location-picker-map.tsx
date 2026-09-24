import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '@/types'
import {
  formatCoordinates,
  IJEBU_ODE_CENTER,
  isValidCoordinates,
  isWithinRadiusKm,
} from '@/utils/geo'
import { MapPin, RotateCcw } from 'lucide-react'
import { MapFallback } from './map-fallback'
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

// Custom SVG Draggable Pin Icon for Leaflet
const createPickerIcon = (isServiceable = true) =>
  L.divIcon({
    className: 'kingdomdash-picker-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%); cursor: grab; display: flex; flex-direction: column; align-items: center;">
        <svg width="38" height="46" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.25 12 30 12 30C12 30 24 20.25 24 12C24 5.37258 18.6274 0 12 0Z" fill="${isServiceable ? '#10b981' : '#f59e0b'}"/>
          <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
        </svg>
        <span style="background: rgba(15, 23, 42, 0.85); color: #fff; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-top: -4px; white-space: nowrap; border: 1px solid rgba(255,255,255,0.2);">
          Drag to pinpoint
        </span>
      </div>
    `,
    iconSize: [38, 46],
    iconAnchor: [19, 46],
  })

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  value,
  onChange,
  serviceArea,
  height = 280,
  className = '',
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const [initFailed, setInitFailed] = useState(false)
  const [useGoogleMaps, setUseGoogleMaps] = useState(Boolean(appConfig.maps.googleMapsApiKey))

  const activeCoords: Coordinates =
    value && isValidCoordinates(value) ? value : IJEBU_ODE_CENTER

  const isServiceable = serviceArea
    ? isWithinRadiusKm(activeCoords, serviceArea.center, serviceArea.radiusKm)
    : true

  // Handle location reset to center
  const handleResetToCenter = () => {
    const center = serviceArea?.center || IJEBU_ODE_CENTER
    onChange(center)
  }

  // Attempt Google Maps if key exists
  if (useGoogleMaps && appConfig.maps.googleMapsApiKey) {
    return (
      <div className="relative">
        <GoogleMapView
          center={activeCoords}
          zoom={15}
          serviceArea={serviceArea}
          height={height}
          className={className}
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
          onError={() => setUseGoogleMaps(false)}
        />
        {/* Floating status badge */}
        <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-md">
          <MapPin className={`h-3.5 w-3.5 ${isServiceable ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>{formatCoordinates(activeCoords)}</span>
        </div>
      </div>
    )
  }

  // Leaflet map lifecycle fallback
  useEffect(() => {
    if (!containerRef.current || useGoogleMaps) return

    try {
      if (!mapInstanceRef.current) {
        const map = L.map(containerRef.current, {
          center: [activeCoords.latitude, activeCoords.longitude],
          zoom: 15,
          zoomControl: true,
          attributionControl: false,
        })

        const tileLayer = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          }
        )
        tileLayer.on('tileerror', () => {
          // Silently handle tile errors
        })
        tileLayer.addTo(map)

        setTimeout(() => map.invalidateSize(), 150)
        setTimeout(() => map.invalidateSize(), 400)

        // Click on map to place/move pin
        if (!readOnly) {
          map.on('click', (e: L.LeafletMouseEvent) => {
            const newCoords: Coordinates = {
              latitude: Math.round(e.latlng.lat * 1000000) / 1000000,
              longitude: Math.round(e.latlng.lng * 1000000) / 1000000,
            }
            onChange(newCoords)
          })
        }

        mapInstanceRef.current = map
      }
    } catch (err) {
      console.warn('[LocationPickerMap] Failed to initialize Leaflet map, using fallback:', err)
      setInitFailed(true)
      return
    }

    const map = mapInstanceRef.current
    if (!map) return

    // Update marker
    if (markerRef.current) {
      markerRef.current.setLatLng([activeCoords.latitude, activeCoords.longitude])
      markerRef.current.setIcon(createPickerIcon(isServiceable))
    } else {
      const marker = L.marker([activeCoords.latitude, activeCoords.longitude], {
        icon: createPickerIcon(isServiceable),
        draggable: !readOnly,
      }).addTo(map)

      if (!readOnly) {
        marker.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng()
          onChange({
            latitude: Math.round(latlng.lat * 1000000) / 1000000,
            longitude: Math.round(latlng.lng * 1000000) / 1000000,
          })
        })
      }

      markerRef.current = marker
    }

    // Update Service Area Circle
    if (serviceArea && isValidCoordinates(serviceArea.center) && serviceArea.radiusKm > 0) {
      const radiusMeters = serviceArea.radiusKm * 1000
      if (circleRef.current) {
        circleRef.current.setLatLng([
          serviceArea.center.latitude,
          serviceArea.center.longitude,
        ])
        circleRef.current.setRadius(radiusMeters)
      } else {
        circleRef.current = L.circle(
          [serviceArea.center.latitude, serviceArea.center.longitude],
          {
            radius: radiusMeters,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.12,
            weight: 2,
          }
        ).addTo(map)
      }
    }
  }, [activeCoords, isServiceable, serviceArea, readOnly, onChange, useGoogleMaps])

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  if (initFailed) {
    return (
      <MapFallback
        center={activeCoords}
        className={className}
      />
    )
  }

  const styleHeight = typeof height === 'number' ? `${height}px` : height

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        style={{ height: styleHeight, width: '100%' }}
        className="relative rounded-xl overflow-hidden shadow-xs border border-neutral-200"
      />

      {/* Floating coordinates bar */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs text-white backdrop-blur-md shadow-md">
        <MapPin className={`h-3.5 w-3.5 ${isServiceable ? 'text-emerald-400' : 'text-amber-400'}`} />
        <span>{formatCoordinates(activeCoords)}</span>
      </div>

      {/* Service area status pill */}
      {serviceArea && (
        <div
          className={`absolute top-3 right-3 z-[400] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md shadow-md ${
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

      {/* Recenter button */}
      {!readOnly && (
        <button
          type="button"
          onClick={handleResetToCenter}
          className="absolute bottom-3 right-3 z-[400] flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 backdrop-blur-md shadow-md hover:bg-white transition-colors"
          title="Reset pin to market center"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Recenter</span>
        </button>
      )}
    </div>
  )
}
