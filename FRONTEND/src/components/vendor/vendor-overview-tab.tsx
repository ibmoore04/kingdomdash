import { Package, FolderTree, CheckCircle2, AlertCircle, Plus, ExternalLink, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Category, Product, Vendor } from '@/types'
import { formatNgn } from '@/utils/formatting'

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
  const inStockCount = products.filter((p) => p.is_available).length
  const outOfStockCount = products.length - inStockCount
  const activeCategoriesCount = categories.filter((c) => c.is_active).length

  const hasFood = vendorServices ? vendorServices.includes('food') : vendor.business_type === 'restaurant'
  const hasGrocery = vendorServices ? vendorServices.includes('grocery') : vendor.business_type === 'grocery_store'

  const serviceLabels = [
    hasFood ? 'Food' : null,
    hasGrocery ? 'Grocery' : null,
  ].filter(Boolean).join(' + ') || 'Food'

  return (
    <div className="space-y-8">
      {/* ── Store Welcome Banner ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-h3 font-bold text-text-primary truncate">{vendor.business_name}</h2>
                <Badge variant={vendor.is_active ? 'success' : 'warning'} className="text-[11px]">
                  {vendor.is_active ? 'Active' : 'Paused'}
                </Badge>
                <Badge variant="primary" className="text-[11px]">
                  {serviceLabels}
                </Badge>
              </div>
              <p className="mt-0.5 text-body-small text-text-secondary truncate">
                {serviceLabels} Merchant • {vendor.business_address}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasFood && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                <Link to={`/food/${vendor.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Food Store
                </Link>
              </Button>
            )}
            {hasGrocery && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                <Link to={`/groceries/${vendor.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Grocery Store
                </Link>
              </Button>
            )}
            <Button onClick={onOpenAddProduct} size="sm" className="gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Product
            </Button>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-3.5 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">Total Products</span>
            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-2 sm:mt-3 text-xl sm:text-display font-bold text-text-primary">{products.length}</p>
          <button
            type="button"
            onClick={onNavigateToProducts}
            className="mt-1.5 sm:mt-2 text-caption font-medium text-primary hover:underline block truncate"
          >
            Manage products →
          </button>
        </div>

        <div className="rounded-xl border border-border bg-white p-3.5 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">In Stock</span>
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-status-success" aria-hidden="true" />
          </div>
          <p className="mt-2 sm:mt-3 text-xl sm:text-display font-bold text-text-primary">{inStockCount}</p>
          <span className="mt-1.5 sm:mt-2 block text-caption text-text-secondary truncate">Available to order</span>
        </div>

        <div className="rounded-xl border border-border bg-white p-3.5 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">Out of Stock</span>
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-status-warning" aria-hidden="true" />
          </div>
          <p className="mt-2 sm:mt-3 text-xl sm:text-display font-bold text-text-primary">{outOfStockCount}</p>
          <span className="mt-1.5 sm:mt-2 block text-caption text-text-secondary truncate">Hidden from menu</span>
        </div>

        <div className="rounded-xl border border-border bg-white p-3.5 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">Categories</span>
            <FolderTree className="h-4 w-4 sm:h-5 sm:w-5 text-text-primary" aria-hidden="true" />
          </div>
          <p className="mt-2 sm:mt-3 text-xl sm:text-display font-bold text-text-primary">{activeCategoriesCount}</p>
          <button
            type="button"
            onClick={onNavigateToCategories}
            className="mt-1.5 sm:mt-2 text-caption font-medium text-primary hover:underline block truncate"
          >
            Manage categories →
          </button>
        </div>
      </div>

      {/* ── Recent Items Preview ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h3 className="text-h4 font-bold text-text-primary">Featured Menu Items</h3>
          <Button variant="ghost" size="sm" onClick={onNavigateToProducts}>
            View all ({products.length})
          </Button>
        </div>

        {products.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-text-muted" aria-hidden="true" />
            <h4 className="mt-3 text-h4 font-semibold text-text-primary">No products added yet</h4>
            <p className="mt-1 text-body-small text-text-secondary">
              Start by creating categories and adding your menu or store items.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={onOpenAddCategory} variant="outline" size="sm">
                Add Category
              </Button>
              <Button onClick={onOpenAddProduct} size="sm" className="font-bold text-white bg-primary hover:bg-primary-hover">
                Add Product
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {products.slice(0, 5).map((product) => {
              const category = categories.find((c) => c.id === product.category_id)
              return (
                <div key={product.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-dark-surface">
                      <img
                        src={product.image_url || '/kingdomdash-backup.jpg'}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/kingdomdash-backup.jpg'
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-body-small font-semibold text-text-primary">{product.name}</p>
                      <p className="text-caption text-text-muted">
                        {category ? category.name : 'Uncategorized'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-body-small font-bold text-text-primary">
                      {formatNgn(product.price)}
                    </span>
                    <Badge variant={product.is_available ? 'success' : 'dark'} className="text-caption">
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
