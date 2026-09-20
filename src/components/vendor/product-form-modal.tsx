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
import type { Category, Product, ProductInsert, ProductUpdate } from '@/types'
import { ImageIcon } from 'lucide-react'

interface ProductFormModalProps {
  isOpen: boolean
  vendorId: string
  categories: Category[]
  editingProduct: Product | null
  isSubmitting?: boolean
  onClose: () => void
  onSubmit: (data: ProductInsert | ProductUpdate) => Promise<void>
}

export function ProductFormModal({
  isOpen,
  vendorId,
  categories,
  editingProduct,
  isSubmitting,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [displayOrder, setDisplayOrder] = useState('0')
  const [isAvailable, setIsAvailable] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false)

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name)
      setCategoryId(editingProduct.category_id || '')
      setPrice(editingProduct.price.toString())
      setDescription(editingProduct.description || '')
      setImageUrl(editingProduct.image_url || '')
      setDisplayOrder(editingProduct.display_order.toString())
      setIsAvailable(editingProduct.is_available)
    } else {
      setName('')
      setCategoryId(categories[0]?.id || '')
      setPrice('')
      setDescription('')
      setImageUrl('')
      setDisplayOrder('0')
      setIsAvailable(true)
    }
    setError(null)
    setImagePreviewFailed(false)
  }, [editingProduct, categories, isOpen])

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return true
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Product name is required.')
      return
    }

    const numPrice = parseFloat(price)
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please provide a valid price (must be 0 or greater).')
      return
    }

    if (imageUrl.trim() && !isValidUrl(imageUrl)) {
      setError('Please enter a valid HTTP/HTTPS image URL or leave empty.')
      return
    }

    const orderNum = parseInt(displayOrder, 10)
    const validOrder = isNaN(orderNum) ? 0 : orderNum

    try {
      setError(null)
      if (editingProduct) {
        await onSubmit({
          name: trimmedName,
          category_id: categoryId || null,
          price: numPrice,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          is_available: isAvailable,
          display_order: validOrder,
        })
      } else {
        await onSubmit({
          vendor_id: vendorId,
          name: trimmedName,
          category_id: categoryId || null,
          price: numPrice,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          is_available: isAvailable,
          display_order: validOrder,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-h4 font-bold text-text-primary">
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-3 text-body-small text-status-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="product-name" className="text-label font-semibold text-text-primary">
              Product / Item Name <span className="text-status-error">*</span>
            </Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Party Jollof Rice, Fresh Tomatoes (1kg)"
              className="mt-1"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="product-category" className="text-label font-semibold text-text-primary">
                Category
              </Label>
              <Select
                value={categoryId || 'none'}
                onValueChange={(val) => setCategoryId(val === 'none' ? '' : val)}
              >
                <SelectTrigger
                  id="product-category"
                  className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 py-2 text-body-small focus-visible:ring-primary"
                >
                  <SelectValue placeholder="No Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} {cat.service_type ? `(${cat.service_type.toUpperCase()})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="product-price" className="text-label font-semibold text-text-primary">
                Price (₦ NGN) <span className="text-status-error">*</span>
              </Label>
              <Input
                id="product-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="2500"
                min="0"
                step="0.01"
                className="mt-1"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="product-description" className="text-label font-semibold text-text-primary">
              Description (Optional)
            </Label>
            <Textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Portion size, ingredients, special details…"
              className="mt-1 resize-none"
              rows={2}
            />
          </div>

          {/* Image URL & Live Preview */}
          <div>
            <Label htmlFor="product-image" className="text-label font-semibold text-text-primary">
              Image URL (Optional)
            </Label>
            <Input
              id="product-image"
              type="url"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value)
                setImagePreviewFailed(false)
              }}
              placeholder="https://example.com/image.jpg"
              className="mt-1"
            />

            {imageUrl.trim() && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-page-background p-2.5">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-dark-surface">
                  {!imagePreviewFailed ? (
                    <img
                      src={imageUrl}
                      alt="Product preview"
                      className="h-full w-full object-cover"
                      onError={() => setImagePreviewFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-muted">
                      <ImageIcon className="h-6 w-6" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-semibold text-text-primary">
                    {imagePreviewFailed ? 'Image load failed (URL unreachable)' : 'Live Image Preview'}
                  </p>
                  <p className="truncate text-caption text-text-secondary">{imageUrl}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="product-display-order" className="text-label font-semibold text-text-primary">
                Display Order
              </Label>
              <Input
                id="product-display-order"
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
                  id="product-availability"
                  checked={isAvailable}
                  onCheckedChange={setIsAvailable}
                />
                <Label htmlFor="product-availability" className="cursor-pointer text-body-small font-medium text-text-primary">
                  {isAvailable ? 'In Stock (Available)' : 'Out of Stock'}
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
              {isSubmitting ? 'Saving…' : editingProduct ? 'Save Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
