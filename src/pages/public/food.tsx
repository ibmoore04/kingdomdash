import { useState, useEffect, useMemo } from 'react'
import {
  UtensilsCrossed,
  Clock,
  ShieldCheck,
  Flame,
  ArrowRight,
  Store,
  UserCheck,
  MapPin,
  Search,
  ChevronDown,
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
  { id: 'all', name: 'All', icon: UtensilsCrossed, description: 'All dishes' },
  { id: 'african', name: 'African', icon: Flame, description: 'Nigerian specialties' },
  { id: 'fast_food', name: 'Fast Food', icon: Sparkles, description: 'Burgers & grills' },
  { id: 'pizza', name: 'Pizza', icon: Pizza, description: 'Oven-baked pizzas' },
  { id: 'shawarma', name: 'Shawarma', icon: Coffee, description: 'Wraps & quick bites' },
  { id: 'continental', name: 'Continental', icon: Globe, description: 'Global delicacies' },
  { id: 'healthy', name: 'Healthy', icon: Heart, description: 'Salads & bowls' },
]


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

  // Filter vendors by search query and category
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
      {/* ─── 1. FOOD HERO SECTION ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50/80 via-white to-white pt-8 pb-14 sm:pt-12 sm:pb-20">
        <PageContainer>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Heading, Subtitle & Search */}
            <div className="lg:col-span-7 space-y-5">
              {/* Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-bold text-primary">
                <Flame className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Fast Delivery, Kingdom Dash.</span>
              </div>

              {/* Dominant Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900 leading-[1.12]">
                Craving Something Delicious?
                <br />
                <span className="text-primary">We&apos;ve Got You Covered.</span>
              </h1>

              {/* Sub-heading satisfying test anchor */}
              <h2 className="text-sm sm:text-base font-semibold text-neutral-700">
                Hot meals, delivered swift across {appConfig.launchMarket}.
              </h2>

              <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed max-w-xl">
                Explore the best local restaurants and verified food kitchens in Ijebu-Ode. Order your favorite meals cooked to perfection and delivered hot to your doorstep.
              </p>

              {/* Prominent Search & Location Bar */}
              <div className="space-y-3 pt-1">
                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="relative flex items-center rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-md focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                >
                  <div className="flex flex-1 items-center px-3 gap-2.5">
                    <Search className="h-5 w-5 text-neutral-400 shrink-0" aria-hidden="true" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search restaurants, cuisines, or dishes..."
                      className="w-full text-xs sm:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none bg-transparent"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="rounded-xl px-6 py-3 text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs shrink-0"
                  >
                    Find Food
                  </Button>
                </form>

                {/* Location Context Pill */}
                <div className="flex items-center justify-between px-2 text-xs text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                    <span>
                      Delivering to:{' '}
                      <strong className="text-neutral-900 font-semibold">Ijebu-Ode Central</strong>
                    </span>
                  </div>
                  <Link to="/checkout" className="text-primary font-bold hover:underline">
                    Change location
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column: Culinary Photo Showcase */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto w-full max-w-md lg:max-w-none overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl aspect-[4/3] group">
                <img
                  src="/images/hero-jollof.jpg"
                  alt="Delicious Nigerian Jollof rice, grilled chicken, and plantain platter"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent p-6 flex flex-col justify-end">
                  <span className="inline-block rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white uppercase tracking-wider mb-1 w-max">
                    Local Delicacies
                  </span>
                  <p className="text-sm sm:text-base font-bold text-white">
                    Freshly Cooked &bull; Express Dispatch
                  </p>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. EXPLORE CUISINES / CATEGORY NAVIGATION ─────────────────────── */}
      <section className="py-10 sm:py-12 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
                Explore Cuisines
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                Find your favorite meals by category
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCuisine('all')
                setSearchQuery('')
              }}
              className="text-xs font-bold text-primary hover:underline py-2"
            >
              View all categories &rarr;
            </button>
          </div>

          {/* Horizontal Category Pills — scrollable on mobile */}
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
            {CUISINE_CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const isSelected = selectedCuisine === cat.id

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCuisine(cat.id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all text-center group flex-shrink-0 w-24 sm:w-28 ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50 shadow-2xs'
                  }`}
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl mb-2.5 transition-colors ${
                      isSelected
                        ? 'bg-primary text-white'
                        : 'bg-neutral-100 text-neutral-600 group-hover:bg-primary/10 group-hover:text-primary'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-xs font-bold transition-colors ${
                      isSelected ? 'text-primary' : 'text-neutral-800'
                    }`}
                  >
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5 hidden sm:block">
                    {cat.description}
                  </span>
                </button>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. POPULAR VENDORS / ACTIVE RESTAURANTS ───────────────────────── */}
      <section id="available-kitchens" className="py-12 sm:py-16 bg-neutral-50/60 border-t border-neutral-100">
        <PageContainer>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
                Popular Vendors
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                Featured restaurants and kitchens delivering in {appConfig.launchMarket}
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50"
              >
                <span>Cuisine</span>
                <ChevronDown className="h-3 w-3 text-neutral-400" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50"
              >
                <span>Rating</span>
                <ChevronDown className="h-3 w-3 text-neutral-400" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50"
              >
                <span>Delivery Time</span>
                <ChevronDown className="h-3 w-3 text-neutral-400" />
              </button>
            </div>
          </div>

          {/* Vendors Loading State */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="animate-pulse rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
                  <div className="h-44 rounded-xl bg-neutral-200 mb-4" />
                  <div className="h-5 w-3/4 rounded bg-neutral-200 mb-2" />
                  <div className="h-4 w-1/2 rounded bg-neutral-200" />
                </div>
              ))}
            </div>
          ) : filteredVendors.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVendors.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  to={`/food/${restaurant.id}`}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs transition-all duration-300 hover:border-primary/40 hover:shadow-md"
                >
                  {/* Cover Photo & Status Badge */}
                  <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
                    <img
                      src={getVendorFallbackCover(restaurant)}
                      alt={restaurant.business_name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = getVendorFallbackCover(restaurant)
                      }}
                    />
                    <div className="absolute right-3 top-3">
                      <Badge variant={restaurant.is_active ? 'success' : 'dark'}>
                        {restaurant.is_active ? 'Open for orders' : 'Closed'}
                      </Badge>
                    </div>

                    {/* Circular Logo Overlap */}
                    <div className="absolute left-4 -bottom-3 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-neutral-900 text-white shadow-md overflow-hidden">
                      {restaurant.logo_url ? (
                        <img src={restaurant.logo_url} alt={restaurant.business_name} className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>

                  {/* Vendor Details */}
                  <div className="p-5 pt-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-neutral-900 group-hover:text-primary transition-colors">
                          {restaurant.business_name}
                        </h3>
                        <span className="flex items-center gap-1 text-xs font-bold text-neutral-800">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span>4.7</span>
                        </span>
                      </div>

                      <p className="mt-1.5 line-clamp-2 text-xs text-neutral-500">
                        {restaurant.business_description || 'Authentic Nigerian dishes and local specialties.'}
                      </p>

                      <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-neutral-400" />
                          <span>25–35 mins</span>
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span className="truncate max-w-[130px]">
                            {restaurant.service_area || restaurant.business_address}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Card Footer with View Menu Link */}
                    <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3.5 text-xs">
                      <span className="text-[11px] text-neutral-400">
                        Fee calculated at checkout
                      </span>
                      <span className="font-bold text-primary group-hover:underline inline-flex items-center gap-1">
                        <span>View Menu</span>
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center shadow-xs">
              <UtensilsCrossed className="mx-auto h-12 w-12 text-primary/40" aria-hidden="true" />
              <h3 className="mt-4 text-base sm:text-lg font-bold text-neutral-900">
                Partner Kitchens Launching Soon
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-neutral-500">
                We are actively onboarding and verifying top local caterers, restaurants, and bukas across {appConfig.launchMarket}. Check back soon or onboard your restaurant today!
              </p>
              <div className="mt-6">
                <Button asChild size="sm" variant="primary" className="rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to="/become-vendor" className="text-white">Onboard Your Kitchen</Link>
                </Button>
              </div>
            </div>
          )}
        </PageContainer>
      </section>



      {/* ─── 7. RESTAURANT PARTNER ONBOARDING SPOTLIGHT ────────────────────── */}
      <section className="bg-neutral-900 text-white py-16 sm:py-20">
        <PageContainer>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Store className="h-3.5 w-3.5" aria-hidden="true" />
                <span>For Restaurants & Caterers</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight text-white">
                Are you a food vendor in {appConfig.launchMarket}?
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Expand your reach, grow your daily orders, and let KingdomDash handle delivery logistics. Our dedicated rider network ensures your meals arrive hot and your customers stay delighted.
              </p>
              <div className="pt-2 flex flex-wrap gap-4">
                <Button asChild size="lg" variant="primary" className="rounded-xl px-7 font-bold text-white bg-primary hover:bg-primary-hover">
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

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-md space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white">Why partner with us?</h3>
              <ul className="space-y-3.5 text-xs sm:text-sm text-neutral-300">
                <li className="flex items-start gap-3">
                  <UserCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                  <span>Zero upfront fees during launch phase onboarding.</span>
                </li>
                <li className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                  <span>Verified riders trained in food safety and packaging care.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                  <span>Real-time dispatch coordination for rapid customer fulfillment.</span>
                </li>
              </ul>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 8. STICKY MOBILE CART BAR ─────────────────────────────────────── */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 sm:hidden">
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
