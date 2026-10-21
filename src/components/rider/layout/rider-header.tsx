import { useState, useEffect } from 'react'
import { LogOut, Bell, Globe, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import type { RiderProfile } from '@/types/rider'
import { getUnreadNotificationCount, subscribeToMyNotifications } from '@/services/supabase/notifications'
import { KingdomAvatar } from '@/components/common/kingdom-avatar'

interface RiderHeaderProps {
  rider: RiderProfile | null
  onToggleAvailability?: (next: boolean) => Promise<void>
}

export function RiderHeader({ rider }: RiderHeaderProps) {
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
    <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-neutral-200/90 bg-white/95 backdrop-blur-md px-3 sm:px-6 lg:px-8">
      {/* ── Left Side: Brand Logo & Section Title ─────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2.5 group shrink-0" title="Back to Public Website">
          <img
            src="/KingdomDash-logo.jpg"
            alt="KingdomDash"
            className="h-7 sm:h-8 w-auto rounded-lg object-contain shadow-xs shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <div className="flex flex-col shrink-0">
            <div className="font-extrabold text-neutral-900 tracking-wide text-xs leading-tight group-hover:text-primary transition-colors whitespace-nowrap">
              KINGDOM<span className="text-primary">DASH</span>
            </div>
            <div className="hidden sm:block text-[9px] text-primary font-bold uppercase tracking-wider leading-none whitespace-nowrap">
              Rider Dispatch
            </div>
          </div>
        </Link>

        {/* Fleet Hub & Vehicle Badge — only on large desktop screens to prevent tablet header overflow */}
        <div className="hidden xl:block h-4 w-px bg-neutral-200 mx-1 shrink-0" />
        <div className="hidden xl:flex items-center gap-2 text-xs font-semibold text-neutral-600 whitespace-nowrap shrink-0">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>Ijebu-Ode Fleet Hub</span>
          {rider && (
            <Badge variant="info" className="capitalize text-[10px] font-semibold whitespace-nowrap">
              {rider.vehicle_type}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Right Side: Navigation & Profile Actions ───────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Notifications Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          asChild
          className="relative text-neutral-600 hover:text-neutral-900 h-8 w-8 sm:h-9 sm:w-9 rounded-xl transition-colors hover:bg-neutral-100 shrink-0"
        >
          <Link
            to="/rider/notifications"
            title={
              unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                : 'Rider Notifications'
            }
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
            )}
          </Link>
        </Button>

        {/* Public Website Link (Visible on all screen sizes) */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="inline-flex gap-1.5 h-8 px-2 sm:px-2.5 lg:px-3 text-xs font-semibold text-neutral-700 hover:text-primary rounded-xl shrink-0"
        >
          <Link to="/" title="Back to Public Website">
            <Globe className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline whitespace-nowrap">Website</span>
          </Link>
        </Button>

        {/* Profile Avatar Capsule */}
        {rider?.full_name && (
          <Link
            to="/rider/profile"
            className="inline-flex items-center gap-1.5 sm:gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-neutral-100 text-xs font-semibold text-neutral-800 transition-colors cursor-pointer border border-transparent hover:border-neutral-200 shrink-0"
            title={`Rider Profile: ${rider.full_name}`}
          >
            <KingdomAvatar
              avatarUrl={rider.avatar_url}
              name={rider.full_name}
              size="sm"
              role="rider"
              showBadge={false}
              className="h-7 w-7 ring-1 ring-neutral-200 shrink-0"
            />
            <span className="hidden lg:inline max-w-[100px] truncate font-bold text-neutral-900">
              {rider.full_name.split(' ')[0]}
            </span>
          </Link>
        )}

        {/* Direct Sign out button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="text-neutral-500 hover:text-rose-600 hover:bg-rose-50 gap-1.5 h-8 w-8 sm:w-auto px-0 sm:px-2.5 lg:px-3 text-xs font-semibold rounded-xl shrink-0 flex items-center justify-center"
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden lg:inline whitespace-nowrap">Sign Out</span>
        </Button>
      </div>
    </header>
  )
}
