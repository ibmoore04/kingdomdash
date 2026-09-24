import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '@/types'
import { IJEBU_ODE_CENTER, isValidCoordinates } from '@/utils/geo'
import { MapFallback } from './map-fallback'
import { appConfig } from '@/config/app.config'
import { GoogleMapView } from './google-map-view'

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

// Custom SVG Pin Icon for Leaflet
const createPinIcon = (color = '#10b981') =>
  L.divIcon({
    className: 'kingdomdash-custom-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; items-center; justify-content: center;">
        <svg width="34" height="42" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.37258 0 0 5.37258 0 12C0 20.25 12 30 12 30C12 30 24 20.25 24 12C24 5.37258 18.6274 0 12 0Z" fill="${color}"/>
          <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
        </svg>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
  })

export const LocationMap: React.FC<LocationMapProps> = ({
  center,
  zoom = 14,
  marker,
  serviceArea,
  height = 240,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const [initFailed, setInitFailed] = useState(false)
  const [useGoogleMaps, setUseGoogleMaps] = useState(Boolean(appConfig.maps.googleMapsApiKey))

  const effectiveCenter: Coordinates =
    center && isValidCoordinates(center)
      ? center
      : marker && isValidCoordinates(marker.coords)
      ? marker.coords
      : IJEBU_ODE_CENTER

  // Attempt Google Maps if key exists
  if (useGoogleMaps && appConfig.maps.googleMapsApiKey) {
    return (
      <GoogleMapView
        center={effectiveCenter}
        zoom={zoom}
        marker={marker}
        serviceArea={serviceArea}
        height={height}
        className={className}
        onError={() => setUseGoogleMaps(false)}
      />
    )
  }

  useEffect(() => {
    if (!containerRef.current || useGoogleMaps) return

    // Graceful fallback for Leaflet / Esri
    try {
      if (!mapInstanceRef.current) {
        const map = L.map(containerRef.current, {
          center: [effectiveCenter.latitude, effectiveCenter.longitude],
          zoom,
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

        mapInstanceRef.current = map

        setTimeout(() => map.invalidateSize(), 150)
        setTimeout(() => map.invalidateSize(), 400)
      }
    } catch (err) {
      console.warn('[LocationMap] Failed to initialize Leaflet map instance, using fallback:', err)
      setInitFailed(true)
      return
    }

    const map = mapInstanceRef.current
    if (!map) return

    map.setView([effectiveCenter.latitude, effectiveCenter.longitude], zoom)
    map.invalidateSize()

    // Render / Update Marker
    if (marker && isValidCoordinates(marker.coords)) {
      if (markerRef.current) {
        markerRef.current.setLatLng([marker.coords.latitude, marker.coords.longitude])
      } else {
        const newMarker = L.marker([marker.coords.latitude, marker.coords.longitude], {
          icon: createPinIcon(),
        }).addTo(map)

        if (marker.label) {
          newMarker.bindPopup(marker.label)
        }
        markerRef.current = newMarker
      }
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }

    // Render / Update Service Area Circle
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
    } else if (circleRef.current) {
      circleRef.current.remove()
      circleRef.current = null
    }
  }, [effectiveCenter, zoom, marker, serviceArea, useGoogleMaps])

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
        center={effectiveCenter}
        marker={marker}
        className={className}
      />
    )
  }

  const styleHeight = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      ref={containerRef}
      style={{ height: styleHeight, width: '100%' }}
      className={`relative rounded-xl overflow-hidden shadow-xs border border-neutral-200 ${className}`}
    />
  )
}
