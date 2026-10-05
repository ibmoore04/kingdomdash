import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  getSharedAudioContext,
  isAudioUnlocked,
  unlockAudioContext,
  playKitchenOrderChime,
  playDispatchAlertChime,
  playLockoutAlertBeep,
} from '@/utils/audio-chime'

describe('Phase 4: Mobile AudioContext Autoplay Hardening & Dispatch Chimes', () => {
  const srcAudioPath = path.resolve(__dirname, '../../../utils/audio-chime.ts')
  const frontendAudioPath = path.resolve(__dirname, '../../../../FRONTEND/src/utils/audio-chime.ts')

  const srcBannerPath = path.resolve(__dirname, '../../../components/common/audio-unlock-banner.tsx')
  const frontendBannerPath = path.resolve(
    __dirname,
    '../../../../FRONTEND/src/components/common/audio-unlock-banner.tsx'
  )

  const srcKdsPath = path.resolve(__dirname, '../../../components/vendor/kitchen-display-screen.tsx')
  const frontendKdsPath = path.resolve(
    __dirname,
    '../../../../FRONTEND/src/components/vendor/kitchen-display-screen.tsx'
  )

  it('verifies 1:1 dual directory parity for audio utilities and components', () => {
    expect(fs.existsSync(srcAudioPath)).toBe(true)
    expect(fs.existsSync(frontendAudioPath)).toBe(true)
    expect(fs.readFileSync(srcAudioPath, 'utf8')).toBe(fs.readFileSync(frontendAudioPath, 'utf8'))

    expect(fs.existsSync(srcBannerPath)).toBe(true)
    expect(fs.existsSync(frontendBannerPath)).toBe(true)
    expect(fs.readFileSync(srcBannerPath, 'utf8')).toBe(fs.readFileSync(frontendBannerPath, 'utf8'))

    expect(fs.existsSync(srcKdsPath)).toBe(true)
    expect(fs.existsSync(frontendKdsPath)).toBe(true)
    expect(fs.readFileSync(srcKdsPath, 'utf8')).toBe(fs.readFileSync(frontendKdsPath, 'utf8'))
  })

  it('verifies audio chime utility provides mobile unlock engine and multi-tone alerts', () => {
    expect(typeof getSharedAudioContext).toBe('function')
    expect(typeof isAudioUnlocked).toBe('function')
    expect(typeof unlockAudioContext).toBe('function')
    expect(typeof playKitchenOrderChime).toBe('function')
    expect(typeof playDispatchAlertChime).toBe('function')
    expect(typeof playLockoutAlertBeep).toBe('function')

    const code = fs.readFileSync(srcAudioPath, 'utf8')
    // Gesture listeners
    expect(code).toContain('pointerdown')
    expect(code).toContain('touchstart')
    // Chime synthesizer frequencies
    expect(code).toContain('587.33') // Kitchen D5
    expect(code).toContain('880') // A5
    expect(code).toContain('783.99') // Rider G5
    expect(code).toContain('1046.5') // Rider C6
    expect(code).toContain('220') // Lockout low beep
  })

  it('verifies KDS screen wires unlockAudioContext on sound toggle and displays unlock banner', () => {
    const kdsCode = fs.readFileSync(srcKdsPath, 'utf8')

    expect(kdsCode).toContain('unlockAudioContext()')
    expect(kdsCode).toContain('AudioUnlockBanner')
    expect(kdsCode).toContain('Tap to activate kitchen order alerts')
  })
})
