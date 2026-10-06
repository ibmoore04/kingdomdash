import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import {
  isOnline,
  isStandalonePwa,
  isIosDevice,
  canInstallPwa,
  triggerPwaInstall,
} from '@/utils/pwa-service-worker'
import {
  isPushNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  displayNotification,
} from '@/utils/web-push'
import { OfflineBanner } from '@/components/shared/offline-banner'
import { PwaInstallBanner } from '@/components/common/pwa-install-banner'
import * as offlineQueueModule from '@/services/rider/offline-delivery-queue'

describe('Phase 2: Full PWA Experience & Offline Service Worker Shell', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  describe('PWA Lifecycle Utilities', () => {
    it('detects online/offline status correctly', () => {
      expect(isOnline()).toBe(true)

      vi.stubGlobal('navigator', {
        ...window.navigator,
        onLine: false,
      })
      expect(isOnline()).toBe(false)
    })

    it('detects standalone display mode', () => {
      // Default non-standalone
      expect(isStandalonePwa()).toBe(false)

      // Mock matchMedia standalone
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      expect(isStandalonePwa()).toBe(true)
    })

    it('identifies iOS user agents', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      })
      expect(isIosDevice()).toBe(true)

      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
      })
      expect(isIosDevice()).toBe(false)
    })
  })

  describe('Web Push Notification Foundation', () => {
    it('verifies notification support and permission state', () => {
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      })

      expect(isPushNotificationSupported()).toBe(true)
      expect(getNotificationPermission()).toBe('default')
    })

    it('requests notification permission via browser API', async () => {
      const requestMock = vi.fn().mockResolvedValue('granted')
      vi.stubGlobal('Notification', {
        permission: 'default',
        requestPermission: requestMock,
      })

      const status = await requestNotificationPermission()
      expect(status).toBe('granted')
      expect(requestMock).toHaveBeenCalled()
    })

    it('triggers native notification with KingdomDash icon and sound vibration pattern', async () => {
      const showNotificationMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('Notification', {
        permission: 'granted',
      })
      vi.stubGlobal('navigator', {
        serviceWorker: {
          ready: Promise.resolve({
            showNotification: showNotificationMock,
          }),
        },
      })

      const result = await displayNotification('Order En Route', {
        body: 'Rider is arriving at TASUED Gate.',
      })

      expect(result).toBe(true)
      expect(showNotificationMock).toHaveBeenCalledWith(
        'Order En Route',
        expect.objectContaining({
          body: 'Rider is arriving at TASUED Gate.',
          icon: '/KingdomDash-emblem.png',
          vibrate: [120, 60, 150],
        })
      )
    })
  })

  describe('OfflineBanner Component', () => {
    it('renders nothing when browser is online', () => {
      vi.stubGlobal('navigator', { ...window.navigator, onLine: true })
      render(<OfflineBanner />)
      expect(screen.queryByText(/You are currently offline/i)).not.toBeInTheDocument()
    })

    it('renders offline warning with queued items count and retry button when offline', () => {
      vi.stubGlobal('navigator', { ...window.navigator, onLine: false })
      vi.spyOn(offlineQueueModule, 'getQueuedDeliveryActions').mockReturnValue([
        {
          id: '1',
          orderId: 'order-1',
          actionType: 'delivered',
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
      ])

      render(<OfflineBanner />)

      expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument()
      expect(screen.getByText(/1 action queued/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })
  })

  describe('PwaInstallBanner Component', () => {
    it('renders PWA installation prompt with emblem and actions', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false })

      render(<PwaInstallBanner />)

      // Emitting installable event activates banner
      act(() => {
        window.dispatchEvent(new CustomEvent('kd:pwa-installable'))
      })

      expect(screen.getByText(/Install KingdomDash/i)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /(Install App|How to Install|Download)/i })
      ).toBeInTheDocument()
      expect(screen.getByText(/Maybe Later/i)).toBeInTheDocument()
    })

    it('dismisses banner and sets snooze timestamp when Maybe Later is clicked', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false })

      render(<PwaInstallBanner />)

      act(() => {
        window.dispatchEvent(new CustomEvent('kd:pwa-installable'))
      })

      const dismissBtn = screen.getByText(/Maybe Later/i)
      fireEvent.click(dismissBtn)

      expect(screen.queryByText(/Install KingdomDash/i)).not.toBeInTheDocument()
      expect(localStorage.getItem('kd_pwa_install_dismissed_until')).not.toBeNull()
    })
  })
})
