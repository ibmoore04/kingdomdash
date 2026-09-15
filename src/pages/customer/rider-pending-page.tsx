import { useState } from 'react'
import { RiderPendingView } from '@/components/rider/rider-pending-view'
import { supabase } from '@/services/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useNavigate } from 'react-router-dom'

export default function RiderPendingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      if (!profile) return
      // Check if profile was promoted to rider
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', profile.id)
        .single()

      if (data?.role === 'rider') {
        navigate('/rider/dashboard', { replace: true })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-page-background flex items-center justify-center p-4">
      <RiderPendingView onRefresh={handleRefresh} isLoading={isLoading} />
    </div>
  )
}
