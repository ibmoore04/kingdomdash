import { useState, useEffect, useMemo } from 'react'
import {
  Package,
  FolderTree,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Layers,
  ShoppingBag,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Category, Product, Vendor } from '@/types'
import { formatNgn } from '@/utils/formatting'
import { OrderVolumeChart } from '@/components/admin/analytics/order-volume-chart'
import { generateVendorOrdersOverTime, type MinimalVendorOrder } from '@/utils/vendor-analytics'
import { getOrdersByVendor } from '@/services/supabase/orders'
import type { AdminDateRangePreset } from '@/types/admin'

interface VendorOverviewTabProps {
  vendor: Vendor
  vendorServices?: ('food' | 'grocery')[]
  products: Product[]
  categories: Category[]
  onNavigateToProducts: () => void
  onNavigateToCategories: () => void
  onOpenAddProduct: () => void
  onOpenAddCategory: () => void
}

export function VendorOverviewTab({
  vendor,
  vendorServices,
  products,
  categories,
  onNavigateToProducts,
  onNavigateToCategories,
  onOpenAddProduct,
  onOpenAddCategory,
}: VendorOverviewTabProps) {
  const [orders, setOrders] = useState<MinimalVendorOrder[]>([])
  const [isOrdersLoading, setIsOrdersLoading] = useState(true)
  const [datePreset, setDatePreset] = useState<AdminDateRangePreset>('30d')

  useEffect(() => {
    let isMounted = true
    async function loadVendorOrders() {
      setIsOrdersLoading(true)
      try {
        const res = await getOrdersByVendor(vendor.id)
        if (isMounted && res.data) {
          setOrders(res.data as MinimalVendorOrder[])
        }
      } catch (err) {
        console.error('Failed to load vendor orders for trends chart:', err)
      } finally {
        if (isMounted) {
          setIsOrdersLoading(false)
        }
      }
    }

    if (vendor?.id) {
      loadVendorOrders()
    }
    return () => {
      isMounted = false
    }
  }, [vendor?.id])

  const ordersOverTime = useMemo(() => {
    return generateVendorOrdersOverTime(orders, datePreset)
  }, [orders, datePreset])

  const inStockCount = products.filter((p) => p.is_available).length
  const outOfStockCount = products.length - inStockCount
  const activeCategoriesCount = categories.filter((c) => c.is_active).length
  const stockPercentage = products.length > 0 ? Math.round((inStockCount / products.length) * 100) : 100

  const hasFood = vendorServices ? vendorServices.includes('food') : vendor.business_type === 'restaurant'
  const hasGrocery = vendorServices ? vendorServices.includes('grocery') : vendor.business_type === 'grocery_store'

  const serviceLabels = [
    hasFood ? 'Food Delivery' : null,
    hasGrocery ? 'Groceries' : null,
  ].filter(Boolean).join(' & ') || 'Food Delivery'

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Store Welcome Hero Card ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border bg-gradient-to-br from-white via-white to-primary/[0.04] p-5 sm:p-7 shadow-xs">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-white border border-border shadow-md shadow-primary/10 ring-4 ring-primary/10 p-1">
              {vendor.logo_url ? (
                <img
                  src={vendor.logo_url}
                  alt={vendor.business_name}
                  className="h-full w-full object-cover rounded-xl"
                  onError={(e) => {
                    e.currentTarget.src = '/KingdomDash-emblem-clean.png'
                  }}
                />
              ) : (
                <img
                  src="/KingdomDash-emblem-clean.png"
                  alt="KingdomDash"
                  className="h-10 w-10 sm:h-11 sm:w-11 object-contain"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight truncate">
                  {vendor.business_name}
                </h2>
                <Badge
                  variant={vendor.is_active ? 'success' : 'warning'}
                  className="gap-1 text-[11px] font-semibold px-2.5 py-0.5"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      vendor.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {vendor.is_active ? 'Active on KingdomDash' : 'Store Paused'}
                </Badge>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                  <Sparkles className="h-3 w-3" />
                  {serviceLabels}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-y-1 gap-x-4 text-body-small text-text-secondary">
                {vendor.business_address && (
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                    <span className="truncate">{vendor.business_address}</span>
                  </span>
                )}
                {vendor.operating_hours && (
                  <span className="inline-flex items-center gap-1.5 text-text-muted">
                    <Clock className="h-3.5 w-3.5 text-text-muted shrink-0" aria-hidden="true" />
                    <span>{typeof vendor.operating_hours === 'string' ? vendor.operating_hours : ''}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action & Storefront Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
            {hasFood && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-semibold h-9 rounded-xl hover:text-primary">
                <Link to={`/food/${vendor.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Food Storefront
                </Link>
              </Button>
            )}
            {hasGrocery && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-semibold h-9 rounded-xl hover:text-primary">
                <Link to={`/groceries/${vendor.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Grocery Storefront
                </Link>
              </Button>
            )}
            <Button
              onClick={onOpenAddProduct}
              size="sm"
              className="gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-sm h-9 px-4 rounded-xl"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {/* Metric 1: Total Products */}
        <div className="group rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs hover:border-primary/30 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Total Products
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
              <Package className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            {products.length}
          </p>
          <button
            type="button"
            onClick={onNavigateToProducts}
            className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline"
          >
            <span>Manage products</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Metric 2: In Stock */}
        <div className="group rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs hover:border-emerald-500/30 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              In Stock
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              {inStockCount}
            </p>
            {products.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                {stockPercentage}%
              </span>
            )}
          </div>
          <span className="mt-2 block text-caption text-text-secondary truncate">
            Available for customer orders
          </span>
        </div>

        {/* Metric 3: Out of Stock */}
        <div className="group rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs hover:border-amber-500/30 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Out of Stock
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
              <AlertCircle className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            {outOfStockCount}
          </p>
          <span className="mt-2 block text-caption text-text-secondary truncate">
            {outOfStockCount > 0 ? 'Paused from storefront' : 'All items in stock'}
          </span>
        </div>

        {/* Metric 4: Categories */}
        <div className="group rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs hover:border-purple-500/30 hover:shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Categories
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:scale-105 transition-transform">
              <FolderTree className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            {activeCategoriesCount}
          </p>
          <button
            type="button"
            onClick={onNavigateToCategories}
            className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline"
          >
            <span>Manage categories</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── Inventory Health Progress Strip ─────────────────────────────────── */}
      {products.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-body-small font-bold text-text-primary">
                Catalog Stock Health
              </span>
            </div>
            <span className="text-caption font-semibold text-text-secondary">
              {inStockCount} of {products.length} items ready for immediate fulfillment
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-page-background">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
              style={{ width: `${stockPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Orders & Fulfillment Trends Visual Chart ────────────────────────── */}
      <OrderVolumeChart
        data={ordersOverTime}
        isLoading={isOrdersLoading}
        activePreset={datePreset}
        onPresetChange={setDatePreset}
        title="Orders & Fulfillment Trends"
        subtitle="Platform throughput, gross volume, and fulfillment dynamics"
      />

      {/* ── Quick Action Hub ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs">
        <h3 className="text-base sm:text-lg font-bold text-text-primary tracking-tight mb-4">
          Quick Catalog Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={onOpenAddProduct}
            className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border/80 bg-page-background hover:bg-primary/5 hover:border-primary/40 transition-all text-left group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs group-hover:scale-105 transition-transform">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-body-small font-bold text-text-primary group-hover:text-primary transition-colors">
                Add New Product
              </p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Create dish or grocery SKU
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenAddCategory}
            className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border/80 bg-page-background hover:bg-primary/5 hover:border-primary/40 transition-all text-left group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs group-hover:scale-105 transition-transform">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <p className="text-body-small font-bold text-text-primary group-hover:text-primary transition-colors">
                Add Category
              </p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Organize menu sections
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onNavigateToProducts}
            className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border/80 bg-page-background hover:bg-primary/5 hover:border-primary/40 transition-all text-left group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs group-hover:scale-105 transition-transform">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-body-small font-bold text-text-primary group-hover:text-primary transition-colors">
                Products & Menu
              </p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Edit prices & availability
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onNavigateToCategories}
            className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border/80 bg-page-background hover:bg-primary/5 hover:border-primary/40 transition-all text-left group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs group-hover:scale-105 transition-transform">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-body-small font-bold text-text-primary group-hover:text-primary transition-colors">
                Taxonomy & Categories
              </p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Order and section display
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Featured Menu Items Preview ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-text-primary tracking-tight">
              Featured Menu & Catalog Items
            </h3>
            <p className="text-caption text-text-secondary mt-0.5">
              Recent products available to customer storefronts
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onNavigateToProducts}
            className="text-xs font-semibold h-8 rounded-xl"
          >
            View all ({products.length})
          </Button>
        </div>

        {products.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-text-muted" aria-hidden="true" />
            <h4 className="mt-3 text-body font-bold text-text-primary">No products added yet</h4>
            <p className="mt-1 text-body-small text-text-secondary max-w-sm mx-auto">
              Start by creating categories and adding your menu or store items to start receiving orders.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={onOpenAddCategory} variant="outline" size="sm" className="rounded-xl">
                Add Category
              </Button>
              <Button
                onClick={onOpenAddProduct}
                size="sm"
                className="font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-xs"
              >
                Add Product
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border/70">
            {products.slice(0, 5).map((product) => {
              const category = categories.find((c) => c.id === product.category_id)
              return (
                <div key={product.id} className="flex items-center justify-between py-3 sm:py-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-page-background">
                      <img
                        src={product.image_url || '/kingdomdash-backup.jpg'}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/kingdomdash-backup.jpg'
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-small font-bold text-text-primary truncate">
                        {product.name}
                      </p>
                      <p className="text-caption text-text-muted truncate">
                        {category ? category.name : 'Uncategorized'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <span className="text-body-small sm:text-body font-bold text-text-primary">
                      {formatNgn(product.price)}
                    </span>
                    <Badge
                      variant={product.is_available ? 'success' : 'default'}
                      className="text-caption font-semibold"
                    >
                      {product.is_available ? 'In Stock' : 'Out of Stock'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
