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
      setOffers(inboxRes.data)
      setHasActiveDelivery(Boolean(activeRes.data))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInbox()

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadInbox()
      }
    }, 20000)

    return () => clearInterval(interval)
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
        <div>
          <h1 className="text-h3 font-bold text-text-primary">Dispatch Offers</h1>
          <p className="text-body-small text-text-secondary">
            Review and accept pending delivery invitations in your coverage zone.
          </p>
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
