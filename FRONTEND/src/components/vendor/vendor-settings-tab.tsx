import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Store,
  Clock,
  Bell,
  Volume2,
  Save,
  KeyRound,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { Vendor, VendorUpdate } from '@/types'
import { generateWhatsAppLink } from '@/utils/whatsapp'

interface VendorSettingsTabProps {
  vendor: Vendor
  onUpdateVendor: (updates: VendorUpdate) => Promise<void>
  isMutating: boolean
}

import {
  fetchVendorSettings,
  updateVendorSettings,
  DEFAULT_VENDOR_SETTINGS,
  type VendorSettings as VendorSettingsState,
} from '@/services/supabase/platform-settings'

export type { VendorSettingsState }

export function VendorSettingsTab({
  vendor,
  onUpdateVendor,
  isMutating,
}: VendorSettingsTabProps) {
  const { pushToast } = useToast()

  const [settings, setSettings] = useState<VendorSettingsState>(DEFAULT_VENDOR_SETTINGS)
  const [isActive, setIsActive] = useState(vendor.is_active)

  useEffect(() => {
    setIsActive(vendor.is_active)
  }, [vendor.is_active])

  useEffect(() => {
    let isMounted = true
    if (vendor?.id) {
      fetchVendorSettings(vendor.id).then((res) => {
        if (isMounted && res.data) {
          setSettings(res.data)
        }
      })
    }
    return () => {
      isMounted = false
    }
  }, [vendor?.id])

  const storageKey = vendor?.id ? `kd_vendor_settings_${vendor.id}` : 'kd_vendor_settings'

  const handleToggle = (key: keyof VendorSettingsState) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {}
      if (vendor?.id) {
        updateVendorSettings(vendor.id, next).catch((err) => {
          console.error('Failed to save vendor settings to Supabase:', err)
        })
      }
      return next
    })
    pushToast({
      title: 'Setting Updated',
      message: 'Your store preference has been updated.',
      variant: 'success',
    })
  }

  const handleSelectChange = (
    key: keyof VendorSettingsState,
    value: number | string | boolean
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {}
      if (vendor?.id) {
        updateVendorSettings(vendor.id, next).catch((err) => {
          console.error('Failed to save vendor settings to Supabase:', err)
        })
      }
      return next
    })
  }

  const handleTestChime = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return

      const ctx = new AudioContextClass()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12) // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.6)

      pushToast({
        title: 'Order Sound Tested',
        message: 'Kitchen alert sound is working correctly.',
        variant: 'info',
      })
    } catch {
      pushToast({
        title: 'Sound Test',
        message: 'Order alert test chime triggered.',
        variant: 'info',
      })
    }
  }

  const handleSaveOperationalStatus = async () => {
    try {
      await onUpdateVendor({ is_active: isActive })
      pushToast({
        title: 'Store Status Saved',
        message: isActive
          ? 'Your store is currently ACTIVE and accepting orders.'
          : 'Your store is currently PAUSED from receiving new orders.',
        variant: 'success',
      })
    } catch (err) {
      pushToast({
        title: 'Status Update Failed',
        message: err instanceof Error ? err.message : 'Failed to update store status.',
        variant: 'error',
      })
    }
  }

  return (
    <div className="space-y-8 max-w-4xl pb-16">
      <div>
        <h2 className="text-h3 font-bold text-text-primary">Store & Merchant Settings</h2>
        <p className="text-body-small text-text-secondary mt-1">
          Configure order acceptance rules, store operating hours, notification chimes, and dispatch preferences.
        </p>
      </div>

      {/* 1. Store Availability & Status */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Store className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Store Availability</h3>
            <p className="text-caption text-text-secondary">Control whether your storefront is live on KingdomDash.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface-muted border border-border/60">
          <div>
            <span className="text-body font-semibold text-text-primary block">
              {isActive ? 'Store is Open & Accepting Orders' : 'Store is Temporarily Paused'}
            </span>
            <span className="text-caption text-text-secondary">
              {isActive
                ? 'Customers in Owerri can place orders from your catalog.'
                : 'Your catalog remains visible but checkout is temporarily disabled.'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={isActive ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setIsActive(!isActive)}
              className="gap-1.5"
            >
              {isActive ? 'Pause Store' : 'Open Store'}
            </Button>

            {isActive !== vendor.is_active && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveOperationalStatus}
                disabled={isMutating}
                className="gap-1.5 font-bold text-white bg-primary hover:bg-primary-hover"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {isMutating ? 'Saving…' : 'Save Status'}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 2. Order Fulfillment & Preparation Buffer */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Fulfillment & Operating Hours</h3>
            <p className="text-caption text-text-secondary">Set preparation buffer times and daily store hours.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-body font-semibold text-text-primary block">Auto-Accept Incoming Orders</span>
              <span className="text-caption text-text-secondary">
                Automatically confirm orders and dispatch nearest couriers without manual confirmation.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoAcceptOrders}
              aria-label="Toggle auto-accept orders"
              onClick={() => handleToggle('autoAcceptOrders')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                settings.autoAcceptOrders ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.autoAcceptOrders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-border/60 pt-4">
            <label htmlFor="vendor-prep-time" className="text-body font-semibold text-text-primary block mb-1">
              Kitchen / Packaging Prep Time
            </label>
            <span className="text-caption text-text-secondary block mb-3">
              Average minutes needed to prepare items before rider pickup.
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[15, 25, 40, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleSelectChange('prepTimeMinutes', mins)}
                  className={`py-2.5 px-3 rounded-xl border text-body-small font-medium transition-all ${
                    settings.prepTimeMinutes === mins
                      ? 'border-primary bg-primary-soft/40 text-primary-hover font-bold shadow-xs'
                      : 'border-border bg-white text-text-secondary hover:border-border-hover'
                  }`}
                >
                  {mins} Minutes
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border/60 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vendor-open-time" className="text-body-small font-semibold text-text-primary block mb-1">
                Daily Opening Time
              </label>
              <input
                id="vendor-open-time"
                type="time"
                value={settings.openTime}
                onChange={(e) => handleSelectChange('openTime', e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-body-small text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="vendor-close-time" className="text-body-small font-semibold text-text-primary block mb-1">
                Daily Closing Time
              </label>
              <input
                id="vendor-close-time"
                type="time"
                value={settings.closeTime}
                onChange={(e) => handleSelectChange('closeTime', e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-body-small text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Dispatch & Audio Alerts */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Order Alerts & Sound Notifications</h3>
            <p className="text-caption text-text-secondary">Configure high-priority alerts so no order is missed.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-body font-semibold text-text-primary block">Loud Audio Chime on New Orders</span>
              <span className="text-caption text-text-secondary">
                Plays an audible notification chime whenever a customer places an order.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.soundAlerts}
              aria-label="Toggle loud audio chime"
              onClick={() => handleToggle('soundAlerts')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                settings.soundAlerts ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.soundAlerts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
            <div>
              <span className="text-body font-semibold text-text-primary block">WhatsApp Order Alerts</span>
              <span className="text-caption text-text-secondary">
                Receive instant order summaries directly on your merchant WhatsApp line.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.whatsAppAlerts}
              aria-label="Toggle WhatsApp alerts"
              onClick={() => handleToggle('whatsAppAlerts')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                settings.whatsAppAlerts ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.whatsAppAlerts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestChime}
              className="gap-2"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Test Order Chime
            </Button>
          </div>
        </div>
      </section>

      {/* 4. Security & Merchant Support */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Security & Merchant Hotline</h3>
            <p className="text-caption text-text-secondary">Manage password credentials and merchant support access.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border/70 bg-surface-muted flex flex-col justify-between gap-3">
            <div>
              <span className="text-body-small font-bold text-text-primary block">Merchant Password</span>
              <span className="text-caption text-text-secondary">Update your store login password.</span>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white w-fit">
              <Link to="/auth/update-password">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Change Password
              </Link>
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-border/70 bg-surface-muted flex flex-col justify-between gap-3">
            <div>
              <span className="text-body-small font-bold text-text-primary block">Operations Support Hotline</span>
              <span className="text-caption text-text-secondary">Direct WhatsApp link to merchant dispatch team.</span>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white w-fit text-emerald-600 hover:text-emerald-700">
              <a href={generateWhatsAppLink('Hello KingdomDash Merchant Support, I need assistance.')} target="_blank" rel="noopener noreferrer">
                <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                Contact Dispatch Support
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
