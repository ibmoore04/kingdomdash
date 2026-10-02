import React, { useState } from 'react'
import { AlertTriangle, Loader2, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cancelOrderCustomer } from '@/services/supabase/orders'
import { useToast } from '@/hooks/use-toast'

interface CancelOrderModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  orderNumber: string
  isPaid?: boolean
  onCancelled: () => void
}

const CANCELLATION_REASONS = [
  'Changed my mind',
  'Placed order by mistake',
  'Delivery taking too long',
  'Want to change order items or address',
  'Found a better alternative',
  'Other reason',
]

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  isPaid = false,
  onCancelled,
}) => {
  const { pushToast } = useToast()
  const [selectedReason, setSelectedReason] = useState(CANCELLATION_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirmCancel = async () => {
    const finalReason =
      selectedReason === 'Other reason'
        ? customReason.trim() || 'Cancelled by customer (Other)'
        : selectedReason

    setIsSubmitting(true)
    try {
      const { error } = await cancelOrderCustomer(orderId, finalReason)
      if (error) {
        pushToast({
          variant: 'error',
          title: 'Cancellation Failed',
          message:
            typeof error === 'object' && error !== null && 'message' in error
              ? String(error.message)
              : 'Unable to cancel this order. It may already be in fulfillment.',
        })
      } else {
        pushToast({
          variant: 'success',
          title: 'Order Cancelled',
          message: isPaid
            ? `Order #${orderNumber} has been cancelled. A refund request has been queued for review.`
            : `Order #${orderNumber} has been cancelled successfully.`,
        })
        onCancelled()
        onClose()
      }
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'An error occurred during cancellation.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-error/10 text-error">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-text-primary">
                Cancel Order #{orderNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-text-secondary">
                Are you sure you want to cancel this order?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {isPaid && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Payment was received for this order</p>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Cancelling will automatically queue a refund ticket with support for review and processing back to your payment account.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-text-primary">
              Please select a reason for cancellation:
            </label>
            <div className="space-y-1.5">
              {CANCELLATION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-medium cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'border-primary bg-primary/5 text-primary font-bold'
                      : 'border-border bg-white text-text-primary hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancellationReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other reason' && (
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-text-secondary">
                Please specify your reason *
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Tell us why you are cancelling this order..."
                rows={2}
                className="w-full rounded-xl border border-border bg-white p-2.5 text-xs text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-xs font-semibold"
          >
            Keep Order
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-xs font-bold bg-error hover:bg-error/90 text-white gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span>Confirm Cancellation</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
