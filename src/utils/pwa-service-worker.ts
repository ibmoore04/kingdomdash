/**
 * PWA Service Worker Registration, Lifecycle, & Installation Utilities.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let swRegistration: ServiceWorkerRegistration | null = null

/**
 * Checks if the application is currently running as an installed PWA.
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const isStandalone =
    typeof window.matchMedia === 'function'
      ? Boolean(window.matchMedia('(display-mode: standalone)').matches)
      : false
  const isIosStandalone =
    typeof navigator !== 'undefined' &&
    (navigator as unknown as { standalone?: boolean }).standalone === true
  return isStandalone || isIosStandalone
}

export function setDeferredInstallPrompt(prompt: BeforeInstallPromptEvent | null): void {
  deferredPrompt = prompt
  if (prompt && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kd:pwa-installable'))
  }
}

/**
 * Checks if user device is iOS Safari (which requires manual "Add to Home Screen").
 */
export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

/**
 * Checks if user device is Android.
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /android/.test(userAgent)
}

/**
 * Checks if user is on Desktop or Laptop (Windows, Mac, Linux, Chromebook).
 */
export function isDesktopOrLaptop(): boolean {
  if (typeof window === 'undefined') return true
  return !isIosDevice() && !isAndroidDevice()
}

/**
 * Automatically downloads a standalone desktop launcher shortcut file (.html).
 */
export function downloadDesktopAppLauncher(): void {
  if (typeof window === 'undefined') return
  const origin = window.location.origin
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>KingdomDash Desktop App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="${origin}/KingdomDash-emblem.png">
  <script>
    const targetUrl = "${origin}/";
    window.location.replace(targetUrl);
  </script>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#fff;">
  <div style="text-align:center;padding:24px;">
    <img src="${origin}/KingdomDash-emblem.png" width="72" height="72" style="border-radius:16px;background:#000;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5);" />
    <h2 style="margin-top:16px;font-size:22px;letter-spacing:-0.02em;">Launching KingdomDash Desktop App...</h2>
    <p style="color:#94a3b8;font-size:14px;margin-top:8px;">Fast, offline-ready campus delivery across Ijebu-Ode.</p>
    <p style="margin-top:20px;"><a href="${origin}/" style="color:#f43f5e;font-weight:bold;text-decoration:none;background:rgba(244,63,94,0.15);padding:8px 18px;border-radius:9999px;">Click here if not redirected automatically</a></p>
  </div>
</body>
</html>`

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'KingdomDash-Desktop-App.html'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Returns current browser online status.
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

/**
 * Registers the KingdomDash service worker.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })
    swRegistration = reg

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('kd:pwa-update-available'))
          }
        })
      }
    })

    return reg
  } catch (err) {
    console.warn('[PWA] Service worker registration failed:', err)
    return null
  }
}

/**
 * Returns stored ServiceWorker registration.
 */
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return swRegistration
}

/**
 * Initializes global installation prompt listener.
 */
export function initializePwaInstallListener(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    window.dispatchEvent(new CustomEvent('kd:pwa-installable'))
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    window.dispatchEvent(new CustomEvent('kd:pwa-installed'))
  })
}

/**
 * Returns whether an installation prompt is primed and ready.
 */
export function canInstallPwa(): boolean {
  return Boolean(deferredPrompt)
}

/**
 * Prompts the user to install KingdomDash as a native PWA.
 */
export async function triggerPwaInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  if (!deferredPrompt) {
    return 'unsupported'
  }

  try {
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null
    return choice.outcome
  } catch (err) {
    console.error('[PWA] Error displaying install prompt:', err)
    return 'unsupported'
  }
}

// Auto-initialize install listeners in browser
if (typeof window !== 'undefined') {
  initializePwaInstallListener()
}
