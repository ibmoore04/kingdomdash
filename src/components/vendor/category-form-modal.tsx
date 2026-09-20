import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Category, CategoryInsert, CategoryUpdate, ReferenceCategory } from '@/types'

interface CategoryFormModalProps {
  isOpen: boolean
  vendorId: string
  editingCategory: Category | null
  referenceCategories?: ReferenceCategory[]
  vendorServices?: ('food' | 'grocery')[]
  isSubmitting?: boolean
  onClose: () => void
  onSubmit: (data: CategoryInsert | CategoryUpdate) => Promise<void>
}

export function CategoryFormModal({
  isOpen,
  vendorId,
  editingCategory,
  referenceCategories = [],
  vendorServices,
  isSubmitting,
  onClose,
  onSubmit,
}: CategoryFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [serviceType, setServiceType] = useState<'food' | 'grocery'>('food')
  const [referenceCategoryId, setReferenceCategoryId] = useState('')
  const [displayOrder, setDisplayOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name)
      setDescription(editingCategory.description || '')
      setServiceType((editingCategory.service_type as 'food' | 'grocery') || 'food')
      setReferenceCategoryId(editingCategory.reference_category_id || '')
      setDisplayOrder(editingCategory.display_order.toString())
      setIsActive(editingCategory.is_active)
    } else {
      setName('')
      setDescription('')
      const defaultService: 'food' | 'grocery' =
        vendorServices && vendorServices.includes('food')
          ? 'food'
          : vendorServices?.[0] || 'food'
      setServiceType(defaultService)
      setReferenceCategoryId('')
      setDisplayOrder('0')
      setIsActive(true)
    }
    setError(null)
  }, [editingCategory, isOpen, vendorServices])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Category name is required.')
      return
    }

    const orderNum = parseInt(displayOrder, 10)
    const validOrder = isNaN(orderNum) ? 0 : orderNum

    try {
      setError(null)
      if (editingCategory) {
        await onSubmit({
          name: trimmedName,
          description: description.trim() || null,
          service_type: serviceType,
          reference_category_id: referenceCategoryId || null,
          display_order: validOrder,
          is_active: isActive,
        })
      } else {
        await onSubmit({
          vendor_id: vendorId,
          name: trimmedName,
          description: description.trim() || null,
          service_type: serviceType,
          reference_category_id: referenceCategoryId || null,
          display_order: validOrder,
          is_active: isActive,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h4 font-bold text-text-primary">
            {editingCategory ? 'Edit Category' : 'Create Category'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-3 text-body-small text-status-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="category-name" className="text-label font-semibold text-text-primary">
              Category Name <span className="text-status-error">*</span>
            </Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Swallows & Soups, Grills, Produce"
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="category-service-type" className="text-label font-semibold text-text-primary">
              Service Type <span className="text-status-error">*</span>
            </Label>
            <Select
              value={serviceType}
              onValueChange={(val) => setServiceType(val as 'food' | 'grocery')}
            >
              <SelectTrigger
                id="category-service-type"
                className="mt-1 flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-body-small focus-visible:ring-primary"
              >
                <SelectValue placeholder="Select Service Type" />
              </SelectTrigger>
              <SelectContent>
                {(!vendorServices || vendorServices.includes('food')) && (
                  <SelectItem value="food">Food Menu</SelectItem>
                )}
                {(!vendorServices || vendorServices.includes('grocery')) && (
                  <SelectItem value="grocery">Grocery Catalog</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {referenceCategories.length > 0 && (
            <div>
              <Label htmlFor="reference-category" className="text-label font-semibold text-text-primary">
                Global Reference Category (Optional)
              </Label>
              <Select
                value={referenceCategoryId || 'none'}
                onValueChange={(val) => {
                  const resolvedVal = val === 'none' ? '' : val
                  setReferenceCategoryId(resolvedVal)
                  const matched = referenceCategories.find((rc) => rc.id === resolvedVal)
                  if (matched && matched.service_type) {
                    setServiceType(matched.service_type as 'food' | 'grocery')
                  }
                }}
              >
                <SelectTrigger
                  id="reference-category"
                  className="mt-1 flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-body-small focus-visible:ring-primary"
                >
                  <SelectValue placeholder="None / Custom Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / Custom Category</SelectItem>
                  {referenceCategories
                    .filter((ref) => !ref.service_type || ref.service_type === serviceType)
                    .map((ref) => (
                      <SelectItem key={ref.id} value={ref.id}>
                        {ref.name} ({ref.service_type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="category-description" className="text-label font-semibold text-text-primary">
              Description (Optional)
            </Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this menu section"
              className="mt-1 resize-none"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="display-order" className="text-label font-semibold text-text-primary">
                Display Order
              </Label>
              <Input
                id="display-order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                min="0"
                step="1"
                className="mt-1"
              />
            </div>

            <div className="flex flex-col justify-center pt-5">
              <div className="flex items-center gap-3">
                <Switch
                  id="category-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="category-active" className="cursor-pointer text-body-small font-medium text-text-primary">
                  {isActive ? 'Active' : 'Inactive'}
                </Label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="font-bold text-white bg-primary hover:bg-primary-hover"
            >
              {isSubmitting ? 'Saving…' : editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
