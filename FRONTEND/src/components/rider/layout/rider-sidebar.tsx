import {
  LayoutDashboard,
  Inbox,
  MapPin,
  History,
  User,
  Settings,
  Bell,
  Globe,
  LogOut,
  HelpCircle,
} from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import type { RiderProfile } from '@/types/rider'
import { useAuthStore } from '@/stores/auth-store'

interface RiderSidebarProps {
  rider: RiderProfile | null
  activeTripCount?: number
  inboxCount?: number
}

export function RiderSidebar({
  activeTripCount = 0,
  inboxCount = 0,
}: RiderSidebarProps) {
  const { signOut } = useAuthStore()

  const navItems = [
    {
      to: '/rider/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
    {
      to: '/rider/assignments',
      icon: Inbox,
      label: 'Dispatch Offers',
      badge: inboxCount > 0 ? inboxCount : undefined,
    },
    {
      to: '/rider/deliveries/active',
      icon: MapPin,
      label: 'Active Delivery',
      badge: activeTripCount > 0 ? 'Live' : undefined,
    },
    {
      to: '/rider/history',
      icon: History,
      label: 'Trip History',
    },
    {
      to: '/rider/profile',
      icon: User,
      label: 'Rider Profile',
    },
    {
      to: '/rider/notifications',
      icon: Bell,
      label: 'Notifications',
    },
    {
      to: '/rider/support',
      icon: HelpCircle,
      label: 'Support Desk',
    },
    {
      to: '/rider/settings',
      icon: Settings,
      label: 'Settings & Vehicle',
    },
  ]

  return (
    <aside
      aria-label="Rider dashboard sidebar"
      className="hidden lg:flex flex-col lg:col-span-3 bg-white rounded-2xl border border-neutral-200/90 shadow-md p-3.5 space-y-3 lg:sticky lg:top-20 lg:self-start z-20 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-none"
    >
      <nav aria-label="Rider navigation menu" className="space-y-1">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-neutral-500'}`} aria-hidden="true" />
                  <span>{label}</span>
                </div>
                {badge && (
                  <span
                    className={`h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full text-[10px] font-black ${
                      isActive ? 'bg-white text-primary' : 'bg-primary text-white'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="pt-3 border-t border-neutral-100 space-y-1 bg-neutral-50/50 rounded-xl p-2">
        <Link
          to="/"
          title="Return to public storefront"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:text-primary hover:bg-neutral-100 transition-colors"
        >
          <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>Public Portal</span>
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 text-rose-500" aria-hidden="true" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  )
}
