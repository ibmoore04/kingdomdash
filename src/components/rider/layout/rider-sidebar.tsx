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
  Star,
  HelpCircle,
  Bike,
  ShieldCheck,
} from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import type { RiderProfile } from '@/types/rider'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'

interface RiderSidebarProps {
  rider: RiderProfile | null
  activeTripCount?: number
  inboxCount?: number
}

export function RiderSidebar({
  rider,
  activeTripCount = 0,
  inboxCount = 0,
}: RiderSidebarProps) {
  const { signOut } = useAuthStore()

  const operationNavItems = [
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
      badgeVariant: 'primary' as const,
    },
    {
      to: '/rider/deliveries/active',
      icon: MapPin,
      label: 'Active Delivery',
      badge: activeTripCount > 0 ? 'Active' : undefined,
      badgeVariant: 'warning' as const,
    },
    {
      to: '/rider/history',
      icon: History,
      label: 'Trip History',
    },
  ]

  const accountNavItems = [
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
      label: 'Rider Support Desk',
    },
    {
      to: '/rider/settings',
      icon: Settings,
      label: 'Settings & Vehicle',
    },
  ]

  return (
    <aside
      className="hidden lg:flex lg:flex-col shrink-0 h-screen border-r border-border bg-white w-64 select-none"
      aria-label="Rider desktop navigation"
    >
      {/* ── Brand Header (FIXED) ──────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4 shrink-0 bg-white">
        <Link
          to="/rider/dashboard"
          className="flex items-center gap-3 group min-w-0"
          title="KingdomDash Rider Portal"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-primary/10 border border-primary/20 shrink-0 p-1 group-hover:scale-105 transition-transform">
            <img
              src="/KingdomDash-emblem-clean.png"
              alt="KingdomDash"
              className="h-full w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-text-primary text-sm tracking-tight group-hover:text-primary transition-colors flex items-center gap-1.5">
              <span>KINGDOM<span className="text-primary">DASH</span></span>
            </div>
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
              Rider Dispatch
            </div>
          </div>
        </Link>
      </div>

      {/* ── Rider Profile & Duty Status Card (FIXED) ─────────────────────────── */}
      <div className="p-3 mx-3 my-2.5 rounded-2xl bg-page-background border border-border/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shrink-0 border border-primary/20">
            {rider?.avatar_url ? (
              <img
                src={rider.avatar_url}
                alt={rider.full_name || 'Rider'}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <Bike className="h-5 w-5" />
            )}
            {/* Live duty indicator dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                rider?.is_available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
              title={rider?.is_available ? 'Online (Available)' : 'Offline'}
              aria-label={rider?.is_available ? 'Online' : 'Offline'}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-body-small font-bold text-text-primary truncate">
                {rider?.full_name || 'Dispatch Rider'}
              </span>
              {rider?.is_verified && (
                <span title="Verified Rider" className="inline-flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-secondary">
              <span className="capitalize font-medium truncate">
                {rider?.vehicle_type || 'Motorcycle'}
              </span>
              <span className="text-text-muted">•</span>
              <span className="font-bold text-amber-500 flex items-center gap-0.5 shrink-0">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                {Number(rider?.rating || 5.0).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Links (SCROLLABLE) ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-1 space-y-4" aria-label="Rider navigation">
        {/* Section 1: Fleet Operations */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Fleet Operations
          </div>
          <nav className="flex flex-col gap-1">
            {operationNavItems.map(({ to, icon: Icon, label, badge, badgeVariant }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-body-small font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-secondary hover:bg-page-background hover:text-text-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`h-4.5 w-4.5 shrink-0 ${
                          isActive ? 'text-white' : 'text-text-muted'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{label}</span>
                    </div>

                    {badge !== undefined && (
                      <Badge
                        variant={isActive ? 'dark' : badgeVariant}
                        className={`text-[10px] font-bold px-1.5 py-0 shrink-0 ${
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
        </div>

        {/* Section 2: Account & Settings */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Account & System
          </div>
          <nav className="flex flex-col gap-1">
            {accountNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-body-small font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-secondary hover:bg-page-background hover:text-text-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        isActive ? 'text-white' : 'text-text-muted'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Fixed Footer Actions ─────────────────────────────────────────────── */}
      <div className="border-t border-border p-3 shrink-0 space-y-1 bg-white">
        <div className="px-3 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
          Quick Links
        </div>
        <Link
          to="/"
          title="Back to Public Website"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-body-small font-semibold text-text-secondary hover:bg-page-background hover:text-primary transition-colors"
        >
          <Globe className="h-4.5 w-4.5 text-primary shrink-0" aria-hidden="true" />
          <span className="truncate">Public Website</span>
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          title="Sign out of Rider Portal"
          className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-body-small font-semibold text-text-muted hover:bg-error/10 hover:text-error transition-colors text-left"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Sign Out</span>
        </button>

        <div className="pt-1 px-3">
          <p className="text-[10px] text-text-muted">
            Ijebu-Ode Fleet Console • v1.2
          </p>
        </div>
      </div>
    </aside>
  )
}
