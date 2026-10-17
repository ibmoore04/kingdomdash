import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { RiderProfile } from '@/types/rider'
import { updateRiderContactInfo } from '@/services/rider/rider-service'
import { useUiStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Phone,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface CompulsoryContactBannerProps {
  rider: RiderProfile | null
  onSuccess?: () => Promise<void>
}

export function CompulsoryContactBanner({
  rider,
  onSuccess,
}: CompulsoryContactBannerProps) {
  const { pushToast } = useUiStore()

  // Form states
  const [isExpanded, setIsExpanded] = useState(false)
  const [phone, setPhone] = useState(rider?.phone || '')
  const [whatsappNumber, setWhatsappNumber] = useState(
    rider?.whatsapp_number || rider?.phone || ''
  )
  const [sameAsPhone, setSameAsPhone] = useState(
    !rider?.whatsapp_number || rider?.whatsapp_number === rider?.phone
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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

  // Check if contact info is incomplete
  const hasPhone = Boolean(rider?.phone && rider.phone.trim().length >= 7)
  const hasWhatsapp = Boolean(
    rider?.whatsapp_number && rider.whatsapp_number.trim().length >= 7
  )
  const isIncomplete = !hasPhone || !hasWhatsapp

  // Only show for approved/verified riders with missing phone or whatsapp
  if (!rider || !rider.is_verified || !isIncomplete) {
    return null
  }

  const handlePhoneChange = (val: string) => {
    setPhone(val)
    if (sameAsPhone) {
      setWhatsappNumber(val)
    }
  }

  const handleToggleSameAsPhone = (checked: boolean) => {
    setSameAsPhone(checked)
    if (checked) {
      setWhatsappNumber(phone)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const cleanPhone = phone.trim()
    const cleanWa = sameAsPhone ? cleanPhone : whatsappNumber.trim()

    if (!cleanPhone || cleanPhone.length < 7) {
      setFormError('Please enter a valid operational phone number (minimum 7 digits).')
      return
    }

    if (!cleanWa || cleanWa.length < 7) {
      setFormError(
        'WhatsApp number is compulsory. If you do not have a dedicated WhatsApp number, check the box to use your phone number.'
      )
      return
    }

    setIsSubmitting(true)
    try {
      const { success, error } = await updateRiderContactInfo(cleanPhone, cleanWa)
      if (!success && error) {
        throw error
      }

      pushToast({
        title: 'Contact Information Saved',
        message: 'Your phone and WhatsApp lines have been verified for delivery dispatches.',
        variant: 'success',
      })

      if (onSuccess) {
        await onSuccess()
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to update contact numbers. Please retry.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="compulsory-rider-contact-banner"
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-white p-5 sm:p-6 shadow-md transition-all"
    >
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-500/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-4">
        {/* Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/30">
              <AlertTriangle className="h-5 w-5 animate-pulse" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-amber-950 tracking-tight">
                  Action Required: Add Your Phone & WhatsApp Number
                </h3>
                <Badge variant="warning" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                  Compulsory
                </Badge>
              </div>
              <p className="text-body-small text-amber-900/90 mt-1 leading-relaxed">
                Your rider application is approved! Customers and KingdomDash dispatch must be able to reach you via regular phone call and WhatsApp during active trips.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="gap-1.5 font-bold text-xs rounded-xl border-amber-600/30 bg-white/80 hover:bg-white text-amber-900 shadow-xs"
            >
              <span>{isExpanded ? 'Hide Quick Form' : 'Quick Setup'}</span>
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </Button>

            <Button
              asChild
              variant="primary"
              size="sm"
              className="gap-1.5 font-bold text-xs rounded-xl text-white bg-amber-600 hover:bg-amber-700 shadow-sm"
            >
              <Link to="/rider/settings">
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Open Settings</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Expandable Quick Setup Form */}
        {isExpanded && (
          <form
            onSubmit={handleSubmit}
            className="mt-3 rounded-2xl border border-amber-500/30 bg-white/95 p-4 sm:p-5 shadow-inner space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field 1: Operational Call Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="quick-rider-phone" className="text-caption font-bold text-text-primary flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>Operational Phone (Call Line) *</span>
                </Label>
                <Input
                  id="quick-rider-phone"
                  type="tel"
                  placeholder="e.g. 08123456789 or +234..."
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="h-10 text-body-small rounded-xl"
                  required
                />
                <p className="text-[11px] text-text-muted">
                  Used by customers to call you when you arrive at their location.
                </p>
              </div>

              {/* Field 2: WhatsApp Number */}
              <div className="space-y-1.5">
                <Label htmlFor="quick-rider-whatsapp" className="text-caption font-bold text-text-primary flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>WhatsApp Number (Compulsory) *</span>
                </Label>
                <Input
                  id="quick-rider-whatsapp"
                  type="tel"
                  placeholder="e.g. 08123456789 or +234..."
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  disabled={sameAsPhone}
                  className="h-10 text-body-small rounded-xl disabled:bg-slate-100 disabled:text-text-muted"
                  required
                />
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="quick-same-as-phone"
                    checked={sameAsPhone}
                    onChange={(e) => handleToggleSameAsPhone(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <label
                    htmlFor="quick-same-as-phone"
                    className="text-caption font-medium text-text-secondary cursor-pointer"
                  >
                    Same as operational phone number
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-900">
              <strong>Notice:</strong> If you do not have a dedicated WhatsApp line, keep the box checked to use your usual phone number so dispatch and customers can reach you via WhatsApp.
            </div>

            {formError && (
              <div className="rounded-xl bg-error/10 border border-error/20 p-2.5 text-caption font-medium text-error">
                {formError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                className="gap-2 font-bold text-xs rounded-xl text-white bg-primary hover:bg-primary-hover shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{isSubmitting ? 'Saving Numbers...' : 'Save & Verify Contact'}</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
