import { useState, useEffect } from 'react'
import type { AssignmentInboxOffer } from '@/types/rider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Navigation, Clock, Store, AlertCircle, Check, X } from 'lucide-react'

interface AssignmentCardProps {
  offer: AssignmentInboxOffer
  onAccept: (assignmentId: string) => Promise<void>
  onReject: (assignmentId: string, reason?: string) => Promise<void>
  isProcessing?: boolean
}

export function AssignmentCard({
  offer,
  onAccept,
  onReject,
  isProcessing = false,
}: AssignmentCardProps) {
  // 60-second visual UX guidance timer
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [actionPending, setActionPending] = useState<'accept' | 'reject' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleAccept = async () => {
    setErrorMessage(null)
    setActionPending('accept')
    try {
      await onAccept(offer.assignment_id)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to accept assignment. Please retry.'
      )
    } finally {
      setActionPending(null)
    }
  }

  const handleReject = async () => {
    setErrorMessage(null)
    setActionPending('reject')
    try {
      await onReject(offer.assignment_id, 'declined_by_rider')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to decline assignment.'
      )
    } finally {
      setActionPending(null)
    }
  }

  const isBusy = isProcessing || actionPending !== null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-card transition-all hover:shadow-card-hover">
      {/* Visual countdown progress bar (UX guidance only) */}
      <div
        className="absolute top-0 left-0 h-1 bg-primary transition-all duration-1000 ease-linear"
        style={{ width: `${(secondsLeft / 60) * 100}%` }}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-caption text-text-muted">New Dispatch Offer</span>
          <h3 className="text-h4 font-bold text-text-primary">
            {offer.vendor_name}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={
              offer.service_type === 'food'
                ? 'primary'
                : offer.service_type === 'grocery'
                ? 'success'
                : 'info'
            }
            className="capitalize font-semibold"
          >
            {offer.service_type}
          </Badge>
          <div className="flex items-center gap-1 rounded-full bg-page-background px-2.5 py-1 text-caption font-medium text-text-secondary">
            <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>{secondsLeft}s</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 rounded-xl border border-border bg-page-background/60 p-3.5 text-body-small">
        <div className="flex items-start gap-2.5">
          <Store className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-caption font-medium text-text-muted">Pickup Location</span>
            <p className="font-semibold text-text-primary">{offer.pickup_address}</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <MapPin className="h-4 w-4 shrink-0 text-error mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-caption font-medium text-text-muted">Destination Area</span>
            <p className="font-semibold text-text-primary">
              {offer.delivery_area} <span className="text-caption text-text-muted">(Exact address after accept)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-1 text-caption text-text-secondary border-t border-border/60">
          <Navigation className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          <span>Estimated Trip: <strong>{offer.estimated_distance_km.toFixed(1)} km</strong></span>
          {offer.special_instructions_preview && (
            <span className="ml-auto rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
              {offer.special_instructions_preview}
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-error/10 p-2.5 text-body-small text-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleReject}
          disabled={isBusy}
          className="h-12 w-full gap-2 text-text-secondary hover:text-error hover:border-error"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Decline
        </Button>

        <Button
          type="button"
          variant="primary"
          onClick={handleAccept}
          disabled={isBusy}
          className="h-12 w-full gap-2 font-bold shadow-md text-white bg-primary hover:bg-primary-hover"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {actionPending === 'accept' ? 'Accepting...' : 'Accept Job'}
        </Button>
      </div>
    </div>
  )
}
