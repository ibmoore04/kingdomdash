import { useState, useEffect, useMemo } from 'react'
import {
  UtensilsCrossed,
  Flame,
  ArrowRight,
  Store,
  Search,
  Sparkles,
  Pizza,
  Coffee,
  Heart,
  Globe,
  ShoppingBag,
  Coins,
  Moon,
} from 'lucide-react'
import {
  isLateNightHours,
  filterVendorsByBudget,
  filterVendorsByLateNight,
} from '@/utils/campus-discovery'
import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'
import { getLocalBusinessSchema } from '@/components/seo/local-business-schema'
import { getVendorsByService } from '@/services/supabase/vendors'
import { useCartStore } from '@/stores/cart-store'
import { formatNgn } from '@/utils/formatting'
import { VendorCard } from '@/components/shared/vendor-card'
import { VendorCardSkeleton } from '@/components/ui/skeletons'
import { StickyCategoryRail } from '@/components/shared/sticky-category-rail'
import { PromoHeroCarousel } from '@/components/shared/promo-hero-carousel'
import type { Vendor } from '@/types'

const CUISINE_CATEGORIES = [
  { id: 'all', name: 'All Cuisines', icon: UtensilsCrossed },
  { id: 'african', name: 'African & Local', icon: Flame },
  { id: 'fast_food', name: 'Fast Food', icon: Sparkles },
  { id: 'pizza', name: 'Pizza', icon: Pizza },
  { id: 'shawarma', name: 'Shawarma & Grills', icon: Coffee },
  { id: 'continental', name: 'Continental', icon: Globe },
  { id: 'healthy', name: 'Healthy & Salads', icon: Heart },
] as const

export default function FoodPage() {
  useSeo({
    title: 'Food Delivery in Ijebu-Ode — Top Restaurants & Fast Doorstep Dispatch',
    description: `Order hot meals and local delicacies from verified restaurants in Ijebu-Ode, Ogun State. 30–45 minute delivery by verified dispatch riders. Swift in Motion.`,
    keywords: 'Food Delivery in Ijebu-Ode, restaurant delivery Ijebu-Ode, order food online Ogun State, jollof rice delivery, fast food Ijebu-Ode',
    schema: getLocalBusinessSchema('food'),
  })

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCuisine, setSelectedCuisine] = useState('all')
  const [isPocketFriendlyOnly, setIsPocketFriendlyOnly] = useState(false)
  const [isLateNightOnly, setIsLateNightOnly] = useState(false)
  const isLateNightNow = useMemo(() => isLateNightHours(), [])

  const cartItems = useCartStore((state) => state.items)
  const subtotal = useCartStore((state) => state.getSubtotal())
  const totalItemCount = cartItems.reduce((acc, curr) => acc + curr.quantity, 0)

  useEffect(() => {
    let isMounted = true
    async function fetchRestaurants() {
      try {
        const { data, error } = await getVendorsByService('food')
        if (isMounted && !error && data) {
          setVendors(data)
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchRestaurants()
    return () => {
      isMounted = false
    }
  }, [])

  // Filter vendors by search query, cuisine category, student budget, and late night
  const filteredVendors = useMemo(() => {
    let result = vendors.filter((v) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        v.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.business_description &&
          v.business_description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.service_area && v.service_area.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCategory =
        selectedCuisine === 'all' ||
        (v.business_description &&
          v.business_description.toLowerCase().includes(selectedCuisine.replace('_', ' ')))

      return matchesSearch && matchesCategory
    })

    if (isPocketFriendlyOnly) {
      result = filterVendorsByBudget(result, 2500)
    }

    if (isLateNightOnly) {
      result = filterVendorsByLateNight(result)
    }

    return result
  }, [vendors, searchQuery, selectedCuisine, isPocketFriendlyOnly, isLateNightOnly])

  const cuisineRailItems = useMemo(() => {
    return CUISINE_CATEGORIES.map(({ id, name }) => ({
      id,
      name,
      count:
        id === 'all'
          ? vendors.length
          : vendors.filter(
              (v) =>
                v.business_description &&
                v.business_description.toLowerCase().includes(id.replace('_', ' '))
            ).length,
    }))
  }, [vendors])

  return (
    <div className="bg-white text-neutral-900 overflow-x-hidden">
      {/* ─── PAGE HEADER & SEARCH (NO HERO BANNER) ─────────────────────────── */}
      <section className="pt-8 pb-6 border-b border-neutral-100 bg-white">
        <PageContainer>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                Food Delivery
              </h1>
              <h2 className="mt-1 text-xs sm:text-sm font-semibold text-neutral-500">
                Hot meals, delivered swift across {appConfig.launchMarket}.
              </h2>
            </div>

            {/* Compact Search Bar */}
            <form
              onSubmit={(e) => e.preventDefault()}
              className="relative flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 p-1.5 focus-within:bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 w-full md:max-w-md transition-all"
            >
              <div className="flex flex-1 items-center px-2.5 gap-2">
                <Search className="h-4 w-4 text-neutral-400 shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search restaurants, dishes, cuisines..."
                  aria-label="Search restaurants or dishes"
                  className="w-full text-xs sm:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none bg-transparent"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs shrink-0"
              >
                Find Food
              </Button>
            </form>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. STICKY CUISINE CATEGORY RAIL ───────────────────────────────── */}
      <section className="border-b border-neutral-100 bg-neutral-50/70 py-4">
        <PageContainer>
          <StickyCategoryRail
            categories={cuisineRailItems}
            activeId={selectedCuisine}
            onSelect={(id) => setSelectedCuisine(id)}
            className="mb-2"
          />

          {/* Student & Campus Discovery Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
            <button
              type="button"
              onClick={() => setIsPocketFriendlyOnly((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border ${
                isPocketFriendlyOnly
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:bg-neutral-50'
              }`}
            >
              <Coins className="h-3.5 w-3.5 text-emerald-600" />
              <span>Under ₦2,500 (Pocket-Friendly)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLateNightOnly((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border ${
                isLateNightOnly
                  ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-amber-300 hover:bg-neutral-50'
              }`}
            >
              <Moon className="h-3.5 w-3.5 text-amber-500" />
              <span>Late-Night Cravings {isLateNightNow ? '• Active Now' : ''}</span>
            </button>
          </div>

          {/* Personal Shopper Concierge Banner (Visible on Large and Small Screens) */}
          <div className="mt-5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/[0.06] via-amber-500/[0.03] to-white p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3.5 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span>Personal Market Shopper</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                  Prefer custom raw ingredients or direct open-air market foodstuffs?
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed max-w-2xl">
                  Can&apos;t find what you&apos;re looking for in restaurant menus? Send a verified personal shopper to Oke-Aje or Ita Osu market for fresh live catfish, tubers, peppers, or bulk groceries.
                </p>
              </div>
            </div>
            <Button
              asChild
              variant="primary"
              size="sm"
              className="w-full md:w-auto rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shrink-0 shadow-xs h-10 px-5"
            >
              <Link to="/personal-shopper" className="text-white inline-flex items-center justify-center gap-2">
                <span>Book Personal Shopper</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. AVAILABLE RESTAURANTS (Core Showcase) ───────────────────────── */}
      <section id="available-kitchens" className="py-10 sm:py-14 bg-white">
        <PageContainer>
          {/* Featured Deals Carousel */}
          <div className="mb-10 sm:mb-12">
            <PromoHeroCarousel />
          </div>

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-4 border-b border-neutral-100">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Local Delicacies
              </p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                Available Restaurants
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                Showing {filteredVendors.length} {filteredVendors.length === 1 ? 'kitchen' : 'kitchens'} in {appConfig.launchMarket}
              </p>
            </div>

            {(selectedCuisine !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCuisine('all')
                  setSearchQuery('')
                }}
                className="text-xs font-bold text-primary hover:underline self-start sm:self-auto"
              >
                Reset filters &rarr;
              </button>
            )}
          </div>

          {/* Vendors Loading State (Phase 4 Shimmer) */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <VendorCardSkeleton count={6} />
            </div>
          ) : filteredVendors.length > 0 ? (
            /* Vendors Grid Showcase */
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVendors.map((restaurant) => (
                <VendorCard
                  key={restaurant.id}
                  vendor={restaurant}
                  serviceType="food"
                />
              ))}
            </div>
          ) : (
            /* Welcoming Empty State */
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-12 text-center shadow-xs">
              <UtensilsCrossed className="mx-auto h-12 w-12 text-neutral-400" aria-hidden="true" />
              <h3 className="mt-4 text-base sm:text-lg font-bold text-neutral-900">
                Partner Kitchens Launching Soon
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-neutral-500">
                We are actively onboarding and verifying top local caterers, restaurants, and bukas across {appConfig.launchMarket}. Check back soon or onboard your restaurant today!
              </p>
              <div className="mt-6">
                <Button asChild size="sm" variant="primary" className="rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-xs">
                  <Link to="/become-vendor" className="text-white">Onboard Your Kitchen</Link>
                </Button>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      {/* ─── 4. RESTAURANT PARTNER ONBOARDING CTA ───────────────────────────── */}
      <section className="bg-neutral-900 text-white py-14 sm:py-18 border-t border-neutral-800">
        <PageContainer>
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Store className="h-3.5 w-3.5" aria-hidden="true" />
              <span>For Restaurants & Caterers</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight text-white">
              Are you a food vendor in {appConfig.launchMarket}?
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-xl mx-auto">
              Expand your reach, grow your daily orders, and let KingdomDash handle delivery logistics. Our dedicated rider network ensures your meals arrive hot and on time.
            </p>
            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" variant="primary" className="rounded-xl px-7 font-bold text-white bg-primary hover:bg-primary-hover shadow-md">
                <Link to="/become-vendor" className="text-white">Join as a Food Vendor</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="rounded-xl border border-white/20 text-white hover:bg-white/10 px-6 font-bold"
              >
                <Link to="/contact">Speak with Operations</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 5. STICKY MOBILE CART BAR ──────────────────────────────────────── */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-30 sm:hidden">
          <Link
            to="/cart"
            className="flex items-center justify-between rounded-2xl bg-neutral-900 text-white px-5 py-3.5 shadow-2xl border border-white/10"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                {totalItemCount}
              </div>
              <span className="text-xs font-semibold">
                {totalItemCount === 1 ? 'item' : 'items'} in cart
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-primary">{formatNgn(subtotal)}</span>
              <span className="text-xs font-bold flex items-center">
                <span>View Cart</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
