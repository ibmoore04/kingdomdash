import { Link } from 'react-router-dom'
import { RotateCcw, Clock, CheckCircle2, AlertCircle, ArrowLeft, Mail, Phone } from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'

export default function RefundPolicyPage() {
  useSeo({
    title: 'Refund & Cancellation Policy — KingdomDash',
    description: `Understand how order cancellations, missing or damaged items, and refunds are handled at KingdomDash across Ijebu-Ode.`,
  })

  const lastUpdated = 'September 2026'

  return (
    <div className="bg-neutral-50/50 py-10 sm:py-16">
      <PageContainer>
        <div className="mx-auto max-w-3xl">
          {/* Back link */}
          <div className="mb-6">
            <Button asChild variant="ghost" size="sm" className="gap-2 text-neutral-600 hover:text-neutral-900">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
            </Button>
          </div>

          {/* Header Card */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs mb-8">
            <div className="flex items-center gap-3 text-primary mb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <RotateCcw className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.16em]">Customer Protection</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
              Refund & Cancellation Policy
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-neutral-500">
              Last updated: {lastUpdated} &bull; Clear, fair policies for customers in {appConfig.launchMarket}.
            </p>
          </div>

          {/* Policy Document Content */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs space-y-8 text-neutral-700 leading-relaxed text-sm sm:text-base">
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                1. Order Cancellation Rules
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-2">
                  <h3 className="font-bold text-neutral-900 text-sm">Before Preparation Begins</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    You may cancel an order free of charge while the order status is <strong>Order Placed</strong> and before the kitchen or grocery merchant begins preparation. You will receive a 100% full refund.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-2">
                  <h3 className="font-bold text-neutral-900 text-sm">After Preparation Begins</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Once the restaurant enters <strong>Preparing</strong> status, cooked food and perishable ingredients cannot be salvaged. Orders cancelled after this stage are non-refundable.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                2. Missing, Incorrect or Damaged Items
              </h2>
              <p>We take pride in our service quality. You are entitled to a refund or replacement if:</p>
              <ul className="space-y-2 text-xs sm:text-sm text-neutral-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Incorrect item delivered:</strong> You received a completely different dish or grocery item than what you ordered.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Missing item:</strong> A paid item was left behind at the store or kitchen.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Damaged packaging or spilled contents:</strong> The order was mishandled during transit and arrived unfit for consumption.</span>
                </li>
              </ul>
              <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Reporting Window:</strong> To ensure prompt investigation with the merchant and rider, please submit photos of the issue within <strong>2 hours</strong> of delivery confirmation.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                3. Courier Dispatch Cancellations
              </h2>
              <p>
                For point-to-point parcel dispatch, you may cancel without penalty at any time prior to the rider arriving at the pickup location. If a rider has already arrived at the sender&apos;s address, a nominal base dispatch cancellation fee (₦500) applies to compensate the rider for fuel and travel time.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                4. Refund Processing Timeframes
              </h2>
              <p>Once an approved refund is authorized by KingdomDash Support:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-neutral-600">
                <li>
                  <strong className="text-neutral-800">Card & Bank Account Reversals (via Paystack):</strong> Funds are credited back to the originating bank account or debit card within <strong>3 to 7 business days</strong>, depending on your Nigerian financial institution&apos;s settlement schedule.
                </li>
                <li>
                  <strong className="text-neutral-800">Bank Transfer / USSD:</strong> Refunds are processed directly to the account verified during purchase.
                </li>
              </ul>
            </section>

            <section className="space-y-3 pt-2 border-t border-neutral-100">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                5. How to Initiate a Refund Claim
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600">
                Please contact our dedicated support team with your <strong>Order ID (e.g. KD-...)</strong> and a brief photo or description:
              </p>
              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <a
                  href={`https://wa.me/${appConfig.whatsapp.businessNumber.replace(/[^0-9]/g, '')}?text=Hello%20KingdomDash,%20I%20need%20assistance%20with%20a%20refund%20or%20order%20issue.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center gap-3 hover:bg-emerald-50 transition-colors"
                >
                  <Phone className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">WhatsApp Support</h4>
                    <p className="text-[11px] text-neutral-500">Fastest response for active orders</p>
                  </div>
                </a>
                <a
                  href={`mailto:${appConfig.support.email}?subject=Refund%20Request`}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 flex items-center gap-3 hover:bg-neutral-100 transition-colors"
                >
                  <Mail className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">Email Help Desk</h4>
                    <p className="text-[11px] text-neutral-500">{appConfig.support.email}</p>
                  </div>
                </a>
              </div>
            </section>
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
