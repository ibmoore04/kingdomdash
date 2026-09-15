import { useState } from 'react'
import { Plus, FolderTree, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import type { Category, Product } from '@/types'

interface VendorCategoriesTabProps {
  categories: Category[]
  products: Product[]
  isLoading?: boolean
  onAddCategory: () => void
  onEditCategory: (category: Category) => void
  onDeleteCategory: (category: Category) => void
  onToggleCategoryStatus: (categoryId: string, currentStatus: boolean) => Promise<void>
}

export function VendorCategoriesTab({
  categories,
  products,
  isLoading,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onToggleCategoryStatus,
}: VendorCategoriesTabProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggle = async (categoryId: string, currentStatus: boolean) => {
    try {
      setTogglingId(categoryId)
      await onToggleCategoryStatus(categoryId, !currentStatus)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-h3 font-bold text-text-primary">Menu & Product Categories</h2>
          <p className="text-body-small text-text-secondary">
            Organize your offerings into sections that help customers browse with ease.
          </p>
        </div>

        <Button onClick={onAddCategory} className="gap-2 shrink-0 font-bold text-white bg-primary hover:bg-primary-hover">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center text-body text-text-secondary shadow-sm">
          Loading categories…
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-12 text-center shadow-sm">
          <FolderTree className="mx-auto h-12 w-12 text-text-muted" aria-hidden="true" />
          <h3 className="mt-3 text-h4 font-bold text-text-primary">No categories yet</h3>
          <p className="mt-1 text-body-small text-text-secondary">
            Create categories like &quot;Rice Dishes&quot;, &quot;Grills&quot;, or &quot;Pantry Essentials&quot; to organize your items.
          </p>
          <Button onClick={onAddCategory} className="mt-5 gap-2 font-bold text-white bg-primary hover:bg-primary-hover" size="sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add First Category
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const productCount = products.filter((p) => p.category_id === category.id).length
            const isToggling = togglingId === category.id

            return (
              <div
                key={category.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-card-hover"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-h4 font-bold text-text-primary">{category.name}</h3>
                      {category.description ? (
                        <p className="mt-1 line-clamp-2 text-caption text-text-secondary">
                          {category.description}
                        </p>
                      ) : (
                        <p className="mt-1 text-caption italic text-text-muted">No description</p>
                      )}
                    </div>
                    <Badge variant={category.is_active ? 'success' : 'dark'} className="text-caption">
                      {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-caption text-text-muted">
                    <span className="font-semibold text-text-primary">{productCount} items</span>
                    <span>•</span>
                    <span>Order: {category.display_order}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={category.is_active}
                      disabled={isToggling}
                      onCheckedChange={() => handleToggle(category.id, category.is_active)}
                      aria-label={`Toggle status for ${category.name}`}
                    />
                    <span className="text-caption font-medium text-text-secondary">
                      {category.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditCategory(category)}
                      className="h-8 w-8 p-0 text-text-secondary hover:text-text-primary"
                      aria-label={`Edit ${category.name}`}
                    >
                      <Edit className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteCategory(category)}
                      className="h-8 w-8 p-0 text-status-error hover:bg-status-error/10"
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
