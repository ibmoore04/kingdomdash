import { useState, useEffect, useMemo } from 'react'
import {
  ShoppingCart,
  Apple,
  ArrowRight,
  Search,
  Sparkles,
  ShoppingBag,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'
import { getLocalBusinessSchema } from '@/components/seo/local-business-schema'
import { getVendorsByService } from '@/services/supabase/vendors'
import { useCartStore } from '@/stores/cart-store'
import { formatNgn } from '@/utils/formatting'
import { VendorCard } from '@/components/shared/vendor-card'
import { VendorCardSkeleton } from '@/components/ui/skeletons'
import { PromoHeroCarousel } from '@/components/shared/promo-hero-carousel'
import type { Vendor } from '@/types'

const GROCERY_CATEGORIES = [
  { id: 'all', name: 'All Items', icon: Layers },
  { id: 'produce', name: 'Fresh Produce', icon: Apple },
  { id: 'dairy', name: 'Dairy & Eggs', icon: Milk },
  { id: 'pantry', name: 'Pantry Staples', icon: Egg },
  { id: 'meat', name: 'Meat & Poultry', icon: Beef },
  { id: 'beverages', name: 'Beverages', icon: GlassWater },
  { id: 'household', name: 'Household', icon: Sparkles },
  { id: 'snacks', name: 'Bakery & Snacks', icon: ShoppingBag },
] as const

export default function GroceriesPage() {
  useSeo({
    title: 'Grocery Delivery in Ijebu-Ode — Fresh Produce & Supermarket Delivery',
    description: `Fresh market produce, household essentials, and supermarket staples delivered to your doorstep in Ijebu-Ode, Ogun State. Swift in Motion.`,
    keywords: 'Grocery Delivery in Ijebu-Ode, fresh food market Ijebu-Ode, supermarket delivery Ogun State, buy groceries online Nigeria',
    schema: getLocalBusinessSchema('grocery'),
  })

  const [stores, setStores] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open'>('all')
  const [sortBy, setSortBy] = useState('Recommended')

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
      {/* ─── PAGE HEADER & SEARCH (NO HERO BANNER) ─────────────────────────── */}
      <section className="pt-8 pb-6 border-b border-neutral-100 bg-white">
        <PageContainer>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                Grocery Delivery
              </h1>
              <h2 className="mt-1 text-xs sm:text-sm font-semibold text-neutral-500">
                Fresh groceries, delivered today across {appConfig.launchMarket}.
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
                  placeholder="Search produce, staples, marts in Ijebu-Ode..."
                  aria-label="Search produce, staples, marts in Ijebu-Ode"
                  className="w-full text-xs sm:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none bg-transparent"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-xs shrink-0"
              >
                Find Stores
              </Button>
            </form>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. GROCERY CATEGORY PILLS ──────────────────────────────────────── */}
      <section className="border-b border-neutral-100 bg-neutral-50/70 py-6">
        <PageContainer>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {GROCERY_CATEGORIES.map(({ id, name, icon: Icon }) => {
              const isActive = selectedCategory === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedCategory(id)}
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

          {/* Personal Market Shopper Strip */}
          <div className="mt-3.5 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 text-left min-w-0">
              <ShoppingBag className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs text-neutral-700 truncate">
                <strong className="text-neutral-900 font-semibold">Prefer a custom market run to Oke-Aje or Ita Osu?</strong> We send a personal shopper.
              </p>
            </div>
            <Link
              to="/personal-shopper"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0"
            >
              <span>Use Personal Shopper</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. AVAILABLE GROCERY STORES (Core Showcase) ────────────────────── */}
      <section id="available-stores" className="py-10 sm:py-14 bg-white">
        <PageContainer>
          {/* Featured Highlights Carousel */}
          <div className="mb-10 sm:mb-12">
            <PromoHeroCarousel />
          </div>

          {/* Section Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-4 border-b border-neutral-100">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Local Markets & Marts
              </p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                Available Grocery Stores
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                Showing {filteredStores.length} {filteredStores.length === 1 ? 'store' : 'stores'} in {appConfig.launchMarket}
              </p>
            </div>

            {/* Quick Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                All Stores ({stores.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  statusFilter === 'open'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                Open Now
              </button>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger
                  aria-label="Sort stores"
                  className="h-8 rounded-full border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:border-neutral-300 focus:ring-1 focus:ring-primary w-auto min-w-[130px]"
                >
                  <SelectValue placeholder="Sort stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Recommended">Recommended</SelectItem>
                  <SelectItem value="Fastest Delivery">Fastest Delivery</SelectItem>
                  <SelectItem value="Top Rated">Top Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stores Loading State (Phase 4 Shimmer) */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <VendorCardSkeleton count={6} />
            </div>
          ) : filteredStores.length > 0 ? (
            /* Stores Grid Showcase */
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStores.map((store) => (
                <VendorCard
                  key={store.id}
                  vendor={store}
                  serviceType="grocery"
                />
              ))}
            </div>
          ) : (
            /* Welcoming Empty State */
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-12 text-center shadow-xs">
              <ShoppingCart className="mx-auto h-12 w-12 text-neutral-400" aria-hidden="true" />
              <h3 className="mt-4 text-base sm:text-lg font-bold text-neutral-900">
                Partner Stores Launching Soon
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-neutral-500">
                We are connecting local supermarkets, vegetable vendors, and convenience stores across {appConfig.launchMarket}. Are you a store owner? Join KingdomDash today.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="sm" variant="primary" className="rounded-xl px-6 bg-primary hover:bg-primary/90 text-white font-bold shadow-xs">
                  <Link to="/personal-shopper" className="text-white">Use Personal Shopper</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl px-6 border-neutral-300 font-bold">
                  <Link to="/become-vendor">Onboard Your Store</Link>
                </Button>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      {/* ─── 4. DIRECT ASSISTANCE & WHATSAPP (Courier-Style Polish) ───────────── */}
      <section className="py-14 sm:py-18 bg-neutral-50/70 border-t border-neutral-100">
        <PageContainer>
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Direct Assistance
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              Need help ordering groceries?
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-lg mx-auto">
              Send your grocery list or store inquiry to our dispatch desk on WhatsApp. We will confirm item availability and arrange rapid delivery.
            </p>
            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <WhatsAppCta
                label="Order via WhatsApp"
                message={`Hi KingdomDash, I would like to order groceries in ${appConfig.launchMarket}.`}
              />
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-neutral-300 text-neutral-800 hover:bg-neutral-100 px-6 font-bold"
              >
                <Link to="/become-vendor">Onboard Your Store</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 5. FLOATING STICKY CART BAR ─────────────────────────────────────── */}
      {totalItemCount > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-4 left-4 right-4 z-30 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-5 duration-300">
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
