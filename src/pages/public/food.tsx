import { useState, useEffect, useMemo } from 'react'
import {
  UtensilsCrossed,
  Clock,
  Flame,
  ArrowRight,
  Store,
  MapPin,
  Search,
  Star,
  Sparkles,
  Pizza,
  Coffee,
  Heart,
  Globe,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'
import { getVendorsByService } from '@/services/supabase/vendors'
import { getVendorFallbackCover } from '@/utils/vendor-branding'
import { useCartStore } from '@/stores/cart-store'
import { formatNgn } from '@/utils/formatting'
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
    title: 'Food Delivery — Swift in Motion | KingdomDash',
    description: `Order hot meals from local restaurants in ${appConfig.launchMarket}. Fast, dependable doorstep delivery. Swift in Motion.`,
  })

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCuisine, setSelectedCuisine] = useState('all')

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

  // Filter vendors by search query and cuisine category
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
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
  }, [vendors, searchQuery, selectedCuisine])

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

      {/* ─── 2. CUISINE CATEGORY PILLS ──────────────────────────────────────── */}
      <section className="border-b border-neutral-100 bg-neutral-50/70 py-6">
        <PageContainer>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {CUISINE_CATEGORIES.map(({ id, name, icon: Icon }) => {
              const isActive = selectedCuisine === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedCuisine(id)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-md'
                      : 'border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100/70'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-neutral-500'}`}
                    aria-hidden="true"
                  />
                  <span>{name}</span>
                </button>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. AVAILABLE RESTAURANTS (Core Showcase) ───────────────────────── */}
      <section id="available-kitchens" className="py-12 sm:py-16 bg-white">
        <PageContainer>
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

          {/* Vendors Loading State */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs"
                >
                  <div className="h-44 rounded-xl bg-neutral-200 mb-4" />
                  <div className="h-5 w-3/4 rounded bg-neutral-200 mb-2" />
                  <div className="h-4 w-1/2 rounded bg-neutral-200" />
                </div>
              ))}
            </div>
          ) : filteredVendors.length > 0 ? (
            /* Vendors Grid Showcase */
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVendors.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs transition-all duration-300 hover:border-primary/40 hover:shadow-lg"
                >
                  {/* Card Cover & Badges */}
                  <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
                    <img
                      src={getVendorFallbackCover(restaurant)}
                      alt={restaurant.business_name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = getVendorFallbackCover(restaurant)
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/60 via-transparent to-transparent opacity-60" />

                    {/* Status Badge */}
                    <div className="absolute right-3 top-3">
                      <Badge variant={restaurant.is_active ? 'success' : 'dark'} className="shadow-xs">
                        {restaurant.is_active ? 'Open for orders' : 'Closed'}
                      </Badge>
                    </div>

                    {/* Overlay Rating & Delivery Estimate */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-white">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                        <span className="font-semibold">{restaurant.rating ?? 4.8}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                        <Clock className="h-3 w-3 text-white/80" aria-hidden="true" />
                        <span>25–35 min</span>
                      </span>
                    </div>

                    {/* Circular Logo Overlap */}
                    <div className="absolute right-3 -bottom-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-neutral-900 text-white shadow-md overflow-hidden">
                      {restaurant.logo_url ? (
                        <img
                          src={restaurant.logo_url}
                          alt={restaurant.business_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Store className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Vendor Details */}
                  <div className="p-5 pt-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 group-hover:text-primary transition-colors">
                        {restaurant.business_name}
                      </h3>

                      <p className="mt-2 line-clamp-2 text-xs text-neutral-500 leading-relaxed">
                        {restaurant.business_description ||
                          'Authentic Nigerian dishes and local specialties freshly prepared.'}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-neutral-100 pt-3.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-neutral-500 truncate max-w-[55%]">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {restaurant.service_area || restaurant.business_address || 'Ijebu-Ode'}
                        </span>
                      </span>

                      <Link
                        to={`/food/${restaurant.id}`}
                        className="inline-flex items-center gap-1 font-bold text-primary group-hover:underline transition-colors"
                      >
                        <span>View Menu</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>
                </div>
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
