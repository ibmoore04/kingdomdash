import { LayoutDashboard, Inbox, MapPin, History, User, Settings, Bell } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { RiderProfile } from '@/types/rider'
import { Badge } from '@/components/ui/badge'

interface RiderSidebarProps {
  rider: RiderProfile | null
  activeTripCount?: number
}

export function RiderSidebar({ rider, activeTripCount = 0 }: RiderSidebarProps) {
  const navItems = [
    {
      to: '/rider/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
    {
      to: '/rider/assignments',
      icon: Inbox,
      label: 'Dispatch Inbox',
    },
    {
      to: '/rider/deliveries/active',
      icon: MapPin,
      label: 'Active Delivery',
      badge: activeTripCount > 0 ? activeTripCount : undefined,
    },
    {
      to: '/rider/history',
      icon: History,
      label: 'Delivery History',
    },
    {
      to: '/rider/notifications',
      icon: Bell,
      label: 'Notifications',
    },
    {
      to: '/rider/profile',
      icon: User,
      label: 'Rider Profile',
    },
    {
      to: '/rider/settings',
      icon: Settings,
      label: 'Settings',
    },
  ]

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:flex lg:flex-col overflow-y-auto">
      <div className="p-4 border-b border-border/70">
        <span className="text-caption font-semibold text-text-muted uppercase tracking-wider block">
          Courier Operations
        </span>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-body-small font-bold text-text-primary truncate">
            {rider?.full_name || 'Dispatch Rider'}
          </span>
          {rider?.rating && (
            <span className="text-caption font-semibold text-amber-500">
              ★ {Number(rider.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-3" aria-label="Rider desktop navigation">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-body-small font-medium transition-all ${
                isActive
                  ? 'bg-primary text-white font-bold shadow-xs'
                  : 'text-text-secondary hover:bg-page-background hover:text-text-primary'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </div>
            {badge !== undefined && (
              <Badge variant="warning" className="h-5 px-1.5 text-caption font-bold">
                {badge}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-4 border-t border-border/70 text-caption text-text-muted">
        <p className="font-semibold text-text-secondary">KingdomDash Fleet v1.0</p>
        <p>Launch Market: Ijebu-Ode</p>
      </div>
    </aside>
  )
}
