import type { AssignmentInboxOffer } from '@/types/rider'
import { AssignmentCard } from './assignment-card'
import { Button } from '@/components/ui/button'
import { ScanningRadar } from '@/components/rider/dashboard/scanning-radar'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface AssignmentInboxListProps {
  offers: AssignmentInboxOffer[]
  isLoading: boolean
  onAccept: (assignmentId: string) => Promise<void>
  onReject: (assignmentId: string, reason?: string) => Promise<void>
  onRefresh: () => void
  isAvailable: boolean
}

export function AssignmentInboxList({
  offers,
  isLoading,
  onAccept,
  onReject,
  onRefresh,
  isAvailable,
}: AssignmentInboxListProps) {
  if (isLoading && offers.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="mt-3 text-body-small font-medium text-text-secondary">
          Checking for active dispatches...
        </p>
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-neutral-200/90 bg-white p-6 sm:p-10 text-center shadow-md">
        <ScanningRadar
          isAvailable={isAvailable}
          hubLocation="Ijebu-Ode Dispatch Network"
        />
        <div className="mt-5 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            className="gap-2 text-xs font-bold rounded-xl h-9 shadow-xs"
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh Radar Offers</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!isAvailable && (
        <div className="flex items-center gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-body-small text-text-primary">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            <strong>You are offline</strong> — but you have a pending dispatch. Go online to accept new jobs automatically.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-body-small font-semibold text-text-primary">
          Available Offers ({offers.length})
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="gap-1.5 text-caption text-text-muted hover:text-text-primary"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {offers.map((offer) => (
          <AssignmentCard
            key={offer.assignment_id}
            offer={offer}
            onAccept={onAccept}
            onReject={onReject}
          />
        ))}
      </div>
    </div>
  )
}
