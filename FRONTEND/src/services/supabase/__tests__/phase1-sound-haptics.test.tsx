import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  isGlobalSoundEnabled,
  setGlobalSoundEnabled,
  getAudioVolume,
  setAudioVolume,
  getAudioVolumeMultiplier,
  isHapticsEnabled,
  setHapticsEnabled,
  triggerHapticFeedback,
} from '@/utils/audio-chime'
import { SoundHapticsSettingsCard } from '@/components/common/sound-haptics-settings-card'

describe('Phase 1: Sound & Haptics Control Center', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Audio Volume Levels & Multipliers', () => {
    it('defaults to medium volume with 0.7 multiplier', () => {
      expect(getAudioVolume()).toBe('medium')
      expect(getAudioVolumeMultiplier()).toBe(0.7)
    })

    it('updates to low volume with 0.35 multiplier and persists to localStorage', () => {
      const listener = vi.fn()
      window.addEventListener('kd:sound-volume-changed', listener)

      setAudioVolume('low')
      expect(getAudioVolume()).toBe('low')
      expect(getAudioVolumeMultiplier()).toBe(0.35)
      expect(localStorage.getItem('kd_sound_volume_level')).toBe('low')
      expect(listener).toHaveBeenCalledTimes(1)

      window.removeEventListener('kd:sound-volume-changed', listener)
    })

    it('updates to high volume with 1.0 multiplier and persists to localStorage', () => {
      setAudioVolume('high')
      expect(getAudioVolume()).toBe('high')
      expect(getAudioVolumeMultiplier()).toBe(1.0)
      expect(localStorage.getItem('kd_sound_volume_level')).toBe('high')
    })
  })

  describe('Global Sound & Library Mode Silencing', () => {
    it('defaults to globally enabled', () => {
      expect(isGlobalSoundEnabled()).toBe(true)
    })

    it('silences audio when disabled and dispatches preference change event', () => {
      const listener = vi.fn()
      window.addEventListener('kd:sound-preference-changed', listener)

      setGlobalSoundEnabled(false)
      expect(isGlobalSoundEnabled()).toBe(false)
      expect(localStorage.getItem('kd_sound_alerts_enabled')).toBe('false')
      expect(listener).toHaveBeenCalledTimes(1)

      setGlobalSoundEnabled(true)
      expect(isGlobalSoundEnabled()).toBe(true)
      expect(localStorage.getItem('kd_sound_alerts_enabled')).toBe('true')

      window.removeEventListener('kd:sound-preference-changed', listener)
    })
  })

  describe('Haptic Vibration Engine', () => {
    it('defaults to enabled', () => {
      expect(isHapticsEnabled()).toBe(true)
    })

    it('persists haptics toggle and emits event', () => {
      const listener = vi.fn()
      window.addEventListener('kd:haptics-preference-changed', listener)

      setHapticsEnabled(false)
      expect(isHapticsEnabled()).toBe(false)
      expect(localStorage.getItem('kd_haptics_enabled')).toBe('false')
      expect(listener).toHaveBeenCalledTimes(1)

      window.removeEventListener('kd:haptics-preference-changed', listener)
    })

    it('calls navigator.vibrate when available', () => {
      const vibrateMock = vi.fn().mockReturnValue(true)
      vi.stubGlobal('navigator', {
        ...window.navigator,
        vibrate: vibrateMock,
      })

      setHapticsEnabled(true)
      const result = triggerHapticFeedback('success')

      expect(vibrateMock).toHaveBeenCalledWith([120, 60, 150])
      expect(result).toBe(true)

      vi.unstubAllGlobals()
    })

    it('safely skips vibration when haptics are disabled', () => {
      const vibrateMock = vi.fn()
      vi.stubGlobal('navigator', {
        ...window.navigator,
        vibrate: vibrateMock,
      })

      setHapticsEnabled(false)
      const result = triggerHapticFeedback('success')

      expect(vibrateMock).not.toHaveBeenCalled()
      expect(result).toBe(false)

      vi.unstubAllGlobals()
    })
  })

  describe('SoundHapticsSettingsCard UI Component', () => {
    it('renders master sound toggle, volume presets, and tone testers', () => {
      render(<SoundHapticsSettingsCard />)

      expect(screen.getByText('Sound & Haptic Alerts')).toBeInTheDocument()
      expect(screen.getByLabelText(/Toggle audible notification chimes/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Discreet/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Normal/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Loud/i })).toBeInTheDocument()
      expect(screen.getByText(/Kitchen Bell/i)).toBeInTheDocument()
      expect(screen.getByText(/Dispatch Horn/i)).toBeInTheDocument()
      expect(screen.getByText(/Security Alert/i)).toBeInTheDocument()
    })

    it('allows changing volume preset via button click', () => {
      render(<SoundHapticsSettingsCard />)

      const loudBtn = screen.getByRole('button', { name: /Loud/i })
      fireEvent.click(loudBtn)

      expect(getAudioVolume()).toBe('high')
      expect(localStorage.getItem('kd_sound_volume_level')).toBe('high')
    })

    it('toggles master sound switch', () => {
      render(<SoundHapticsSettingsCard />)

      const masterSwitch = screen.getByLabelText(/Toggle audible notification chimes/i)
      fireEvent.click(masterSwitch)

      expect(isGlobalSoundEnabled()).toBe(false)
    })
  })
})
