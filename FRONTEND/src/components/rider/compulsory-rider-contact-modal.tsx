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
import { Phone, MessageSquare, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { RiderProfile } from '@/types/rider'
import { updateRiderContactInfo } from '@/services/rider/rider-service'

interface CompulsoryRiderContactModalProps {
  rider: RiderProfile | null
  onSaved?: () => Promise<void> | void
}

export function CompulsoryRiderContactModal({
  rider,
  onSaved,
}: CompulsoryRiderContactModalProps) {
  const isVerified = Boolean(rider && rider.is_verified)
  const hasPhone = Boolean(
    (rider?.phone && rider.phone.trim().length >= 7) ||
    (rider?.whatsapp_number && rider.whatsapp_number.trim().length >= 7)
  )
  const [justSaved, setJustSaved] = useState(false)

  // Compulsory prompt triggers immediately ONLY when rider has no phone registered
  const isCompulsoryOpen = Boolean(!justSaved && isVerified && !hasPhone)

  const [phoneNumber, setPhoneNumber] = useState(rider?.phone || '')
  const [whatsappNumber, setWhatsappNumber] = useState(rider?.whatsapp_number || rider?.phone || '')
  const [useSameNumber, setUseSameNumber] = useState(
    Boolean(!rider?.whatsapp_number || rider?.whatsapp_number === rider?.phone)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Synchronize state if rider prop changes
  useEffect(() => {
    if (rider) {
      if (rider.phone) setPhoneNumber(rider.phone)
      if (rider.whatsapp_number) {
        setWhatsappNumber(rider.whatsapp_number)
        setUseSameNumber(rider.whatsapp_number === rider.phone)
      } else if (rider.phone) {
        setWhatsappNumber(rider.phone)
        setUseSameNumber(true)
      }
    }
  }, [rider])

  const handlePhoneChange = (val: string) => {
    setPhoneNumber(val)
    if (useSameNumber) {
      setWhatsappNumber(val)
    }
    if (errorMsg) setErrorMsg(null)
  }

  const handleSameNumberToggle = (checked: boolean) => {
    setUseSameNumber(checked)
    if (checked) {
      setWhatsappNumber(phoneNumber)
    }
  }

  const validatePhone = (num: string): boolean => {
    const clean = num.replace(/[\s\-()]/g, '')
    // Nigerian standard numbers: 080..., 070..., 090..., 081... (11 digits) or +234... (13-14 digits)
    const phoneRegex = /^(\+?234|0)[789][01]\d{8}$/
    return phoneRegex.test(clean) || clean.length >= 10
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const cleanPhone = phoneNumber.trim()
    const cleanWhatsapp = useSameNumber ? cleanPhone : whatsappNumber.trim()

    if (!cleanPhone) {
      setErrorMsg('Primary operational phone number is required.')
      return
    }

    if (!validatePhone(cleanPhone)) {
      setErrorMsg('Please enter a valid phone number (e.g., 08012345678 or +2348012345678).')
      return
    }

    if (!cleanWhatsapp) {
      setErrorMsg('WhatsApp number is required. Tick "Use same number" if your WhatsApp is on this phone.')
      return
    }

    if (!validatePhone(cleanWhatsapp)) {
      setErrorMsg('Please enter a valid WhatsApp number (e.g., 08012345678).')
      return
    }

    setIsSubmitting(true)
    try {
      const { success, error } = await updateRiderContactInfo(cleanPhone, cleanWhatsapp)
      if (!success && error) {
        throw error
      }

      setJustSaved(true)
      setSuccessMsg('Phone and WhatsApp numbers successfully registered! Updating console...')
      if (onSaved) {
        await onSaved()
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register contact information.')
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
        data-testid="compulsory-rider-contact-modal"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-status-error/15 text-status-error border-status-error/30 flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="h-3.5 w-3.5" />
              Compulsory Action Required Now
            </Badge>
          </div>
          <DialogTitle className="text-xl font-black text-text-primary flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Register Your Phone & WhatsApp Number
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-text-secondary leading-relaxed">
            Your rider application is active! Customers, vendors, and dispatch coordinators must
            be able to reach you directly during order pickup and handoff. You must register your
            working call line and WhatsApp number before accessing dispatch orders.
          </p>

          {errorMsg && (
            <div
              data-testid="rider-modal-error-alert"
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
              <Label htmlFor="rider-modal-phone" className="text-xs font-bold text-text-primary">
                Operational Phone Number (Call Line) <span className="text-status-error">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  id="rider-modal-phone"
                  data-testid="rider-modal-phone-input"
                  type="tel"
                  placeholder="e.g. 08012345678 or +234..."
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="pl-9 text-sm font-medium"
                  required
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-[11px] text-text-muted">
                Direct mobile line where customers and dispatch call you.
              </p>
            </div>

            {/* Same number checkbox */}
            <div className="rounded-lg border border-border bg-surface-alt/60 p-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-text-primary select-none">
                <input
                  type="checkbox"
                  data-testid="rider-modal-same-number-checkbox"
                  checked={useSameNumber}
                  onChange={(e) => handleSameNumberToggle(e.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>My WhatsApp number is the same as my phone number</span>
              </label>
            </div>

            {/* WhatsApp input (if different) */}
            {!useSameNumber && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <Label htmlFor="rider-modal-whatsapp" className="text-xs font-bold text-text-primary">
                  WhatsApp Contact Line <span className="text-status-error">*</span>
                </Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                  <Input
                    id="rider-modal-whatsapp"
                    data-testid="rider-modal-whatsapp-input"
                    type="tel"
                    placeholder="e.g. 08012345678"
                    value={whatsappNumber}
                    onChange={(e) => {
                      setWhatsappNumber(e.target.value)
                      if (errorMsg) setErrorMsg(null)
                    }}
                    className="pl-9 text-sm font-medium"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-[11px] text-text-muted">
                  Used for dispatch order coordination, item dropoff photos, and instant chat.
                </p>
              </div>
            )}

            <Button
              type="submit"
              data-testid="rider-modal-submit-btn"
              disabled={isSubmitting || !phoneNumber.trim()}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Registering Contact Details…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Save Contact Details & Start Delivering</span>
                </>
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
