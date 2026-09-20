import { useState, useMemo } from 'react'
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Category, Product } from '@/types'
import { formatNgn } from '@/utils/formatting'

interface VendorProductsTabProps {
  products: Product[]
  categories: Category[]
  isLoading?: boolean
  onAddProduct: () => void
  onEditProduct: (product: Product) => void
  onDeleteProduct: (product: Product) => void
  onToggleAvailability: (productId: string, currentStatus: boolean) => Promise<void>
}

export function VendorProductsTab({
  products,
  categories,
  isLoading,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onToggleAvailability,
}: VendorProductsTabProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) {
        return false
      }
      if (availabilityFilter === 'available' && !p.is_available) {
        return false
      }
      if (availabilityFilter === 'unavailable' && p.is_available) {
        return false
      }
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchesName = p.name.toLowerCase().includes(query)
        const matchesDesc = p.description?.toLowerCase().includes(query) ?? false
        return matchesName || matchesDesc
      }
      return true
    })
  }, [products, selectedCategory, availabilityFilter, search])

  const handleToggle = async (productId: string, currentStatus: boolean) => {
    try {
      setTogglingId(productId)
      await onToggleAvailability(productId, !currentStatus)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar / Action Controls ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-h3 font-bold text-text-primary">Products & Menu</h2>
          <p className="text-body-small text-text-secondary">
            Manage your items, authoritative prices, and real-time availability in Ijebu-Ode.
          </p>
        </div>

        <Button onClick={onAddProduct} className="gap-2 shrink-0 font-bold text-white bg-primary hover:bg-primary-hover">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Product
        </Button>
      </div>

      {/* ── Filters & Search ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name or keyword…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={selectedCategory}
            onValueChange={(val) => setSelectedCategory(val)}
          >
            <SelectTrigger className="h-10 rounded-md border border-border bg-white px-3 py-1.5 text-body-small focus-visible:ring-primary w-auto min-w-[170px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories ({products.length})</SelectItem>
              {categories.map((c) => {
                const count = products.filter((p) => p.category_id === c.id).length
                return (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({count})
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <Select
            value={availabilityFilter}
            onValueChange={(val) => setAvailabilityFilter(val as 'all' | 'available' | 'unavailable')}
          >
            <SelectTrigger className="h-10 rounded-md border border-border bg-white px-3 py-1.5 text-body-small focus-visible:ring-primary w-auto min-w-[130px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">In Stock</SelectItem>
              <SelectItem value="unavailable">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Product List ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center text-body text-text-secondary shadow-sm">
          Loading catalog items…
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-text-muted" aria-hidden="true" />
          <h3 className="mt-3 text-h4 font-bold text-text-primary">No products found</h3>
          <p className="mt-1 text-body-small text-text-secondary">
            {products.length === 0
              ? 'Get started by creating your first product or menu item.'
              : 'Try changing your search keywords or filter options.'}
          </p>
          {products.length === 0 && (
            <Button onClick={onAddProduct} className="mt-5 gap-2 font-bold text-white bg-primary hover:bg-primary-hover" size="sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add First Product
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-body-small">
              <thead className="border-b border-border bg-page-background text-caption font-semibold uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="py-3.5 pl-6 pr-4">Item</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Price (NGN)</th>
                  <th className="px-4 py-3.5">Availability</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((product) => {
                  const category = categories.find((c) => c.id === product.category_id)
                  const isToggling = togglingId === product.id

                  return (
                    <tr key={product.id} className="transition-colors hover:bg-page-background/50">
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-dark-surface">
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
                            <p className="font-semibold text-text-primary">{product.name}</p>
                            {product.description && (
                              <p className="line-clamp-1 text-caption text-text-secondary">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-text-secondary">
                        <Badge variant="default" className="text-caption">
                          {category ? category.name : 'None'}
                        </Badge>
                      </td>

                      <td className="px-4 py-4 font-bold text-text-primary">
                        {formatNgn(product.price)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          <Switch
                            checked={product.is_available}
                            disabled={isToggling}
                            onCheckedChange={() => handleToggle(product.id, product.is_available)}
                            aria-label={`Toggle availability for ${product.name}`}
                          />
                          <span className={`text-caption font-medium ${product.is_available ? 'text-status-success' : 'text-text-muted'}`}>
                            {product.is_available ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 pl-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditProduct(product)}
                            className="h-8 w-8 p-0 text-text-secondary hover:text-text-primary"
                            aria-label={`Edit ${product.name}`}
                          >
                            <Edit className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteProduct(product)}
                            className="h-8 w-8 p-0 text-status-error hover:bg-status-error/10 hover:text-status-error"
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards Presentation */}
          <div className="divide-y divide-border md:hidden">
            {filteredProducts.map((product) => {
              const category = categories.find((c) => c.id === product.category_id)
              const isToggling = togglingId === product.id

              return (
                <div key={product.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-dark-surface">
                      <img
                        src={product.image_url || '/kingdomdash-backup.jpg'}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/kingdomdash-backup.jpg'
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-text-primary">{product.name}</h4>
                        <span className="font-bold text-text-primary shrink-0">
                          {formatNgn(product.price)}
                        </span>
                      </div>
                      {product.description && (
                        <p className="mt-0.5 line-clamp-2 text-caption text-text-secondary">
                          {product.description}
                        </p>
                      )}
                      <div className="mt-2">
                        <Badge variant="default" className="text-caption">
                          {category ? category.name : 'Uncategorized'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.is_available}
                        disabled={isToggling}
                        onCheckedChange={() => handleToggle(product.id, product.is_available)}
                        aria-label={`Toggle availability for ${product.name}`}
                      />
                      <span className="text-caption font-medium text-text-secondary">
                        {product.is_available ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditProduct(product)}
                        className="h-8 gap-1.5 px-3 text-caption"
                      >
                        <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteProduct(product)}
                        className="h-8 w-8 p-0 text-status-error hover:bg-status-error/10"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
