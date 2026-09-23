import { Clock, RefreshCw, MessageSquare, LogOut, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { appConfig } from '@/config/app.config'
import { useAuthStore } from '@/stores/auth-store'

interface RiderPendingViewProps {
  onRefresh?: () => void
  isLoading?: boolean
  isSuspended?: boolean
}

export function RiderPendingView({ onRefresh, isLoading, isSuspended }: RiderPendingViewProps) {
  const { signOut, profile } = useAuthStore()

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-white p-8 text-center shadow-card">
        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${
            isSuspended ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
          }`}
        >
          {isSuspended ? (
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
          ) : (
            <Clock className="h-8 w-8 animate-pulse" aria-hidden="true" />
          )}
        </div>

        <Badge variant={isSuspended ? 'error' : 'warning'} className="mb-4">
          {isSuspended ? 'Account Inactive' : 'Verification Under Review'}
        </Badge>

        <h2 className="text-h3 font-bold text-text-primary">
          {isSuspended ? 'Rider Account Suspended' : 'Rider Account Awaiting Verification'}
        </h2>

        <p className="mt-3 text-body text-text-secondary">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}!{' '}
          {isSuspended
            ? 'Your rider account is currently inactive. Please reach out to dispatch support for reactivation.'
            : `Your rider registration is currently being verified by the KingdomDash fleet operations team for ${appConfig.launchMarket}.`}
        </p>

        <div className="mt-6 rounded-xl border border-border bg-page-background p-4 text-left text-body-small">
          <p className="font-semibold text-text-primary">Fleet Onboarding Checklist</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-text-secondary">
            <li>Identity and driver credentials review by dispatch operations.</li>
            <li>Vehicle roadworthiness and cargo equipment check.</li>
            <li>Once approved, you will be able to toggle online and receive deliveries.</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Check Status
            </Button>
          )}

          <Button asChild variant="primary" className="gap-2 font-bold text-white bg-primary hover:bg-primary-hover">
            <Link to="/contact" className="text-white">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Contact Dispatch
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => signOut()}
            className="gap-2 text-text-muted hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}
