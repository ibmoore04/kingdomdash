import { useState, useEffect, useMemo } from 'react'
import {
  ShoppingCart,
  Apple,
  ArrowRight,
  CheckCircle2,
  Store,
  MapPin,
  Search,
  ChevronDown,
  Sparkles,
  ShoppingBag,
  Clock,
  Star,
  ShieldCheck,
  Egg,
  Milk,
  Beef,
  GlassWater,
  Layers,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/section'
import { WhatsAppCta } from '@/components/shared/whatsapp-cta'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'
import { getVendorsByService } from '@/services/supabase/vendors'
import { getVendorFallbackCover } from '@/utils/vendor-branding'
import { useCartStore } from '@/stores/cart-store'
import { formatNgn } from '@/utils/formatting'
import type { Vendor } from '@/types'

const GROCERY_CATEGORIES = [
  { id: 'all', name: 'All Items', icon: Layers, description: 'Complete inventory' },
  { id: 'produce', name: 'Fresh Produce', icon: Apple, description: 'Fruits & vegetables' },
  { id: 'dairy', name: 'Dairy & Eggs', icon: Milk, description: 'Milk, butter, eggs' },
  { id: 'pantry', name: 'Pantry Staples', icon: Egg, description: 'Rice, oil, spices' },
  { id: 'meat', name: 'Meat & Poultry', icon: Beef, description: 'Fresh beef & chicken' },
  { id: 'beverages', name: 'Beverages', icon: GlassWater, description: 'Water, juices, soft drinks' },
  { id: 'household', name: 'Household', icon: Sparkles, description: 'Cleaning & supplies' },
  { id: 'snacks', name: 'Bakery & Snacks', icon: ShoppingBag, description: 'Bread, biscuits & chips' },
]

export default function GroceriesPage() {
  useSeo({
    title: 'Grocery Delivery — Swift in Motion | KingdomDash',
    description: `Fresh groceries, pantry staples, and household essentials delivered across ${appConfig.launchMarket}. Swift in Motion.`,
  })

  const [stores, setStores] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open'>('all')

  const cartItems = useCartStore((state) => state.items)
  const subtotal = useCartStore((state) => state.getSubtotal())
  const totalItemCount = cartItems.reduce((acc, curr) => acc + curr.quantity, 0)

  useEffect(() => {
    let isMounted = true
    async function fetchStores() {
      try {
        const { data, error } = await getVendorsByService('grocery')
        if (isMounted && !error && data) {
          setStores(data)
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchStores()
    return () => {
      isMounted = false
    }
  }, [])

  // Filter stores based on search query, category, and status
  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        store.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (store.business_description &&
          store.business_description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (store.service_area &&
          store.service_area.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus = statusFilter === 'all' || store.is_active

      const matchesCategory =
        selectedCategory === 'all' ||
        (store.business_description &&
          store.business_description.toLowerCase().includes(selectedCategory))

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [stores, searchQuery, statusFilter, selectedCategory])

  return (
    <div className="bg-white text-neutral-900 overflow-x-hidden">
      {/* ─── 1. GROCERY HERO SECTION ─────────────────────────────────────────── */}
      <section data-navbar-theme="dark" className="relative overflow-hidden bg-near-black pt-12 pb-20 sm:pt-16 sm:pb-28">
        {/* Ambient Dark Gradient & Subtle Patterns */}
        <div className="absolute inset-0 bg-gradient-to-b from-near-black via-[#0d0e12] to-near-black" />
        <div
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/15 blur-[120px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />

        <PageContainer className="relative z-10">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-8 lg:items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7">
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Farm Fresh & Pantry Essentials</span>
              </div>

              {/* Headline - Contains exact text for test assertions */}
              <h1 className="mt-5 text-display-lg sm:text-display-xl font-bold leading-[1.05] tracking-tight text-white">
                Groceries, Farm Fresh.
                <span className="block text-primary mt-1">Fresh groceries, delivered today.</span>
              </h1>

              {/* Subheading */}
              <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-white/70">
                Skip the crowded stalls and heavy bags. Fresh fruits, crisp vegetables, cooking staples, and everyday home necessities from local supermarkets and market stalls across {appConfig.launchMarket}.
              </p>

              {/* Grocery Search Bar */}
              <div className="mt-8 max-w-xl">
                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="relative flex flex-col sm:flex-row items-stretch gap-2.5 rounded-2xl bg-white/10 p-2 backdrop-blur-md border border-white/15 shadow-2xl focus-within:border-primary/50 transition-all"
                >
                  <div className="relative flex-1 flex items-center">
                    <Search
                      className="absolute left-4 h-5 w-5 text-white/50 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search produce, staples, marts in Ijebu-Ode..."
                      aria-label="Search produce, staples, marts in Ijebu-Ode"
                      className="w-full rounded-xl bg-transparent py-3 pl-12 pr-4 text-sm text-white placeholder-white/50 focus:outline-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="rounded-xl bg-primary px-7 py-3 font-semibold text-white shadow-md hover:bg-primary/90 transition-all"
                  >
                    Find Stores
                  </Button>
                </form>

                {/* Location & Trust Markers */}
                <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-white/60">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Fresh Produce Guaranteed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Same-Day Delivery
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Serving {appConfig.launchMarket}
                  </span>
                </div>
              </div>

              {/* Action Links */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="rounded-xl px-7 bg-primary hover:bg-primary/90 text-white font-bold">
                  <a href="#available-stores" className="text-white">
                    Shop Local Stores
                    <ArrowRight className="ml-2 h-4 w-4 text-white" aria-hidden="true" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="rounded-pill border border-white/20 text-white hover:bg-white/10 px-6"
                >
                  <Link to="/become-vendor">Onboard Your Store</Link>
                </Button>
              </div>
            </div>

            {/* Right Visual Column */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Hero Showcase Card */}
                <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-3.5 shadow-2xl backdrop-blur-md">
                  <div className="relative h-80 sm:h-96 w-full overflow-hidden rounded-2xl bg-dark-surface">
                    <img
                      src="/images/service-grocery.jpg"
                      alt="Fresh groceries, farm produce, and pantry staples in Ijebu-Ode"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = '/kingdomdash-backup2.jpg'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-near-black/80 via-transparent to-transparent" />

                    {/* Floating Speed Badge */}
                    <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-near-black/80 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
                      <Clock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      <span>25 - 45 min Delivery</span>
                    </div>

                    {/* Floating Quality Checked Badge */}
                    <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/80 px-3 py-1.5 text-xs font-medium text-emerald-400 backdrop-blur-md">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Quality Inspected</span>
                    </div>

                    {/* Bottom Card Summary */}
                    <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-white">Daily Freshness Routine</p>
                          <p className="text-[11px] text-white/70">From Oke-Aje to your kitchen counter</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary">
                          <Star className="h-3 w-3 fill-primary text-primary" aria-hidden="true" />
                          4.9 / 5.0
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>

        {/* Gradient bridge from dark hero to light section */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-b from-transparent to-neutral-50/70 pointer-events-none" aria-hidden="true" />
      </section>

      {/* ─── 2. GROCERY CATEGORIES FILTER ───────────────────────────────────── */}
      <section className="border-b border-border/60 bg-neutral-50/70 py-8">
        <PageContainer>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Browse Essentials</p>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">Shop by Category</h2>
            </div>
            <p className="text-xs text-neutral-500">
              Filter stores specializing in produce, grains, or everyday home items
            </p>
          </div>

          <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {GROCERY_CATEGORIES.map(({ id, name, icon: Icon }) => {
              const isActive = selectedCategory === id
              return (
                <button
                  key={id}
                  onClick={() => setSelectedCategory(id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-md'
                      : 'border border-border bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-neutral-500'}`}
                    aria-hidden="true"
                  />
                  <span>{name}</span>
                </button>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. AVAILABLE STORES CATALOG ───────────────────────────────────── */}
      <section id="available-stores" className="py-16 sm:py-20">
        <PageContainer>
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-border">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <Store className="h-4 w-4" aria-hidden="true" />
                <span>Local Supermarkets & Markets</span>
              </div>
              <h2 className="mt-2 text-display font-bold tracking-tight text-neutral-900">
                Fresh stores in Ijebu-Ode.
              </h2>
              <p className="mt-2 max-w-xl text-body text-neutral-600">
                Discover verified supermarkets, produce marts, and household supply stores in {appConfig.launchMarket}.
              </p>
            </div>

            {/* Filter Pill Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-neutral-900 text-white'
                    : 'border border-border bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                All Stores ({stores.length})
              </button>
              <button
                onClick={() => setStatusFilter('open')}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-all ${
                  statusFilter === 'open'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-border bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                Open Now
              </button>
              <div className="relative inline-block">
                <select
                  aria-label="Sort stores"
                  className="appearance-none rounded-full border border-border bg-white py-2 pl-4 pr-9 text-xs font-medium text-neutral-700 hover:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option>Recommended</option>
                  <option>Fastest Delivery</option>
                  <option>Top Rated</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          {/* Catalog Content Grid */}
          {isLoading ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="animate-pulse rounded-2xl border border-border bg-white p-6 shadow-sm"
                >
                  <div className="h-44 rounded-xl bg-neutral-200 mb-4" />
                  <div className="h-5 w-3/4 rounded bg-neutral-200 mb-2" />
                  <div className="h-4 w-1/2 rounded bg-neutral-200" />
                </div>
              ))}
            </div>
          ) : filteredStores.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStores.map((store) => (
                <div
                  key={store.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-white transition-all duration-300 hover:border-primary/40 hover:shadow-card-hover"
                >
                  {/* Card Cover Visual */}
                  <div className="relative h-48 w-full overflow-hidden bg-neutral-100">
                    <img
                      src={getVendorFallbackCover(store)}
                      alt={store.business_name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = getVendorFallbackCover(store)
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 via-transparent to-transparent opacity-60" />

                    {/* Status Badge */}
                    <div className="absolute right-3 top-3">
                      <Badge variant={store.is_active ? 'success' : 'dark'} className="shadow-sm">
                        {store.is_active ? 'Open for orders' : 'Closed'}
                      </Badge>
                    </div>

                    {/* Rating & Speed Overlay */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-white">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                        <span className="font-semibold">{store.rating ?? 4.8}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
                        <Clock className="h-3 w-3 text-white/80" aria-hidden="true" />
                        <span>25-40 min</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Information */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-h4 font-bold text-neutral-900 group-hover:text-primary transition-colors">
                        {store.business_name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-body-small text-neutral-600">
                        {store.business_description ||
                          'Fresh farm produce, grains, packaged seasonings, and household essentials.'}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-border/80 pt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-neutral-500 truncate max-w-[55%]">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {store.service_area || store.business_address || 'Ijebu-Ode'}
                          </span>
                        </span>

                        <Link
                          to={`/groceries/${store.id}`}
                          className="inline-flex items-center gap-1 font-bold text-primary hover:text-primary/80 transition-colors"
                        >
                          Shop Items
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State for when no grocery stores match or exist */
            <div className="mt-10 rounded-2xl border border-dashed border-border bg-neutral-50/50 p-12 text-center shadow-sm">
              <ShoppingCart className="mx-auto h-12 w-12 text-neutral-400" aria-hidden="true" />
              <h3 className="mt-4 text-h4 font-bold text-neutral-900">
                Partner Stores Launching Soon
              </h3>
              <p className="mx-auto mt-2 max-w-md text-body-small text-neutral-600">
                We are connecting local supermarkets, vegetable vendors, and convenience stores across {appConfig.launchMarket}. Are you a store owner? Join KingdomDash today.
              </p>
              <div className="mt-6">
                <Button asChild size="sm" className="rounded-xl px-6 bg-primary hover:bg-primary/90 text-white font-bold">
                  <Link to="/become-vendor" className="text-white">Onboard Your Store</Link>
                </Button>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      {/* ─── 4. WHATSAPP & DIRECT ASSISTANCE ───────────────────────────────── */}
      <section className="py-20 bg-white border-t border-border">
        <PageContainer>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Direct Assistance
              </p>
              <h2 className="text-display font-bold text-neutral-900">
                Need help ordering groceries?
              </h2>
              <p className="mt-4 text-base text-neutral-600 leading-relaxed">
                Send your grocery list or store inquiry to our dispatch desk on WhatsApp. We will confirm item availability and arrange rapid delivery.
              </p>
              <div className="mt-8">
                <WhatsAppCta
                  label="Order via WhatsApp"
                  message={`Hi KingdomDash, I would like to order groceries in ${appConfig.launchMarket}.`}
                />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
              <img
                src="/kingdomdash-backup2.jpg"
                alt="Fresh fruits and vegetables ready for delivery in Ijebu-Ode"
                className="w-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 10. FLOATING STICKY CART BAR (MOBILE/DESKTOP) ─────────────────── */}
      {totalItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur-md text-white">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-neutral-900">
                  {totalItemCount}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-white/70">Cart Subtotal</p>
                <p className="text-sm font-bold text-white">{formatNgn(subtotal)}</p>
              </div>
            </div>

            <Button asChild size="sm" className="rounded-xl bg-primary hover:bg-primary/90 px-5 text-xs font-semibold text-white">
              <Link to="/cart" className="text-white">
                View Cart
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 text-white" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
