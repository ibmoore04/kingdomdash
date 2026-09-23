import { useState, useEffect, useCallback, useMemo } from 'react'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { getRiderDeliveryHistory } from '@/services/rider/history-service'
import { getRiderActiveDelivery } from '@/services/rider/custody-service'
import type { CompletedDeliveryHistoryItem } from '@/types/rider'
import { HistoryCard, getTripEarnings } from '@/components/rider/history/history-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatNgn } from '@/utils/formatting'
import {
  History,
  RefreshCw,
  Wallet,
  TrendingUp,
  Search,
  CheckCircle2,
} from 'lucide-react'

type FilterPeriod = 'all' | 'today' | 'week' | 'food' | 'grocery' | 'courier'

export default function RiderHistoryPage() {
  const [history, setHistory] = useState<CompletedDeliveryHistoryItem[]>([])
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<FilterPeriod>('all')
  const [searchQuery, setSearchQuery] = useState('')

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

  // Earnings calculations
  const stats = useMemo(() => {
    const now = new Date()
    const todayStr = now.toDateString()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    let todayEarnings = 0
    let todayCount = 0
    let weekEarnings = 0
    let weekCount = 0
    let totalEarnings = 0

    history.forEach((item) => {
      const earnings = getTripEarnings(item)
      totalEarnings += earnings

      if (item.delivered_at) {
        const itemDate = new Date(item.delivered_at)
        if (itemDate.toDateString() === todayStr) {
          todayEarnings += earnings
          todayCount += 1
        }
        if (itemDate >= oneWeekAgo) {
          weekEarnings += earnings
          weekCount += 1
        }
      }
    })

    return {
      todayEarnings,
      todayCount,
      weekEarnings,
      weekCount,
      totalEarnings,
      totalCount: history.length,
    }
  }, [history])

  // Filtered list
  const filteredHistory = useMemo(() => {
    const now = new Date()
    const todayStr = now.toDateString()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const query = searchQuery.trim().toLowerCase()

    return history.filter((item) => {
      // Period filter
      if (periodFilter === 'today') {
        if (!item.delivered_at || new Date(item.delivered_at).toDateString() !== todayStr) {
          return false
        }
      } else if (periodFilter === 'week') {
        if (!item.delivered_at || new Date(item.delivered_at) < oneWeekAgo) {
          return false
        }
      } else if (['food', 'grocery', 'courier'].includes(periodFilter)) {
        if (item.service_type !== periodFilter) {
          return false
        }
      }

      // Search query
      if (query) {
        const vendor = item.vendor_name?.toLowerCase() || ''
        const pickup = item.pickup_area?.toLowerCase() || ''
        const delivery = item.delivery_area?.toLowerCase() || ''
        const id = item.delivery_id?.toLowerCase() || ''
        return vendor.includes(query) || pickup.includes(query) || delivery.includes(query) || id.includes(query)
      }

      return true
    })
  }, [history, periodFilter, searchQuery])

  return (
    <RiderLayout activeTripCount={hasActiveDelivery ? 1 : 0}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-h3 font-bold text-text-primary">Trip History & Earnings</h1>
            <p className="text-body-small text-text-secondary">
              Review completed dispatches, payout settlements, and weekly earnings in Ijebu-Ode.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={isLoading}
            className="gap-2 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {/* Earnings & Trip Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Today */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-caption font-semibold uppercase tracking-wider text-emerald-800">
                Today's Earnings
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-h3 font-extrabold text-emerald-900">
                {formatNgn(stats.todayEarnings)}
              </span>
            </div>
            <p className="mt-1 text-caption text-emerald-700 font-medium">
              {stats.todayCount} completed {stats.todayCount === 1 ? 'trip' : 'trips'} today
            </p>
          </div>

          {/* This Week */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-caption font-semibold uppercase tracking-wider text-primary">
                Last 7 Days
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-h3 font-extrabold text-text-primary">
                {formatNgn(stats.weekEarnings)}
              </span>
            </div>
            <p className="mt-1 text-caption text-text-secondary font-medium">
              {stats.weekCount} trips delivered this week
            </p>
          </div>

          {/* Total All Time */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                All-Time Total
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-page-background text-text-muted">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-h3 font-extrabold text-text-primary">
                {formatNgn(stats.totalEarnings)}
              </span>
            </div>
            <p className="mt-1 text-caption text-text-secondary font-medium">
              {stats.totalCount} total successful deliveries
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'All Trips' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'food', label: 'Food' },
                { id: 'grocery', label: 'Grocery' },
                { id: 'courier', label: 'Courier' },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setPeriodFilter(filter.id)}
                className={`rounded-lg px-3 py-1.5 text-caption font-semibold transition-colors ${
                  periodFilter === filter.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-page-background text-text-secondary hover:bg-neutral-200/60 hover:text-text-primary'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor or area…"
              className="h-8 pl-8 text-caption"
            />
          </div>
        </div>

        {/* History List */}
        {isLoading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-3 text-body-small text-text-secondary">Loading delivery records...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-page-background text-text-muted">
              <History className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-h4 font-bold text-text-primary">
              {history.length === 0 ? 'No Completed Deliveries Yet' : 'No Trips Matching Filter'}
            </h2>
            <p className="mt-1 max-w-sm text-body-small text-text-secondary">
              {history.length === 0
                ? 'Deliveries you fulfill in Ijebu-Ode will appear here with timestamps, pickup zones, and delivery payout settlements.'
                : 'Try adjusting your search query or selecting a different filter above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <HistoryCard key={item.assignment_id} item={item} />
            ))}
          </div>
        )}
      </div>
    </RiderLayout>
  )
}
