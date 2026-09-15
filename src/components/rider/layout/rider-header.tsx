import { useState, useEffect } from 'react'
import { LogOut, Bike, Settings, Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import type { RiderProfile } from '@/types/rider'
import { AvailabilitySwitch } from '../dashboard/availability-switch'
import { getUnreadNotificationCount, subscribeToMyNotifications } from '@/services/supabase/notifications'

interface RiderHeaderProps {
  rider: RiderProfile | null
  onToggleAvailability: (next: boolean) => Promise<void>
}

export function RiderHeader({ rider, onToggleAvailability }: RiderHeaderProps) {
  const { profile, signOut } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState<number>(0)

  useEffect(() => {
    let isMounted = true

    async function loadUnread() {
      const res = await getUnreadNotificationCount()
      if (isMounted) {
        setUnreadCount(res.count)
      }
    }

    loadUnread()

    if (!profile?.id) return

    const unsubscribe = subscribeToMyNotifications(profile.id, (payload) => {
      if (payload.eventType === 'INSERT') {
        setUnreadCount((prev) => prev + 1)
      } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
        loadUnread()
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [profile?.id])

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-white px-3 sm:px-6 shadow-xs overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link to="/rider/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold shrink-0">
            <Bike className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="text-body font-bold text-text-primary block leading-tight truncate">
              KingdomDash
            </span>
            <span className="text-caption font-semibold text-primary hidden sm:block leading-none">
              Rider Portal
            </span>
          </div>
        </Link>

        {rider && (
          <Badge variant="info" className="hidden md:inline-flex capitalize shrink-0">
            {rider.vehicle_type}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {rider && (
          <AvailabilitySwitch
            isAvailable={rider.is_available}
            isVerified={rider.is_verified}
            isActive={rider.is_active}
            inFlightCount={rider.active_in_flight_count || 0}
            onToggle={onToggleAvailability}
            compact
          />
        )}

        <div className="flex items-center gap-1 sm:border-l sm:border-border sm:pl-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            asChild
            className="relative text-text-muted hover:text-text-primary shrink-0"
          >
            <Link to="/rider/notifications" title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Rider Notifications'} aria-label="Notifications">
              <Bell className="h-4 w-4" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            asChild
            className="hidden sm:inline-flex text-text-muted hover:text-text-primary"
          >
            <Link to="/rider/settings" title="Rider Settings" aria-label="Settings">
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            title="Sign out of Rider Portal"
            className="hidden sm:inline-flex text-text-muted hover:text-text-primary"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  )
}
