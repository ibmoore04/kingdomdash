import { useState } from 'react'
import { AlertTriangle, Phone, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Vendor } from '@/types'
import { updateVendorContactInfo } from '@/services/supabase/vendors'

interface VendorCompulsoryContactBannerProps {
  vendor: Vendor | null
  onSaved?: () => Promise<void> | void
}

export function VendorCompulsoryContactBanner({
  vendor,
  onSaved,
}: VendorCompulsoryContactBannerProps) {
  const isVendorActive = Boolean(vendor && vendor.is_active !== false)
  const hasPhone = Boolean(vendor?.phone && vendor.phone.trim().length >= 7)

  const isMissingContact = Boolean(isVendorActive && !hasPhone)

  const [phone, setPhone] = useState(vendor?.phone || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isMissingContact) return null

  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vendor) return
    setErrorMsg(null)
    setSuccessMsg(null)

    const cleanPhone = phone.trim()
    if (!cleanPhone || cleanPhone.length < 7) {
      setErrorMsg('Please enter a valid operational phone number (e.g. 08012345678).')
      return
    }

    setIsSubmitting(true)
    try {
      const { success, error } = await updateVendorContactInfo(vendor.id, cleanPhone, cleanPhone)
      if (!success && error) {
        throw new Error(error)
      }
      setSuccessMsg('Store operational phone registered!')
      if (onSaved) {
        await onSaved()
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register store phone.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="compulsory-vendor-contact-banner"
      role="alert"
      className="mb-6 rounded-xl border-2 border-status-error/40 bg-status-error/10 p-4 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-status-error/20 p-2 text-status-error shrink-0 mt-0.5">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-status-error">
                Compulsory Immediate Action
              </span>
            </div>
            <h4 className="text-base font-bold text-text-primary">
              Store Operational Phone Number Missing
            </h4>
            <p className="text-xs text-text-secondary max-w-xl">
              Dispatch riders and buyers must be able to call your kitchen/store immediately for order confirmations, preparation inquiries, and pickup coordination.
            </p>
            {errorMsg && (
              <p className="text-xs font-semibold text-status-error flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {errorMsg}
              </p>
            )}
            {successMsg && (
              <p className="text-xs font-semibold text-status-success flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {successMsg}
              </p>
            )}
          </div>
        </div>

        {/* Quick inline register */}
        <form onSubmit={handleQuickSave} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
            <Input
              type="tel"
              placeholder="Store Phone (080...)"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              className="pl-8 text-xs h-9 w-full sm:w-48 bg-white"
              disabled={isSubmitting}
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || !phone.trim()}
            className="h-9 px-4 text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs shrink-0"
          >
            {isSubmitting ? 'Saving…' : 'Save Phone'}
          </Button>
        </form>
      </div>
    </div>
  )
}
