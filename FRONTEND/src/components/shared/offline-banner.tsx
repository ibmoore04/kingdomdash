import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[9999] w-full bg-amber-500 text-slate-950 px-4 py-2 shadow-md transition-all animate-slide-down"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-xs font-bold sm:text-sm">
        <WifiOff className="h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />
        <span>You are currently offline. Actions will sync once your internet connection is restored.</span>
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin ml-1" aria-hidden="true" />
      </div>
    </div>
  )
}
