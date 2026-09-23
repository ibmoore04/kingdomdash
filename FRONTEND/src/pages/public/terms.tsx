import { Link } from 'react-router-dom'
import { FileCheck, Scale, ArrowLeft, AlertTriangle, HelpCircle } from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'

export default function TermsPage() {
  useSeo({
    title: 'Terms of Service — KingdomDash',
    description: `Read the Terms of Service governing your use of KingdomDash's on-demand delivery, marketplace, and courier platform in Ijebu-Ode, Ogun State.`,
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
                <Scale className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.16em]">Platform Agreement</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
              Terms of Service
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-neutral-500">
              Last updated: {lastUpdated} &bull; Applicable across {appConfig.launchMarket}, Nigeria.
            </p>
          </div>

          {/* Terms Content */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs space-y-8 text-neutral-700 leading-relaxed text-sm sm:text-base">
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                1. Acceptance of Terms
              </h2>
              <p>
                By creating an account, browsing menus, booking courier dispatches, or using any service provided by KingdomDash (&quot;KingdomDash,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                2. Nature of Services
              </h2>
              <p>
                KingdomDash operates a technology platform providing:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-neutral-600">
                <li>An on-demand food ordering marketplace connecting consumers with independent restaurants and eateries.</li>
                <li>An on-demand grocery marketplace connecting consumers with local grocery and supermarket merchants.</li>
                <li>A point-to-point courier and parcel dispatch booking system for intra-city transit within {appConfig.launchMarket}.</li>
              </ul>
              <p className="text-xs sm:text-sm text-neutral-500">
                Merchants prepare and package their goods. Dispatch riders handle physical pickup and doorstep delivery. KingdomDash coordinates order transmission, distance routing, and payment escrow.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                3. User Accounts & Responsibilities
              </h2>
              <p>
                You must be at least 18 years old or possess legal parental consent to register an account. You agree to provide accurate, up-to-date phone contact and address details. You are responsible for maintaining the confidentiality of your credentials.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                4. Pricing, Fees & Payment
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-neutral-600">
                <li>
                  <strong className="text-neutral-800">Menu & Product Prices:</strong> Set directly by our vendor partners.
                </li>
                <li>
                  <strong className="text-neutral-800">Delivery Fees:</strong> Calculated dynamically using our distance-based pricing engine based on actual geodesic route kilometers between pickup and dropoff points.
                </li>
                <li>
                  <strong className="text-neutral-800">Service Fee:</strong> A platform service fee of ₦150 is applied per order to cover network maintenance, payment processing security, and continuous platform improvements.
                </li>
                <li>
                  <strong className="text-neutral-800">Payment:</strong> All electronic transactions are processed securely via licensed payment gateways (such as Paystack). Orders are confirmed once payment authorization is verified.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                5. Prohibited Courier Items
              </h2>
              <p>When booking courier dispatch, senders must not dispatch prohibited items, including but not limited to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-neutral-600">
                <li>Illegal drugs, narcotics, or unregulated controlled substances.</li>
                <li>Firearms, ammunition, fireworks, weapons, or explosives.</li>
                <li>Cash, bank drafts, bearer bonds, or precious metals.</li>
                <li>Flammable liquids, hazardous chemicals, or corrosive materials.</li>
                <li>Stolen property or items obtained through unlawful conduct.</li>
              </ul>
              <p className="text-xs sm:text-sm text-neutral-500">
                Riders and platform management reserve the right to decline or hand over suspect parcels to law enforcement authorities.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                6. Delivery Handover & Customer Availability
              </h2>
              <p>
                Customers or designated recipients must be reachable via phone and present at the specified delivery coordinates when the rider arrives. Riders will wait a maximum of <strong>10 minutes</strong> at the dropoff destination before contacting dispatch support. Unclaimed perishable orders cannot be returned to restaurant kitchens and will remain non-refundable.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                7. Limitation of Liability
              </h2>
              <p>
                KingdomDash strives for timely deliveries, but delivery times are estimates subject to weather conditions, traffic congestion, and merchant kitchen preparation queues. KingdomDash is not liable for indirect, incidental, or consequential damages resulting from platform downtime or third-party merchant actions.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                8. Governing Law
              </h2>
              <p>
                These Terms shall be interpreted and governed in accordance with the laws of Ogun State and the Federal Republic of Nigeria. Any disputes arising shall first be addressed through good-faith mediation with KingdomDash customer support.
              </p>
            </section>

            <section className="space-y-3 pt-2 border-t border-neutral-100">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                9. Questions & Support
              </h2>
              <p>
                For inquiries regarding these Terms of Service, email us at{' '}
                <a href={`mailto:${appConfig.support.email}`} className="text-primary font-medium hover:underline">
                  {appConfig.support.email}
                </a>{' '}
                or reach our helpline at{' '}
                <strong className="text-neutral-900 font-semibold">{appConfig.support.phoneDisplay}</strong>.
              </p>
            </section>
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
