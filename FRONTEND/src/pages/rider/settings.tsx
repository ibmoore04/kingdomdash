import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
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
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import { generateWhatsAppLink } from '@/utils/whatsapp'
import { SoundHapticsSettingsCard } from '@/components/common/sound-haptics-settings-card'
import { updateRiderContactInfo } from '@/services/rider/rider-service'

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

  // Contact state (Phone & WhatsApp)
  const [phone, setPhone] = useState(rider?.phone || '')
  const [whatsappNumber, setWhatsappNumber] = useState(
    rider?.whatsapp_number || rider?.phone || ''
  )
  const [sameAsPhone, setSameAsPhone] = useState(
    !rider?.whatsapp_number || rider?.whatsapp_number === rider?.phone
  )
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)

  // Sound test state
  const [isPlayingSound, setIsPlayingSound] = useState(false)

  useEffect(() => {
    if (rider?.phone) {
      setPhone(rider.phone)
      if (!rider.whatsapp_number || rider.whatsapp_number === rider.phone) {
        setWhatsappNumber(rider.phone)
        setSameAsPhone(true)
      } else {
        setWhatsappNumber(rider.whatsapp_number)
        setSameAsPhone(false)
      }
    }
  }, [rider?.phone, rider?.whatsapp_number])

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
    const cleanPhone = phone.trim()
    const cleanWa = sameAsPhone ? cleanPhone : whatsappNumber.trim()

    if (!cleanPhone || cleanPhone.length < 7) {
      pushToast({
        title: 'Validation Error',
        message: 'Please provide a valid operational phone number (minimum 7 digits).',
        variant: 'warning',
      })
      return
    }

    if (!cleanWa || cleanWa.length < 7) {
      pushToast({
        title: 'Validation Error',
        message:
          'WhatsApp number is compulsory. If you do not have a dedicated WhatsApp number, keep the checkbox checked to use your usual phone number.',
        variant: 'warning',
      })
      return
    }

    setIsUpdatingPhone(true)
    try {
      const { success, error } = await updateRiderContactInfo(cleanPhone, cleanWa)
      if (!success && error) throw error

      await refreshRider()
      setPhoneSaved(true)
      setTimeout(() => setPhoneSaved(false), 3000)

      pushToast({
        title: 'Contact Information Updated',
        message: 'Your operational phone and WhatsApp lines have been saved for deliveries.',
        variant: 'success',
      })
    } catch (err) {
      pushToast({
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Failed to update contact numbers.',
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
                  { id: 'in_app', label: 'In-App Map Only', desc: 'Google Maps route view' },
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

        {/* Sound & Sensory Control Center */}
        <SoundHapticsSettingsCard
          title="Dispatch Sound & Haptic Alerts"
          description="Synthesized chime volume, vibration alerts, and library quiet mode during active deliveries."
        />

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

            {/* Compulsory notice ONLY if contact phone is missing; leaves once registered */}
            {!rider?.phone && !rider?.whatsapp_number ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-caption text-amber-950 font-medium flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Compulsory Dispatch Information:</strong> An operational phone number is required for live trip coordination so customers and KingdomDash dispatch can contact you.
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-caption text-emerald-950 font-medium flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>
                    <strong>Contact Number Active:</strong> Your operational phone number ({rider?.phone || rider?.whatsapp_number}) is registered and active for dispatch orders.
                  </span>
                </div>
                <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold tracking-wider">
                  Active
                </Badge>
              </div>
            )}

            <form onSubmit={handleSavePhone} className="border-t border-border pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Field 1: Operational Phone */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                    <Label htmlFor="rider-phone-input" className="text-body-small font-semibold text-text-primary">
                      Operational Phone Number
                    </Label>
                    <span className="text-primary text-xs font-bold" aria-hidden="true">*</span>
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden="true" />
                    <Input
                      id="rider-phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        if (sameAsPhone) setWhatsappNumber(e.target.value)
                      }}
                      placeholder="e.g. 08123456789 or +234..."
                      className="pl-9"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Direct voice call line for customer arrival notifications.
                  </p>
                </div>

                {/* Field 2: WhatsApp Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="rider-whatsapp-input" className="text-body-small font-semibold text-text-primary flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <span>WhatsApp Contact Line</span>
                  </Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden="true" />
                    <Input
                      id="rider-whatsapp-input"
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="e.g. 08123456789 or +234..."
                      disabled={sameAsPhone}
                      className="pl-9 disabled:bg-slate-100 disabled:text-text-muted"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="same-as-phone-checkbox"
                      checked={sameAsPhone}
                      onChange={(e) => {
                        setSameAsPhone(e.target.checked)
                        if (e.target.checked) setWhatsappNumber(phone)
                      }}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="same-as-phone-checkbox"
                      className="text-caption font-medium text-text-secondary cursor-pointer"
                    >
                      Same as operational phone number
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-page-background border border-border p-3 text-caption text-text-muted">
                <strong>Notice:</strong> If you do not have a dedicated WhatsApp business number, keep the checkbox selected to use your usual phone number for WhatsApp messaging and dispatch coordination.
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    isUpdatingPhone ||
                    (!phone.trim() || !whatsappNumber.trim()) ||
                    (phone.trim() === (rider?.phone || '') &&
                      (sameAsPhone ? phone.trim() : whatsappNumber.trim()) ===
                        (rider?.whatsapp_number || rider?.phone || ''))
                  }
                  className="font-bold text-white bg-primary hover:bg-primary-hover shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  {isUpdatingPhone ? 'Saving Numbers...' : phoneSaved ? 'Saved!' : 'Save Contact Details'}
                </Button>
              </div>
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
