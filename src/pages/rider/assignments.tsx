import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import {
  getRiderAssignmentInbox,
  acceptDeliveryAssignment,
  rejectDeliveryAssignment,
} from '@/services/rider/assignment-service'
import { getRiderActiveDelivery } from '@/services/rider/custody-service'
import type { AssignmentInboxOffer } from '@/types/rider'
import { AssignmentInboxList } from '@/components/rider/assignments/assignment-inbox-list'
import { supabase } from '@/services/supabase/client'
import { Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function RiderAssignmentsPage() {
  const navigate = useNavigate()
  const { rider, refreshRider } = useCurrentRider()
  const [offers, setOffers] = useState<AssignmentInboxOffer[]>([])
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadInbox = useCallback(async () => {
    setIsLoading(true)
    try {
      const [inboxRes, activeRes] = await Promise.all([
        getRiderAssignmentInbox(),
        getRiderActiveDelivery(),
      ])

      const rawOffers = inboxRes.data || []
      const seen = new Set<string>()
      const dedupedOffers: AssignmentInboxOffer[] = []
      for (const o of rawOffers) {
        const key = o.order_id || o.delivery_id || o.assignment_id
        if (key && !seen.has(key)) {
          seen.add(key)
          dedupedOffers.push(o)
        }
      }
      setOffers(dedupedOffers)
      setHasActiveDelivery(Boolean(activeRes.data))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInbox()

    // Realtime Postgres changes subscription for instantaneous offer updates
    const channel = supabase
      .channel('rider_assignments_live_inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_assignments' },
        () => {
          loadInbox()
        }
      )
      .subscribe()

    // Backup polling interval (20 seconds, paused when tab hidden)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadInbox()
      }
    }, 20000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [loadInbox])

  const handleAccept = async (assignmentId: string) => {
    const { success, error } = await acceptDeliveryAssignment(assignmentId)
    if (!success && error) {
      throw error
    }
    await loadInbox()
    await refreshRider()
    navigate('/rider/deliveries/active')
  }

  const handleReject = async (assignmentId: string, reason?: string) => {
    const { success, error } = await rejectDeliveryAssignment(assignmentId, reason)
    if (!success && error) {
      throw error
    }
    await loadInbox()
  }

  return (
    <RiderLayout
      activeTripCount={hasActiveDelivery ? 1 : 0}
      inboxCount={offers.length}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-md p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Inbox className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">Dispatch Offers</h1>
                {offers.length > 0 ? (
                  <Badge variant="primary" className="font-semibold text-caption">
                    {offers.length} New Offer{offers.length > 1 ? 's' : ''}
                  </Badge>
                ) : (
                  <Badge variant="default" className="font-semibold text-caption text-text-muted">
                    Radar Active
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                Review and accept pending delivery invitations in your coverage zone.
              </p>
            </div>
          </div>
        </div>

        <AssignmentInboxList
          offers={offers}
          isLoading={isLoading}
          onAccept={handleAccept}
          onReject={handleReject}
          onRefresh={loadInbox}
          isAvailable={Boolean(rider?.is_available)}
        />
      </div>
    </RiderLayout>
  )
}
