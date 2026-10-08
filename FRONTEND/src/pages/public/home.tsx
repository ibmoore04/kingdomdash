import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MapPin,
  Flame,
  ArrowRight,
  Bike,
  ShieldCheck,
  Headphones,
  ShoppingBag,
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
import { PromoHeroCarousel } from '@/components/shared/promo-hero-carousel'
import { QuickReorderBar } from '@/components/customer/quick-reorder-bar'
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
      {/* ─── 1. STREAMLINED HERO SECTION ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50/70 via-white to-white pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-14 lg:pb-20">
        <PageContainer>
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Headlines & Actions */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-6">
              {/* Tagline Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-bold text-primary">
                <Flame className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>{appConfig.tagline} &bull; {appConfig.launchMarket}</span>
              </div>

              {/* Bold Clean Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.1]">
                Everything You Need.{' '}
                <span className="text-primary block sm:inline">Delivered.</span>
              </h1>

              {/* Concise Subtitle */}
              <div className="space-y-1">
                <p className="text-base sm:text-lg font-bold text-neutral-800 tracking-tight">
                  Food. Groceries. Courier.
                </p>
                <p className="max-w-xl text-sm sm:text-base text-neutral-600 leading-relaxed">
                  Fast, reliable delivery across <strong className="text-neutral-900 font-semibold">{appConfig.launchMarket}</strong>. Safe handling, verified local merchants, and instant dispatch.
                </p>
              </div>

              {/* Quick Service Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  asChild
                  size="lg"
                  variant="primary"
                  className="rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
                >
                  <Link to="/food" className="flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 shrink-0" />
                    <span>Order Food</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold border-2 border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50 text-neutral-900 shadow-xs"
                >
                  <Link to="/groceries" className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Shop Groceries</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-neutral-700 hover:text-primary hover:bg-primary/5 border border-dashed border-neutral-200 sm:border-transparent"
                >
                  <Link to="/courier" className="flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-primary shrink-0" />
                    <span>Send a Package</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              {/* Address Search Form */}
              <form onSubmit={handleAddressSubmit} className="max-w-xl pt-1">
                <div className="flex flex-col sm:flex-row items-stretch gap-2 rounded-2xl border-2 border-neutral-200/90 bg-white p-1.5 sm:p-2 shadow-xs transition-all focus-within:border-primary focus-within:shadow-md">
                  <div className="flex flex-1 items-center gap-2.5 px-3 py-1.5">
                    <MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      placeholder="Enter your delivery address in Ijebu-Ode"
                      className="w-full bg-transparent text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0 border-none outline-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs shrink-0"
                  >
                    Find Vendors
                  </Button>
                </div>
              </form>

              {/* Clean Trust Row */}
              <div className="flex items-center gap-4 sm:gap-8 pt-3 border-t border-neutral-100 text-xs text-neutral-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <Bike className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                  <span>30–45 mins</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                  <span>100% Safe</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Headphones className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                  <span>Local Support</span>
                </span>
              </div>
            </div>

            {/* Right Column: Visual Showcase */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full max-w-sm lg:max-w-none">
                <div className="relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-lg aspect-square">
                  <img
                    src="/images/hero-jollof.jpg"
                    alt="Nigerian Smoky Jollof Rice Combo with grilled chicken and plantain"
                    className="h-full w-full object-cover object-center"
                    loading="eager"
                  />
                </div>

                {/* Floating "Today's Pick" Pill/Card */}
                <div className="absolute -bottom-4 right-2 sm:right-4 w-60 sm:w-68 rounded-2xl border border-neutral-200 bg-white/95 p-3.5 shadow-lg backdrop-blur-md space-y-2 animate-fade-up">
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
                    <h3 className="text-xs sm:text-sm font-bold text-neutral-900">Jollof Rice Combo</h3>
                    <p className="text-[11px] text-neutral-500 line-clamp-1">
                      Party Jollof with grilled chicken &amp; dodo
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs sm:text-sm font-extrabold text-neutral-900">₦5,500</span>
                      <span className="text-[11px] text-neutral-400 line-through">₦6,500</span>
                    </div>
                    <Button asChild size="sm" variant="primary" className="h-7 rounded-lg px-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover">
                      <Link to="/food" className="text-white">Order Now</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── QUICK REORDER BAR (for returning customers) ─────────────────── */}
      <div className="bg-neutral-50/70 border-y border-neutral-100 py-4">
        <PageContainer>
          <QuickReorderBar />
        </PageContainer>
      </div>

      {/* ─── 2. SHOP BY CATEGORY SECTION ─────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-white">
        <PageContainer>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8 sm:mb-10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                EXPLORE CATALOG
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                Shop by Category
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600">
                Explore our wide selection of food, groceries, and services
              </p>
            </div>
            <Link
              to="/food"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:text-primary-hover transition-colors shrink-0"
            >
              <span>View all categories</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              return (
                <Link
                  key={cat.id}
                  to={cat.to}
                  className="group flex flex-col items-center text-center rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-5 shadow-2xs hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 justify-between"
                >
                  <div className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl ${cat.bgColor} mb-2.5 group-hover:scale-105 transition-transform`}>
                    <Icon className={`h-6 w-6 sm:h-7 sm:w-7 ${cat.iconColor}`} aria-hidden="true" />
                  </div>
                  <div className="w-full">
                    <h3 className="text-xs sm:text-sm font-bold text-neutral-900 group-hover:text-primary transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                      {cat.description}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. PROMOTIONAL HERO CAROUSEL ─────────────────────────────────── */}
      <section className="py-6 sm:py-8 bg-neutral-50/60 border-y border-neutral-100">
        <PageContainer>
          <PromoHeroCarousel />
        </PageContainer>
      </section>

      {/* ─── 4. POPULAR VENDORS SECTION ───────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-white">
        <PageContainer>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8 sm:mb-10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                LOCAL MERCHANTS
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                Popular Vendors
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600">
                Top-rated dining spots and stores in Ijebu-Ode delivering swift
              </p>
            </div>
            <Link
              to="/food"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:text-primary-hover transition-colors shrink-0"
            >
              <span>View all vendors</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {isLoadingVendors ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-56 rounded-2xl border border-neutral-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : vendors.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {vendors.slice(0, 4).map((vendor) => (
                <Link
                  key={vendor.id}
                  to="/food"
                  className="group flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-md hover:border-primary/40 transition-all duration-200"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-neutral-100">
                    <img
                      src={getVendorFallbackCover(vendor)}
                      alt={vendor.business_name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = getVendorFallbackCover(vendor)
                      }}
                    />
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-neutral-900 shadow-xs backdrop-blur-xs">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                      <span>4.8</span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 group-hover:text-primary transition-colors line-clamp-1">
                        {vendor.business_name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 capitalize mt-0.5">
                        {vendor.business_type} &bull; Ijebu-Ode Central
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-primary" aria-hidden="true" />
                        <span>30–45 mins</span>
                      </span>
                      <span className="font-semibold text-neutral-900">From ₦500</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 sm:p-8 text-center space-y-3 max-w-md mx-auto">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Local vendors are joining KingdomDash
                </h3>
                <p className="text-xs text-neutral-600 mt-1">
                  We are onboarding premier restaurants and stores across Ijebu-Ode.
                </p>
              </div>
              <div className="pt-1 flex justify-center gap-2">
                <Button asChild size="sm" variant="primary" className="rounded-xl px-4 font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to="/become-vendor" className="text-white">Become a Vendor</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl px-4 font-bold">
                  <Link to="/food">Explore Catalog</Link>
                </Button>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      {/* ─── 5. CORE SERVICES: THREE SERVICES, ONE PLATFORM ──────────────── */}
      <section className="py-12 sm:py-16 bg-neutral-50/60 border-t border-neutral-100">
        <PageContainer>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8 sm:mb-10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                WHAT WE DELIVER
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                Three services, one platform.
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600">
                Everything you need delivered swiftly to your doorstep.
              </p>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:text-primary-hover transition-colors shrink-0"
            >
              <span>View All Services</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Service 1: Food Delivery */}
            <div className="group flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200">
              <div className="h-44 overflow-hidden bg-neutral-100">
                <img
                  src="/images/hero-jollof.jpg"
                  alt="Food Delivery — Nigerian dishes and delicacies"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900 group-hover:text-primary transition-colors">
                    Food Delivery
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Order from your favorite restaurants and enjoy delicious hot meals delivered swiftly to your door in Ijebu-Ode.
                  </p>
                </div>
                <Link
                  to="/food"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary group-hover:text-primary-hover transition-colors pt-2 border-t border-neutral-100"
                >
                  <span>Explore Food</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Service 2: Grocery Delivery */}
            <div className="group flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200">
              <div className="h-44 overflow-hidden bg-neutral-100">
                <img
                  src="/images/service-grocery.jpg"
                  alt="Grocery Delivery — fresh produce and pantry essentials"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900 group-hover:text-primary transition-colors">
                    Grocery Delivery
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Shop for fresh groceries, pantry staples, and everyday household essentials with guaranteed freshness.
                  </p>
                </div>
                <Link
                  to="/groceries"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary group-hover:text-primary-hover transition-colors pt-2 border-t border-neutral-100"
                >
                  <span>Shop Groceries</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Service 3: Courier Dispatch */}
            <div className="group flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200">
              <div className="h-44 overflow-hidden bg-neutral-100">
                <img
                  src="/images/promo-rider.jpg"
                  alt="Courier Dispatch — parcel and document delivery"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900 group-hover:text-primary transition-colors">
                    Courier Dispatch
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                    Send parcels, business documents, and packages across Ijebu-Ode with verified and trained dispatch riders.
                  </p>
                </div>
                <Link
                  to="/courier"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary group-hover:text-primary-hover transition-colors pt-2 border-t border-neutral-100"
                >
                  <span>Explore Courier</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 6. HOW KINGDOMDASH WORKS (SIMPLE 3 STEPS) ──────────────────── */}
      <section className="py-12 sm:py-16 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="text-center max-w-lg mx-auto mb-8 sm:mb-10 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
              SIMPLE &amp; FAST
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              How KingdomDash Works
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600">
              From browse to doorstep in three simple, transparent steps.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.step} className="flex flex-col items-center text-center p-4 rounded-2xl bg-neutral-50/70 border border-neutral-100">
                  <div className="relative mb-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white border border-neutral-200 shadow-2xs text-primary">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-white shadow-2xs">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900">{step.title}</h3>
                  <p className="mt-1 text-xs text-neutral-600 leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 7. UNIFIED LOCAL COVERAGE & MOBILE EXPERIENCE ──────────────── */}
      <section className="py-10 sm:py-14 bg-neutral-50/80 border-t border-neutral-200/60">
        <PageContainer>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Card: Coverage */}
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Coverage Area</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
                  Proudly serving Ijebu-Ode
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  We are launching in <strong className="text-neutral-900 font-semibold">Ijebu-Ode Central</strong> and supported nearby areas, with plans to expand across Ogun State. Our distance pricing engine guarantees fair, transparent delivery rates based on verified location coordinates.
                </p>
              </div>
              <div className="pt-2">
                <Button asChild size="sm" variant="primary" className="rounded-xl px-5 py-2 font-bold bg-primary hover:bg-primary-hover text-white shadow-xs">
                  <Link to="/services">Learn More About Our Coverage</Link>
                </Button>
              </div>
            </div>

            {/* Right Card: Mobile App CTA */}
            <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>KingdomDash on the Go</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
                  Take KingdomDash with you
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Enjoy a faster, easier ordering experience wherever you are in Ijebu-Ode. Browse menus, track orders in real time, and place delivery requests directly from your mobile device.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap gap-2.5">
                <Button asChild size="sm" variant="primary" className="rounded-xl px-5 py-2 font-bold bg-primary hover:bg-primary-hover text-white shadow-xs">
                  <Link to="/food">Order on Mobile</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl px-4 py-2 font-bold border-neutral-300">
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
