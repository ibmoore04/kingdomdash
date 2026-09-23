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

// Custom SVG Draggable Pin Icon
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

  const activeCoords: Coordinates =
    value && isValidCoordinates(value) ? value : IJEBU_ODE_CENTER

  const isServiceable = serviceArea
    ? isWithinRadiusKm(activeCoords, serviceArea.center, serviceArea.radiusKm)
    : true

  // Leaflet map lifecycle
  useEffect(() => {
    if (!containerRef.current) return

    try {
      if (!mapInstanceRef.current) {
        const map = L.map(containerRef.current, {
          center: [activeCoords.latitude, activeCoords.longitude],
          zoom: 15,
          zoomControl: true,
          attributionControl: false,
        })

        // High-availability Esri World Street Map (100% free, fast CDN, zero API key required)
        const tileLayer = L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          }
        )
        tileLayer.on('tileerror', () => {
          // Silently handle tile errors without breaking map interactions
        })
        tileLayer.addTo(map)

        // Ensure map layout is properly computed
        setTimeout(() => {
          map.invalidateSize()
        }, 150)
        setTimeout(() => {
          map.invalidateSize()
        }, 400)

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
            fillOpacity: 0.08,
            weight: 2,
            dashArray: '5, 8',
          }
        ).addTo(map)
      }
    }
  }, [activeCoords.latitude, activeCoords.longitude, isServiceable, readOnly, serviceArea, onChange])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    })
    observer.observe(el)

    return () => {
      observer.disconnect()
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([activeCoords.latitude, activeCoords.longitude], 15)
    }
  }

  if (initFailed) {
    return (
      <div style={{ height }} className={className}>
        <MapFallback
          center={activeCoords}
          serviceAreaName={serviceArea?.name}
          isServiceable={isServiceable}
          message="Tap or click below to verify your delivery location coordinates."
        />
      </div>
    )
  }

  return (
    <div
      data-testid="location-picker-map"
      className={`isolate relative z-0 w-full rounded-xl overflow-hidden border border-slate-700/60 shadow-md flex flex-col ${className}`}
      style={{ height }}
    >
      <div ref={containerRef} className="w-full flex-1" />

      {/* Recenter Button */}
      <button
        type="button"
        onClick={handleRecenter}
        title="Recenter map"
        className="absolute top-3 right-3 z-20 p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 shadow-md backdrop-blur-sm transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      {/* Interactive Bottom Pin Status Bar */}
      <div className="bg-slate-900/95 backdrop-blur-sm px-4 py-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 select-none">
        <div className="flex items-center gap-2">
          <MapPin
            className={`w-4 h-4 ${isServiceable ? 'text-emerald-400' : 'text-amber-400'}`}
          />
          <span className="font-medium text-white">{formatCoordinates(activeCoords)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded font-semibold ${
              isServiceable
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {isServiceable ? 'Inside Delivery Zone' : 'Outside Service Zone'}
          </span>
        </div>
      </div>
    </div>
  )
}
