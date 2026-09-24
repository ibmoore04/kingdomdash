import { describe, it, expect, beforeEach } from 'vitest'
import { loadGoogleMapsScript, _resetGoogleMapsLoader } from '../google-maps-loader'
import { appConfig } from '@/config/app.config'

describe('Google Maps Script Loader', () => {
  beforeEach(() => {
    _resetGoogleMapsLoader()
    // Clean up injected script tags
    document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((s) => s.remove())
  })

  it('rejects when VITE_GOOGLE_MAPS_API_KEY is not configured', async () => {
    // appConfig.maps.googleMapsApiKey defaults to empty string in test environment
    if (!appConfig.maps.googleMapsApiKey) {
      await expect(loadGoogleMapsScript()).rejects.toThrow('VITE_GOOGLE_MAPS_API_KEY is not configured')
    }
  })

  it('resolves immediately if window.google.maps is already loaded', async () => {
    const mockGoogle = { maps: {} }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).google = mockGoogle

    const result = await loadGoogleMapsScript()
    expect(result).toBe(mockGoogle)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).google
  })
})
