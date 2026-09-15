import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { getVendorByProfileId } from '@/services/supabase/vendors'
import type { Vendor } from '@/types'

export interface UseCurrentVendorResult {
  vendor: Vendor | null
  isLoading: boolean
  error: Error | null
  isPendingApproval: boolean
  refreshVendor: () => Promise<void>
}

export function useCurrentVendor(): UseCurrentVendorResult {
  const { profile, session } = useAuthStore()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const fetchCounter = useRef(0)

  const fetchVendor = useCallback(async () => {
    if (!session || !profile) {
      setVendor(null)
      setIsLoading(false)
      setError(null)
      return
    }

    if (profile.role !== 'vendor') {
      setVendor(null)
      setIsLoading(false)
      setError(new Error('User does not have vendor role.'))
      return
    }

    const currentFetchId = ++fetchCounter.current
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await getVendorByProfileId(profile.id)

      if (currentFetchId !== fetchCounter.current) return

      if (fetchError) {
        setError(new Error(fetchError.message))
        setVendor(null)
      } else {
        setVendor(data)
        setError(null)
      }
    } catch (err) {
      if (currentFetchId !== fetchCounter.current) return
      setError(err instanceof Error ? err : new Error('Failed to load vendor profile.'))
      setVendor(null)
    } finally {
      if (currentFetchId === fetchCounter.current) {
        setIsLoading(false)
      }
    }
  }, [profile, session])

  useEffect(() => {
    fetchVendor()
  }, [fetchVendor])

  const isPendingApproval = vendor === null || !vendor.is_active

  return {
    vendor,
    isLoading,
    error,
    isPendingApproval,
    refreshVendor: fetchVendor,
  }
}
