import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  UtensilsCrossed,
  FolderTree,
  Store,
  LogOut,
  ExternalLink,
  Menu,
  X,
  ShoppingBag,
  Bell,
  Settings,
  Globe,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCurrentVendor } from '@/hooks/use-current-vendor'
import { VendorPendingView } from '@/components/vendor/vendor-pending-view'
import { VendorOverviewTab } from '@/components/vendor/vendor-overview-tab'
import { VendorOrdersList } from '@/components/vendor/VendorOrdersList'
import { VendorProductsTab } from '@/components/vendor/vendor-products-tab'
import { VendorCategoriesTab } from '@/components/vendor/vendor-categories-tab'
import { VendorProfileTab } from '@/components/vendor/vendor-profile-tab'
import { VendorSettingsTab } from '@/components/vendor/vendor-settings-tab'
import { VendorNotificationsTab } from '@/components/vendor/vendor-notifications-tab'
import { ProductFormModal } from '@/components/vendor/product-form-modal'
import { CategoryFormModal } from '@/components/vendor/category-form-modal'
import { DeleteConfirmDialog } from '@/components/vendor/delete-confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import {
  getVendorCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getReferenceCategories,
} from '@/services/supabase/categories'
import {
  getVendorProducts,
  createProduct,
  updateProduct,
  toggleProductAvailability,
  deleteProduct,
} from '@/services/supabase/products'
import { updateVendorProfile, getVendorServices } from '@/services/supabase/vendors'
import type {
  Category,
  CategoryInsert,
  CategoryUpdate,
  Product,
  ProductInsert,
  ProductUpdate,
  ReferenceCategory,
  VendorUpdate,
} from '@/types'

type TabType = 'overview' | 'orders' | 'products' | 'categories' | 'profile' | 'notifications' | 'settings'

const NAV_ITEMS: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders & Fulfillment', icon: ShoppingBag },
  { id: 'products', label: 'Products & Menu', icon: UtensilsCrossed },
  { id: 'categories', label: 'Categories', icon: FolderTree },
  { id: 'profile', label: 'Business Profile', icon: Store },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const VENDOR_MOBILE_NAV_ITEMS: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'products', label: 'Products', icon: UtensilsCrossed },
  { id: 'profile', label: 'Store', icon: Store },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const TAB_DESCRIPTIONS: Record<TabType, string> = {
  overview: 'Store analytics, stock health, and catalog performance overview',
  orders: 'Incoming orders, kitchen preparation, and courier fulfillment',
  products: 'Manage menu items, dish pricing, and stock availability',
  categories: 'Store taxonomy, dish sections, and menu organization',
  profile: 'Business storefront details, brand profile, and contact information',
  notifications: 'Platform alerts, customer order updates, and system logs',
  settings: 'Store configuration, fulfillment preferences, and security controls',
}

export default function VendorDashboardPage() {
  const [searchParams] = useSearchParams()
  const { vendor, isLoading: isVendorLoading, isPendingApproval, refreshVendor } = useCurrentVendor()
  const { signOut } = useAuthStore()

  const initialTab = (searchParams.get('tab') as TabType) || 'overview'
  const [activeTab, setActiveTab] = useState<TabType>(
    ['overview', 'orders', 'products', 'categories', 'profile', 'notifications', 'settings'].includes(initialTab)
      ? initialTab
      : 'overview'
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Data states
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [referenceCategories, setReferenceCategories] = useState<ReferenceCategory[]>([])
  const [vendorServices, setVendorServices] = useState<('food' | 'grocery')[]>([])
  const [isDataLoading, setIsDataLoading] = useState(false)

  // Modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    type: 'category' | 'product'
    item: Category | Product | null
  }>({
    isOpen: false,
    type: 'product',
    item: null,
  })
  const [isMutating, setIsMutating] = useState(false)

  // Load catalog data
  const loadCatalogData = useCallback(async (vendorId: string) => {
    setIsDataLoading(true)
    try {
      const [catRes, prodRes, refRes, srvRes] = await Promise.all([
        getVendorCategories(vendorId),
        getVendorProducts(vendorId),
        getReferenceCategories(),
        getVendorServices(vendorId),
      ])

      if (catRes.data) setCategories(catRes.data)
      if (prodRes.data) setProducts(prodRes.data)
      if (refRes.data) setReferenceCategories(refRes.data)
      if (srvRes && srvRes.length > 0) {
        setVendorServices(srvRes)
      } else if (vendor?.business_type === 'restaurant') {
        setVendorServices(['food'])
      } else if (vendor?.business_type === 'grocery_store') {
        setVendorServices(['grocery'])
      }
    } finally {
      setIsDataLoading(false)
    }
  }, [vendor?.business_type])

  useEffect(() => {
    if (vendor && !isPendingApproval) {
      loadCatalogData(vendor.id)
    }
  }, [vendor, isPendingApproval, loadCatalogData])

  // ── Category Handlers ────────────────────────────────────────────────────────
  const handleSaveCategory = async (data: CategoryInsert | CategoryUpdate) => {
    if (!vendor) return
    setIsMutating(true)
    try {
      if (editingCategory) {
        const { data: updated } = await updateCategory(editingCategory.id, data as CategoryUpdate)
        if (updated) {
          setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        }
      } else {
        const { data: created } = await createCategory(data as CategoryInsert)
        if (created) {
          setCategories((prev) => [...prev, created])
        }
      }
      setCategoryModalOpen(false)
      setEditingCategory(null)
    } finally {
      setIsMutating(false)
    }
  }

  const handleToggleCategoryStatus = async (categoryId: string, newStatus: boolean) => {
    // Optimistic update
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, is_active: newStatus } : c))
    )
    try {
      await updateCategory(categoryId, { is_active: newStatus })
    } catch {
      // Revert on error
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, is_active: !newStatus } : c))
      )
    }
  }

  const handleConfirmDeleteCategory = async () => {
    if (!deleteDialog.item || deleteDialog.type !== 'category') return
    setIsMutating(true)
    try {
      await deleteCategory(deleteDialog.item.id)
      setCategories((prev) => prev.filter((c) => c.id !== deleteDialog.item?.id))
      // Unlink category on locally cached products
      setProducts((prev) =>
        prev.map((p) => (p.category_id === deleteDialog.item?.id ? { ...p, category_id: null } : p))
      )
      setDeleteDialog({ isOpen: false, type: 'category', item: null })
    } finally {
      setIsMutating(false)
    }
  }

  // ── Product Handlers ─────────────────────────────────────────────────────────
  const handleSaveProduct = async (data: ProductInsert | ProductUpdate) => {
    if (!vendor) return
    setIsMutating(true)
    try {
      if (editingProduct) {
        const { data: updated } = await updateProduct(editingProduct.id, data as ProductUpdate)
        if (updated) {
          setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        }
      } else {
        const { data: created } = await createProduct(data as ProductInsert)
        if (created) {
          setProducts((prev) => [created, ...prev])
        }
      }
      setProductModalOpen(false)
      setEditingProduct(null)
    } finally {
      setIsMutating(false)
    }
  }

  const handleToggleProductAvailability = async (productId: string, newStatus: boolean) => {
    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, is_available: newStatus } : p))
    )
    try {
      await toggleProductAvailability(productId, newStatus)
    } catch {
      // Revert on error
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_available: !newStatus } : p))
      )
    }
  }

  const handleConfirmDeleteProduct = async () => {
    if (!deleteDialog.item || deleteDialog.type !== 'product') return
    setIsMutating(true)
    try {
      await deleteProduct(deleteDialog.item.id)
      setProducts((prev) => prev.filter((p) => p.id !== deleteDialog.item?.id))
      setDeleteDialog({ isOpen: false, type: 'product', item: null })
    } finally {
      setIsMutating(false)
    }
  }

  // ── Profile Handlers ─────────────────────────────────────────────────────────
  const handleUpdateProfile = async (updates: VendorUpdate) => {
    if (!vendor) return
    setIsMutating(true)
    try {
      const { data: updated, error } = await updateVendorProfile(vendor.id, updates)
      if (error) {
        const errorMsg = error instanceof Error ? error.message : (error as { message?: string }).message || 'Failed to update vendor profile'
        throw new Error(errorMsg)
      }
      if (updated) {
        await refreshVendor()
      }
    } finally {
      setIsMutating(false)
    }
  }

  // ── Loading & Pending States ─────────────────────────────────────────────────
  if (isVendorLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
          <span className="text-body-small text-text-secondary">Loading vendor portal…</span>
        </div>
      </div>
    )
  }

  if (isPendingApproval || !vendor) {
    return (
      <div className="min-h-screen bg-page-background">
        <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-label font-bold text-text-primary">KingdomDash</span>
            <span className="text-caption font-semibold text-text-muted">Vendor Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 px-2.5 sm:px-3 text-xs font-semibold text-text-secondary hover:text-primary"
            >
              <Link to="/" title="Back to Public Website">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Website</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </Button>
          </div>
        </header>
        <VendorPendingView onRefresh={refreshVendor} isLoading={isVendorLoading} />
      </div>
    )
  }

  const publicStorePath =
    vendor.business_type === 'restaurant' ? `/food/${vendor.id}` : `/groceries/${vendor.id}`

  return (
    <div className="flex h-screen overflow-hidden bg-page-background">
      {/* ── Desktop Sidebar ──────────────────────────────────────────────────── */}
      {/* ── Desktop Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className="
          hidden lg:flex lg:flex-col
          shrink-0 h-screen
          border-r border-border bg-white
          w-64
        "
        aria-label="Vendor dashboard sidebar"
      >
        {/* Brand Header - FIXED */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-4 shrink-0 bg-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-primary/10 border border-primary/20 shrink-0 p-1">
            {vendor.logo_url ? (
              <img
                src={vendor.logo_url}
                alt={vendor.business_name}
                className="h-full w-full object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = '/KingdomDash-emblem-clean.png'
                }}
              />
            ) : (
              <img
                src="/KingdomDash-emblem-clean.png"
                alt="KingdomDash"
                className="h-7 w-7 object-contain"
              />
            )}
          </div>
          <div className="overflow-hidden min-w-0 flex-1">
            <div className="font-bold text-text-primary text-sm truncate">{vendor.business_name}</div>
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider">Vendor Portal</div>
          </div>
        </div>

        {/* Store status card - FIXED */}
        <div className="p-3 mx-3 my-2.5 rounded-xl bg-page-background border border-border/80 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  vendor.is_active ? 'bg-status-success animate-pulse' : 'bg-amber-400'
                }`}
                aria-hidden="true"
              />
              <span className="text-caption font-semibold text-text-primary truncate">
                {vendor.is_active ? 'Store Active' : 'Store Paused'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold text-text-secondary px-2 py-0.5 rounded-md bg-white border border-border shrink-0">
              {vendor.business_type === 'restaurant' ? 'Restaurant' : 'Grocery'}
            </span>
          </div>
        </div>

        {/* Navigation - SCROLLABLE ONLY */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-1 space-y-1" aria-label="Vendor dashboard navigation">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Store Operations
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-body-small font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text-secondary hover:bg-page-background hover:text-text-primary'
                  }`}
                  title={label}
                >
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-white' : 'text-text-muted'}`}
                    aria-hidden="true"
                  />
                  <span className="truncate flex-1 text-left">{label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Actions - FIXED AT BOTTOM */}
        <div className="border-t border-border p-3 shrink-0 space-y-1 bg-white">
          <div className="px-3 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Quick Links
          </div>
          <Link
            to="/"
            title="Back to Public Website"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-body-small font-semibold text-text-secondary hover:bg-page-background hover:text-primary transition-colors"
          >
            <Globe className="h-4.5 w-4.5 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate">Public Website</span>
          </Link>
          <Link
            to={publicStorePath}
            target="_blank"
            rel="noopener noreferrer"
            title="Preview Store"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-body-small font-semibold text-text-muted hover:bg-page-background hover:text-text-primary transition-colors"
          >
            <ExternalLink className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Preview Store</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            title="Sign Out"
            className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-body-small font-semibold text-text-muted hover:bg-error/10 hover:text-error transition-colors"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        {/* Top Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white/95 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-xl p-2 text-text-secondary hover:bg-page-background lg:hidden shrink-0 border border-border"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-text-primary truncate">
                {NAV_ITEMS.find((item) => item.id === activeTab)?.label}
              </h1>
              <p className="hidden md:block text-[11px] text-text-secondary truncate">
                {TAB_DESCRIPTIONS[activeTab]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Badge
              variant={vendor.is_active ? 'success' : 'warning'}
              className="hidden sm:inline-flex gap-1.5 px-2.5 py-1 text-caption font-semibold"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  vendor.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {vendor.is_active ? 'Store Active' : 'Paused'}
            </Badge>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('notifications')}
              title="Store Notifications"
              aria-label="Notifications"
              className={`rounded-xl text-text-muted hover:text-text-primary ${
                activeTab === 'notifications' ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              <Bell className="h-4.5 w-4.5" aria-hidden="true" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('settings')}
              title="Store Settings"
              aria-label="Settings"
              className={`hidden sm:inline-flex rounded-xl text-text-muted hover:text-text-primary ${
                activeTab === 'settings' ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              <Settings className="h-4.5 w-4.5" aria-hidden="true" />
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 px-2.5 sm:px-3 text-xs font-semibold text-text-secondary hover:text-primary rounded-xl shrink-0"
            >
              <Link to="/" title="Back to Public Website">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>Website</span>
              </Link>
            </Button>

            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex gap-1.5 text-caption font-semibold rounded-xl">
              <Link to={publicStorePath} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Preview Store
              </Link>
            </Button>
          </div>
        </header>

        {/* Main Scrollable View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
          <div className="mx-auto max-w-6xl">
            {activeTab === 'overview' && (
              <VendorOverviewTab
                vendor={vendor}
                vendorServices={vendorServices}
                products={products}
                categories={categories}
                onNavigateToProducts={() => setActiveTab('products')}
                onNavigateToCategories={() => setActiveTab('categories')}
                onOpenAddProduct={() => {
                  setEditingProduct(null)
                  setProductModalOpen(true)
                }}
                onOpenAddCategory={() => {
                  setEditingCategory(null)
                  setCategoryModalOpen(true)
                }}
              />
            )}

            {activeTab === 'orders' && (
              <VendorOrdersList vendorId={vendor.id} />
            )}

            {activeTab === 'products' && (
              <VendorProductsTab
                products={products}
                categories={categories}
                isLoading={isDataLoading}
                onAddProduct={() => {
                  setEditingProduct(null)
                  setProductModalOpen(true)
                }}
                onEditProduct={(product) => {
                  setEditingProduct(product)
                  setProductModalOpen(true)
                }}
                onDeleteProduct={(product) => {
                  setDeleteDialog({
                    isOpen: true,
                    type: 'product',
                    item: product,
                  })
                }}
                onToggleAvailability={handleToggleProductAvailability}
              />
            )}

            {activeTab === 'categories' && (
              <VendorCategoriesTab
                categories={categories}
                products={products}
                isLoading={isDataLoading}
                onAddCategory={() => {
                  setEditingCategory(null)
                  setCategoryModalOpen(true)
                }}
                onEditCategory={(category) => {
                  setEditingCategory(category)
                  setCategoryModalOpen(true)
                }}
                onDeleteCategory={(category) => {
                  setDeleteDialog({
                    isOpen: true,
                    type: 'category',
                    item: category,
                  })
                }}
                onToggleCategoryStatus={handleToggleCategoryStatus}
              />
            )}

            {activeTab === 'profile' && (
              <VendorProfileTab
                vendor={vendor}
                isSaving={isMutating}
                onUpdateProfile={handleUpdateProfile}
              />
            )}

            {activeTab === 'notifications' && (
              <VendorNotificationsTab
                vendor={vendor}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'settings' && (
              <VendorSettingsTab
                vendor={vendor}
                onUpdateVendor={handleUpdateProfile}
                isMutating={isMutating}
              />
            )}
          </div>
        </main>
      </div>

      {/* ── Mobile Sticky Bottom Navigation Bar ─────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-white/95 backdrop-blur-md px-2 py-1 shadow-lg lg:hidden"
        aria-label="Vendor mobile bottom navigation"
      >
        {VENDOR_MOBILE_NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Mobile Drawer Navigation ─────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex w-72 max-w-[85%] flex-col bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-primary/10 border border-primary/20 shrink-0 p-1">
                  {vendor.logo_url ? (
                    <img
                      src={vendor.logo_url}
                      alt={vendor.business_name}
                      className="h-full w-full object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = '/KingdomDash-emblem-clean.png'
                      }}
                    />
                  ) : (
                    <img
                      src="/KingdomDash-emblem-clean.png"
                      alt="KingdomDash"
                      className="h-7 w-7 object-contain"
                    />
                  )}
                </div>
                <div>
                  <span className="text-body font-bold text-text-primary block truncate max-w-[140px]">
                    {vendor.business_name}
                  </span>
                  <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                    Vendor Portal
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-page-background hover:text-text-primary"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-1 flex-1 overflow-y-auto">
              <div className="px-2 pb-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Store Operations
              </div>
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveTab(id)
                      setMobileNavOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-body-small font-medium ${
                      isActive
                        ? 'bg-primary text-white font-semibold shadow-xs'
                        : 'text-text-secondary hover:bg-page-background'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-auto border-t border-border pt-4 space-y-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2.5 text-text-secondary hover:text-primary rounded-xl"
              >
                <Link to="/" onClick={() => setMobileNavOpen(false)}>
                  <Globe className="h-4 w-4 text-primary" />
                  Public Website
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2.5 text-text-muted hover:text-text-primary rounded-xl"
              >
                <Link to={publicStorePath} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Preview Store
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="w-full justify-start gap-2.5 text-text-muted hover:bg-error/10 hover:text-error rounded-xl"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialogs / Modals ─────────────────────────────────────────────────── */}
      <ProductFormModal
        isOpen={productModalOpen}
        vendorId={vendor.id}
        categories={categories}
        editingProduct={editingProduct}
        isSubmitting={isMutating}
        onClose={() => {
          setProductModalOpen(false)
          setEditingProduct(null)
        }}
        onSubmit={handleSaveProduct}
      />

      <CategoryFormModal
        isOpen={categoryModalOpen}
        vendorId={vendor.id}
        editingCategory={editingCategory}
        referenceCategories={referenceCategories}
        vendorServices={vendorServices}
        isSubmitting={isMutating}
        onClose={() => {
          setCategoryModalOpen(false)
          setEditingCategory(null)
        }}
        onSubmit={handleSaveCategory}
      />

      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        title={deleteDialog.type === 'category' ? 'Delete Category' : 'Delete Product'}
        description={`Are you sure you want to delete "${deleteDialog.item?.name}"? This action cannot be undone.`}
        warning={
          deleteDialog.type === 'category' &&
          products.filter((p) => p.category_id === deleteDialog.item?.id).length > 0
            ? `There are ${
                products.filter((p) => p.category_id === deleteDialog.item?.id).length
              } products in this category. They will become uncategorized.`
            : undefined
        }
        isDeleting={isMutating}
        onClose={() => setDeleteDialog({ isOpen: false, type: 'product', item: null })}
        onConfirm={
          deleteDialog.type === 'category'
            ? handleConfirmDeleteCategory
            : handleConfirmDeleteProduct
        }
      />
    </div>
  )
}
