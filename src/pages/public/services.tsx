import { Link } from 'react-router-dom'
import {
  UtensilsCrossed,
  ShoppingCart,
  Package,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  FileText,
  Bike,
  Apple,
  Milk,
  Wheat,
  Coffee,
  Boxes,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'

const GROCERY_CATEGORIES = [
  { name: 'Fresh Produce', icon: Apple, subtitle: 'Fresh produce' },
  { name: 'Dairy & Eggs', icon: Milk, subtitle: 'Dairy' },
  { name: 'Pantry Staples', icon: Wheat, subtitle: 'Grains & pantry' },
  { name: 'Snacks & Drinks', icon: Coffee, subtitle: 'Snacks' },
  { name: 'Pack Deliveries', icon: Boxes, subtitle: 'Pack essentials' },
  { name: 'Courier Deliveries', icon: Bike, subtitle: 'Local pickups' },
]

export default function ServicesPage() {
  useSeo({
    title: 'Our Services — Swift in Motion | KingdomDash',
    description: `Explore KingdomDash delivery services in ${appConfig.launchMarket}: Food Delivery, Grocery Delivery, and Courier Dispatch. Swift in Motion.`,
  })

  return (
    <div className="bg-white text-neutral-900 overflow-x-hidden">
      {/* ─── 1. HERO SECTION ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50/80 via-white to-white pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
        <PageContainer>
          {/* Eyebrow & Headline */}
          <div className="mb-8 sm:mb-10 max-w-3xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
              OUR SERVICES
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900 leading-[1.12]">
              Fast, Reliable, and Secure:
              <br />
              <span className="text-primary">All the Delivery Services You Need.</span>
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-neutral-600 leading-relaxed max-w-2xl pt-1">
              Food, groceries, and courier dispatch seamlessly unified for{' '}
              <strong className="text-neutral-900 font-semibold">{appConfig.launchMarket}</strong>. One reliable platform for all your daily movement needs.
            </p>
            <div className="pt-2">
              <Button
                asChild
                size="lg"
                variant="primary"
                className="rounded-xl px-8 py-3.5 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
              >
                <Link to="/food">Order Now</Link>
              </Button>
            </div>
          </div>

          {/* 3-Panel Visual Mosaic Hero */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-stretch">
            {/* Main Handover Visual (Left/Center Panel) */}
            <div className="md:col-span-6 relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-900 min-h-[280px] sm:min-h-[340px] group shadow-sm">
              <img
                src="/images/about-team-hero.jpg"
                alt="KingdomDash delivery dispatch and handover in Ijebu-Ode"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end">
                <span className="inline-block rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white uppercase tracking-wider mb-2 w-max">
                  Swift in Motion
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  Doorstep Delivery Across Ijebu-Ode
                </h3>
                <p className="text-xs text-white/80 mt-1 max-w-md">
                  Trained riders and verified merchants delivering meals and essentials in 30–45 minutes.
                </p>
              </div>
            </div>

            {/* Grocery Delivery Card (Right Top Panel) */}
            <div className="md:col-span-3 relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-900 min-h-[220px] sm:min-h-[340px] group shadow-sm">
              <img
                src="/images/service-grocery.jpg"
                alt="Fresh grocery basket from Ijebu-Ode local stores"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-85"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 sm:p-6 flex flex-col justify-end">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white mb-2 shadow-xs">
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Grocery Delivery
                </h3>
                <p className="text-xs text-white/75 mt-1">
                  Fresh produce, pantry staples, and market essentials delivered today.
                </p>
                <Link
                  to="/groceries"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/90 hover:underline"
                >
                  <span>Explore Groceries</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Courier Dispatch Card (Right Bottom Panel) */}
            <div className="md:col-span-3 relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-900 min-h-[220px] sm:min-h-[340px] group shadow-sm">
              <img
                src="/images/promo-rider.jpg"
                alt="Courier dispatch parcel delivery rider"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-85"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 sm:p-6 flex flex-col justify-end">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white mb-2 shadow-xs">
                  <Package className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Courier Dispatch
                </h3>
                <p className="text-xs text-white/75 mt-1">
                  Secure point-to-point dispatch for business parcels and documents.
                </p>
                <Link
                  to="/courier"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/90 hover:underline"
                >
                  <span>Send Package</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. FOOD DELIVERY HUB ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="mb-10 sm:mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block mb-1.5">
              SERVICE 01
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
              Food Delivery Hub
            </h2>
            <p className="mt-1 text-sm sm:text-base text-neutral-600">
              Hot, delicious meals from your favorite local kitchens delivered directly to your doorstep.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Multi-Photo Food Gallery */}
            <div className="lg:col-span-6 space-y-4">
              {/* Primary Large Platter Photo */}
              <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm aspect-[16/10]">
                <img
                  src="/images/hero-jollof.jpg"
                  alt="Authentic Nigerian Jollof rice, chicken, and local delicacies"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-neutral-900 shadow-xs backdrop-blur-xs flex items-center gap-1.5">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                  <span>Verified Local Kitchens</span>
                </div>
              </div>

              {/* 3 Smaller Dish Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="relative overflow-hidden rounded-xl border border-neutral-200 aspect-square shadow-2xs">
                  <img
                    src="/images/story-market.jpg"
                    alt="Fresh meal preparations"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="relative overflow-hidden rounded-xl border border-neutral-200 aspect-square shadow-2xs">
                  <img
                    src="/images/hero-jollof.jpg"
                    alt="Nigerian cooked meals"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="relative overflow-hidden rounded-xl border border-neutral-200 aspect-square shadow-2xs">
                  <img
                    src="/images/about-team-hero.jpg"
                    alt="Friendly order packaging"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: 3 Structured Feature Cards */}
            <div className="lg:col-span-6 space-y-4">
              {/* Feature Card 1: Curated Local Restaurants */}
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 sm:p-6 transition-all hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                    Curated Local Restaurants
                  </h3>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UtensilsCrossed className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Browse top-rated restaurants, buka spots, and modern eateries in {appConfig.launchMarket}. Every partner is inspected for food hygiene and culinary authenticity.
                </p>
                <div>
                  <Button asChild variant="primary" size="sm" className="rounded-xl px-5 font-bold text-white bg-primary hover:bg-primary-hover">
                    <Link to="/food" className="text-white">Explore Food Delivery</Link>
                  </Button>
                </div>
              </div>

              {/* Feature Card 2: Real-Time Order Tracking */}
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 sm:p-6 transition-all hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                    Real-time Order Tracking
                  </h3>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clock className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Accurate distance-based pricing and live order timeline. Know exactly when your food is being cooked, picked up by the dispatch rider, and approaching your gate.
                </p>
                <div>
                  <Button asChild variant="primary" size="sm" className="rounded-xl px-5 font-bold text-white bg-primary hover:bg-primary-hover">
                    <Link to="/food" className="text-white">Order Now</Link>
                  </Button>
                </div>
              </div>

              {/* Feature Card 3: Dietary Preferences */}
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 sm:p-6 transition-all hover:bg-neutral-50 hover:border-neutral-300 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                    Dietary Preferences & Flavor Variety
                  </h3>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  From traditional swallow dishes with egusi and efo riro to pastries, wraps, and refreshing fruit drinks. Custom special instructions supported at checkout.
                </p>
                <div>
                  <Button asChild variant="primary" size="sm" className="rounded-xl px-5 font-bold text-white bg-primary hover:bg-primary-hover">
                    <Link to="/food" className="text-white">Order Now</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. GROCERY & ESSENTIALS ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-neutral-50/60 border-t border-neutral-100">
        <PageContainer>
          <div className="mb-8">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block mb-1.5">
              SERVICE 02
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
              Grocery & Essentials
            </h2>
            <p className="mt-1 text-sm sm:text-base text-neutral-600">
              Skip the crowded market stalls. Get fresh produce and everyday household supplies delivered to your door.
            </p>
          </div>

          {/* Category Pills & Fresh Produce Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center mb-8">
            {/* Left: Category Navigation Pills */}
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Shop by Category
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {GROCERY_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <Link
                      key={cat.name}
                      to="/groceries"
                      className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-primary hover:bg-primary/5 transition-all text-center group shadow-2xs"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 group-hover:bg-primary/10 text-neutral-600 group-hover:text-primary transition-colors mb-2">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-xs font-bold text-neutral-800 group-hover:text-primary transition-colors">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 mt-0.5">
                        {cat.subtitle}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Right: Fresh Market Banner */}
            <div className="lg:col-span-5 relative overflow-hidden rounded-2xl border border-neutral-200 shadow-sm aspect-[16/10]">
              <img
                src="/images/service-grocery.jpg"
                alt="Fresh market produce and vegetables"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent p-5 flex flex-col justify-end">
                <p className="text-sm font-bold text-white">Fresh Market Selection</p>
                <p className="text-xs text-white/80">Carefully sourced from local Ijebu-Ode vendors</p>
              </div>
            </div>
          </div>

          {/* Two Detailed Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Personal Shopper Selection */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Check className="h-4 w-4 text-primary stroke-[3]" />
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                    Personal Shopper Selection
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Our trained personal shoppers handpick the freshest produce, verify expiration dates, and package delicate groceries securely.
                </p>
                {/* Checklist */}
                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-700 pt-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Same-day service</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Insured deliveries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Verified local stores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Freshness guaranteed</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button asChild variant="primary" className="rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to="/groceries" className="text-white">Explore Grocery Delivery</Link>
                </Button>
              </div>
            </div>

            {/* Card 2: Scheduled Deliveries */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clock className="h-4 w-4 text-primary" />
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                    Scheduled Deliveries
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Order when convenient and set your preferred delivery time. Perfect for weekend restocks, pantry refills, and corporate pantry orders.
                </p>
                {/* Checklist */}
                <div className="grid grid-cols-2 gap-2 text-xs text-neutral-700 pt-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Flexible time slots</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Safe doorstep drop</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Order updates via SMS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Zero market stress</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button asChild variant="primary" className="rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to="/groceries" className="text-white">Order Now</Link>
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 4. COURIER & PARCEL DISPATCH ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="mb-10 sm:mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block mb-1.5">
              SERVICE 03
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
              Courier & Parcel Dispatch
            </h2>
            <p className="mt-1 text-sm sm:text-base text-neutral-600">
              Fast, reliable point-to-point courier service for packages, parcels, and important business documents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Instant Parcel Delivery */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-neutral-300 transition-all">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bike className="h-5 w-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                  Instant Parcel Delivery
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Direct courier dispatch across town. A verified rider picks up from your doorstep and delivers straight to the recipient.
                </p>
                <div className="space-y-1.5 text-xs text-neutral-700 pt-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Same-day service</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Real-time GPS routing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Insured deliveries</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button asChild variant="primary" className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to="/courier" className="text-white">Explore Courier Dispatch</Link>
                </Button>
              </div>
            </div>

            {/* Card 2: Document & Package Services */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-neutral-300 transition-all">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                  Document & Package Services
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Confidential paperwork, legal files, bank documents, and delicate parcels handled with maximum care and security.
                </p>
                <div className="space-y-1.5 text-xs text-neutral-700 pt-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Same-day service</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Direct recipient signature</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Insured deliveries</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button asChild variant="primary" className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to="/courier" className="text-white">Send a Package</Link>
                </Button>
              </div>
            </div>

            {/* Card 3: Business Logistics Solutions */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-neutral-300 transition-all">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                  Business Logistics Solutions
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  End-to-end dispatch for local businesses, online vendors, and pharmacies requiring regular customer fulfillment.
                </p>
                <div className="space-y-1.5 text-xs text-neutral-700 pt-1">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Same-day service</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Scheduled batch pickups</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Dedicated support line</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button asChild variant="primary" className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to="/courier" className="text-white">Learn More</Link>
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 5. TAKE KINGDOMDASH WITH YOU (MOBILE APP BANNER) ─────────────── */}
      <section className="py-14 sm:py-18 bg-neutral-50/80 border-t border-neutral-200/80">
        <PageContainer>
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Smartphone Mockup Image */}
              <div className="lg:col-span-4 flex justify-center">
                <div className="relative w-48 sm:w-56 overflow-hidden rounded-2xl border-4 border-neutral-900 shadow-xl">
                  <img
                    src="/images/mobile-mockup.jpg"
                    alt="KingdomDash web app on smartphone"
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Text & Store Buttons */}
              <div className="lg:col-span-8 space-y-4 text-center lg:text-left">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
                  ORDER ANYWHERE, ANYTIME
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
                  Take KingdomDash with you
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 max-w-xl">
                  Order food from top kitchens, shop daily groceries, or dispatch urgent parcels right from your phone. Fast, reliable, and secure across {appConfig.launchMarket}.
                </p>

                {/* Badges / CTAs */}
                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <Link
                    to="/food"
                    className="inline-flex items-center gap-2.5 rounded-xl bg-neutral-900 px-5 py-2.5 text-white hover:bg-neutral-800 transition-colors shadow-2xs"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400">Order Online via</span>
                      <span className="text-xs font-bold">KingdomDash Web App</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </Link>

                  <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-100 px-4 py-2.5 rounded-xl border border-neutral-200">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Optimized for all mobile browsers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
