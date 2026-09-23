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
    },
    {
      to: '/rider/deliveries/active',
      icon: MapPin,
      label: 'Trip',
      badge: activeTripCount > 0 ? activeTripCount : undefined,
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
      className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-white/95 backdrop-blur-md lg:hidden shadow-lg"
      aria-label="Rider mobile navigation"
    >
      {items.map(({ to, icon: Icon, label, badge }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-text-muted hover:text-text-primary'
            }`
          }
        >
          <div className="relative">
            <Icon className="h-5 w-5" aria-hidden="true" />
            {badge !== undefined && (
              <Badge
                variant="warning"
                className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full p-0.5 text-[10px] font-bold"
              >
                {badge}
              </Badge>
            )}
          </div>
          <span className="text-[11px] leading-tight">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
