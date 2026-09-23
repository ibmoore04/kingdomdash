import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin, Clock, ArrowLeft, ShoppingCart } from 'lucide-react'
import { Section, PageContainer } from '@/components/layout/section'
import { SectionHeading } from '@/components/shared/section-heading'
import { ProductCard } from '@/components/shared/product-card'
import { WhatsAppCta } from '@/components/shared/whatsapp-cta'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/error-state'
import { getVendorById } from '@/services/supabase/vendors'
import { getAvailableProducts } from '@/services/supabase/products'
import { getVendorCategories } from '@/services/supabase/categories'
import { getVendorFallbackCover } from '@/utils/vendor-branding'
import type { Category, Product, Vendor } from '@/types'
import { VendorConflictModal } from '@/components/cart/vendor-conflict-modal'
import { useCartStore, type CartVendor, type CartItem } from '@/stores/cart-store'
import { useToast } from '@/hooks/use-toast'

export default function GroceryDetailPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const { pushToast } = useToast()
  const forceAddItem = useCartStore((state) => state.forceAddItem)

  const [store, setStore] = useState<Vendor | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

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

  const cartVendor: CartVendor | null = store
    ? {
        id: store.id,
        name: store.business_name,
        address: store.business_address || 'Ijebu-Ode, Ogun State',
        serviceType: 'grocery',
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
      if (!storeId) {
        setIsLoading(false)
        setHasError(true)
        return
      }

      setIsLoading(true)
      setHasError(false)

      try {
        const [storeRes, productsRes, categoriesRes] = await Promise.all([
          getVendorById(storeId),
          getAvailableProducts(storeId, 'grocery'),
          getVendorCategories(storeId, 'grocery'),
        ])

        if (!isMounted) return

        const storeData = storeRes.data as Vendor | null
        if (storeRes.error || !storeData || !storeData.is_active) {
          setHasError(true)
          setStore(null)
        } else {
          setStore(storeData)
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
  }, [storeId])

  if (isLoading) {
    return (
      <Section tone="soft">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
            <span className="text-body-small text-text-secondary">Loading grocery store items…</span>
          </div>
        </div>
      </Section>
    )
  }

  if (hasError || !store) {
    return (
      <Section tone="soft">
        <ErrorState
          title="Store not found"
          description="We couldn't find the grocery store you're looking for or it is currently closed."
        />
        <div className="mt-6 flex justify-center">
          <Link
            to="/groceries"
            className="flex items-center gap-2 text-body-small font-medium text-primary transition-colors hover:text-primary-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to grocery stores
          </Link>
        </div>
      </Section>
    )
  }

  return (
    <>
      {/* ─── STORE HERO ───────────────────────────────────────────────────── */}
      <section data-navbar-theme="dark" className="relative overflow-hidden bg-neutral-950">
        <div
          className="absolute inset-0 bg-neutral-950"
          aria-label={`${store.business_name} cover photo`}
          role="img"
        >
          <img
            src={getVendorFallbackCover(store)}
            alt={`${store.business_name} cover photo`}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.src = getVendorFallbackCover(store)
            }}
          />
          {/* Multi-layered dark scrim: base uniform dim + deep left-to-right gradient for text legibility + bottom fade */}
          <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/25" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" aria-hidden="true" />
        </div>

        <PageContainer className="relative z-10 pb-16 pt-24 sm:pt-28">
          <Link
            to="/groceries"
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white/90 border border-white/20 transition-all hover:bg-black/80 hover:text-white hover:border-white/40 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All stores
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {store.logo_url && (
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-white/30 bg-white shadow-xl shrink-0">
                  <img src={store.logo_url} alt={store.business_name} className="h-full w-full object-cover" />
                </div>
              )}
              <div>
                <h1 className="text-display font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] tracking-tight">
                  {store.business_name}
                </h1>
                <p className="mt-2 max-w-xl text-body-large font-medium text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] leading-relaxed">
                  {store.business_description || 'Fresh produce and household essentials in Ijebu-Ode.'}
                </p>
              </div>
            </div>
            <Badge variant={store.is_active ? 'success' : 'dark'} className="text-caption font-bold shadow-lg">
              {store.is_active ? 'Open for Orders' : 'Closed'}
            </Badge>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-body-small">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white border border-white/20 shadow-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{store.service_area || store.business_address}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white border border-white/20 shadow-sm">
              <Clock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {typeof store.operating_hours === 'string'
                  ? store.operating_hours
                  : 'Typical fulfillment 30-45 mins'}
              </span>
            </span>
          </div>
        </PageContainer>
      </section>

      {/* ─── PRODUCTS ─────────────────────────────────────────────────────── */}
      <Section tone="soft" spacing="loose">
        <SectionHeading
          eyebrow="Products"
          title="Available items."
          description={`Browse groceries, farm produce, and home staples from ${store.business_name}.`}
          size="large"
        />

        {products.length > 0 ? (
          <div className="mt-10 space-y-10">
            {categories.length > 0 ? (
              categories.map((category) => {
                const categoryProducts = products.filter((p) => p.category_id === category.id)
                if (categoryProducts.length === 0) return null

                return (
                  <div key={category.id} className="space-y-4">
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

            {products.some((p) => !p.category_id || !categories.some((c) => c.id === p.category_id)) && (
              <div className="space-y-4">
                {categories.length > 0 && (
                  <h3 className="border-b border-border pb-2 text-h4 font-bold text-text-primary">
                    General Groceries
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
            <ShoppingCart className="mx-auto h-12 w-12 text-text-muted" aria-hidden="true" />
            <h4 className="mt-3 text-h4 font-bold text-text-primary">No items currently available</h4>
            <p className="mt-1 text-body-small text-text-secondary">
              This grocery store is restocking items today. Please check back shortly!
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
              Chat with our grocery desk on WhatsApp and we will process your order from {store.business_name} right away.
            </p>
          </div>
          <div className="sm:flex sm:justify-end">
            <WhatsAppCta
              message={`Hello KingdomDash, I would like to order groceries from ${store.business_name}.`}
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
