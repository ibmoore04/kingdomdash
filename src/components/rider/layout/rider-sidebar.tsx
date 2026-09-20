import { LayoutDashboard, Inbox, MapPin, History, User, Settings, Bell, Globe, ChevronRight } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
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
    <aside
      className="
        group/sidebar
        hidden lg:flex lg:flex-col
        shrink-0 overflow-hidden overflow-y-auto
        border-r border-border bg-white
        w-[72px] hover:w-64
        transition-all duration-300 ease-in-out
        relative z-10
      "
      aria-label="Rider desktop navigation"
    >
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-3.5 shrink-0">
        <Link to="/rider/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold shrink-0">
            <span className="text-sm font-extrabold">KD</span>
          </div>
          <div className="overflow-hidden whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
            <div className="font-bold text-text-primary text-sm">KingdomDash</div>
            <div className="text-[10px] text-primary font-semibold uppercase tracking-wider">Rider Portal</div>
          </div>
        </Link>

        {/* Expand hint arrow */}
        <ChevronRight
          className="w-4 h-4 shrink-0 text-text-muted group-hover/sidebar:opacity-0 transition-opacity duration-200 absolute right-3"
          aria-hidden="true"
        />
      </div>

      {/* Rider info strip */}
      <div className="px-3.5 py-3 border-b border-border/70 shrink-0 overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-page-background border border-border flex items-center justify-center shrink-0">
            <User className="h-3.5 w-3.5 text-text-muted" />
          </div>
          <div className="overflow-hidden whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
            <p className="text-body-small font-bold text-text-primary truncate leading-tight">
              {rider?.full_name || 'Dispatch Rider'}
            </p>
            {rider?.rating && (
              <p className="text-caption font-semibold text-amber-500 leading-tight">
                ★ {Number(rider.rating).toFixed(1)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="flex flex-col gap-1 px-2 py-3 flex-1" aria-label="Rider navigation">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-body-small font-medium transition-all group/item ${
                isActive
                  ? 'bg-primary text-white font-bold shadow-xs'
                  : 'text-text-secondary hover:bg-page-background hover:text-text-primary'
              }`
            }
            title={label}
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-text-muted group-hover/item:text-text-primary'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 whitespace-nowrap overflow-hidden opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 truncate">
                  {label}
                </span>
                {badge !== undefined && (
                  <Badge
                    variant="warning"
                    className={`h-5 px-1.5 text-caption font-bold shrink-0 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 ${
                      isActive ? 'bg-white text-primary' : ''
                    }`}
                  >
                    {badge}
                  </Badge>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-border/70 px-2 py-3 shrink-0 space-y-1">
        <Link
          to="/"
          className="flex items-center gap-3 px-2.5 py-2 rounded-xl text-body-small font-semibold text-text-secondary hover:bg-page-background hover:text-primary transition-colors group/item"
          title="Back to Public Website"
        >
          <Globe className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap overflow-hidden opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
            Public Website
          </span>
        </Link>

        <div className="overflow-hidden whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 px-2.5">
          <p className="text-caption font-semibold text-text-secondary">KingdomDash Fleet v1.0</p>
          <p className="text-caption text-text-muted">Launch Market: Ijebu-Ode</p>
        </div>
      </div>
    </aside>
  )
}
