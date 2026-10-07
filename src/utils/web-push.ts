/**
 * Web Push Notification Utilities & Permission Bridge.
 */

import { getServiceWorkerRegistration } from './pwa-service-worker'

export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported'

/**
 * Checks if browser supports Web Notifications.
 */
export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Returns current notification permission state.
 */
export function getNotificationPermission(): PushPermissionStatus {
  if (!isPushNotificationSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Prompts user for system notification permission.
 */
export async function requestNotificationPermission(): Promise<PushPermissionStatus> {
  if (!isPushNotificationSupported()) return 'unsupported'

  try {
    const result = await Notification.requestPermission()
    return result
  } catch (err) {
    console.warn('[WebPush] Error requesting notification permission:', err)
    return getNotificationPermission()
  }
}

/**
 * Triggers a native system notification via the Service Worker registration,
 * or falls back to desktop Notification constructor.
 */
export async function displayNotification(
  title: string,
  options: NotificationOptions & { url?: string } = {}
): Promise<boolean> {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') {
    return false
  }

  const enhancedOptions: NotificationOptions & { vibrate?: number[] } = {
    icon: '/KingdomDash-emblem.png',
    badge: '/favicon.svg',
    vibrate: [120, 60, 150],
    ...options,
    data: {
      url: options.url || '/',
      ...(typeof options.data === 'object' && options.data !== null ? options.data : {}),
    },
  }

  try {
    const swReg = getServiceWorkerRegistration() || (await navigator.serviceWorker?.ready)
    if (swReg && 'showNotification' in swReg) {
      await swReg.showNotification(title, enhancedOptions)
      return true
    }

    // Direct browser notification fallback
    new Notification(title, enhancedOptions)
    return true
  } catch (err) {
    console.warn('[WebPush] Failed to show notification:', err)
    return false
  }
}
