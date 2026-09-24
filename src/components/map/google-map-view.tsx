import React, { useEffect, useRef, useState } from 'react'
import type { Coordinates } from '@/types'
import { loadGoogleMapsScript } from '@/services/maps/google-maps-loader'

export interface GoogleMapViewProps {
  center: Coordinates
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
  draggableMarker?: boolean
  onMarkerDragEnd?: (coords: Coordinates) => void
  onMapClick?: (coords: Coordinates) => void
  onError?: (err: Error) => void
}

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  center,
  zoom = 15,
  marker,
  serviceArea,
  height = 240,
  className = '',
  draggableMarker = false,
  onMarkerDragEnd,
  onMapClick,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const circleRef = useRef<google.maps.Circle | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let isMounted = true

    loadGoogleMapsScript()
      .then((googleObj) => {
        if (!isMounted || !containerRef.current) return

        if (!mapRef.current) {
          const map = new googleObj.maps.Map(containerRef.current, {
            center: { lat: center.latitude, lng: center.longitude },
            zoom,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }],
              },
            ],
          })

          mapRef.current = map

          if (onMapClick) {
            map.addListener('click', (e: google.maps.MapMouseEvent) => {
              if (e.latLng) {
                onMapClick({ latitude: e.latLng.lat(), longitude: e.latLng.lng() })
              }
            })
          }
        }

        setIsLoaded(true)
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('[GoogleMapView] Failed to load Google Maps JS API:', err)
          if (onError) onError(err)
        }
      })

    return () => {
      isMounted = false
    }
  }, [onError, onMapClick])

  // Update map center & zoom
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      mapRef.current.setCenter({ lat: center.latitude, lng: center.longitude })
      mapRef.current.setZoom(zoom)
    }
  }, [center, zoom, isLoaded])

  // Update marker
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !window.google) return

    const targetCoords = marker ? marker.coords : center

    if (!markerRef.current) {
      const gMarker = new window.google.maps.Marker({
        position: { lat: targetCoords.latitude, lng: targetCoords.longitude },
        map: mapRef.current,
        draggable: draggableMarker,
        title: marker?.label || 'Target Location',
        icon: {
          path: 'M12 0C5.37 0 0 5.37 0 12c0 8.25 12 18 12 18s12-9.75 12-18c0-6.63-5.37-12-12-12zm0 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z',
          fillColor: '#E50914',
          fillOpacity: 1,
          scale: 1.2,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          anchor: new window.google.maps.Point(12, 30),
        },
      })

      if (draggableMarker && onMarkerDragEnd) {
        gMarker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            onMarkerDragEnd({ latitude: e.latLng.lat(), longitude: e.latLng.lng() })
          }
        })
      }

      markerRef.current = gMarker
    } else {
      markerRef.current.setPosition({ lat: targetCoords.latitude, lng: targetCoords.longitude })
    }
  }, [center, marker, draggableMarker, onMarkerDragEnd, isLoaded])

  // Update service area circle
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !window.google) return

    if (serviceArea) {
      if (!circleRef.current) {
        circleRef.current = new window.google.maps.Circle({
          strokeColor: '#E50914',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#E50914',
          fillOpacity: 0.1,
          map: mapRef.current,
          center: { lat: serviceArea.center.latitude, lng: serviceArea.center.longitude },
          radius: serviceArea.radiusKm * 1000,
        })
      } else {
        circleRef.current.setCenter({
          lat: serviceArea.center.latitude,
          lng: serviceArea.center.longitude,
        })
        circleRef.current.setRadius(serviceArea.radiusKm * 1000)
      }
    }
  }, [serviceArea, isLoaded])

  const styleHeight = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      ref={containerRef}
      style={{ height: styleHeight, width: '100%' }}
      className={`relative rounded-xl overflow-hidden shadow-xs ${className}`}
    />
  )
}
