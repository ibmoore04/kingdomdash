import { LayoutDashboard, MapPin, DollarSign, Bike, Settings } from 'lucide-react'
import { ComingSoonNotice } from '@/components/shared/coming-soon-notice'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Overview' },
  { icon: MapPin, label: 'Deliveries' },
  { icon: DollarSign, label: 'Earnings' },
  { icon: Bike, label: 'Vehicle' },
  { icon: Settings, label: 'Settings' },
]

export default function RiderDashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-page-background">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-white lg:flex lg:flex-col overflow-y-auto">
        <div className="flex h-14 items-center border-b border-border px-5">
          <span className="text-label font-semibold text-text-primary">Rider Portal</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-3" aria-label="Rider dashboard navigation">
          {NAV_ITEMS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-body-small font-medium text-text-secondary transition-all duration-200 ease-out hover:bg-page-background hover:text-text-primary hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:translate-y-0 active:shadow-none"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-6">
          <h1 className="text-h4 font-semibold text-text-primary">Rider Dashboard</h1>
          <span className="rounded-pill bg-primary-soft px-3 py-1 text-caption font-medium text-primary-hover">
            Phase 1 Shell
          </span>
        </header>
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-2xl">
            <ComingSoonNotice title="Rider dashboard — Phase 1 placeholder">
              This shell is in place for routing purposes. The full rider dashboard — including active deliveries, earnings, and route information — will be built in a later phase once authentication and backend services are connected.
            </ComingSoonNotice>
          </div>
        </div>
      </main>
    </div>
  )
}
