import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin, Clock, ArrowLeft, UtensilsCrossed } from 'lucide-react'
import { Section, PageContainer } from '@/components/layout/section'
import { SectionHeading } from '@/components/shared/section-heading'
import { ProductCard } from '@/components/shared/product-card'
import { StickyCategoryRail } from '@/components/shared/sticky-category-rail'
import { WhatsAppCta } from '@/components/shared/whatsapp-cta'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/error-state'
import { getVendorById } from '@/services/supabase/vendors'
import { getAvailableProducts } from '@/services/supabase/products'
import { getVendorCategories } from '@/services/supabase/categories'
import { getVendorFallbackCover } from '@/utils/vendor-branding'
import { getVendorOperatingStatus } from '@/utils/operating-hours'
import { TrustBadgeRow } from '@/components/shared/trust-badges'
import { cn } from '@/lib/cn'
import type { Category, Product, Vendor } from '@/types'
import { VendorConflictModal } from '@/components/cart/vendor-conflict-modal'
import { useCartStore, type CartVendor, type CartItem } from '@/stores/cart-store'
import { useToast } from '@/hooks/use-toast'
import { ProductCardSkeleton } from '@/components/ui/skeletons'

export default function FoodDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>()
  const { pushToast } = useToast()
  const forceAddItem = useCartStore((state) => state.forceAddItem)

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('')

  const [conflictState, setConflictState] = useState<{
    isOpen: boolean
    currentVendorName: string
    pendingItem: Omit<CartItem, 'quantity'> | null
    pendingVendor: CartVendor | null
  }>({
    isOpen: false,
    currentVendorName: '',
    pendingItem: null,
    pendingVendor: null,
  })

  const cartVendor: CartVendor | null = vendor
    ? {
        id: vendor.id,
        name: vendor.business_name,
        address: vendor.business_address || 'Ijebu-Ode, Ogun State',
        serviceType: 'food',
      }
    : null

  const handleVendorConflict = (conflict: {
    currentVendorName: string
    pendingItem: Omit<CartItem, 'quantity'>
    pendingVendor: CartVendor
  }) => {
    setConflictState({
      isOpen: true,
      currentVendorName: conflict.currentVendorName,
      pendingItem: conflict.pendingItem,
      pendingVendor: conflict.pendingVendor,
    })
  }

  const handleConfirmConflict = () => {
    if (conflictState.pendingItem && conflictState.pendingVendor) {
      forceAddItem(conflictState.pendingItem, conflictState.pendingVendor)
      pushToast({
        variant: 'success',
        title: 'New cart started',
        message: `Cart updated with items from ${conflictState.pendingVendor.name}.`,
      })
    }
    setConflictState({
      isOpen: false,
      currentVendorName: '',
      pendingItem: null,
      pendingVendor: null,
    })
  }

  const handleCancelConflict = () => {
    setConflictState({
      isOpen: false,
      currentVendorName: '',
      pendingItem: null,
      pendingVendor: null,
    })
  }

  useEffect(() => {
    let isMounted = true
    async function loadData() {
      if (!vendorId) {
        setIsLoading(false)
        setHasError(true)
        return
      }

      setIsLoading(true)
      setHasError(false)

      try {
        const [vendorRes, productsRes, categoriesRes] = await Promise.all([
          getVendorById(vendorId),
          getAvailableProducts(vendorId, 'food'),
          getVendorCategories(vendorId, 'food'),
        ])

        if (!isMounted) return

        const vendorData = vendorRes.data as Vendor | null
        if (vendorRes.error || !vendorData || !vendorData.is_active) {
          setHasError(true)
          setVendor(null)
        } else {
          setVendor(vendorData)
          setProducts(productsRes.data || [])
          setCategories(categoriesRes.data || [])
        }
      } catch {
        if (isMounted) setHasError(true)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [vendorId])

  const categoryRailItems = useMemo(() => {
    const items = categories
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        count: products.filter((p) => p.category_id === cat.id).length,
      }))
      .filter((cat) => (cat.count ?? 0) > 0)

    const uncategorizedCount = products.filter(
      (p) => !p.category_id || !categories.some((c) => c.id === p.category_id)
    ).length

    if (uncategorizedCount > 0 && items.length > 0) {
      items.push({
        id: 'uncategorized',
        name: 'Other Dishes',
        count: uncategorizedCount,
      })
    }

    return items
  }, [categories, products])

  useEffect(() => {
    if (categoryRailItems.length === 0) return
    if (!activeCategoryId && categoryRailItems[0]) {
      setActiveCategoryId(categoryRailItems[0].id)
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('category-', '')
            setActiveCategoryId(id)
            break
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px' }
    )

    categoryRailItems.forEach((cat) => {
      const el = document.getElementById(`category-${cat.id}`)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [categoryRailItems, activeCategoryId])

  const handleCategorySelect = (id: string) => {
    setActiveCategoryId(id)
    const targetElement = document.getElementById(`category-${id}`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' })
    }
  }

  if (isLoading) {
    return (
      <Section tone="soft">
        <PageContainer>
          <div className="space-y-8 py-6">
            <div className="h-56 w-full rounded-3xl animate-shimmer bg-neutral-200" />
            <div className="h-10 w-48 rounded-xl animate-shimmer bg-neutral-200" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProductCardSkeleton count={6} />
            </div>
          </div>
        </PageContainer>
      </Section>
    )
  }

  if (hasError || !vendor) {
    return (
      <Section tone="soft">
        <ErrorState
          headingTag="h1"
          title="Restaurant not found"
          description="We couldn't find the restaurant you're looking for or it is currently closed."
        />
        <div className="mt-6 flex justify-center">
          <Link
            to="/food"
            className="flex items-center gap-2 text-body-small font-medium text-primary transition-colors hover:text-primary-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to restaurants
          </Link>
        </div>
      </Section>
    )
  }

  return (
    <>
      {/* ─── VENDOR HERO ──────────────────────────────────────────────────── */}
      <section data-navbar-theme="dark" className="relative overflow-hidden bg-neutral-950">
        <div
          className="absolute inset-0 bg-neutral-950"
          aria-label={`${vendor.business_name} cover photo`}
          role="img"
        >
          <img
            src={getVendorFallbackCover(vendor)}
            alt={`${vendor.business_name} cover photo`}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.src = getVendorFallbackCover(vendor)
            }}
          />
          {/* Multi-layered dark scrim: base uniform dim + deep left-to-right gradient for text legibility + bottom fade */}
          <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/25" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" aria-hidden="true" />
        </div>

        <PageContainer className="relative z-10 pb-16 pt-24 sm:pt-28">
          <Link
            to="/food"
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white/90 border border-white/20 transition-all hover:bg-black/80 hover:text-white hover:border-white/40 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All restaurants
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {vendor.logo_url && (
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-white/30 bg-white shadow-xl shrink-0">
                  <img src={vendor.logo_url} alt={vendor.business_name} className="h-full w-full object-cover" />
                </div>
              )}
              <div>
                <h1 className="text-display font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-tight">
                  {vendor.business_name}
                </h1>
                <p className="mt-2 max-w-xl text-body-large font-medium text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] leading-relaxed">
                  {vendor.business_description || 'Fresh meals prepared to order in Ijebu-Ode.'}
                </p>
              </div>
            </div>
            {(() => {
              const opStatus = getVendorOperatingStatus(vendor.operating_hours, vendor.is_active)
              return (
                <Badge
                  variant={
                    opStatus.isOpen
                      ? opStatus.isClosingSoon
                        ? 'warning'
                        : 'success'
                      : 'dark'
                  }
                  className="text-caption font-bold shadow-lg flex items-center gap-1.5 shrink-0"
                >
                  {opStatus.isOpen && (
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        opStatus.isClosingSoon ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
                      )}
                    />
                  )}
                  {opStatus.statusText}
                </Badge>
              )
            })()}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-body-small">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white border border-white/20 shadow-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{vendor.service_area || vendor.business_address}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white border border-white/20 shadow-sm">
              <Clock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {typeof vendor.operating_hours === 'string'
                  ? vendor.operating_hours
                  : 'Typical preparation 20-30 mins'}
              </span>
            </span>
          </div>

          {/* Enterprise Trust Badges */}
          <div className="mt-4">
            <TrustBadgeRow
              badges={['verified_partner', 'hygiene_inspected', 'money_back']}
            />
          </div>

          {/* Pre-order Notice if currently closed */}
          {!getVendorOperatingStatus(vendor.operating_hours, vendor.is_active).isOpen && (
            <div className="mt-4 rounded-2xl border border-amber-500/40 bg-neutral-900/85 backdrop-blur-md p-4 text-xs text-amber-200 flex items-start gap-3 shadow-lg max-w-xl">
              <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-bold">Kitchen Closed &bull; Pre-orders Open</strong>
                <p className="mt-0.5 text-neutral-300">
                  This kitchen is currently not accepting immediate orders. Pre-orders are accepted and will be prepared as soon as the kitchen opens.
                </p>
              </div>
            </div>
          )}
        </PageContainer>
      </section>

      {/* ─── MENU ITEMS ───────────────────────────────────────────────────── */}
      <Section tone="soft" spacing="loose">
        <SectionHeading
          eyebrow="Menu"
          title="Available dishes."
          description={`Browse hot, fresh meals available from ${vendor.business_name}.`}
          size="large"
        />

        {categoryRailItems.length > 1 && (
          <StickyCategoryRail
            categories={categoryRailItems}
            activeId={activeCategoryId}
            onSelect={handleCategorySelect}
            className="mt-6 mb-8"
          />
        )}

        {products.length > 0 ? (
          <div className="mt-8 space-y-10">
            {/* If categories exist, group by category */}
            {categories.length > 0 ? (
              categories.map((category) => {
                const categoryProducts = products.filter((p) => p.category_id === category.id)
                if (categoryProducts.length === 0) return null

                return (
                  <div
                    key={category.id}
                    id={`category-${category.id}`}
                    className="scroll-mt-32 space-y-4"
                  >
                    <div className="border-b border-border pb-2">
                      <h3 className="text-h4 font-bold text-text-primary">{category.name}</h3>
                      {category.description && (
                        <p className="text-caption text-text-secondary">{category.description}</p>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {categoryProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          vendor={cartVendor}
                          onVendorConflict={handleVendorConflict}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            ) : null}

            {/* Uncategorized products or if no categories defined */}
            {products.some((p) => !p.category_id || !categories.some((c) => c.id === p.category_id)) && (
              <div id="category-uncategorized" className="scroll-mt-32 space-y-4">
                {categories.length > 0 && (
                  <h3 className="border-b border-border pb-2 text-h4 font-bold text-text-primary">
                    Other Dishes
                  </h3>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {products
                    .filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id))
                    .map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        vendor={cartVendor}
                        onVendorConflict={handleVendorConflict}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
            <UtensilsCrossed className="mx-auto h-12 w-12 text-text-muted" aria-hidden="true" />
            <h4 className="mt-3 text-h4 font-bold text-text-primary">No items currently available</h4>
            <p className="mt-1 text-body-small text-text-secondary">
              This kitchen is updating their menu for today. Please check back shortly!
            </p>
          </div>
        )}
      </Section>

      {/* ─── WHATSAPP CTA ─────────────────────────────────────────────────── */}
      <Section tone="dark">
        <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
          <div>
            <p className="mb-2 text-eyebrow font-semibold uppercase tracking-[0.2em] text-primary">
              Place an Order
            </p>
            <h2 className="text-h1 font-bold text-white">Ready to order?</h2>
            <p className="mt-3 text-body text-white/60">
              Chat with our dispatch desk on WhatsApp and we will process your order from {vendor.business_name} immediately.
            </p>
          </div>
          <div className="sm:flex sm:justify-end">
            <WhatsAppCta
              message={`Hello KingdomDash, I would like to place an order from ${vendor.business_name}.`}
            />
          </div>
        </div>
      </Section>

      <VendorConflictModal
        isOpen={conflictState.isOpen}
        currentVendorName={conflictState.currentVendorName}
        newVendorName={conflictState.pendingVendor?.name}
        onConfirm={handleConfirmConflict}
        onCancel={handleCancelConflict}
      />
    </>
  )
}
