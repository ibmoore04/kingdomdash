import { Link } from 'react-router-dom'
import { Shield, Lock, FileText, ArrowLeft, Mail, MapPin } from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'

export default function PrivacyPage() {
  useSeo({
    title: 'Privacy Policy — KingdomDash',
    description: `Understand how KingdomDash collects, protects, and handles your personal data across Ijebu-Ode, Ogun State in compliance with the Nigeria Data Protection Act.`,
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
                <Shield className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.16em]">Legal & Privacy</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
              Privacy Policy
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-neutral-500">
              Last updated: {lastUpdated} &bull; Effective for all users of KingdomDash across {appConfig.launchMarket}.
            </p>
          </div>

          {/* Policy Document Content */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs space-y-8 text-neutral-700 leading-relaxed text-sm sm:text-base">
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                1. Overview & Commitment
              </h2>
              <p>
                KingdomDash (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to respecting and protecting the privacy of our customers, vendors, and dispatch riders. This Privacy Policy outlines how your personal information is gathered, utilized, stored, and shared when you use the KingdomDash web platform and services in {appConfig.launchMarket}, Nigeria.
              </p>
              <p>
                Our data processing practices comply with the <strong>Nigeria Data Protection Act (NDPA)</strong> and Nigeria Data Protection Regulation (NDPR).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                2. Information We Collect
              </h2>
              <p>We collect only the information required to facilitate reliable on-demand delivery services:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-neutral-600">
                <li>
                  <strong className="text-neutral-800">Account Credentials:</strong> Name, verified email address, phone number, and encrypted authentication tokens.
                </li>
                <li>
                  <strong className="text-neutral-800">Delivery Addresses & Coordinates:</strong> Street addresses, landmarks, apartment/room numbers, and precise GPS geolocation coordinates to calculate distance fees and navigate riders.
                </li>
                <li>
                  <strong className="text-neutral-800">Order & Parcel Data:</strong> Product selections, item quantities, special culinary or packing instructions, courier package categories, and recipient contact details.
                </li>
                <li>
                  <strong className="text-neutral-800">Payment Information:</strong> Transaction references and payment status provided by our payment gateway partner (Paystack). KingdomDash does not store full credit/debit card numbers or CVVs on its servers.
                </li>
                <li>
                  <strong className="text-neutral-800">Operational Telemetry:</strong> Device information, browser type, network status, and rider delivery telemetry (active coordinates during live dispatches).
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                3. How We Use Your Data
              </h2>
              <p>Your information is used strictly to power KingdomDash logistics:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-neutral-600">
                <li>Processing, fulfilling, and dispatching food, grocery, and courier orders.</li>
                <li>Calculating transparent, distance-based delivery pricing.</li>
                <li>Communicating status changes (Order Placed, Vendor Confirmed, Rider Assigned, Delivered) via in-app feeds and WhatsApp messaging.</li>
                <li>Assisting customer care and resolving dispute tickets or refund claims.</li>
                <li>Preventing fraud, duplicate checkouts, and securing platform APIs.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                4. Data Sharing & Third Parties
              </h2>
              <p>We never sell your personal information. Data is disclosed only to operational partners under strict necessity:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-neutral-600">
                <li>
                  <strong className="text-neutral-800">Merchants & Vendors:</strong> Receive item details, customer first name, and relevant delivery instructions to prepare the order.
                </li>
                <li>
                  <strong className="text-neutral-800">Dispatch Riders:</strong> Receive recipient address, map pin, delivery instructions, and phone number exclusively to execute doorstep handover.
                </li>
                <li>
                  <strong className="text-neutral-800">Payment Providers (Paystack):</strong> Securely process debit/credit cards, bank transfers, and USSD payments.
                </li>
                <li>
                  <strong className="text-neutral-800">Law Enforcement:</strong> Only if officially compelled under valid Nigerian legal summons or court orders.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                5. Data Security & Storage
              </h2>
              <p>
                We apply modern security controls including SSL/TLS 256-bit encryption in transit, row-level security (RLS) policies at the database layer, password hashing, and token-based API authentication. Only authorized personnel have restricted access to internal operations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                6. Your Rights
              </h2>
              <p>Under the NDPA, you hold the right to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-neutral-600">
                <li>Request a copy of your personal data stored with KingdomDash.</li>
                <li>Request corrections to any inaccurate address or profile information.</li>
                <li>Request account deactivation and deletion of personal identifiable information.</li>
                <li>Opt out of marketing updates while retaining essential transactional alerts.</li>
              </ul>
            </section>

            <section className="space-y-3 pt-2 border-t border-neutral-100">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                7. Contact Our Privacy Officer
              </h2>
              <p>
                If you have questions, feedback, or requests regarding this Privacy Policy or your personal information, reach out to our team:
              </p>
              <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200 text-xs sm:text-sm space-y-1 text-neutral-600">
                <p><strong className="text-neutral-900">KingdomDash Operations</strong></p>
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  <a href={`mailto:${appConfig.support.email}`} className="text-primary hover:underline">{appConfig.support.email}</a>
                </p>
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>{appConfig.support.address}</span>
                </p>
              </div>
            </section>
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
