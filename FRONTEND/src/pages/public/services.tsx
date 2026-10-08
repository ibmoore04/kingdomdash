import { Link } from 'react-router-dom'
import {
  UtensilsCrossed,
  ShoppingCart,
  Package,
  ShieldCheck,
  Building2,
  Bike,
  Clock,
  Sparkles,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'

export default function ServicesPage() {
  useSeo({
    title: 'Our Services — Swift in Motion | KingdomDash',
    description: `Explore KingdomDash delivery services in ${appConfig.launchMarket}: Food Delivery, Grocery Delivery, and Courier Dispatch. Swift in Motion.`,
  })

  return (
    <div className="bg-white text-neutral-900 overflow-x-hidden">
      {/* ─── 1. HERO SECTION ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50/70 via-white to-white pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-14 lg:pb-20">
        <PageContainer>
          <div className="max-w-3xl space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
              OUR SERVICES
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900 leading-[1.12]">
              Fast, Reliable, and Secure:
              <br />
              <span className="text-primary">All the Delivery Services You Need.</span>
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-neutral-600 leading-relaxed max-w-2xl">
              Food, groceries, and courier dispatch seamlessly unified for{' '}
              <strong className="text-neutral-900 font-semibold">{appConfig.launchMarket}</strong>. One reliable platform for all your daily movement needs.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                variant="primary"
                className="rounded-xl px-7 py-2.5 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
              >
                <Link to="/food">Order Food Now</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl px-6 py-2.5 text-sm font-bold border-neutral-300"
              >
                <Link to="/groceries">Shop Groceries</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. THREE CORE SERVICES ───────────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Service 1: Food Delivery */}
            <div className="flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-md hover:border-primary/30 transition-all duration-200">
              <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
                <img
                  src="/images/hero-jollof.jpg"
                  alt="Authentic Nigerian Jollof rice, chicken, and local delicacies"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-neutral-900 shadow-xs backdrop-blur-xs flex items-center gap-1.5">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                  <span>30–45 Mins</span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-neutral-900">
                    Food Delivery Hub
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Order from verified restaurants, local kitchens, and bakeries across Ijebu-Ode. Hot, fresh meals prepared carefully and delivered swiftly to your door.
                  </p>
                  <ul className="text-xs text-neutral-500 space-y-1.5 pt-1">
                    <li className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Live GPS dispatch and arrival tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Inspected kitchen partners &amp; temperature care</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-neutral-100">
                  <Button asChild variant="primary" className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-xs">
                    <Link to="/food" className="text-white">Explore Food Delivery</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Service 2: Grocery Delivery */}
            <div className="flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-md hover:border-primary/30 transition-all duration-200">
              <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
                <img
                  src="/images/service-grocery.jpg"
                  alt="Fresh market produce and grocery items"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-neutral-900 shadow-xs backdrop-blur-xs flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Fresh &amp; Packaged</span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-neutral-900">
                    Grocery &amp; Essentials
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Skip crowded stalls. Order fresh farm produce, dairy, grains, beverages, and household pantry staples from trusted local supermarkets and stores.
                  </p>
                  <ul className="text-xs text-neutral-500 space-y-1.5 pt-1">
                    <li className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Same-day doorstep delivery across Ijebu-Ode</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Carefully picked &amp; safely packed essentials</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-neutral-100">
                  <Button asChild variant="primary" className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-xs">
                    <Link to="/groceries" className="text-white">Explore Grocery Delivery</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Service 3: Courier Dispatch */}
            <div className="flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-md hover:border-primary/30 transition-all duration-200">
              <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
                <img
                  src="/images/promo-rider.jpg"
                  alt="Courier dispatch parcel delivery rider"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-neutral-900 shadow-xs backdrop-blur-xs flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span>Point-to-Point</span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-neutral-900">
                    Courier &amp; Parcel Dispatch
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Reliable point-to-point courier service for packages, parcels, merchant customer orders, and sensitive documents across Ijebu-Ode.
                  </p>
                  <ul className="text-xs text-neutral-500 space-y-1.5 pt-1">
                    <li className="flex items-center gap-2">
                      <Bike className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Verified trained riders with doorstep pickup</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Secure handover with recipient verification</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-neutral-100">
                  <Button asChild variant="primary" className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-xs">
                    <Link to="/courier" className="text-white">Explore Courier Dispatch</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. SPECIALIZED SOLUTIONS ─────────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-neutral-50/60 border-t border-neutral-100">
        <PageContainer>
          <div className="mb-8 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
              SPECIALIZED PLATFORM SOLUTIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              Tailored for Local Needs
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Solution 1: Personal Shopper */}
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">
                    Personal Market Shopper
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Need fresh foodstuffs from Oke-Aje or Ita Osu Market? Send a KingdomDash personal shopper with your exact checklist, inspection standards, and budget cap.
                </p>
              </div>
              <div>
                <Button asChild variant="outline" className="rounded-xl font-bold border-neutral-300">
                  <Link to="/personal-shopper">Use Personal Shopper</Link>
                </Button>
              </div>
            </div>

            {/* Solution 2: Corporate & Volume Rates */}
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-7 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">
                    Corporate Logistics &amp; Bulk Rates
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Volume discounts, batch pickups, and end-of-month invoicing for local businesses, ecommerce brands, and pharmacies with frequent delivery volume.
                </p>
              </div>
              <div>
                <Button asChild variant="outline" className="rounded-xl font-bold border-neutral-300">
                  <Link to="/business">Business Courier Rates</Link>
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 4. MOBILE BANNER ─────────────────────────────────────────────── */}
      <section className="py-10 sm:py-14 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                ORDER ANYWHERE, ANYTIME
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
                Take KingdomDash with you
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 max-w-lg">
                Order meals, shop groceries, and send parcels right from your smartphone browser with instant tracking.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button asChild variant="primary" className="rounded-xl px-6 font-bold bg-primary hover:bg-primary-hover text-white shadow-xs">
                <Link to="/food">Order Now</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
