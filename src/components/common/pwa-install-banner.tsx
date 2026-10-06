import { useState, useEffect } from 'react'
import {
  Download,
  X,
  Share,
  Sparkles,
  Smartphone,
  Laptop,
  MoreVertical,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  isStandalonePwa,
  isIosDevice,
  isAndroidDevice,
  isDesktopOrLaptop,
  canInstallPwa,
  triggerPwaInstall,
  downloadDesktopAppLauncher,
} from '@/utils/pwa-service-worker'
import { useUiStore } from '@/stores/ui-store'

const DISMISS_STORAGE_KEY = 'kd_pwa_install_dismissed_until'
const SNOOZE_DURATION_DAYS = 5

export function PwaInstallBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isLaptop, setIsLaptop] = useState(true)
  const [showInstructions, setShowInstructions] = useState(false)
  const [activeTab, setActiveTab] = useState<'laptop' | 'android' | 'ios'>('laptop')
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // If running standalone or already installed, never show
    if (isStandalonePwa()) return

    // Check snooze timestamp
    const dismissedUntil = localStorage.getItem(DISMISS_STORAGE_KEY)
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      return
    }

    const ios = isIosDevice()
    const android = isAndroidDevice()
    const laptop = isDesktopOrLaptop()

    setIsIos(ios)
    setIsAndroid(android)
    setIsLaptop(laptop)

    if (laptop) {
      setActiveTab('laptop')
    } else if (android) {
      setActiveTab('android')
    } else if (ios) {
      setActiveTab('ios')
    }

    // Always show banner for responsive installation
    const checkCanShow = () => {
      if (isStandalonePwa()) return
      setShowBanner(true)
    }

    checkCanShow()

    const handleInstallable = () => {
      if (!isStandalonePwa()) {
        setShowBanner(true)
      }
    }
    const handleInstalled = () => setShowBanner(false)

    window.addEventListener('kd:pwa-installable', handleInstallable)
    window.addEventListener('kd:pwa-installed', handleInstalled)

    // Fallback: Show on mobile & desktop browsers after 3 seconds
    const timer = setTimeout(() => {
      if (!isStandalonePwa() && !dismissedUntil) {
        setShowBanner(true)
      }
    }, 3000)

    return () => {
      window.removeEventListener('kd:pwa-installable', handleInstallable)
      window.removeEventListener('kd:pwa-installed', handleInstalled)
      clearTimeout(timer)
    }
  }, [])

  const handleInstallClick = async () => {
    setInstalling(true)

    try {
      // If user is on Laptop / PC, automatically download the desktop launcher shortcut
      if (isLaptop) {
        downloadDesktopAppLauncher()
        useUiStore.getState().pushToast({
          title: 'Desktop App Downloaded',
          message: 'KingdomDash-Desktop-App.html downloaded. Click to launch anytime!',
          variant: 'success',
        })
      }

      // If browser has native prompt available, trigger it
      if (canInstallPwa()) {
        const outcome = await triggerPwaInstall()
        if (outcome === 'accepted') {
          setShowBanner(false)
          return
        }
      }

      // Show platform-specific instructions
      if (isLaptop) {
        setActiveTab('laptop')
      } else if (isAndroid) {
        setActiveTab('android')
      } else {
        setActiveTab('ios')
      }

      setShowInstructions(true)
    } finally {
      setInstalling(false)
    }
  }

  const handleManualDownload = () => {
    downloadDesktopAppLauncher()
    useUiStore.getState().pushToast({
      title: 'App Shortcut Downloaded',
      message: 'Launch KingdomDash directly from your Downloads folder.',
      variant: 'success',
    })
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setShowInstructions(false)
    const snoozeTime = Date.now() + SNOOZE_DURATION_DAYS * 24 * 60 * 60 * 1000
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(snoozeTime))
    } catch {
      // Storage unavailable
    }
  }

  if (!showBanner || isStandalonePwa()) {
    return null
  }

  return (
    <>
      {/* Floating Bottom Installation Bar */}
      <aside
        aria-label="Install KingdomDash application"
        className="fixed bottom-16 sm:bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-50 sm:max-w-md rounded-2xl border border-primary/20 bg-neutral-900/95 text-white p-4 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-start gap-3">
          <img
            src="/KingdomDash-emblem.png"
            alt="KingdomDash Emblem"
            className="h-11 w-11 shrink-0 rounded-xl bg-black border border-white/10 p-1 object-contain shadow-xs"
          />

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-body-small font-bold text-white tracking-tight">
                {isLaptop ? 'Install KingdomDash on PC / Laptop' : 'Install KingdomDash App'}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/20 border border-primary/30 px-1.5 py-0.2 text-[9px] font-bold text-primary-soft">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
                Fast
              </span>
            </div>

            <p className="text-caption text-neutral-300 leading-snug line-clamp-2">
              {isLaptop
                ? 'Install as a standalone desktop app or download instant 1-click launcher.'
                : 'Add to Home Screen for 1-tap ordering, lock-screen updates & campus offline sync.'}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleInstallClick}
                disabled={installing}
                className="bg-primary hover:bg-primary-hover text-white text-caption font-bold px-3 py-1.5 h-8 gap-1.5 rounded-lg shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                {installing
                  ? 'Opening...'
                  : canInstallPwa()
                  ? 'Install App'
                  : isLaptop
                  ? 'Download / Install App'
                  : 'How to Install'}
              </Button>

              <button
                type="button"
                onClick={handleDismiss}
                className="text-caption text-neutral-400 hover:text-white px-2 py-1 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss app install banner"
            className="absolute top-3 right-3 rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Universal Multi-Platform Installation Modal (Laptop, Android & iOS) */}
      {showInstructions && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-neutral-900 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/KingdomDash-emblem.png"
                  alt="KingdomDash"
                  className="h-8 w-8 rounded-lg object-contain bg-black p-0.5"
                />
                <div>
                  <h3 id="install-guide-title" className="text-body font-bold text-text-primary leading-tight">
                    Install KingdomDash
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-medium">Select your device for quick setup</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                aria-label="Close instructions"
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Platform Selector Tabs: Laptop, Android, iOS */}
            <div className="grid grid-cols-3 rounded-xl bg-neutral-100 p-1 mb-4 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('laptop')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'laptop'
                    ? 'bg-white text-primary shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Laptop className="h-3.5 w-3.5" />
                <span>Laptop / PC</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'android'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                <span>Android</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'ios'
                    ? 'bg-white text-blue-800 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Share className="h-3.5 w-3.5 text-blue-600" />
                <span>iPhone / iPad</span>
              </button>
            </div>

            {/* 1. Laptop / Desktop Instructions */}
            {activeTab === 'laptop' && (
              <div className="space-y-4 my-3 text-left">
                <ol className="space-y-3 text-body-small text-text-secondary">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                      1
                    </span>
                    <span>
                      Look at your browser&apos;s address bar (URL bar) at the top right. Click the{' '}
                      <strong className="text-text-primary font-semibold">Install</strong> icon{' '}
                      (computer with a down arrow).
                    </span>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                      2
                    </span>
                    <span>
                      Click <strong className="text-text-primary font-semibold">Install</strong> on the prompt. KingdomDash will open in its own clean desktop window!
                    </span>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                      3
                    </span>
                    <span>
                      Or use browser menu: click <strong>⋮</strong> (three dots) &gt;{' '}
                      <strong>Save and share</strong> &gt; <strong>Install KingdomDash</strong>.
                    </span>
                  </li>
                </ol>

                {/* Instant Download Shortcut Button */}
                <div className="pt-2 border-t border-neutral-100">
                  <Button
                    type="button"
                    onClick={handleManualDownload}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold h-9 gap-1.5 text-xs rounded-xl"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    <span>Download Desktop App Launcher (.html)</span>
                  </Button>
                  <p className="text-[10px] text-neutral-500 text-center mt-1">
                    Opens KingdomDash full-screen without address bar clutter.
                  </p>
                </div>
              </div>
            )}

            {/* 2. Android Instructions */}
            {activeTab === 'android' && (
              <ol className="space-y-3.5 text-body-small text-text-secondary my-4 text-left">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    1
                  </span>
                  <span>
                    Tap the <strong className="text-text-primary font-semibold">Menu</strong> icon{' '}
                    <MoreVertical className="inline h-4 w-4 text-emerald-600 align-text-bottom mx-0.5" /> (three dots) in the top-right corner of Chrome or Samsung Internet.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    2
                  </span>
                  <span>
                    Tap <strong className="text-text-primary font-semibold">&quot;Install app&quot;</strong> or{' '}
                    <strong className="text-text-primary font-semibold">&quot;Add to Home screen&quot;</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    3
                  </span>
                  <span>
                    Confirm by tapping <strong className="text-text-primary font-semibold">Install</strong>. Done! KingdomDash is now on your app home screen.
                  </span>
                </li>
              </ol>
            )}

            {/* 3. iOS Instructions */}
            {activeTab === 'ios' && (
              <ol className="space-y-3.5 text-body-small text-text-secondary my-4 text-left">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                    1
                  </span>
                  <span>
                    Tap the <strong className="text-text-primary font-semibold">Share</strong> button{' '}
                    <Share className="inline h-4 w-4 text-blue-600 align-text-bottom mx-0.5" /> at the bottom of Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong className="text-text-primary font-semibold">Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                    3
                  </span>
                  <span>
                    Tap <strong className="text-text-primary font-semibold">Add</strong> in the top right corner. Done!
                  </span>
                </li>
              </ol>
            )}

            <div className="mt-3 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center gap-2 text-[11px] text-neutral-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Zero Play Store / App Store download required • Instant offline updates</span>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => setShowInstructions(false)}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold h-10 rounded-xl"
              >
                Got It
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
