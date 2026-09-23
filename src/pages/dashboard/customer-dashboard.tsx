import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingBag,
  MapPin,
  User,
  Settings,
  Bell,
  Clock,
  ArrowRight,
  Bike,
  Store,
  LogOut,
  PackageCheck,
  Plus,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Globe,
  Gift,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/services/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CustomerSettingsTab } from '@/components/customer/customer-settings-tab'
import { CustomerNotificationsTab } from '@/components/customer/customer-notifications-tab'
import { CustomerRewardsTab } from '@/components/customer/customer-rewards-tab'
import { OrderReviewModal } from '@/components/customer/order-review-modal'
import { CustomerOrderCard } from '@/components/customer/customer-order-card'
import { CancelOrderModal } from '@/components/customer/cancel-order-modal'
import { getOrderReview, fetchCustomerReviews } from '@/services/supabase/reviews'

type CustomerTab = 'orders' | 'addresses' | 'profile' | 'rewards' | 'notifications' | 'settings'

interface CustomerOrderSummary {
  id: string
  customer_id: string
  vendor_id?: string | null
  service_type: 'food' | 'grocery' | 'courier'
  status: string
  subtotal: number
  delivery_fee: number
  total: number
  delivery_pin?: string | null
  pickup_address?: string
  delivery_address?: string
  created_at: string
  vendors?: {
    id?: string
    business_name?: string
  } | null
  order_items?: Array<{
    id: string
    product_name: string
    quantity: number
    unit_price: number
    line_total: number
  }>
}

const NAV_ITEMS: { id: CustomerTab; icon: typeof ShoppingBag; label: string }[] = [
  { id: 'orders', icon: ShoppingBag, label: 'Orders' },
  { id: 'addresses', icon: MapPin, label: 'Addresses' },
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'rewards', icon: Gift, label: 'Rewards' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function CustomerDashboardPage() {
  const [searchParams] = useSearchParams()
  const { profile, signOut } = useAuthStore()

  const initialTab = (searchParams.get('tab') as CustomerTab) || 'orders'
  const [activeTab, setActiveTab] = useState<CustomerTab>(
    ['orders', 'addresses', 'profile', 'rewards', 'notifications', 'settings'].includes(initialTab)
      ? initialTab
      : 'orders'
  )

  useEffect(() => {
    const tabParam = searchParams.get('tab') as CustomerTab
    if (tabParam && ['orders', 'addresses', 'profile', 'rewards', 'notifications', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Orders management state
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cancellingOrder, setCancellingOrder] = useState<any | null>(null)

  const loadCustomerOrders = useCallback(async () => {
    if (!profile?.id) return
    try {
      setIsLoadingOrders(true)
      setOrdersError(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any

      // 10s timeout safety promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Orders request timed out. Please try again.')), 10000)
      )

      const fetchOrders = async () => {
        try {
          const query = db
            .from('orders')
            .select(`
              id,
              customer_id,
              vendor_id,
              service_type,
              status,
              subtotal,
              delivery_fee,
              total,
              pickup_address,
              delivery_address,
              delivery_pin,
              cancellation_reason,
              refund_required,
              refund_status,
              delivery_contact,
              delivery_phone,
              created_at,
              vendors ( id, business_name ),
              order_items ( id, product_name, quantity, unit_price, line_total )
            `)
            .eq('customer_id', profile.id)

          const res = typeof query?.order === 'function'
            ? await query.order('created_at', { ascending: false })
            : await query

          if (!res?.error && res?.data) {
            return res.data
          }
          // If join query returned an error, fallback to direct query
          console.warn('[CustomerDashboard] Complex order join failed, falling back to direct table select:', res?.error)
        } catch (innerErr) {
          console.warn('[CustomerDashboard] Join query exception, trying fallback:', innerErr)
        }

        // Direct fallback query without joins
        const fallbackRes = await db
          .from('orders')
          .select('*')
          .eq('customer_id', profile.id)
          .order('created_at', { ascending: false })

        if (fallbackRes?.error) throw fallbackRes.error
        return fallbackRes?.data || []
      }

      const data = await Promise.race([fetchOrders(), timeoutPromise])
      setOrders((data as unknown as CustomerOrderSummary[]) || [])

      if (profile?.id) {
        void fetchCustomerReviews(profile.id).then(() => {
          setReviewsVersion((v) => v + 1)
        })
      }
    } catch (err) {
      console.error('[CustomerDashboard] Failed to load orders:', err)
      setOrdersError(err instanceof Error ? err.message : 'Unable to load orders')
    } finally {
      setIsLoadingOrders(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (profile?.id) {
      loadCustomerOrders()
    }
  }, [profile?.id, loadCustomerOrders])

  const pendingOrdersCount = orders.filter(
    (o) => o.status === 'pending' || o.status === 'placed'
  ).length

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'pending') {
      return o.status === 'pending' || o.status === 'placed'
    }
    if (orderFilter === 'active') {
      return [
        'payment_confirmed',
        'preparing',
        'ready',
        'ready_for_pickup',
        'in_transit',
        'delivering',
      ].includes(o.status)
    }
    if (orderFilter === 'completed') {
      return o.status === 'delivered' || o.status === 'cancelled'
    }
    return true
  })

  // Profile editable state
  const [reviewingOrder, setReviewingOrder] = useState<CustomerOrderSummary | null>(null)
  const [reviewsVersion, setReviewsVersion] = useState(0)
  const [profileName, setProfileName] = useState(profile?.full_name || '')
  const [profilePhone, setProfilePhone] = useState(profile?.phone || '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileFeedback, setProfileFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    if (profile) {
      setProfileName(profile.full_name || '')
      setProfilePhone(profile.phone || '')
    }
  }, [profile])

  const [pendingApplication, setPendingApplication] = useState<{
    type: 'rider' | 'vendor'
    status: string
  } | null>(null)

  useEffect(() => {
    let isMounted = true
    async function checkPendingApplications() {
      if (!profile) return
      try {
        // Scaffold compatibility: cast untyped supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any
        const [riderRes, vendorRes] = await Promise.all([
          db
            .from('rider_applications')
            .select('status')
            .eq('profile_id', profile.id)
            .eq('status', 'pending')
            .maybeSingle(),
          db
            .from('vendor_applications')
            .select('status')
            .eq('profile_id', profile.id)
            .eq('status', 'pending')
            .maybeSingle(),
        ])

        if (!isMounted) return

        if (riderRes.data) {
          setPendingApplication({ type: 'rider', status: riderRes.data.status })
        } else if (vendorRes.data) {
          setPendingApplication({ type: 'vendor', status: vendorRes.data.status })
        }
      } catch {
        // Silently ignore check failures on client
      }
    }

    checkPendingApplications()
    return () => {
      isMounted = false
    }
  }, [profile])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return

    if (!profileName.trim()) {
      setProfileFeedback({ type: 'error', message: 'Full name cannot be empty.' })
      return
    }

    setIsSavingProfile(true)
    setProfileFeedback(null)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileName.trim(),
          phone: profilePhone.trim(),
        })
        .eq('id', profile.id)

      if (error) throw error

      useAuthStore.setState({
        profile: {
          ...profile,
          full_name: profileName.trim(),
          phone: profilePhone.trim(),
        },
      })

      setProfileFeedback({ type: 'success', message: 'Profile details successfully updated.' })
    } catch (err) {
      setProfileFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update profile.',
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSelectTab = (id: CustomerTab) => {
    setActiveTab(id)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-page-background">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-4 sm:px-6 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden group">
            <img
              src="/KingdomDash-logo.jpg"
              alt="KingdomDash"
              className="h-9 w-auto rounded-lg object-contain shadow-xs shrink-0"
            />
            <div className="truncate">
              <h1 className="sr-only">Customer Dashboard</h1>
              <div className="font-bold text-text-primary tracking-wide text-sm leading-tight group-hover:text-primary transition-colors">
                KINGDOM<span className="text-primary">DASH</span>
              </div>
              <div className="text-[10px] text-primary font-bold uppercase tracking-wider leading-tight">
                Customer
              </div>
            </div>
          </Link>
          <Badge variant="primary" className="text-caption hidden md:inline-flex capitalize shrink-0 ml-1">
            {NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Orders'}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleSelectTab('notifications')}
            title="Notifications"
            aria-label="Notifications"
            className={`text-text-muted hover:text-text-primary h-8 w-8 sm:h-9 sm:w-9 ${
              activeTab === 'notifications' ? 'bg-surface-muted text-primary' : ''
            }`}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 px-2 sm:px-3 text-xs font-semibold text-text-secondary hover:text-primary shrink-0"
          >
            <Link to="/" title="Back to Public Website">
              <Globe className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="hidden sm:inline">Website</span>
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-text-muted hover:text-primary gap-1.5 h-8 px-2 sm:px-3 text-xs font-semibold shrink-0"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>

          <Button asChild variant="primary" size="sm" className="hidden sm:inline-flex gap-1.5 h-8 text-xs font-bold text-white bg-primary hover:bg-primary-hover">
            <Link to="/food" className="text-white">
              Order Food
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Desktop Horizontal Tab Bar */}
      <nav aria-label="Customer dashboard tabs" className="hidden lg:flex items-center gap-1 border-b border-border bg-white px-6 py-2 shrink-0 z-10">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectTab(id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:bg-page-background hover:text-text-primary'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
              {id === 'orders' && pendingOrdersCount > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white text-primary' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {pendingOrdersCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 space-y-6">
          {/* Pending Application Banner */}
          {pendingApplication && (
            <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 mt-0.5">
                  {pendingApplication.type === 'rider' ? (
                    <Bike className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Store className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-body-large font-bold text-text-primary">
                      {pendingApplication.type === 'rider'
                        ? 'Rider Application Under Review'
                        : 'Vendor Application Under Review'}
                    </h2>
                    <Badge variant="warning" className="gap-1 text-caption">
                      <Clock className="h-3 w-3 animate-pulse" />
                      Pending Review
                    </Badge>
                  </div>
                  <p className="text-body-small text-text-secondary">
                    {pendingApplication.type === 'rider'
                      ? 'Your application to deliver with KingdomDash is awaiting verification. You can continue shopping as a customer in the meantime.'
                      : 'Your application to sell on KingdomDash is currently under review by our operations team.'}
                  </p>
                  <div className="mt-4">
                    <Button asChild variant="outline" size="sm" className="gap-1.5 bg-white">
                      <Link
                        to={
                          pendingApplication.type === 'rider'
                            ? '/onboarding/rider-pending'
                            : '/onboarding/vendor-pending'
                        }
                      >
                        View Application Status
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mx-auto max-w-4xl">
            {/* Tab: Orders */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-h3 font-bold text-text-primary">My Orders</h2>
                      {pendingOrdersCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-caption font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {pendingOrdersCount} Awaiting Payment
                        </span>
                      )}
                    </div>
                    <p className="text-body-small text-text-secondary">
                      Track current meal and grocery deliveries, complete pending payments, or reorder past favorites.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadCustomerOrders}
                      disabled={isLoadingOrders}
                      className="gap-1.5 text-text-secondary h-9 text-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin text-primary' : ''}`} />
                      <span>Refresh</span>
                    </Button>
                    <Button asChild variant="primary" size="sm" className="font-bold text-white bg-primary hover:bg-primary-hover h-9 text-xs">
                      <Link to="/food" className="text-white">Order Food</Link>
                    </Button>
                  </div>
                </div>

                {/* Filter Tabs — responsive edge-to-edge scroll on mobile with shrink-0 pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
                  {[
                    { id: 'all', label: 'All Orders', count: orders.length },
                    { id: 'pending', label: 'Awaiting Payment', count: pendingOrdersCount },
                    {
                      id: 'active',
                      label: 'In Progress',
                      count: orders.filter((o) =>
                        [
                          'payment_confirmed',
                          'preparing',
                          'ready',
                          'ready_for_pickup',
                          'in_transit',
                          'delivering',
                        ].includes(o.status)
                      ).length,
                    },
                    {
                      id: 'completed',
                      label: 'Past Orders',
                      count: orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled').length,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOrderFilter(tab.id as 'all' | 'pending' | 'active' | 'completed')}
                      className={`shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                        orderFilter === tab.id
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          orderFilter === tab.id
                            ? 'bg-white/20 text-white'
                            : 'bg-surface-muted text-text-muted'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Loading state */}
                {isLoadingOrders && orders.length === 0 && (
                  <div className="py-16 text-center text-text-muted bg-white rounded-2xl border border-border">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-body-small font-semibold text-text-primary">Loading your orders...</p>
                    <p className="text-caption text-text-muted mt-1">Retrieving order history and current deliveries.</p>
                  </div>
                )}

                {/* Error state */}
                {ordersError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{ordersError}</span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={loadCustomerOrders} className="text-xs bg-white">
                      Try Again
                    </Button>
                  </div>
                )}

                {/* Empty State */}
                {!isLoadingOrders && filteredOrders.length === 0 && (
                  <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-xs">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-text-muted mb-4">
                      <PackageCheck className="h-7 w-7 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-body-large font-bold text-text-primary">
                      {orderFilter === 'pending'
                        ? 'No Pending Payments'
                        : orderFilter === 'active'
                        ? 'No Active Deliveries'
                        : 'No Orders Found'}
                    </h3>
                    <p className="text-body-small text-text-secondary max-w-md mx-auto mt-1 mb-6">
                      {orderFilter === 'all'
                        ? 'Craving something delicious? Choose from top local restaurants and grocery supermarkets across Ogun State.'
                        : 'Switch tabs or browse our restaurants and grocery partners to place a new order.'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button asChild variant="primary" size="sm" className="font-bold text-white bg-primary hover:bg-primary-hover">
                        <Link to="/food" className="text-white">Order Food</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/groceries">Shop Groceries</Link>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Orders List */}
                {!isLoadingOrders && filteredOrders.length > 0 && (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => {
                      void reviewsVersion
                      const existingReview = getOrderReview(order.id)
                      return (
                        <CustomerOrderCard
                          key={order.id}
                          order={order}
                          existingReview={existingReview}
                          onReviewClick={(ord) => setReviewingOrder(ord)}
                          onCancelClick={(ord) => setCancellingOrder(ord)}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Order Review Feedback Modal */}
                <OrderReviewModal
                  isOpen={!!reviewingOrder}
                  onClose={() => setReviewingOrder(null)}
                  orderId={reviewingOrder?.id || ''}
                  orderNumber={reviewingOrder ? reviewingOrder.id.slice(0, 8).toUpperCase() : ''}
                  customerId={profile?.id}
                  onReviewSubmitted={() => {
                    setReviewsVersion((v) => v + 1)
                  }}
                />

                {/* Order Cancellation Modal */}
                <CancelOrderModal
                  isOpen={!!cancellingOrder}
                  onClose={() => setCancellingOrder(null)}
                  orderId={cancellingOrder?.id || ''}
                  orderNumber={cancellingOrder ? cancellingOrder.id.slice(0, 8).toUpperCase() : ''}
                  isPaid={cancellingOrder?.status === 'payment_confirmed'}
                  onCancelled={() => {
                    loadCustomerOrders()
                  }}
                />
              </div>
            )}

            {/* Tab: Addresses */}
            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-h3 font-bold text-text-primary">Saved Addresses</h2>
                    <p className="text-body-small text-text-secondary">
                      Manage your home, office, and delivery pickup locations.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectTab('settings')}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Edit in Settings
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl border border-primary/30 bg-primary-soft/10 shadow-xs relative">
                    <Badge variant="primary" className="absolute top-4 right-4 text-caption">
                      Default Delivery
                    </Badge>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                      <span className="text-body font-bold text-text-primary">Home / Ijebu-Ode</span>
                    </div>
                    <p className="text-body-small text-text-secondary leading-relaxed">
                      Ijebu-Ode Central, Ogun State, Nigeria.
                    </p>
                    <span className="text-caption text-text-muted mt-3 block">
                      Instructions: Ring doorbell or call phone on arrival.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Profile */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-h3 font-bold text-text-primary">Customer Profile</h2>
                  <p className="text-body-small text-text-secondary">
                    Manage your personal details and contact information.
                  </p>
                </div>

                {profileFeedback && (
                  <div
                    className={`rounded-xl border p-4 text-body-small flex items-center gap-3 ${
                      profileFeedback.type === 'success'
                        ? 'border-status-success/20 bg-status-success/10 text-status-success'
                        : 'border-status-error/20 bg-status-error/10 text-status-error'
                    }`}
                    role="alert"
                  >
                    {profileFeedback.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 shrink-0" />
                    )}
                    <span>{profileFeedback.message}</span>
                  </div>
                )}

                {/* Identity Summary Card */}
                <div className="p-6 rounded-2xl border border-border bg-white shadow-xs">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary text-white font-bold text-h3 flex items-center justify-center shrink-0">
                      {(profile?.full_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-body-large font-bold text-text-primary truncate">
                        {profile?.full_name || 'Valued Customer'}
                      </h3>
                      <p className="text-body-small text-text-secondary truncate">{profile?.email}</p>
                      <Badge variant="success" className="mt-1.5">
                        Active Customer
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Editable Profile Form */}
                <div className="p-6 rounded-2xl border border-border bg-white shadow-xs">
                  <h3 className="text-body-large font-bold text-text-primary border-b border-border pb-4 mb-5">
                    Edit Personal Information
                  </h3>

                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="profile-full-name" className="font-semibold text-text-primary">
                          Full Name <span className="text-status-error">*</span>
                        </Label>
                        <Input
                          id="profile-full-name"
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="Your full name"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="profile-phone" className="font-semibold text-text-primary">
                          Contact Phone Number
                        </Label>
                        <Input
                          id="profile-phone"
                          type="tel"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          placeholder="+234 801 234 5678"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-email" className="font-semibold text-text-primary">
                        Registered Email Address
                      </Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={profile?.email || ''}
                        disabled
                        className="bg-light-surface text-text-muted"
                      />
                      <p className="text-caption text-text-muted">
                        Email is managed via your secure account credentials.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectTab('settings')}
                        className="gap-1.5 text-text-muted hover:text-text-primary"
                      >
                        <Settings className="h-4 w-4" aria-hidden="true" />
                        Manage Preferences in Settings
                      </Button>

                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={isSavingProfile}
                        className="gap-2 w-full sm:w-auto font-bold text-white bg-primary hover:bg-primary-hover"
                      >
                        <Save className="h-4 w-4" aria-hidden="true" />
                        {isSavingProfile ? 'Saving Changes…' : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Tab: Rewards & Passes */}
            {activeTab === 'rewards' && (
              <CustomerRewardsTab
                userId={profile?.id || 'guest'}
                userName={profile?.full_name || profile?.email?.split('@')[0]}
              />
            )}

            {/* Tab: Notifications */}
            {activeTab === 'notifications' && (
              <CustomerNotificationsTab />
            )}

            {/* Tab: Settings */}
            {activeTab === 'settings' && (
              <CustomerSettingsTab />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-white px-2 py-1 shadow-lg lg:hidden"
        aria-label="Mobile bottom navigation"
      >
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectTab(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} aria-hidden="true" />
                {id === 'orders' && pendingOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-white">
                    {pendingOrdersCount}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[54px]">{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
