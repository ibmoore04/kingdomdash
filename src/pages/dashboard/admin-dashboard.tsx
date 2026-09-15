import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Store,
  Bike,
  Package,
  FileText,
  Settings,
  ShieldCheck,
  Bell,
  LogOut,
  ArrowRight,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdminSettingsTab } from '@/components/admin/admin-settings-tab'
import { AdminNotificationsTab } from '@/components/admin/admin-notifications-tab'

type AdminTab =
  | 'overview'
  | 'customers'
  | 'vendors'
  | 'riders'
  | 'deliveries'
  | 'reports'
  | 'audit'
  | 'notifications'
  | 'settings'

const NAV_ITEMS: { id: AdminTab; icon: typeof LayoutDashboard; label: string }[] = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'customers', icon: Users, label: 'Customers' },
  { id: 'vendors', icon: Store, label: 'Vendors' },
  { id: 'riders', icon: Bike, label: 'Riders' },
  { id: 'deliveries', icon: Package, label: 'Deliveries' },
  { id: 'reports', icon: FileText, label: 'Reports' },
  { id: 'audit', icon: ShieldCheck, label: 'Audit Logs' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function AdminDashboardPage() {
  const [searchParams] = useSearchParams()
  const { profile, signOut } = useAuthStore()

  const initialTab = (searchParams.get('tab') as AdminTab) || 'overview'
  const [activeTab, setActiveTab] = useState<AdminTab>(
    NAV_ITEMS.map((n) => n.id).includes(initialTab) ? initialTab : 'overview'
  )

  return (
    <div className="flex h-screen overflow-hidden bg-page-background">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-white lg:flex lg:flex-col justify-between overflow-y-auto">
        <div>
          <div className="flex h-16 items-center gap-2 border-b border-border px-5">
            <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="text-body font-bold text-text-primary block leading-tight">KingdomDash</span>
              <span className="text-caption font-semibold text-primary block leading-none">Administration</span>
            </div>
          </div>

          <div className="p-4 border-b border-border/70">
            <span className="text-caption font-semibold text-text-muted uppercase tracking-wider block">
              Admin Session
            </span>
            <span className="text-body-small font-bold text-text-primary truncate block mt-1">
              {profile?.full_name || 'System Administrator'}
            </span>
            <span className="text-caption text-text-secondary truncate block">
              {profile?.email}
            </span>
          </div>

          <nav className="flex flex-col gap-1 p-3" aria-label="Admin dashboard navigation">
            {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-body-small font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white font-bold shadow-xs'
                      : 'text-text-secondary hover:bg-page-background hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="w-full justify-start gap-2 text-text-muted hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-h4 font-bold text-text-primary truncate">
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <Badge variant="primary" className="text-caption hidden sm:inline-flex shrink-0">
              HQ Control Center
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('notifications')}
              title="Admin Alerts"
              aria-label="Notifications"
              className={`text-text-muted hover:text-text-primary ${
                activeTab === 'notifications' ? 'bg-surface-muted text-primary' : ''
              }`}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('settings')}
              title="Platform Settings"
              aria-label="Settings"
              className={`text-text-muted hover:text-text-primary ${
                activeTab === 'settings' ? 'bg-surface-muted text-primary' : ''
              }`}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="mx-auto max-w-4xl">
            {/* Tab: Settings */}
            {activeTab === 'settings' && <AdminSettingsTab />}

            {/* Tab: Notifications */}
            {activeTab === 'notifications' && <AdminNotificationsTab />}

            {/* Tab: Overview & Other Modules */}
            {activeTab !== 'settings' && activeTab !== 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-h3 font-bold text-text-primary">Platform Operational Overview</h2>
                  <p className="text-body-small text-text-secondary mt-1">
                    Live system metrics and cross-portal operational state across Owerri.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl border border-border bg-white shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-body-small font-semibold text-text-secondary">Active Merchants</span>
                      <Store className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <span className="text-h3 font-bold text-text-primary">12</span>
                    <span className="text-caption text-emerald-600 block mt-1">100% Operational in Owerri</span>
                  </div>

                  <div className="p-5 rounded-2xl border border-border bg-white shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-body-small font-semibold text-text-secondary">Active Fleet Riders</span>
                      <Bike className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <span className="text-h3 font-bold text-text-primary">8</span>
                    <span className="text-caption text-text-muted block mt-1">GPS Telemetry Online</span>
                  </div>

                  <div className="p-5 rounded-2xl border border-border bg-white shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-body-small font-semibold text-text-secondary">Platform Health</span>
                      <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                    </div>
                    <span className="text-h3 font-bold text-emerald-600">Optimal</span>
                    <span className="text-caption text-text-muted block mt-1">All database triggers active</span>
                  </div>
                </div>

                <div className="p-6 rounded-2xl border border-border bg-white shadow-xs">
                  <h3 className="text-body-large font-bold text-text-primary mb-2">
                    Quick Operational Shortcuts
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab('settings')}
                      className="justify-between h-auto py-3 px-4"
                    >
                      <div className="text-left">
                        <span className="text-body-small font-bold block">Configure Delivery Pricing</span>
                        <span className="text-caption text-text-muted">Adjust base fee and per-KM rate</span>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab('notifications')}
                      className="justify-between h-auto py-3 px-4"
                    >
                      <div className="text-left">
                        <span className="text-body-small font-bold block">Review Onboarding Alerts</span>
                        <span className="text-caption text-text-muted">Verify rider and merchant signups</span>
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
