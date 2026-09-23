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
import {
  AlertTriangle,
  Loader2,
  UserX,
  Clock,
  MapPinOff,
  Wrench,
  NavigationOff,
  HelpCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react'

interface OperationalIssueModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (issueType: OperationalIssueType, notes: string) => Promise<void>
  deliveryId: string
}

interface IssueOption {
  value: OperationalIssueType
  label: string
  description: string
  icon: typeof AlertTriangle
}

const ISSUE_OPTIONS: IssueOption[] = [
  {
    value: 'customer_unreachable',
    label: 'Customer Unreachable',
    description: 'No response to calls or messages upon arrival at the destination.',
    icon: UserX,
  },
  {
    value: 'vendor_delay',
    label: 'Merchant Delay',
    description: 'Vendor preparation is significantly delayed beyond estimated window.',
    icon: Clock,
  },
  {
    value: 'address_issue',
    label: 'Incorrect / Unclear Address',
    description: 'Landmark not found, wrong street address, or gated road access.',
    icon: MapPinOff,
  },
  {
    value: 'vehicle_breakdown',
    label: 'Vehicle Breakdown',
    description: 'Motorcycle, bicycle, or tire puncture preventing transit.',
    icon: Wrench,
  },
  {
    value: 'traffic_delay',
    label: 'Severe Traffic / Blockage',
    description: 'Heavy road construction, accident gridlock, or impassable route.',
    icon: NavigationOff,
  },
  {
    value: 'other',
    label: 'Other Operational Issue',
    description: 'General delivery impediment requiring immediate dispatch intervention.',
    icon: HelpCircle,
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
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-7">
        <DialogHeader className="gap-2.5 pb-2 border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-4 ring-amber-500/10">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-h4 font-bold text-text-primary tracking-tight">
                Report Delivery Exception
              </DialogTitle>
              <DialogDescription className="text-body-small text-text-secondary mt-0.5">
                Log an operational delay or road issue for authoritative dispatch logging.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-3">
          {/* Issue Categories Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-caption font-bold uppercase tracking-wider text-text-secondary">
                Select Exception Category
              </label>
              <span className="text-[11px] font-medium text-text-muted">
                Required
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ISSUE_OPTIONS.map((opt) => {
                const isSelected = selectedType === opt.value
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedType(opt.value)}
                    className={`relative flex flex-col text-left rounded-xl p-3 border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                        : 'border-border/80 bg-white hover:border-primary/40 hover:bg-page-background/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-page-background text-text-secondary border border-border/60'
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded-full transition-all ${
                          isSelected
                            ? 'text-primary'
                            : 'border border-border/80 text-transparent'
                        }`}
                      >
                        <CheckCircle2 className={`h-4 w-4 ${isSelected ? 'fill-primary text-white' : ''}`} />
                      </div>
                    </div>
                    <span className="text-body-small font-bold text-text-primary leading-tight">
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-text-secondary mt-1 leading-snug">
                      {opt.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="issue-notes" className="text-caption font-bold uppercase tracking-wider text-text-secondary">
                Additional Details
              </label>
              <span className="text-[11px] font-medium text-text-muted">
                {notes.length} / 500 characters
              </span>
            </div>
            <textarea
              id="issue-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Arrived at address, security refused entry / customer phone switched off..."
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-border bg-page-background p-3 text-body-small text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all resize-none"
            />
          </div>

          {/* Warning / Dispatch Notification Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-caption text-text-secondary">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-text-primary text-caption">
                Dispatch Real-time Notification
              </p>
              <p className="text-[12px] leading-relaxed">
                Reporting an exception notifies the live fleet dispatch desk immediately. This does <strong>not</strong> cancel your delivery. Please remain in safe proximity with the items until contacted.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-caption text-error font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="font-medium h-10 px-5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="gap-2 font-bold text-white bg-primary hover:bg-primary-hover shadow-sm h-10 px-5"
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
