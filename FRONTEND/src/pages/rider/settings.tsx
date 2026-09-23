import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { supabase } from '@/services/supabase/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Navigation,
  Bell,
  Volume2,
  Smartphone,
  Shield,
  LogOut,
  CheckCircle2,
  Phone,
  Mail,
  User,
  KeyRound,
  ExternalLink,
} from 'lucide-react'
import { generateWhatsAppLink } from '@/utils/whatsapp'

export interface RiderSettingsState {
  defaultNavApp: 'google_maps' | 'apple_maps' | 'in_app'
  autoOpenNavOnAccept: boolean
  highAccuracyGps: boolean
  soundAlerts: boolean
  vibrateAlerts: boolean
  minPayoutFilter: number
  maxDeliveryRadiusKm: number
  batterySaverMode: boolean
  keepScreenAwake: boolean
  offlineTripCache: boolean
}

export function getRiderSettingsStorageKey(userId: string | null | undefined): string {
  return userId ? `kd_rider_settings_${userId}` : 'kd_rider_settings_guest'
}

const DEFAULT_SETTINGS: RiderSettingsState = {
  defaultNavApp: 'google_maps',
  autoOpenNavOnAccept: true,
  highAccuracyGps: true,
  soundAlerts: true,
  vibrateAlerts: true,
  minPayoutFilter: 0,
  maxDeliveryRadiusKm: 15,
  batterySaverMode: false,
  keepScreenAwake: true,
  offlineTripCache: true,
}

import {
  fetchRiderSettings,
  updateRiderSettings,
} from '@/services/supabase/platform-settings'

export default function RiderSettingsPage() {
  const { rider, refreshRider } = useCurrentRider()
  const { profile, session, signOut } = useAuthStore()
  const { pushToast } = useUiStore()

  const userId = profile?.id || session?.user?.id || rider?.profile_id
  const storageKey = getRiderSettingsStorageKey(userId)

  // Local settings state
  const [settings, setSettings] = useState<RiderSettingsState>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  // Synchronize when active user changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
      } else {
        setSettings(DEFAULT_SETTINGS)
      }
    } catch {
      setSettings(DEFAULT_SETTINGS)
    }
  }, [storageKey])

  // Hydrate from Supabase database when rider is available
  useEffect(() => {
    let isMounted = true
    if (rider?.id) {
      fetchRiderSettings(rider.id).then((res) => {
        if (isMounted && res.data) {
          setSettings((prev) => {
            const next = { ...prev, ...res.data }
            try {
              localStorage.setItem(storageKey, JSON.stringify(next))
            } catch {}
            return next
          })
        }
      })
    }
    return () => {
      isMounted = false
    }
  }, [rider?.id, storageKey])

  // Phone number state
  const [phone, setPhone] = useState(rider?.phone || '')
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)

  // Sound test state
  const [isPlayingSound, setIsPlayingSound] = useState(false)

  useEffect(() => {
    if (rider?.phone) {
      setPhone(rider.phone)
    }
  }, [rider?.phone])

  const updateSetting = <K extends keyof RiderSettingsState>(
    key: K,
    value: RiderSettingsState[K]
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch (err) {
        console.error('Failed to persist rider settings', err)
      }
      if (rider?.id) {
        updateRiderSettings(rider.id, next as any).catch((err) => {
          console.error('Failed to sync rider setting to Supabase:', err)
        })
      }
      return next
    })
    pushToast({
      title: 'Setting Saved',
      message: 'Your preferences have been updated.',
      variant: 'success',
    })
  }

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim()) {
      pushToast({
        title: 'Validation Error',
        message: 'Phone number cannot be empty.',
        variant: 'warning',
      })
      return
    }

    setIsUpdatingPhone(true)
    try {
      const userId = profile?.id || session?.user?.id
      if (!userId) {
        throw new Error('User session not found. Please log in again.')
      }

      const { error } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', userId)

      if (error) throw error

      await refreshRider()
      setPhoneSaved(true)
      setTimeout(() => setPhoneSaved(false), 3000)

      pushToast({
        title: 'Phone Number Updated',
        message: 'Your dispatch contact phone has been updated.',
        variant: 'success',
      })
    } catch (err) {
      pushToast({
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Failed to update phone number.',
        variant: 'error',
      })
    } finally {
      setIsUpdatingPhone(false)
    }
  }

  const handleTestSoundAlert = () => {
    setIsPlayingSound(true)
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15) // A5

        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4)

        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)

        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.4)
      } catch {
        // Fallback or muted browser policy
      }
    }

    if (navigator.vibrate && settings.vibrateAlerts) {
      navigator.vibrate([100, 50, 100])
    }

    setTimeout(() => {
      setIsPlayingSound(false)
      pushToast({
        title: 'Alert Notification Tested',
        message: 'Dispatch audio and vibration alert played.',
        variant: 'info',
      })
    }, 500)
  }

  return (
    <RiderLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-h3 font-bold text-text-primary">Rider Settings</h1>
            <p className="text-body-small text-text-secondary">
              Configure dispatch alerts, navigation app preferences, device optimization, and credentials.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1 text-caption">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Verified Courier
            </Badge>
          </div>
        </div>

        {/* 1. Navigation & Turn-by-Turn Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Navigation className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Navigation & Mapping</CardTitle>
                <CardDescription>
                  Choose how external turn-by-turn routes and addresses launch during pickups and deliveries.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-body-small font-semibold text-text-primary mb-2 block">
                Default Navigation Application
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'google_maps', label: 'Google Maps', desc: 'Default Android & Web navigation' },
                  { id: 'apple_maps', label: 'Apple Maps', desc: 'Optimized for iOS devices' },
                  { id: 'in_app', label: 'In-App Map Only', desc: 'Leaflet route map view' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateSetting('defaultNavApp', item.id as RiderSettingsState['defaultNavApp'])}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                      settings.defaultNavApp === item.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                        : 'border-border bg-page-background hover:bg-white hover:border-text-muted'
                    }`}
                  >
                    <span className="font-bold text-body-small text-text-primary">{item.label}</span>
                    <span className="text-caption text-text-muted mt-1">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="space-y-0.5">
                <Label htmlFor="toggle-auto-nav" className="text-body-small font-medium text-text-primary cursor-pointer">
                  Auto-Launch Navigation on Accept
                </Label>
                <p className="text-caption text-text-muted">
                  Automatically prompt external turn-by-turn navigation as soon as you accept an assignment.
                </p>
              </div>
              <Switch
                id="toggle-auto-nav"
                checked={settings.autoOpenNavOnAccept}
                onCheckedChange={(checked) => updateSetting('autoOpenNavOnAccept', checked)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="space-y-0.5">
                <Label htmlFor="toggle-high-accuracy" className="text-body-small font-medium text-text-primary cursor-pointer">
                  High-Accuracy GPS Tracking
                </Label>
                <p className="text-caption text-text-muted">
                  Enables precise GPS telemetry for smoother real-time route estimations and dispatch matching.
                </p>
              </div>
              <Switch
                id="toggle-high-accuracy"
                checked={settings.highAccuracyGps}
                onCheckedChange={(checked) => updateSetting('highAccuracyGps', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. Dispatch Alerts & Sound Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Dispatch Offers & Sound Alerts</CardTitle>
                <CardDescription>
                  Manage alert tones and sensory cues when customer delivery offers are assigned to you.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="toggle-sound-alerts" className="text-body-small font-medium text-text-primary cursor-pointer">
                  Sound Alert on New Dispatch Offer
                </Label>
                <p className="text-caption text-text-muted">
                  Audible chime rings when a customer order or courier assignment is sent to your inbox.
                </p>
              </div>
              <Switch
                id="toggle-sound-alerts"
                checked={settings.soundAlerts}
                onCheckedChange={(checked) => updateSetting('soundAlerts', checked)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="space-y-0.5">
                <Label htmlFor="toggle-vibrate-alerts" className="text-body-small font-medium text-text-primary cursor-pointer">
                  Vibration Alerts
                </Label>
                <p className="text-caption text-text-muted">
                  Phone pulses with haptic feedback for incoming offers and critical status updates.
                </p>
              </div>
              <Switch
                id="toggle-vibrate-alerts"
                checked={settings.vibrateAlerts}
                onCheckedChange={(checked) => updateSetting('vibrateAlerts', checked)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="space-y-0.5">
                <span className="text-body-small font-medium text-text-primary">
                  Test Alert Tone & Vibration
                </span>
                <p className="text-caption text-text-muted">
                  Verify that dispatch alerts can be heard over road noise and helmet audio.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestSoundAlert}
                disabled={isPlayingSound}
                className="gap-2"
              >
                <Volume2 className={`h-4 w-4 ${isPlayingSound ? 'animate-pulse text-primary' : ''}`} aria-hidden="true" />
                {isPlayingSound ? 'Playing Alert...' : 'Test Sound'}
              </Button>
            </div>

            <div className="border-t border-border pt-4">
              <Label className="text-body-small font-semibold text-text-primary mb-2 block">
                Preferred Maximum Delivery Radius: {settings.maxDeliveryRadiusKm} km
              </Label>
              <div className="flex items-center gap-3">
                {[5, 10, 15, 25].map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => updateSetting('maxDeliveryRadiusKm', km)}
                    className={`flex-1 py-2 px-3 rounded-lg border text-body-small font-medium transition-all text-center ${
                      settings.maxDeliveryRadiusKm === km
                        ? 'border-primary bg-primary text-white font-bold shadow-xs'
                        : 'border-border bg-page-background hover:bg-white text-text-secondary'
                    }`}
                  >
                    {km} km
                  </button>
                ))}
              </div>
              <p className="text-caption text-text-muted mt-2">
                Limits assignment recommendations to deliveries within your preferred travel distance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3. Device Optimization & Battery */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Device & Battery Optimization</CardTitle>
                <CardDescription>
                  Keep your battery running through long courier shifts on the road.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="toggle-battery-saver" className="text-body-small font-medium text-text-primary cursor-pointer">
                  Battery Saver Mode
                </Label>
                <p className="text-caption text-text-muted">
                  Reduces background refresh intervals and map rendering FPS when standing idle.
                </p>
              </div>
              <Switch
                id="toggle-battery-saver"
                checked={settings.batterySaverMode}
                onCheckedChange={(checked) => updateSetting('batterySaverMode', checked)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="space-y-0.5">
                <Label htmlFor="toggle-awake" className="text-body-small font-medium text-text-primary cursor-pointer">
                  Keep Screen Awake During Active Delivery
                </Label>
                <p className="text-caption text-text-muted">
                  Prevents phone screen from locking while navigating a live delivery route.
                </p>
              </div>
              <Switch
                id="toggle-awake"
                checked={settings.keepScreenAwake}
                onCheckedChange={(checked) => updateSetting('keepScreenAwake', checked)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="space-y-0.5">
                <Label htmlFor="toggle-offline-cache" className="text-body-small font-medium text-text-primary cursor-pointer">
                  Offline Delivery Caching
                </Label>
                <p className="text-caption text-text-muted">
                  Pre-loads customer details and drop-off addresses in case mobile data signal drops in remote zones.
                </p>
              </div>
              <Switch
                id="toggle-offline-cache"
                checked={settings.offlineTripCache}
                onCheckedChange={(checked) => updateSetting('offlineTripCache', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. Contact & Identity Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <User className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Profile & Contact Details</CardTitle>
                <CardDescription>
                  Keep your customer contact number up to date for smooth dispatch calls and handover verification.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-caption font-semibold text-text-muted block mb-1">
                  Full Registered Name
                </Label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-page-background px-3 py-2.5 text-body-small font-medium text-text-primary">
                  <User className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  <span>{rider?.full_name || profile?.full_name || 'Rider Account'}</span>
                </div>
              </div>

              <div>
                <Label className="text-caption font-semibold text-text-muted block mb-1">
                  Account Email
                </Label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-page-background px-3 py-2.5 text-body-small font-medium text-text-primary">
                  <Mail className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  <span className="truncate">{rider?.email || profile?.email || session?.user?.email || 'N/A'}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSavePhone} className="border-t border-border pt-4 space-y-3">
              <Label htmlFor="rider-phone-input" className="text-body-small font-semibold text-text-primary block">
                Operational Phone Number
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden="true" />
                  <Input
                    id="rider-phone-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="pl-9"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isUpdatingPhone || phone.trim() === (rider?.phone || '')}
                  className="shrink-0 font-bold text-white bg-primary hover:bg-primary-hover"
                >
                  {isUpdatingPhone ? 'Saving...' : phoneSaved ? 'Saved!' : 'Save Phone'}
                </Button>
              </div>
              <p className="text-caption text-text-muted">
                This number is used by customers and vendors to contact you during active delivery assignments.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* 5. Account Security & Support */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Security & Dispatch Support</CardTitle>
                <CardDescription>
                  Manage authentication, password protection, and emergency dispatch assistance.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-body-small font-medium text-text-primary">
                  Account Password
                </span>
                <p className="text-caption text-text-muted">
                  Update your authentication password or refresh security credentials.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link to="/auth/update-password">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Change Password
                </Link>
              </Button>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="space-y-0.5">
                <span className="text-body-small font-medium text-text-primary">
                  Dispatch Emergency Support
                </span>
                <p className="text-caption text-text-muted">
                  Contact Ijebu-Ode Fleet Control for road assistance, accidents, or dispute escalation.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="gap-2 text-primary border-primary/30 hover:bg-primary/5">
                <a
                  href={generateWhatsAppLink('Hello KingdomDash Dispatch Support, I need assistance.')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  WhatsApp Support
                </a>
              </Button>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="space-y-0.5">
                <span className="text-body-small font-medium text-error">
                  Sign Out of Rider Workspace
                </span>
                <p className="text-caption text-text-muted">
                  Disconnect your active session on this device. (Make sure you are offline before signing out).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="gap-2 text-error border-error/30 hover:bg-error/10 hover:text-error hover:border-error"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RiderLayout>
  )
}
