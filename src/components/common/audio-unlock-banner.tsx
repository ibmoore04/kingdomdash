import { useState, useEffect } from 'react'
import { Volume2, VolumeX, Check, X } from 'lucide-react'
import { isAudioUnlocked, unlockAudioContext, playKitchenOrderChime } from '@/utils/audio-chime'

export interface AudioUnlockBannerProps {
  label?: string
  className?: string
}

export function AudioUnlockBanner({
  label = 'Tap to enable order audio alerts',
  className = '',
}: AudioUnlockBannerProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [justActivated, setJustActivated] = useState(false)

  useEffect(() => {
    // Initial check
    if (isAudioUnlocked()) {
      setUnlocked(true)
      return
    }

    // Polling interval or listener to check if unlocked by another interaction
    const interval = setInterval(() => {
      if (isAudioUnlocked()) {
        setUnlocked(true)
        clearInterval(interval)
      }
    }, 1500)

    return () => clearInterval(interval)
  }, [])

  if (unlocked || dismissed) {
    if (justActivated) {
      return (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-white shadow-xl animate-fade-in ${className}`}>
          <Check className="h-4 w-4" />
          <span className="text-xs font-bold">Audio alerts active</span>
        </div>
      )
    }
    return null
  }

  const handleUnlock = async () => {
    const success = await unlockAudioContext()
    if (success) {
      setUnlocked(true)
      setJustActivated(true)
      playKitchenOrderChime()
      setTimeout(() => setJustActivated(false), 3000)
    }
  }

  return (
    <div
      role="region"
      aria-label="Audio alert activation"
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 flex items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-neutral-900/95 p-3.5 text-white shadow-2xl backdrop-blur-md transition-all ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <Volume2 className="h-4 w-4 animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-bold text-white leading-tight">{label}</p>
          <p className="text-[10px] text-neutral-400 leading-tight">
            Browser requires a tap to unblock background sounds
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleUnlock}
          className="rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-extrabold text-neutral-950 transition-colors shadow-xs"
        >
          Enable
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss audio alert banner"
          className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
