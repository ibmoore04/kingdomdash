import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  User,
  Bell,
  MapPin,
  ShieldCheck,
  KeyRound,
  Save,
  Phone,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/services/supabase/client'
import { getNotificationPreferences, updateNotificationPreferences } from '@/services/supabase/notifications'

export interface CustomerSettingsState {
  orderSmsAlerts: boolean
  whatsAppUpdates: boolean
  promoEmails: boolean
  deliveryNotes: string
  preferredDeliveryType: 'doorstep' | 'pickup_point' | 'building_security'
}

const DEFAULT_SETTINGS: CustomerSettingsState = {
  orderSmsAlerts: true,
  whatsAppUpdates: true,
  promoEmails: false,
  deliveryNotes: 'Please ring bell and leave with security if unavailable.',
  preferredDeliveryType: 'doorstep',
}

export function getCustomerSettingsStorageKey(userId: string | null | undefined): string {
  return userId ? `customer_settings_${userId}` : 'customer_settings_guest'
}

import {
  fetchCustomerPreferences,
  updateCustomerPreferences,
} from '@/services/supabase/platform-settings'

export function CustomerSettingsTab() {
  const { profile, session } = useAuthStore()
  const { pushToast } = useToast()

  const userId = session?.user?.id || profile?.id
  const storageKey = getCustomerSettingsStorageKey(userId)

  const [settings, setSettings] = useState<CustomerSettingsState>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  // Synchronize when active user changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
      } else {
        setSettings(DEFAULT_SETTINGS)
      }
    } catch {
      setSettings(DEFAULT_SETTINGS)
    }
  }, [storageKey])

  // Hydrate preferences from Supabase backend
  useEffect(() => {
    let isMounted = true
    if (userId) {
      fetchCustomerPreferences(userId).then((res) => {
        if (isMounted && res.data) {
          setSettings((prev) => {
            const next = {
              ...prev,
              deliveryNotes: res.data.deliveryNotes,
              preferredDeliveryType: res.data.preferredDeliveryType,
            }
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
  }, [userId, storageKey])

  useEffect(() => {
    let isMounted = true
    getNotificationPreferences().then((res) => {
      if (isMounted && res.data) {
        setSettings((prev) => ({
          ...prev,
          orderSmsAlerts: res.data!.order_updates,
          whatsAppUpdates: res.data!.delivery_updates,
          promoEmails: res.data!.promotional,
        }))
      }
    })
    return () => {
      isMounted = false
    }
  }, [])

  const [phone, setPhone] = useState(profile?.phone || '')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const handleToggle = (key: keyof CustomerSettingsState) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch (err) {
        console.error('Failed to save customer settings', err)
      }

      if (key === 'orderSmsAlerts' || key === 'whatsAppUpdates' || key === 'promoEmails') {
        updateNotificationPreferences({
          order_updates: key === 'orderSmsAlerts' ? next.orderSmsAlerts : prev.orderSmsAlerts,
          delivery_updates: key === 'whatsAppUpdates' ? next.whatsAppUpdates : prev.whatsAppUpdates,
          promotional: key === 'promoEmails' ? next.promoEmails : prev.promoEmails,
        }).catch(() => {})
      }

      return next
    })
    pushToast({
      title: 'Preferences Updated',
      message: 'Your customer preference has been saved.',
      variant: 'success',
    })
  }

  const handleDeliveryTypeChange = (type: CustomerSettingsState['preferredDeliveryType']) => {
    setSettings((prev) => {
      const next = { ...prev, preferredDeliveryType: type }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch (err) {
        console.error('Failed to save customer settings', err)
      }
      if (userId) {
        updateCustomerPreferences(userId, { preferredDeliveryType: type }).catch((err) => {
          console.error('Failed to sync delivery type to Supabase:', err)
        })
      }
      return next
    })
    pushToast({
      title: 'Delivery Mode Updated',
      message: `Preferred drop-off set to ${type.replace('_', ' ')}.`,
      variant: 'info',
    })
  }

  const handleSaveContactInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    const activeUserId = profile?.id || session?.user?.id
    if (!activeUserId) {
      pushToast({
        title: 'Authentication Required',
        message: 'Please sign in to update your profile.',
        variant: 'error',
      })
      return
    }

    setIsSavingProfile(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
        })
        .eq('id', activeUserId)

      if (error) throw error

      if (profile) {
        useAuthStore.setState({
          profile: {
            ...profile,
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        })
      }

      pushToast({
        title: 'Profile Updated',
        message: 'Your name and contact phone have been saved.',
        variant: 'success',
      })
    } catch (err) {
      pushToast({
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Could not save profile changes.',
        variant: 'error',
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveDeliveryNotes = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings))
      if (userId) {
        updateCustomerPreferences(userId, { deliveryNotes: settings.deliveryNotes }).catch((err) => {
          console.error('Failed to sync delivery notes to Supabase:', err)
        })
      }
      pushToast({
        title: 'Delivery Notes Saved',
        message: 'Default drop-off instructions have been updated.',
        variant: 'success',
      })
    } catch (err) {
      console.error('Failed to save delivery notes', err)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl pb-16">
      <div>
        <h2 className="text-h3 font-bold text-text-primary">Account & Preferences</h2>
        <p className="text-body-small text-text-secondary mt-1">
          Manage your contact information, delivery drop-off instructions, and order notification alerts.
        </p>
      </div>

      {/* 1. Contact Information */}
      <section className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <User className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Contact & Profile</h3>
            <p className="text-caption text-text-secondary">Used by riders and vendors to coordinate deliveries.</p>
          </div>
        </div>

        <form onSubmit={handleSaveContactInfo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="customer-fullname" className="text-body-small font-semibold text-text-primary block mb-1">
                Full Name
              </label>
              <input
                id="customer-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-body-small text-text-primary focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="customer-phone" className="text-body-small font-semibold text-text-primary block mb-1">
                Contact Phone
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 text-text-muted absolute left-3.5 top-3" aria-hidden="true" />
                <input
                  id="customer-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full rounded-xl border border-border bg-surface-muted pl-10 pr-3.5 py-2.5 text-body-small text-text-primary focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="customer-email" className="text-body-small font-semibold text-text-primary block mb-1">
              Registered Email
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-text-muted absolute left-3.5 top-3" aria-hidden="true" />
              <input
                id="customer-email"
                type="email"
                readOnly
                value={profile?.email || session?.user?.email || ''}
                placeholder="No email registered"
                className="w-full rounded-xl border border-border bg-gray-100 pl-10 pr-3.5 py-2.5 text-body-small text-text-secondary cursor-not-allowed"
              />
            </div>
            <span className="text-caption text-text-muted mt-1 block">
              Email is tied to your account authentication and cannot be changed here.
            </span>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingProfile}
              className="gap-1.5 font-bold text-white bg-primary hover:bg-primary-hover"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </section>

      {/* 2. Delivery & Drop-off Preferences */}
      <section className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Delivery Preferences</h3>
            <p className="text-caption text-text-secondary">Default instructions shared with dispatch couriers.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-body-small font-semibold text-text-primary block mb-2">
              Preferred Hand-off Method
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  { id: 'doorstep', label: 'Direct Doorstep', desc: 'Hand to me directly' },
                  { id: 'building_security', label: 'Security Gate', desc: 'Leave at security gate' },
                  { id: 'pickup_point', label: 'Meet Outside', desc: 'Meet courier outside building' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleDeliveryTypeChange(opt.id)}
                  className={`p-3 sm:p-3.5 rounded-xl border text-left transition-all ${
                    settings.preferredDeliveryType === opt.id
                      ? 'border-primary bg-primary-soft/40 shadow-xs'
                      : 'border-border bg-white hover:border-border-hover'
                  }`}
                >
                  <span className="text-body-small font-bold text-text-primary block">{opt.label}</span>
                  <span className="text-caption text-text-secondary">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border/60 pt-4">
            <label htmlFor="customer-notes" className="text-body-small font-semibold text-text-primary block mb-1">
              Default Delivery Notes
            </label>
            <textarea
              id="customer-notes"
              rows={3}
              value={settings.deliveryNotes}
              onChange={(e) => setSettings((prev) => ({ ...prev, deliveryNotes: e.target.value }))}
              placeholder="e.g. Near Market junction, call when at gate..."
              className="w-full rounded-xl border border-border bg-surface-muted p-3 text-body-small text-text-primary focus:border-primary focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveDeliveryNotes}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Save Delivery Notes
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Notification Preferences */}
      <section className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Order & Promo Notifications</h3>
            <p className="text-caption text-text-secondary">Control how we update you on order progress and deals.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-body font-semibold text-text-primary block">Order Status SMS Alerts</span>
              <span className="text-caption text-text-secondary">
                Receive instant SMS text updates when your rider is nearby.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.orderSmsAlerts}
              aria-label="Toggle SMS alerts"
              onClick={() => handleToggle('orderSmsAlerts')}
              className="relative inline-flex items-center justify-center p-2 -mr-2 min-h-[44px] min-w-[48px] shrink-0 cursor-pointer"
            >
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  settings.orderSmsAlerts ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.orderSmsAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
            <div>
              <span className="text-body font-semibold text-text-primary block">WhatsApp Delivery Updates</span>
              <span className="text-caption text-text-secondary">
                Get live tracking links and digital receipts via WhatsApp.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.whatsAppUpdates}
              aria-label="Toggle WhatsApp updates"
              onClick={() => handleToggle('whatsAppUpdates')}
              className="relative inline-flex items-center justify-center p-2 -mr-2 min-h-[44px] min-w-[48px] shrink-0 cursor-pointer"
            >
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  settings.whatsAppUpdates ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.whatsAppUpdates ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
            <div>
              <span className="text-body font-semibold text-text-primary block">Discounts & Promo Announcements</span>
              <span className="text-caption text-text-secondary">
                Occasional food discounts and merchant promo vouchers.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.promoEmails}
              aria-label="Toggle promotional emails"
              onClick={() => handleToggle('promoEmails')}
              className="relative inline-flex items-center justify-center p-2 -mr-2 min-h-[44px] min-w-[48px] shrink-0 cursor-pointer"
            >
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  settings.promoEmails ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.promoEmails ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. Security */}
      <section className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-body-large font-bold text-text-primary">Password & Security</h3>
            <p className="text-caption text-text-secondary">Protect your KingdomDash account.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface-muted border border-border/60">
          <div>
            <span className="text-body-small font-bold text-text-primary block">Account Password</span>
            <span className="text-caption text-text-secondary">
              Update password to keep your orders and stored cards secure.
            </span>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white shrink-0 self-start sm:self-auto">
            <Link to="/auth/update-password">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Change Password
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
