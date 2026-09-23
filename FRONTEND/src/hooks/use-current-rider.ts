import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { getRiderOperationalProfile } from '@/services/rider/rider-service'
import type { RiderProfile } from '@/types/rider'

export interface UseCurrentRiderResult {
  rider: RiderProfile | null
  isLoading: boolean
  error: Error | null
  isPendingApproval: boolean
  refreshRider: () => Promise<void>
}

export function useCurrentRider(): UseCurrentRiderResult {
  const { profile, session } = useAuthStore()
  const [rider, setRider] = useState<RiderProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchCounter = useRef(0)

  const fetchRider = useCallback(async () => {
    if (!session || !profile) {
      setRider(null)
      setIsLoading(false)
      setError(null)
      return
    }

    if (profile.role !== 'rider') {
      setRider(null)
      setIsLoading(false)
      setError(new Error('User does not have rider role.'))
      return
    }

    const currentFetchId = ++fetchCounter.current
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await getRiderOperationalProfile()

      if (currentFetchId !== fetchCounter.current) return

      if (fetchError) {
        setError(fetchError)
        setRider(null)
      } else {
        setRider(data)
        setError(null)
      }
    } catch (err) {
      if (currentFetchId !== fetchCounter.current) return
      setError(
        err instanceof Error ? err : new Error('Failed to load rider operational profile.')
      )
      setRider(null)
    } finally {
      if (currentFetchId === fetchCounter.current) {
        setIsLoading(false)
      }
    }
  }, [session, profile])

  useEffect(() => {
    fetchRider()
  }, [fetchRider])

  const isPendingApproval = Boolean(rider && !rider.is_verified)

  return {
    rider,
    isLoading,
    error,
    isPendingApproval,
    refreshRider: fetchRider,
  }
}
