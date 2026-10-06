import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw, AlertCircle } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { getQueuedDeliveryActions } from '@/services/rider/offline-delivery-queue'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [justReconnected, setJustReconnected] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
      setQueuedCount(getQueuedDeliveryActions().length)
    } else if (wasOffline) {
      setJustReconnected(true)
      setQueuedCount(getQueuedDeliveryActions().length)
      const timer = setTimeout(() => {
        setJustReconnected(false)
        setWasOffline(false)
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  // Periodic poll of queue count while offline
  useEffect(() => {
    if (isOnline) return
    const interval = setInterval(() => {
      setQueuedCount(getQueuedDeliveryActions().length)
    }, 2500)
    return () => clearInterval(interval)
  }, [isOnline])

  const handleManualRetry = () => {
    if (navigator.onLine) {
      setJustReconnected(true)
      setTimeout(() => setJustReconnected(false), 3000)
    } else {
      window.location.reload()
    }
  }

  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[9999] w-full bg-emerald-600 text-white px-4 py-2 text-center flex items-center justify-center gap-2 text-xs font-bold sm:text-sm shadow-md animate-slide-down"
      >
        <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Connection restored! Synchronizing latest delivery and order updates.</span>
      </div>
    )
  }

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[9999] w-full bg-amber-500 text-slate-950 px-4 py-2 shadow-md transition-all animate-slide-down"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 text-xs font-bold sm:text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <WifiOff className="h-4 w-4 shrink-0 animate-pulse text-slate-950" aria-hidden="true" />
          <span>You are currently offline. Operating in Local Cache Mode.</span>
          {queuedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 text-white px-2 py-0.5 text-[11px] font-bold">
              <AlertCircle className="h-3 w-3 text-amber-400" />
              {queuedCount} {queuedCount === 1 ? 'action' : 'actions'} queued
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] opacity-90 hidden md:inline font-normal">
            Cached menus &amp; deliveries remain available.
          </span>
          <button
            type="button"
            onClick={handleManualRetry}
            className="inline-flex items-center gap-1 rounded-md bg-slate-950 hover:bg-slate-800 text-white px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    </div>
  )
}
