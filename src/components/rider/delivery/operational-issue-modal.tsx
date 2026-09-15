import { useState } from 'react'
import type { OperationalIssueType } from '@/types/rider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface OperationalIssueModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (issueType: OperationalIssueType, notes: string) => Promise<void>
  deliveryId: string
}

const ISSUE_OPTIONS: { value: OperationalIssueType; label: string; description: string }[] = [
  {
    value: 'customer_unreachable',
    label: 'Customer Unreachable',
    description: 'Customer is not answering phone calls or messages upon arrival.',
  },
  {
    value: 'vendor_delay',
    label: 'Merchant Preparation Delay',
    description: 'Vendor is taking significantly longer than expected to prepare.',
  },
  {
    value: 'address_issue',
    label: 'Incorrect or Unclear Address',
    description: 'Address landmark is not found or road access is blocked.',
  },
  {
    value: 'vehicle_breakdown',
    label: 'Vehicle Issue / Mechanical Breakdown',
    description: 'Motorcycle, bicycle, or vehicle issue preventing transit.',
  },
  {
    value: 'traffic_delay',
    label: 'Severe Traffic / Road Blockage',
    description: 'Severe transit delays due to road construction or gridlock.',
  },
  {
    value: 'other',
    label: 'Other Operational Exception',
    description: 'General delivery issue requiring dispatch assistance.',
  },
]

export function OperationalIssueModal({
  isOpen,
  onClose,
  onSubmit,
}: OperationalIssueModalProps) {
  const [selectedType, setSelectedType] = useState<OperationalIssueType>('customer_unreachable')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await onSubmit(selectedType, notes.trim())
      setNotes('')
      onClose()
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to submit report. Please retry.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <DialogTitle>Report Delivery Exception</DialogTitle>
          </div>
          <DialogDescription>
            Log an operational delay or road issue. This records an authoritative breadcrumb for fleet dispatch.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-body-small font-semibold text-text-primary">
              Issue Category
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-border p-2">
              {ISSUE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg p-2 transition-colors ${
                    selectedType === opt.value
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-page-background'
                  }`}
                >
                  <input
                    type="radio"
                    name="issue-type"
                    value={opt.value}
                    checked={selectedType === opt.value}
                    onChange={() => setSelectedType(opt.value)}
                    className="mt-1"
                  />
                  <div className="text-body-small">
                    <span className="font-semibold text-text-primary block">{opt.label}</span>
                    <span className="text-caption text-text-secondary">{opt.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="issue-notes" className="text-body-small font-semibold text-text-primary">
              Additional Details (Optional)
            </label>
            <textarea
              id="issue-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Called customer 3 times, arrived at gate..."
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-border bg-page-background p-3 text-body-small text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-caption text-text-secondary">
            <strong>Important:</strong> Reporting an exception does <em>not</em> cancel the delivery.
            Please remain with the order until dispatch contacts you.
          </div>

          {errorMessage && (
            <p className="text-caption text-error font-medium">{errorMessage}</p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="gap-2 font-bold text-white bg-primary hover:bg-primary-hover"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Submit Exception Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
