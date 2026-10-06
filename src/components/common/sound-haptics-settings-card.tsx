import { useState, useEffect } from 'react'
import {
  Volume2,
  VolumeX,
  Volume1,
  Vibrate,
  Bell,
  Play,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import {
  isGlobalSoundEnabled,
  setGlobalSoundEnabled,
  getAudioVolume,
  setAudioVolume,
  isHapticsEnabled,
  setHapticsEnabled,
  triggerHapticFeedback,
  playKitchenOrderChime,
  playDispatchAlertChime,
  playLockoutAlertBeep,
  type AudioVolumeLevel,
} from '@/utils/audio-chime'

export interface SoundHapticsSettingsCardProps {
  className?: string
  title?: string
  description?: string
  showTester?: boolean
}

export function SoundHapticsSettingsCard({
  className = '',
  title = 'Sound & Haptic Alerts',
  description = 'Manage synthesized order chime volume, library quiet mode, and phone vibration cues.',
  showTester = true,
}: SoundHapticsSettingsCardProps) {
  const [soundEnabled, setSoundEnabledState] = useState(true)
  const [volumeLevel, setVolumeLevelState] = useState<AudioVolumeLevel>('medium')
  const [hapticsEnabled, setHapticsEnabledState] = useState(true)
  const [activeTestTone, setActiveTestTone] = useState<string | null>(null)

  // Initialize from storage
  useEffect(() => {
    setSoundEnabledState(isGlobalSoundEnabled())
    setVolumeLevelState(getAudioVolume())
    setHapticsEnabledState(isHapticsEnabled())

    const handleSoundChange = (e: Event) => {
      const custom = e as CustomEvent<{ enabled: boolean }>
      setSoundEnabledState(custom.detail?.enabled ?? isGlobalSoundEnabled())
    }

    const handleVolumeChange = (e: Event) => {
      const custom = e as CustomEvent<{ level: AudioVolumeLevel }>
      setVolumeLevelState(custom.detail?.level ?? getAudioVolume())
    }

    const handleHapticsChange = (e: Event) => {
      const custom = e as CustomEvent<{ enabled: boolean }>
      setHapticsEnabledState(custom.detail?.enabled ?? isHapticsEnabled())
    }

    window.addEventListener('kd:sound-preference-changed', handleSoundChange)
    window.addEventListener('kd:sound-volume-changed', handleVolumeChange)
    window.addEventListener('kd:haptics-preference-changed', handleHapticsChange)

    return () => {
      window.removeEventListener('kd:sound-preference-changed', handleSoundChange)
      window.removeEventListener('kd:sound-volume-changed', handleVolumeChange)
      window.removeEventListener('kd:haptics-preference-changed', handleHapticsChange)
    }
  }, [])

  const handleToggleSound = () => {
    const next = !soundEnabled
    setSoundEnabledState(next)
    setGlobalSoundEnabled(next)
    if (next) {
      playDispatchAlertChime().catch(() => {})
    }
  }

  const handleVolumeSelect = (level: AudioVolumeLevel) => {
    setVolumeLevelState(level)
    setAudioVolume(level)
    // Play quick feedback tone at selected volume
    playKitchenOrderChime().catch(() => {})
  }

  const handleToggleHaptics = () => {
    const next = !hapticsEnabled
    setHapticsEnabledState(next)
    setHapticsEnabled(next)
    if (next) {
      triggerHapticFeedback([100, 50, 100])
    }
  }

  const handleTestTone = async (toneType: 'kitchen' | 'dispatch' | 'lockout') => {
    setActiveTestTone(toneType)
    try {
      if (toneType === 'kitchen') {
        triggerHapticFeedback('info')
        await playKitchenOrderChime()
      } else if (toneType === 'dispatch') {
        triggerHapticFeedback('success')
        await playDispatchAlertChime()
      } else {
        triggerHapticFeedback('error')
        await playLockoutAlertBeep()
      }
    } finally {
      setTimeout(() => setActiveTestTone(null), 800)
    }
  }

  return (
    <section
      data-testid="sound-haptics-settings-card"
      className={`rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/70 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
            {soundEnabled ? (
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <VolumeX className="h-5 w-5 text-neutral-400" aria-hidden="true" />
            )}
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary leading-tight">{title}</h3>
            <p className="text-caption text-text-secondary mt-0.5 leading-snug">{description}</p>
          </div>
        </div>

        <div>
          {soundEnabled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-[11px] font-bold border border-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              Audible Chimes Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 text-neutral-600 px-3 py-1 text-[11px] font-bold border border-neutral-200">
              <VolumeX className="h-3 w-3" />
              Quiet / Library Mode
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Master Sound Alert Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-body font-semibold text-text-primary block">
              Audible Notification Chimes
            </span>
            <span className="text-caption text-text-secondary block mt-0.5">
              Synthesizes real-time tones for order status updates, kitchen alerts, and delivery milestones.
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            aria-label="Toggle audible notification chimes"
            onClick={handleToggleSound}
            className="relative inline-flex items-center justify-center p-2 -mr-2 min-h-[44px] min-w-[48px] shrink-0 cursor-pointer"
          >
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                soundEnabled ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>

        {/* Volume Level Segmented Control */}
        <div className="border-t border-border/60 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
            <div>
              <span className="text-body-small font-semibold text-text-primary block">Alert Volume</span>
              <span className="text-caption text-text-secondary">
                Adjust chime loudness for indoor study halls or busy street environments.
              </span>
            </div>
            <span className="text-caption font-bold text-primary capitalize self-start sm:self-auto">
              {volumeLevel === 'low' ? 'Low (35%)' : volumeLevel === 'high' ? 'High (100%)' : 'Normal (70%)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'low', label: 'Discreet', icon: Volume1, sub: 'Study Halls' },
              { id: 'medium', label: 'Normal', icon: Volume2, sub: 'Campus Standard' },
              { id: 'high', label: 'Loud', icon: Sparkles, sub: 'Road Noise / Kitchen' },
            ].map((vol) => {
              const Icon = vol.icon
              const isSelected = volumeLevel === vol.id
              return (
                <button
                  key={vol.id}
                  type="button"
                  disabled={!soundEnabled}
                  onClick={() => handleVolumeSelect(vol.id as AudioVolumeLevel)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    !soundEnabled
                      ? 'opacity-40 cursor-not-allowed bg-neutral-50 border-neutral-200'
                      : isSelected
                      ? 'border-primary bg-primary-soft/50 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-white hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 mb-1 ${isSelected ? 'text-primary' : 'text-neutral-500'}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-xs font-bold block ${isSelected ? 'text-primary-hover font-extrabold' : 'text-text-primary'}`}
                  >
                    {vol.label}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5">{vol.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Mobile Haptic Vibration Toggle */}
        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
              <Vibrate className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <span className="text-body-small font-semibold text-text-primary block">
                Mobile Haptic Vibration
              </span>
              <span className="text-caption text-text-secondary block mt-0.5">
                Vibrates supported Android & PWA smartphone devices when dispatch offers or orders arrive.
              </span>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={hapticsEnabled}
            aria-label="Toggle haptic vibration feedback"
            onClick={handleToggleHaptics}
            className="relative inline-flex items-center justify-center p-2 -mr-2 min-h-[44px] min-w-[48px] shrink-0 cursor-pointer"
          >
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                hapticsEnabled ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>

        {/* Tone Sandbox Preview Tester */}
        {showTester && (
          <div className="border-t border-border/60 pt-4 bg-neutral-50/70 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-5 sm:p-6 rounded-b-2xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Interactive Sound Sandbox
              </span>
              <span className="text-[11px] text-neutral-400">Click to preview hardware audio</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleTestTone('kitchen')}
                className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-all ${
                  activeTestTone === 'kitchen'
                    ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-800'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">🛎️ Kitchen Bell</span>
                  <span className="text-[10px] text-neutral-500">Order Placed</span>
                </div>
                <Play className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleTestTone('dispatch')}
                className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-all ${
                  activeTestTone === 'dispatch'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900 shadow-xs'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-800'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">🛵 Dispatch Horn</span>
                  <span className="text-[10px] text-neutral-500">Rider On Way</span>
                </div>
                <Play className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleTestTone('lockout')}
                className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-all ${
                  activeTestTone === 'lockout'
                    ? 'border-rose-400 bg-rose-50 text-rose-900 shadow-xs'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-800'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">⚠️ Security Alert</span>
                  <span className="text-[10px] text-neutral-500">PIN / Attention</span>
                </div>
                <Play className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
