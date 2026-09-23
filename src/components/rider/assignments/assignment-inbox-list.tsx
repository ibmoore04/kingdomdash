import type { AssignmentInboxOffer } from '@/types/rider'
import { AssignmentCard } from './assignment-card'
import { Button } from '@/components/ui/button'
import { Radio, RefreshCw, AlertTriangle } from 'lucide-react'

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

  if (!isAvailable && offers.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-border text-text-muted">
          <Radio className="h-7 w-7" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-h4 font-bold text-text-primary">You are Offline</h3>
        <p className="mt-2 max-w-sm text-body-small text-text-secondary">
          Toggle your availability switch to Online to start receiving nearby delivery dispatches.
        </p>
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Radio className="h-8 w-8 animate-pulse" aria-hidden="true" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
          </span>
        </div>
        <h3 className="mt-4 text-h4 font-bold text-text-primary">Waiting for Dispatches</h3>
        <p className="mt-2 max-w-sm text-body-small text-text-secondary">
          You are online and available. When a nearby order is placed in Ijebu-Ode, it will appear here immediately.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          className="mt-5 gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh Inbox
        </Button>
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
