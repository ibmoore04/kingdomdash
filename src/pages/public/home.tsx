import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MapPin,
  Flame,
  ArrowRight,
  Bike,
  ShieldCheck,
  Award,
  Headphones,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  Package,
  Store,
  Star,
  Clock,
  Smartphone,
  CupSoda,
  Cookie,
  Apple,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'
import { getActiveVendors } from '@/services/supabase/vendors'
import { getVendorFallbackCover } from '@/utils/vendor-branding'
import type { Vendor } from '@/types'

const CATEGORIES = [
  {
    id: 'food',
    name: 'Food',
    description: 'Order delicious meals from local restaurants',
    icon: UtensilsCrossed,
    to: '/food',
    bgColor: 'bg-red-50',
    iconColor: 'text-primary',
  },
  {
    id: 'groceries',
    name: 'Groceries',
    description: 'Daily essentials delivered fast',
    icon: ShoppingBag,
    to: '/groceries',
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'fruits',
    name: 'Fruits & Veggies',
    description: 'Fresh produce from trusted stores',
    icon: Apple,
    to: '/groceries',
    bgColor: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    id: 'beverages',
    name: 'Beverages',
    description: 'Chilled drinks & refreshments',
    icon: CupSoda,
    to: '/groceries',
    bgColor: 'bg-sky-50',
    iconColor: 'text-sky-600',
  },
  {
    id: 'snacks',
    name: 'Snacks & Treats',
    description: 'Quick bites and tasty treats',
    icon: Cookie,
    to: '/groceries',
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  {
    id: 'courier',
    name: 'Courier Dispatch',
    description: 'Send parcels and documents',
    icon: Package,
    to: '/courier',
    bgColor: 'bg-rose-50',
    iconColor: 'text-primary',
  },
]

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Choose',
    description: 'Pick what you want from our curated range of local vendors.',
    icon: ShoppingBag,
  },
  {
    step: '02',
    title: 'Enter Address',
    description: 'Tell us where to deliver. We verify doorstep serviceability instantly.',
    icon: MapPin,
  },
  {
    step: '03',
    title: 'Place Order',
    description: 'Confirm your order with zero hassle. Swift dispatch to your door.',
    icon: Package,
  },
]

const WHY_CHOOSE_ITEMS = [
  {
    title: 'Reliable & Fast',
    description: 'Swift delivery within Ijebu-Ode Central and nearby areas.',
    icon: Bike,
  },
  {
    title: 'Safe & Secure',
    description: 'Your orders, payments, and location details are protected with top security.',
    icon: ShieldCheck,
  },
  {
    title: 'Local & Trusted',
    description: 'We work closely with verified local vendors and food spots in the community.',
    icon: Award,
  },
  {
    title: 'Always Here',
    description: 'Our customer support team is on standby to assist whenever you need help.',
    icon: Headphones,
  },
]

export default function HomePage() {
  useSeo({
    title: 'Food, Groceries & Courier Delivery in Ijebu-Ode',
    description: 'Order food, fresh groceries, and dispatch courier packages across Ijebu-Ode, Ogun State. Swift in Motion.',
  })

  const navigate = useNavigate()
  const [addressInput, setAddressInput] = useState('')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoadingVendors, setIsLoadingVendors] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function fetchVendors() {
      try {
        const { data, error } = await getActiveVendors()
        if (isMounted && !error && data) {
          setVendors(data as Vendor[])
        }
      } catch {
        // Fallback silently if offline
      } finally {
        if (isMounted) setIsLoadingVendors(false)
      }
    }

    fetchVendors()
    return () => {
      isMounted = false
    }
  }, [])

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate('/food')
  }

  return (
    <div className="bg-white text-text-primary overflow-x-hidden">
      {/* ─── 1. HERO SECTION ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50/80 via-white to-white pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
        <PageContainer>
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Headlines & Address CTA */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-7">
              {/* Brand statement badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-bold text-primary">
                <Flame className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Fast. Reliable. Kingdom Driven.</span>
              </div>

              {/* Main Dominant Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.08]">
                Food, groceries,
                <br className="hidden sm:inline" />
                {' '}and more, <span className="text-primary">delivered</span>
                <br className="hidden sm:inline" />
                {' '}to your door.
              </h1>

              {/* Supporting Subtitle */}
              <p className="max-w-xl text-base sm:text-lg text-neutral-600 leading-relaxed">
                Order from local vendors in <strong className="text-neutral-900 font-semibold">{appConfig.launchMarket}</strong>. Fast delivery. Safe handling. Excellent service.
              </p>

              {/* Address Search Form */}
              <form onSubmit={handleAddressSubmit} className="max-w-xl pt-1">
                <div className="flex flex-col sm:flex-row items-stretch gap-2.5 rounded-2xl border-2 border-neutral-200/90 bg-white p-2 shadow-xs transition-all focus-within:border-primary focus-within:shadow-md">
                  <div className="flex flex-1 items-center gap-3 px-3 py-2">
                    <MapPin className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      placeholder="Enter your delivery address in Ijebu-Ode"
                      className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="rounded-xl px-7 py-3 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs shrink-0"
                  >
                    Order Now
                  </Button>
                </div>
              </form>

              {/* Hero Benefits Row — Balanced Spacing & Sizing */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-6 sm:pt-7 border-t border-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Bike className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900 leading-tight">Fast Delivery</h4>
                    <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">30–45 mins</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900 leading-tight">Secure Ordering</h4>
                    <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">100% Safe</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Award className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900 leading-tight">Quality Trusted</h4>
                    <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">Verified spots</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Headphones className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900 leading-tight">Local Support</h4>
                    <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">On standby</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: High-Appeal Hero Image & Floating Pick Card */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full max-w-md lg:max-w-none">
                {/* Decorative background glow */}
                <div className="absolute -inset-4 rounded-full bg-primary/10 blur-3xl opacity-60 pointer-events-none" />

                {/* Hero Dish Image */}
                <div className="relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-xl aspect-square">
                  <img
                    src="/images/hero-jollof.jpg"
                    alt="Nigerian Smoky Jollof Rice Combo with grilled chicken and plantain"
                    className="h-full w-full object-cover object-center"
                    loading="eager"
                  />
                </div>

                {/* Floating "Today's Pick" Card Overlay */}
                <div className="absolute -bottom-6 sm:-bottom-8 right-2 sm:right-2 lg:right-0 w-64 sm:w-72 rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur-md space-y-2.5 animate-fade-up">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <Flame className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      <span>Today&apos;s Pick</span>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                      HOT
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Jollof Rice Combo</h3>
                    <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                      Party Jollof with grilled chicken, dodo & drink
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-extrabold text-neutral-900">₦5,500</span>
                      <span className="text-xs text-neutral-400 line-through">₦6,500</span>
                    </div>
                    <Button asChild size="sm" variant="primary" className="h-8 rounded-lg px-3 text-xs font-bold text-white bg-primary hover:bg-primary-hover">
                      <Link to="/food" className="text-white">Order Now</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. SHOP BY CATEGORY SECTION ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 sm:mb-12">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
                EXPLORE CATALOG
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
                Shop by Category
              </h2>
              <p className="text-sm sm:text-base text-neutral-600">
                Explore our wide selection of food, groceries, and services
              </p>
            </div>
            <Link
              to="/food"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-hover transition-colors shrink-0"
            >
              <span>View all categories</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.id}
                  to={cat.to}
                  className="group flex flex-col items-center text-center rounded-2xl border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 min-h-[195px] justify-between"
                >
                  <div className={`flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-2xl ${cat.bgColor} mb-3 group-hover:scale-105 transition-transform`}>
                    <Icon className={`h-8 w-8 sm:h-9 sm:w-9 ${cat.iconColor}`} aria-hidden="true" />
                  </div>
                  <div className="w-full">
                    <h3 className="text-sm sm:text-base font-bold text-neutral-900 group-hover:text-primary transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. POPULAR VENDORS SECTION ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-neutral-50/70 border-t border-neutral-200/60">
        <PageContainer>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 sm:mb-12">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
                LOCAL MERCHANTS
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
                Popular Vendors
              </h2>
              <p className="text-sm sm:text-base text-neutral-600">
                Top-rated dining spots and stores in Ijebu-Ode delivering swift
              </p>
            </div>
            <Link
              to="/food"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-hover transition-colors shrink-0"
            >
              <span>View all vendors</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {isLoadingVendors ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-64 rounded-2xl border border-neutral-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : vendors.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {vendors.slice(0, 4).map((vendor) => (
                <Link
                  key={vendor.id}
                  to="/food"
                  className="group flex flex-col rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs hover:shadow-lg hover:border-primary/30 transition-all duration-200"
                >
                  {/* Cover image */}
                  <div className="relative h-44 w-full overflow-hidden bg-neutral-100">
                    <img
                      src={getVendorFallbackCover(vendor)}
                      alt={vendor.business_name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = getVendorFallbackCover(vendor)
                      }}
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-neutral-900 shadow-xs backdrop-blur-xs">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                      <span>4.8</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 group-hover:text-primary transition-colors line-clamp-1">
                        {vendor.business_name}
                      </h3>
                      <p className="text-xs text-neutral-500 capitalize mt-0.5">
                        {vendor.business_type} • Ijebu-Ode Central
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span>30–45 mins</span>
                      </span>
                      <span className="font-semibold text-neutral-900">Delivery from ₦500</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* Graceful Empty State with Balanced Container Spacing */
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 sm:p-10 text-center space-y-4 max-w-xl mx-auto shadow-xs my-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Store className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-neutral-900">
                  Local vendors are joining KingdomDash
                </h3>
                <p className="text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
                  We are onboarding premier restaurants, bakeries, and grocery stores across Ijebu-Ode. Partner with KingdomDash to reach more local customers.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
                <Button asChild variant="primary" className="rounded-xl px-6 py-2.5 font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to="/become-vendor" className="text-white">Become a Vendor</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl px-6 py-2.5 font-bold">
                  <Link to="/food">Explore Catalog</Link>
                </Button>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      {/* ─── 4. PROMOTIONAL DARK BANNER ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="relative overflow-hidden rounded-3xl bg-[#101114] text-white p-8 sm:p-12 lg:p-14 shadow-2xl border border-white/10">
            {/* Ambient Red Glow */}
            <div className="absolute top-0 right-1/4 h-80 w-80 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

            <div className="grid items-center gap-8 lg:grid-cols-12 relative z-10">
              {/* Left Column: Headline, Copy, CTA */}
              <div className="lg:col-span-5 space-y-4 sm:space-y-5">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
                  SPECIAL DISPATCH OFFER
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.1]">
                  Your next delivery
                  <br />
                  <span className="text-primary">starts here</span>.
                </h2>
                <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-md">
                  From hot meals to fresh groceries and urgent parcels, KingdomDash brings everyday delivery services together in Ijebu-Ode.
                </p>
                <div className="pt-2">
                  <Button asChild size="lg" variant="primary" className="rounded-xl px-8 font-bold bg-primary hover:bg-primary-hover text-white shadow-lg">
                    <Link to="/food">Order Now</Link>
                  </Button>
                </div>
              </div>

              {/* Center Column: Rider Visual */}
              <div className="lg:col-span-4 flex justify-center">
                <div className="relative h-64 sm:h-72 lg:h-80 w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/40">
                  <img
                    src="/images/promo-rider.jpg"
                    alt="KingdomDash delivery rider with backpack"
                    className="h-full w-full object-cover object-top"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Right Column: Key Feature Highlights */}
              <div className="lg:col-span-3 space-y-5 lg:pl-2">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Great Prices</h4>
                    <p className="text-xs text-white/60 mt-0.5">Affordable for everyone</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">On-Time Delivery</h4>
                    <p className="text-xs text-white/60 mt-0.5">Right on schedule</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Trusted by Locals</h4>
                    <p className="text-xs text-white/60 mt-0.5">Your neighborhood partner</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 5. WHY CHOOSE KINGDOMDASH ────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-neutral-50/80 border-t border-neutral-200/60">
        <PageContainer>
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
              OUR ADVANTAGE
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
              Why Choose KingdomDash?
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
              Built specifically to bring dependable on-demand delivery to residents and merchants in {appConfig.launchMarket}.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CHOOSE_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="flex flex-col items-center text-center p-6 sm:p-7 rounded-2xl border border-neutral-200/80 bg-white shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary border border-primary/20 mb-4 shadow-xs">
                    <Icon className="h-7 w-7 stroke-[2.2]" aria-hidden="true" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900">{item.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 6. OUR SERVICES ──────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 sm:mb-12">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
                WHAT WE DELIVER
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
                Three services, one platform.
              </h2>
              <p className="text-sm sm:text-base text-neutral-600">
                Everything you need delivered swiftly to your doorstep.
              </p>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-hover transition-colors shrink-0"
            >
              <span>View All Services</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
            {/* Service 1: Food Delivery */}
            <div className="group flex flex-col rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 h-full">
              <div className="h-52 overflow-hidden bg-neutral-100">
                <img
                  src="/images/hero-jollof.jpg"
                  alt="Food Delivery — Nigerian dishes and delicacies"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-neutral-900 group-hover:text-primary transition-colors">
                    Food Delivery
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed min-h-[4rem]">
                    Order from your favorite restaurants and enjoy delicious hot meals delivered swiftly to your door in Ijebu-Ode.
                  </p>
                </div>
                <Link
                  to="/food"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:text-primary-hover transition-colors pt-3 border-t border-neutral-100"
                >
                  <span>Explore Food</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Service 2: Grocery Delivery with High-Quality Basket Image */}
            <div className="group flex flex-col rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 h-full">
              <div className="h-52 overflow-hidden bg-neutral-100">
                <img
                  src="/images/service-grocery.jpg"
                  alt="Grocery Delivery — fresh produce and pantry essentials"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-neutral-900 group-hover:text-primary transition-colors">
                    Grocery Delivery
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed min-h-[4rem]">
                    Shop for fresh groceries, pantry staples, and everyday household essentials. We handle the shopping and delivery.
                  </p>
                </div>
                <Link
                  to="/groceries"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:text-primary-hover transition-colors pt-3 border-t border-neutral-100"
                >
                  <span>Shop Groceries</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Service 3: Courier Dispatch */}
            <div className="group flex flex-col rounded-3xl border border-neutral-200 bg-white overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 h-full">
              <div className="h-52 overflow-hidden bg-neutral-100">
                <img
                  src="/images/promo-rider.jpg"
                  alt="Courier Dispatch — parcel and document delivery"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-neutral-900 group-hover:text-primary transition-colors">
                    Courier Dispatch
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed min-h-[4rem]">
                    Send parcels, business documents, and packages across Ijebu-Ode with verified and trained dispatch riders.
                  </p>
                </div>
                <Link
                  to="/courier"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary group-hover:text-primary-hover transition-colors pt-3 border-t border-neutral-100"
                >
                  <span>Explore Courier</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 7. HOW KINGDOMDASH WORKS ─────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-neutral-50/80 border-t border-neutral-200/60">
        <PageContainer>
          <div className="text-center max-w-xl mx-auto mb-12 sm:mb-16 space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
              SIMPLE & FAST
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
              How KingdomDash Works
            </h2>
            <p className="text-sm sm:text-base text-neutral-600">
              From browse to doorstep in three simple, transparent steps.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 relative">
            {/* Desktop connecting dashed line */}
            <div className="hidden sm:block absolute top-9 left-[18%] right-[18%] h-0.5 border-t-2 border-dashed border-neutral-300 -z-0" aria-hidden="true" />

            {HOW_IT_WORKS_STEPS.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.step} className="flex flex-col items-center text-center relative px-4 z-10">
                  <div className="relative mb-5">
                    <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-white border border-neutral-200 shadow-sm text-primary">
                      <Icon className="h-8 w-8" aria-hidden="true" />
                    </div>
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white shadow-xs">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">{step.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 8. PROUDLY SERVING IJEBU-ODE (COVERAGE) ──────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left: Coverage Details */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>Coverage Area</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900">
                Proudly serving Ijebu-Ode
              </h2>
              <p className="text-base sm:text-lg text-neutral-600 leading-relaxed">
                We are launching in <strong className="text-neutral-900 font-semibold">Ijebu-Ode Central</strong> and supported nearby areas, with plans to expand across Ogun State. Our distance pricing engine guarantees fair, transparent delivery rates based on verified location coordinates.
              </p>
              <div className="pt-2">
                <Button asChild size="lg" variant="primary" className="rounded-xl px-7 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-sm">
                  <Link to="/services">Learn More About Our Coverage</Link>
                </Button>
              </div>
            </div>

            {/* Right: Coverage Map Graphic */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl aspect-[16/10]">
                <img
                  src="/images/coverage-map.jpg"
                  alt="Ijebu-Ode Central delivery coverage map"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 9. MOBILE EXPERIENCE CTA ─────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-neutral-50/80 border-t border-neutral-200/60">
        <PageContainer>
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-12 lg:p-16 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14">
            {/* Left: Mobile mockup */}
            <div className="w-full max-w-sm lg:max-w-md flex justify-center">
              <div className="relative w-64 sm:w-72 aspect-square overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 shadow-xl">
                <img
                  src="/images/mobile-mockup.jpg"
                  alt="KingdomDash mobile web app experience"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Right: Mobile Copy */}
            <div className="max-w-lg space-y-5 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                <span>KingdomDash on the Go</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
                Take KingdomDash with you
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
                Enjoy a faster, easier ordering experience wherever you are in Ijebu-Ode. Browse menus, track orders in real time, and place delivery requests directly from your mobile device.
              </p>
              <div className="pt-2 flex flex-wrap justify-center lg:justify-start gap-3">
                <Button asChild size="lg" variant="primary" className="rounded-xl px-8 font-bold bg-primary hover:bg-primary-hover text-white shadow-sm">
                  <Link to="/food">Order on Mobile</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-xl px-6 font-bold border-neutral-300">
                  <Link to="/about">About KingdomDash</Link>
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
