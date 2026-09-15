import { useState, useEffect, useCallback } from 'react'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { getRiderDeliveryHistory } from '@/services/rider/history-service'
import { getRiderActiveDelivery } from '@/services/rider/custody-service'
import type { CompletedDeliveryHistoryItem } from '@/types/rider'
import { HistoryCard } from '@/components/rider/history/history-card'
import { Button } from '@/components/ui/button'
import { History, RefreshCw } from 'lucide-react'

export default function RiderHistoryPage() {
  const [history, setHistory] = useState<CompletedDeliveryHistoryItem[]>([])
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const [histRes, activeRes] = await Promise.all([
        getRiderDeliveryHistory(50, 0),
        getRiderActiveDelivery(),
      ])
      setHistory(histRes.data)
      setHasActiveDelivery(Boolean(activeRes.data))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  return (
    <RiderLayout activeTripCount={hasActiveDelivery ? 1 : 0}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h3 font-bold text-text-primary">Delivery History</h1>
            <p className="text-body-small text-text-secondary">
              Record of your fulfilled dispatches and completed customer handoffs.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-3 text-body-small text-text-secondary">Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-page-background text-text-muted">
              <History className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-h4 font-bold text-text-primary">No Completed Deliveries</h2>
            <p className="mt-1 max-w-sm text-body-small text-text-secondary">
              Deliveries you fulfill will appear here with timestamps, pickup zones, and delivery routes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <HistoryCard key={item.assignment_id} item={item} />
            ))}
          </div>
        )}
      </div>
    </RiderLayout>
  )
}
