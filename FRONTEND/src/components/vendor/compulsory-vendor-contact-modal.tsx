import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Phone, MessageSquare, AlertTriangle, CheckCircle2, Store, ShieldAlert } from 'lucide-react'
import type { Vendor } from '@/types'
import { updateVendorContactInfo } from '@/services/supabase/vendors'

interface CompulsoryVendorContactModalProps {
  vendor: Vendor | null
  onSaved?: () => Promise<void> | void
}

export function CompulsoryVendorContactModal({
  vendor,
  onSaved,
}: CompulsoryVendorContactModalProps) {
  const isVendorActive = Boolean(vendor && vendor.is_active !== false)
  const hasPhone = Boolean(
    (vendor?.phone && vendor.phone.trim().length >= 7) ||
    ((vendor as unknown as { whatsapp_number?: string | null })?.whatsapp_number &&
      (vendor as unknown as { whatsapp_number?: string | null }).whatsapp_number!.trim().length >= 7)
  )
  const [justSaved, setJustSaved] = useState(false)

  // Compulsory prompt triggers immediately ONLY when vendor has no phone registered
  const isCompulsoryOpen = Boolean(!justSaved && isVendorActive && !hasPhone)

  const [phone, setPhone] = useState(vendor?.phone || '')
  const [whatsapp, setWhatsapp] = useState(
    (vendor as unknown as { whatsapp_number?: string | null })?.whatsapp_number || vendor?.phone || ''
  )
  const [useSameNumber, setUseSameNumber] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (vendor) {
      if (vendor.phone) {
        setPhone(vendor.phone)
      }
      const vendorWhatsapp = (vendor as unknown as { whatsapp_number?: string | null })?.whatsapp_number
      if (vendorWhatsapp) {
        setWhatsapp(vendorWhatsapp)
        setUseSameNumber(vendorWhatsapp === vendor.phone)
      } else if (vendor.phone) {
        setWhatsapp(vendor.phone)
        setUseSameNumber(true)
      }
    }
  }, [vendor])

  const handlePhoneChange = (val: string) => {
    setPhone(val)
    if (useSameNumber) {
      setWhatsapp(val)
    }
    if (errorMsg) setErrorMsg(null)
  }

  const handleSameNumberToggle = (checked: boolean) => {
    setUseSameNumber(checked)
    if (checked) {
      setWhatsapp(phone)
    }
  }

  const validatePhone = (num: string): boolean => {
    const clean = num.replace(/[\s\-()]/g, '')
    const phoneRegex = /^(\+?234|0)[789][01]\d{8}$/
    return phoneRegex.test(clean) || clean.length >= 10
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendor) return
    setErrorMsg(null)
    setSuccessMsg(null)

    const cleanPhone = phone.trim()
    const cleanWhatsapp = useSameNumber ? cleanPhone : whatsapp.trim()

    if (!cleanPhone) {
      setErrorMsg('Store operational phone number is required.')
      return
    }

    if (!validatePhone(cleanPhone)) {
      setErrorMsg('Please enter a valid phone number (e.g., 08012345678 or +2348012345678).')
      return
    }

    if (!cleanWhatsapp) {
      setErrorMsg('WhatsApp number is required. Tick "Same as store phone number" if on the same line.')
      return
    }

    if (!validatePhone(cleanWhatsapp)) {
      setErrorMsg('Please enter a valid WhatsApp number (e.g., 08012345678).')
      return
    }

    setIsSubmitting(true)
    try {
      const { success, error } = await updateVendorContactInfo(vendor.id, cleanPhone, cleanWhatsapp)
      if (!success && error) {
        throw new Error(error)
      }

      setJustSaved(true)
      setSuccessMsg('Store contact numbers successfully registered! Updating storefront...')
      if (onSaved) {
        await onSaved()
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register store phone number.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isCompulsoryOpen) return null

  return (
    <Dialog open={isCompulsoryOpen} onOpenChange={() => {}}>
      <DialogContent
        hideCloseButton={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-md border-2 border-primary/40 bg-white p-6 shadow-2xl sm:max-w-lg"
        data-testid="compulsory-vendor-contact-modal"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-status-error/15 text-status-error border-status-error/30 flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="h-3.5 w-3.5" />
              Compulsory Store Contact Required Now
            </Badge>
          </div>
          <DialogTitle className="text-xl font-black text-text-primary flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Register Store Operational Phone Number
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-text-secondary leading-relaxed">
            Dispatch riders and customers must be able to call your kitchen/store immediately for
            order confirmations, preparation inquiries, and pickup handovers. You must register
            your store&apos;s phone number immediately to continue operations.
          </p>

          {errorMsg && (
            <div
              data-testid="vendor-modal-error-alert"
              className="flex items-start gap-2.5 rounded-lg border border-status-error/30 bg-status-error/10 p-3 text-xs font-semibold text-status-error"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-lg border border-status-success/30 bg-status-success/10 p-3 text-xs font-semibold text-status-success">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone input */}
            <div className="space-y-1.5">
              <Label htmlFor="vendor-modal-phone" className="text-xs font-bold text-text-primary">
                Store Operational Phone (Call Line) <span className="text-status-error">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  id="vendor-modal-phone"
                  data-testid="vendor-modal-phone-input"
                  type="tel"
                  placeholder="e.g. 08012345678 or +234..."
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="pl-9 text-sm font-medium"
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-[11px] text-text-muted">
                Official store mobile line for rider pickup coordination and customer inquiries.
              </p>
            </div>

            {/* Same number checkbox */}
            <div className="rounded-lg border border-border bg-surface-alt/60 p-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-text-primary select-none">
                <input
                  type="checkbox"
                  data-testid="vendor-modal-same-number-checkbox"
                  checked={useSameNumber}
                  onChange={(e) => handleSameNumberToggle(e.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>My WhatsApp line is the same as my store phone number</span>
              </label>
            </div>

            {/* WhatsApp input (if different) */}
            {!useSameNumber && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <Label htmlFor="vendor-modal-whatsapp" className="text-xs font-bold text-text-primary">
                  Store WhatsApp Line <span className="text-status-error">*</span>
                </Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                  <Input
                    id="vendor-modal-whatsapp"
                    data-testid="vendor-modal-whatsapp-input"
                    type="tel"
                    placeholder="e.g. 08012345678"
                    value={whatsapp}
                    onChange={(e) => {
                      setWhatsapp(e.target.value)
                      if (errorMsg) setErrorMsg(null)
                    }}
                    className="pl-9 text-sm font-medium"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[11px] text-text-muted">
                  Used for order receipts, customer chat, and kitchen dispatch updates.
                </p>
              </div>
            )}

            <Button
              type="submit"
              data-testid="vendor-modal-submit-btn"
              disabled={isSubmitting || !phone.trim()}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Registering Store Phone…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Register Store Phone & Continue</span>
                </>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
