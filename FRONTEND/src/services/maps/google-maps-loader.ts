import { appConfig } from '@/config/app.config'

/* eslint-disable @typescript-eslint/no-explicit-any */
let googleMapsPromise: Promise<any> | null = null

/**
 * Dynamically loads the Google Maps JavaScript API script.
 * Returns a singleton Promise that resolves when `window.google` is ready.
 */
export function loadGoogleMapsScript(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps script can only be loaded in a browser environment'))
  }

  // Already loaded
  if (window.google?.maps) {
    return Promise.resolve(window.google)
  }

  // Existing loading promise
  if (googleMapsPromise) {
    return googleMapsPromise
  }

  const apiKey = appConfig.maps.googleMapsApiKey

  if (!apiKey) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not configured'))
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if script element already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google)
        } else {
          reject(new Error('Google Maps script loaded but window.google.maps is undefined'))
        }
      })
      existingScript.addEventListener('error', (e) => reject(e))
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry`
    script.async = true
    script.defer = true

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google)
      } else {
        reject(new Error('Google Maps script loaded but window.google.maps is undefined'))
      }
    }

    script.onerror = () => {
      googleMapsPromise = null
      reject(new Error('Failed to load Google Maps JavaScript API script'))
    }

    document.head.appendChild(script)
  })

  return googleMapsPromise
}

/** Reset loader cache (useful for testing) */
export function _resetGoogleMapsLoader() {
  googleMapsPromise = null
}
