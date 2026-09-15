import { useState } from 'react'
import {
  Percent,
  Zap,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

export interface AdminSettingsState {
  commissionPercent: number
  baseDeliveryFee: number
  perKmRate: number
  maxDeliveryRadiusKm: number
  maintenanceMode: boolean
  autoDispatchRiders: boolean
  surgePricingEnabled: boolean
  supportEmail: string
  emergencyHotline: string
}

const DEFAULT_SETTINGS: AdminSettingsState = {
  commissionPercent: 7.5,
  baseDeliveryFee: 500,
  perKmRate: 120,
  maxDeliveryRadiusKm: 25,
  maintenanceMode: false,
  autoDispatchRiders: true,
  surgePricingEnabled: true,
  supportEmail: 'ops@kingdomdash.com',
  emergencyHotline: '+234 800 KINGDOM',
}

const STORAGE_KEY = 'kd_admin_settings'

export function AdminSettingsTab() {
  const { pushToast } = useToast()

  const [settings, setSettings] = useState<AdminSettingsState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = (key: keyof AdminSettingsState) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (err) {
        console.error('Failed to save admin settings', err)
      }
      return next
    })
    pushToast({
      title: 'Admin Setting Updated',
      message: 'Platform configuration updated.',
      variant: 'success',
    })
  }

  const handleNumberChange = (key: keyof AdminSettingsState, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleTextChange = (key: keyof AdminSettingsState, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveAll = () => {
    setIsSaving(true)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      pushToast({
        title: 'Platform Settings Saved',
        message: 'Platform parameters and pricing matrix have been applied.',
        variant: 'success',
      })
    } catch (err) {
      pushToast({
        title: 'Save Failed',
        message: 'Could not write admin configuration.',
        variant: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-h3 font-bold text-text-primary">Platform & System Settings</h2>
          <p className="text-body-small text-text-secondary mt-1">
            Global pricing rules, commission rates, delivery dispatch boundaries, and system maintenance.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSaveAll}
          disabled={isSaving}
          className="gap-1.5 font-bold text-white bg-primary hover:bg-primary-hover"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? 'Saving…' : 'Save Platform Rules'}
        </Button>
      </div>

      {/* 1. Pricing & Commission Matrix */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Percent className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Pricing & Delivery Economics</h3>
            <p className="text-caption text-text-secondary">Set fees applied to orders and merchant settlements.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="admin-commission" className="text-body-small font-semibold text-text-primary block mb-1">
              Merchant Commission Rate (%)
            </label>
            <input
              id="admin-commission"
              type="number"
              step="0.5"
              min="0"
              max="30"
              value={settings.commissionPercent}
              onChange={(e) => handleNumberChange('commissionPercent', parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-body-small text-text-primary focus:border-primary focus:outline-none"
            />
            <span className="text-caption text-text-muted mt-1 block">
              Deducted automatically from vendor order subtotals.
            </span>
          </div>

          <div>
            <label htmlFor="admin-base-fee" className="text-body-small font-semibold text-text-primary block mb-1">
              Base Delivery Fee (₦)
            </label>
            <input
              id="admin-base-fee"
              type="number"
              step="50"
              min="100"
              value={settings.baseDeliveryFee}
              onChange={(e) => handleNumberChange('baseDeliveryFee', parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-body-small text-text-primary focus:border-primary focus:outline-none"
            />
            <span className="text-caption text-text-muted mt-1 block">
              Initial fee charged per dispatch within 2 km.
            </span>
          </div>

          <div>
            <label htmlFor="admin-per-km" className="text-body-small font-semibold text-text-primary block mb-1">
              Per-Kilometer Distance Rate (₦ / km)
            </label>
            <input
              id="admin-per-km"
              type="number"
              step="10"
              min="20"
              value={settings.perKmRate}
              onChange={(e) => handleNumberChange('perKmRate', parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-body-small text-text-primary focus:border-primary focus:outline-none"
            />
            <span className="text-caption text-text-muted mt-1 block">
              Added to base fee for transit distances beyond 2 km.
            </span>
          </div>

          <div>
            <label htmlFor="admin-max-radius" className="text-body-small font-semibold text-text-primary block mb-1">
              Maximum Dispatch Radius (km)
            </label>
            <input
              id="admin-max-radius"
              type="number"
              step="1"
              min="5"
              max="50"
              value={settings.maxDeliveryRadiusKm}
              onChange={(e) => handleNumberChange('maxDeliveryRadiusKm', parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-body-small text-text-primary focus:border-primary focus:outline-none"
            />
            <span className="text-caption text-text-muted mt-1 block">
              Coverage boundary around Owerri metropolitan cluster.
            </span>
          </div>
        </div>
      </section>

      {/* 2. Dispatch Automation & Toggles */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Dispatch Automation & Surge</h3>
            <p className="text-caption text-text-secondary">Control automatic rider allocation and dynamic pricing.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-body font-semibold text-text-primary block">Automatic Courier Dispatch</span>
              <span className="text-caption text-text-secondary">
                Algorithmically match ready vendor orders to the nearest online rider without admin intervention.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoDispatchRiders}
              aria-label="Toggle auto dispatch"
              onClick={() => handleToggle('autoDispatchRiders')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                settings.autoDispatchRiders ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.autoDispatchRiders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
            <div>
              <span className="text-body font-semibold text-text-primary block">Peak-Hour Surge Multiplier</span>
              <span className="text-caption text-text-secondary">
                Enable dynamic surge bonus during bad weather or high order demand in Owerri.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.surgePricingEnabled}
              aria-label="Toggle surge pricing"
              onClick={() => handleToggle('surgePricingEnabled')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                settings.surgePricingEnabled ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.surgePricingEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
            <div>
              <span className="text-body font-semibold text-red-600 block">Platform Maintenance Mode</span>
              <span className="text-caption text-text-secondary">
                Temporarily pause all customer checkouts and rider dispatch for system maintenance.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.maintenanceMode}
              aria-label="Toggle maintenance mode"
              onClick={() => handleToggle('maintenanceMode')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                settings.maintenanceMode ? 'bg-red-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 3. System Contact Hotlines */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Support & Escalation Hotlines</h3>
            <p className="text-caption text-text-secondary">Shown to customers and merchants for emergency support.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="admin-support-email" className="text-body-small font-semibold text-text-primary block mb-1">
              Operations Support Email
            </label>
            <input
              id="admin-support-email"
              type="email"
              value={settings.supportEmail}
              onChange={(e) => handleTextChange('supportEmail', e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-body-small text-text-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="admin-emergency-phone" className="text-body-small font-semibold text-text-primary block mb-1">
              Emergency Escalation Phone / WhatsApp
            </label>
            <input
              id="admin-emergency-phone"
              type="text"
              value={settings.emergencyHotline}
              onChange={(e) => handleTextChange('emergencyHotline', e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-body-small text-text-primary focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
