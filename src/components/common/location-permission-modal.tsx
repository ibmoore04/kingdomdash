import { useState } from 'react'
import {
  MapPin,
  Compass,
  AlertTriangle,
  CheckCircle,
  X,
  Smartphone,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Coordinates } from '@/types'
import { isValidCoordinates, getCurrentBrowserCoordinates } from '@/utils/geo'

export interface LocationPermissionModalProps {
  isOpen: boolean
  onClose: () => void
  onLocationGranted?: (coords: Coordinates) => void
}

export function LocationPermissionModal({
  isOpen,
  onClose,
  onLocationGranted,
}: LocationPermissionModalProps) {
  const [isPrompting, setIsPrompting] = useState(false)
  const [permissionState, setPermissionState] = useState<'idle' | 'success' | 'denied'>('idle')
  const [activeTab, setActiveTab] = useState<'chrome' | 'safari'>('chrome')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const isSecure = typeof window !== 'undefined' ? window.isSecureContext : true
  const isLocalIp = typeof window !== 'undefined' ? /^\d+\.\d+\.\d+\.\d+/.test(window.location.hostname) : false

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.')
      setPermissionState('denied')
      return
    }

    setIsPrompting(true)
    setErrorMessage(null)

    try {
      const coords = await getCurrentBrowserCoordinates()
      if (isValidCoordinates(coords)) {
        setPermissionState('success')
        if (onLocationGranted) {
          onLocationGranted(coords)
        }
        setTimeout(() => {
          onClose()
          setPermissionState('idle')
        }, 1200)
      } else {
        setErrorMessage('Received invalid GPS coordinates.')
        setPermissionState('denied')
      }
    } catch (err) {
      setPermissionState('denied')
      setErrorMessage(err instanceof Error ? err.message : 'Unable to access your location.')
    } finally {
      setIsPrompting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-permission-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
            <Compass className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h2 id="location-permission-title" className="text-base sm:text-lg font-bold text-neutral-900 leading-tight">
              Allow Location Access
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Enable GPS on your phone for precise doorstep delivery in Ijebu-Ode
            </p>
          </div>
        </div>

        {/* Insecure Origin / Local IP Alert Banner */}
        {(!isSecure || isLocalIp) && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Why the Location Switch is Missing in Chrome</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  You are browsing on <strong>HTTP</strong> ({typeof window !== 'undefined' ? window.location.host : 'local IP'}). Mobile Chrome hides the location switch on insecure HTTP connections.
                </p>
              </div>
            </div>
            {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
              <div className="pt-1">
                <a
                  href={`https://${window.location.host}${window.location.pathname}${window.location.search}`}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 px-3 text-xs font-bold text-white shadow-xs hover:bg-primary-hover transition-colors text-center"
                >
                  <span>Switch to HTTPS to Allow Location</span>
                  <span aria-hidden="true">&rarr;</span>
                </a>
                <p className="text-[10px] text-amber-700 mt-1 text-center">
                  (On first visit, tap &ldquo;Advanced&rdquo; &rarr; &ldquo;Proceed&rdquo;, then Chrome will prompt you for location!)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Success Feedback */}
        {permissionState === 'success' && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">Location Permission Granted!</p>
              <p className="text-[11px] text-emerald-800">Pinning your exact delivery doorstep now...</p>
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Permission Required</p>
              <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Big Action Button: Prompt Location Access Now */}
        <div className="mb-5">
          <Button
            type="button"
            variant="primary"
            onClick={handleRequestPermission}
            disabled={isPrompting || permissionState === 'success'}
            className="w-full rounded-xl py-3 text-sm font-bold shadow-md flex items-center justify-center gap-2"
          >
            {isPrompting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Prompting Browser... Check your phone screen</span>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" />
                <span>Prompt Location Access Now</span>
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-neutral-400 mt-1.5">
            Tap the button above. If a popup appears, select <strong>&quot;Allow&quot;</strong> or <strong>&quot;While using the app&quot;</strong>.
          </p>
        </div>

        {/* Step-by-Step Mobile Instructions */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-200/80">
            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-neutral-600" />
              <span>How to Allow on Your Phone:</span>
            </span>

            {/* Browser Selector Switch */}
            <div className="flex items-center rounded-lg bg-neutral-200/70 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('chrome')}
                className={`rounded-md px-2 py-0.5 transition-all ${
                  activeTab === 'chrome'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Chrome
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('safari')}
                className={`rounded-md px-2 py-0.5 transition-all ${
                  activeTab === 'safari'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                iPhone Safari
              </button>
            </div>
          </div>

          {activeTab === 'chrome' ? (
            <div className="space-y-2.5 text-xs text-neutral-700 leading-relaxed">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-blue-900 text-[11px]">
                <strong className="block font-semibold mb-1">Option A (Fastest - HTTPS):</strong>
                Tap the red button above or open <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">https://{typeof window !== 'undefined' ? window.location.host : '...'}</code>. When warned, tap <em>Advanced &rarr; Proceed</em>. Chrome will immediately pop up the native <strong>&ldquo;Allow Location&rdquo;</strong> prompt!
              </div>
              <div className="rounded-lg bg-neutral-100 border border-neutral-200 p-2.5 text-neutral-800 text-[11px]">
                <strong className="block font-semibold mb-1">Option B (Chrome Flag for Local Dev):</strong>
                Open a new tab in Chrome, type <code className="font-mono bg-neutral-200 px-1 py-0.5 rounded">chrome://flags</code>, search for <em>&ldquo;Insecure origins treated as secure&rdquo;</em>, add <code className="font-mono bg-neutral-200 px-1 py-0.5 rounded">{typeof window !== 'undefined' ? `http://${window.location.host}` : ''}</code>, set to <em>Enabled</em> and tap <em>Relaunch</em>.
              </div>
            </div>
          ) : (
            <ol className="space-y-2 text-xs text-neutral-700 list-decimal list-inside leading-relaxed">
              <li>
                Tap the <strong className="font-bold">&quot;aA&quot;</strong> icon on the left side of your Safari address bar.
              </li>
              <li>
                Tap <strong>Website Settings</strong>.
              </li>
              <li>
                Tap <strong>Location</strong> and select{' '}
                <span className="font-bold text-emerald-700">Allow</span>.
              </li>
              <li>
                <em>(Or in iPhone Settings):</em> Open <strong>Settings &rarr; Safari &rarr; Location &rarr; Allow</strong>.
              </li>
              <li>
                Return here and tap <strong>&quot;Prompt Location Access Now&quot;</strong>!
              </li>
            </ol>
          )}
        </div>

        {/* Modal Footer / Fallback */}
        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">Can&apos;t enable GPS?</span>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs font-bold text-primary hover:bg-primary/5 py-1 px-3 h-auto"
          >
            Enter Street Manually &rarr;
          </Button>
        </div>
      </div>
    </div>
  )
}
