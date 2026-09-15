import { Link } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, Bike, ShieldCheck, Star, PackageCheck, Mail, Phone, MapPin, Settings } from 'lucide-react'

export default function RiderProfilePage() {
  const { rider } = useCurrentRider()

  return (
    <RiderLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-h3 font-bold text-text-primary">Rider Profile</h1>
            <p className="text-body-small text-text-secondary">
              Your registered courier identity and operational credentials.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-2 shrink-0">
            <Link to="/rider/settings">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Settings
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4 border-b border-border pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-h3">
              <User className="h-8 w-8" aria-hidden="true" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-h4 font-bold text-text-primary">
                  {rider?.full_name || 'Verified Rider'}
                </h2>
                <Badge variant="success" className="gap-1 text-caption">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Verified
                </Badge>
              </div>
              <p className="text-body-small text-text-secondary">
                KingdomDash Dispatch Fleet • Ijebu-Ode Launch Network
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-page-background p-4 space-y-1">
              <div className="flex items-center gap-2 text-text-muted text-caption font-medium">
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>Email Address</span>
              </div>
              <p className="font-semibold text-text-primary text-body-small">
                {rider?.email || 'N/A'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-page-background p-4 space-y-1">
              <div className="flex items-center gap-2 text-text-muted text-caption font-medium">
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span>Phone Number</span>
              </div>
              <p className="font-semibold text-text-primary text-body-small">
                {rider?.phone || 'N/A'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-page-background p-4 space-y-1">
              <div className="flex items-center gap-2 text-text-muted text-caption font-medium">
                <Bike className="h-4 w-4" aria-hidden="true" />
                <span>Vehicle Type</span>
              </div>
              <p className="font-semibold text-text-primary text-body-small capitalize">
                {rider?.vehicle_type || 'Motorcycle'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-page-background p-4 space-y-1">
              <div className="flex items-center gap-2 text-text-muted text-caption font-medium">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>Service Zone</span>
              </div>
              <p className="font-semibold text-text-primary text-body-small">
                Ijebu-Ode Core Service Area
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-6">
            <div className="rounded-xl border border-border bg-page-background p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-amber-500 font-bold text-h3">
                <Star className="h-6 w-6 fill-amber-500 text-amber-500" aria-hidden="true" />
                <span>{Number(rider?.rating || 5.0).toFixed(1)}</span>
              </div>
              <span className="text-caption text-text-muted font-medium mt-1 block">
                Customer Rating
              </span>
            </div>

            <div className="rounded-xl border border-border bg-page-background p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-primary font-bold text-h3">
                <PackageCheck className="h-6 w-6" aria-hidden="true" />
                <span>{rider?.total_deliveries || 0}</span>
              </div>
              <span className="text-caption text-text-muted font-medium mt-1 block">
                Total Deliveries
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-page-background p-4 text-caption text-text-secondary">
            <strong>Security Notice:</strong> To update legal documents, driver license records, or payout bank accounts, please contact KingdomDash dispatch administration.
          </div>
        </div>
      </div>
    </RiderLayout>
  )
}
