import { LayoutDashboard, Inbox, MapPin, History, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'

interface RiderBottomNavProps {
  activeTripCount?: number
  inboxCount?: number
}

export function RiderBottomNav({ activeTripCount = 0, inboxCount = 0 }: RiderBottomNavProps) {
  const items = [
    {
      to: '/rider/dashboard',
      icon: LayoutDashboard,
      label: 'Home',
    },
    {
      to: '/rider/assignments',
      icon: Inbox,
      label: 'Offers',
      badge: inboxCount > 0 ? inboxCount : undefined,
      badgeVariant: 'primary' as const,
    },
    {
      to: '/rider/deliveries/active',
      icon: MapPin,
      label: 'Active Trip',
      badge: activeTripCount > 0 ? 'Live' : undefined,
      badgeVariant: 'warning' as const,
      hasPulse: activeTripCount > 0,
    },
    {
      to: '/rider/history',
      icon: History,
      label: 'History',
    },
    {
      to: '/rider/profile',
      icon: User,
      label: 'Profile',
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-white/95 backdrop-blur-lg lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2"
      aria-label="Rider mobile navigation"
    >
      {items.map(({ to, icon: Icon, label, badge, badgeVariant, hasPulse }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center justify-center py-1 transition-all duration-150 ${
              isActive
                ? 'text-primary font-bold'
                : 'text-text-muted hover:text-text-primary'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={`relative flex flex-col items-center justify-center rounded-2xl px-3 py-1 transition-all ${
                  isActive ? 'bg-primary/10' : ''
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`h-5 w-5 ${
                      isActive ? 'stroke-[2.5px] text-primary' : 'stroke-2'
                    }`}
                    aria-hidden="true"
                  />
                  {hasPulse && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                  {badge !== undefined && (
                    <Badge
                      variant={badgeVariant || 'primary'}
                      className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold ring-1 ring-white shadow-xs"
                    >
                      {badge}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[56px]">
                  {label}
                </span>
              </div>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
