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
  HelpCircle,
  Building2,
  MoreHorizontal,
  X,
  ChevronRight,
  Camera,
  Sparkles,
  Copy,
  Check,
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
import { CustomerSupportTab } from '@/components/customer/customer-support-tab'
import { CustomerCorporateTab } from '@/components/customer/customer-corporate-tab'
import { OrderReviewModal } from '@/components/customer/order-review-modal'
import { CustomerOrderCard } from '@/components/customer/customer-order-card'
import { CancelOrderModal } from '@/components/customer/cancel-order-modal'
import { QuickReorderBar } from '@/components/customer/quick-reorder-bar'
import { OrderCardSkeleton } from '@/components/ui/skeletons'
import { getOrderReview, fetchCustomerReviews } from '@/services/supabase/reviews'
import { KingdomAvatar } from '@/components/common/kingdom-avatar'
import { AvatarPickerModal } from '@/components/common/avatar-picker-modal'

type CustomerTab = 'orders' | 'corporate' | 'addresses' | 'profile' | 'rewards' | 'notifications' | 'settings' | 'support'

interface CustomerOrderSummary {
  id: string
  customer_id: string
  vendor_id?: string | null
  service_type: 'food' | 'grocery' | 'courier'
  status: string
  subtotal: number
  delivery_fee: number
  service_fee?: number
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

const PRIMARY_NAV_ITEMS: { id: CustomerTab; icon: typeof ShoppingBag; label: string }[] = [
  { id: 'orders', icon: ShoppingBag, label: 'Orders' },
  { id: 'corporate', icon: Building2, label: 'Corporate' },
  { id: 'addresses', icon: MapPin, label: 'Addresses' },
  { id: 'profile', icon: User, label: 'Profile' },
]

const SECONDARY_NAV_ITEMS: { id: CustomerTab; icon: typeof Gift; label: string; description: string }[] = [
  { id: 'rewards', icon: Gift, label: 'Rewards', description: 'Loyalty points & referral bonuses' },
  { id: 'notifications', icon: Bell, label: 'Notifications', description: 'Order updates and system alerts' },
  { id: 'support', icon: HelpCircle, label: 'Support', description: 'Help desk & ticket assistance' },
  { id: 'settings', icon: Settings, label: 'Settings', description: 'Preferences & account security' },
]

const NAV_ITEMS: { id: CustomerTab; icon: typeof ShoppingBag; label: string }[] = [
  ...PRIMARY_NAV_ITEMS,
  ...SECONDARY_NAV_ITEMS.map((item) => ({ id: item.id, icon: item.icon as typeof ShoppingBag, label: item.label })),
]

const VALID_CUSTOMER_TABS: CustomerTab[] = [
  'orders',
  'corporate',
  'addresses',
  'profile',
  'rewards',
  'notifications',
  'settings',
  'support',
]

const CUSTOMER_TAB_STORAGE_KEY = 'kingdomdash_customer_active_tab'

function getInitialCustomerTab(searchParams: URLSearchParams): CustomerTab {
  const paramTab = searchParams.get('tab') as CustomerTab
  if (paramTab && VALID_CUSTOMER_TABS.includes(paramTab)) {
    return paramTab
  }
  try {
    const saved = localStorage.getItem(CUSTOMER_TAB_STORAGE_KEY) as CustomerTab
    if (saved && VALID_CUSTOMER_TABS.includes(saved)) {
      return saved
    }
  } catch {
    // Ignore storage issues in restricted environments
  }
  return 'profile'
}

function getTabTitle(tab: CustomerTab): string {
  switch (tab) {
    case 'profile':
      return 'Profile & Account Settings'
    case 'orders':
      return 'My Orders'
    case 'corporate':
      return 'Corporate Dispatch Portal'
    case 'addresses':
      return 'Saved Addresses'
    case 'rewards':
      return 'Rewards & Loyalty'
    case 'notifications':
      return 'Notifications & System Alerts'
    case 'support':
      return 'Support & Help Desk'
    case 'settings':
      return 'Preferences & Settings'
    default:
      return 'Customer Dashboard'
  }
}

export default function CustomerDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile, signOut } = useAuthStore()

  const [activeTab, setActiveTab] = useState<CustomerTab>(() => getInitialCustomerTab(searchParams))

  // Mobile More Sheet State
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const isMoreActive = ['rewards', 'notifications', 'support', 'settings'].includes(activeTab)

  // Close sheet on escape
  useEffect(() => {
    if (!isMoreOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMoreOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMoreOpen])

  // Sync activeTab with URL searchParams and localStorage
  useEffect(() => {
    const tabParam = searchParams.get('tab') as CustomerTab
    if (tabParam && VALID_CUSTOMER_TABS.includes(tabParam)) {
      setActiveTab(tabParam)
      try {
        localStorage.setItem(CUSTOMER_TAB_STORAGE_KEY, tabParam)
      } catch {
        // Ignore
      }
    } else {
      // If URL does not specify a tab, reflect the active or saved tab into the URL
      try {
        const saved = localStorage.getItem(CUSTOMER_TAB_STORAGE_KEY) as CustomerTab
        const targetTab = saved && VALID_CUSTOMER_TABS.includes(saved) ? saved : 'orders'
        if (targetTab !== 'orders') {
          setActiveTab(targetTab)
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (next.get('tab') !== targetTab) {
              next.set('tab', targetTab)
            }
            return next
          },
          { replace: true }
        )
      } catch {
        // Ignore
      }
    }
  }, [searchParams, setSearchParams])

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
              service_fee,
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

  const activeInTransitOrder = orders.find((o) =>
    [
      'payment_confirmed',
      'preparing',
      'ready',
      'ready_for_pickup',
      'picked_up',
      'in_transit',
      'delivering',
    ].includes(o.status)
  )

  // Profile editable state
  const [reviewingOrder, setReviewingOrder] = useState<CustomerOrderSummary | null>(null)
  const [reviewsVersion, setReviewsVersion] = useState(0)
  const [profileName, setProfileName] = useState(profile?.full_name || '')
  const [profilePhone, setProfilePhone] = useState(profile?.phone || '')
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false)
  const [hasCopiedRef, setHasCopiedRef] = useState(false)
  const [profileCity, setProfileCity] = useState((profile as any)?.city || 'Ijebu-Ode, Ogun State')
  const [profileCountry, setProfileCountry] = useState((profile as any)?.country || 'Nigeria')
  const [profileCoverage, setProfileCoverage] = useState((profile as any)?.delivery_coverage || 'Ijebu-Ode Metropolis & Campuses')
  const customerRefCode = `https://kingdomdash.com/order?ref=${profile?.id?.slice(0, 8) || 'kdash'}`

  const handleCopyRef = () => {
    navigator.clipboard.writeText(customerRefCode)
    setHasCopiedRef(true)
    setTimeout(() => setHasCopiedRef(false), 2500)
  }

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

  const handleSelectTab = useCallback(
    (id: CustomerTab) => {
      setActiveTab(id)
      setIsMoreOpen(false)
      try {
        localStorage.setItem(CUSTOMER_TAB_STORAGE_KEY, id)
      } catch {
        // Ignore
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (next.get('tab') !== id) {
            next.set('tab', id)
          }
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const totalOrdersCount = orders.length
  const deliveredOrdersCount = orders.filter((o) => o.status === 'delivered').length
  const activeOrdersCount = orders.filter((o) =>
    ['payment_confirmed', 'preparing', 'ready', 'ready_for_pickup', 'in_transit', 'delivering'].includes(o.status)
  ).length

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col">
      {/* 1. Full-Width Top Header */}
      <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-neutral-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-8">
        {/* Brand Logo & Section Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/KingdomDash-logo.jpg"
              alt="KingdomDash"
              className="h-8 w-auto rounded-lg object-contain shadow-xs shrink-0"
            />
            <div className="flex flex-col">
              <h1 className="sr-only">Customer Dashboard</h1>
              <div className="font-extrabold text-neutral-900 tracking-wide text-xs leading-tight group-hover:text-primary transition-colors">
                KINGDOM<span className="text-primary">DASH</span>
              </div>
              <div className="text-[9px] text-primary font-bold uppercase tracking-wider leading-none">
                Customer Dashboard
              </div>
            </div>
          </Link>
          <div className="hidden md:block h-4 w-px bg-neutral-200 mx-1" />
          <div className="hidden md:block text-sm font-bold text-neutral-700 truncate">
            {activeTab === 'profile' ? 'Profile & Account Settings' : getTabTitle(activeTab)}
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Notifications Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleSelectTab('notifications')}
            title="Notifications"
            aria-label="Notifications"
            className={`relative text-neutral-600 hover:text-neutral-900 h-9 w-9 rounded-xl transition-colors ${
              activeTab === 'notifications'
                ? 'bg-primary/10 text-primary font-bold ring-1 ring-primary/20'
                : 'hover:bg-neutral-100'
            }`}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
          </Button>

          {/* Public Website Link */}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 px-2.5 sm:px-3 text-xs font-semibold text-neutral-700 hover:text-primary rounded-xl"
          >
            <Link to="/" title="Back to Public Website">
              <Globe className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="hidden sm:inline">Website</span>
            </Link>
          </Button>

          {/* Profile Avatar Capsule */}
          {profile?.full_name && (
            <button
              type="button"
              onClick={() => handleSelectTab('profile')}
              className="hidden md:inline-flex items-center gap-2 px-2.5 py-1 rounded-xl hover:bg-neutral-100 text-xs font-semibold text-neutral-800 transition-colors cursor-pointer border border-transparent hover:border-neutral-200"
              title="Go to profile"
            >
              <KingdomAvatar
                avatarUrl={profile.avatar_url}
                name={profile.full_name}
                size="sm"
                role="customer"
                showBadge={false}
                className="h-7 w-7 ring-1 ring-neutral-200"
              />
              <span className="max-w-[120px] truncate font-bold text-neutral-900">{profile.full_name.split(' ')[0]}</span>
            </button>
          )}

          {/* Direct Sign out button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="text-neutral-500 hover:text-rose-600 hover:bg-rose-50 gap-1.5 h-8 px-2 sm:px-3 text-xs font-semibold rounded-xl shrink-0"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* 2. Full-Width Geometric Crimson KingdomDash Cover Banner (Edge-to-Edge) */}
      <div className="relative h-44 sm:h-52 lg:h-60 w-full overflow-hidden bg-gradient-to-r from-[#700818] via-[#9B1124] to-[#45030C] shadow-inner shrink-0">
        <svg
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-85"
          viewBox="0 0 1200 320"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="facet1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9B1124" />
              <stop offset="100%" stopColor="#6B0616" />
            </linearGradient>
            <linearGradient id="facet2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C41E3A" />
              <stop offset="100%" stopColor="#800A1A" />
            </linearGradient>
            <linearGradient id="facet3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E11D48" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#9B1124" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <polygon points="0,0 360,0 240,320 0,320" fill="url(#facet1)" />
          <polygon points="360,0 760,0 560,320 240,320" fill="url(#facet2)" />
          <polygon points="760,0 1200,0 980,320 560,320" fill="#750816" />
          <polygon points="980,320 1200,0 1200,320" fill="#4A040E" />
          <polygon points="240,320 560,320 420,130" fill="url(#facet3)" />
          <polygon points="560,320 980,320 780,120" fill="#B91C1C" fillOpacity="0.45" />
          <polygon points="360,0 580,150 760,0" fill="#F87171" fillOpacity="0.25" />
          <polygon points="140,0 420,130 240,320" fill="#4A040E" fillOpacity="0.4" />
        </svg>
        <div className="absolute inset-0 bg-radial-gradient from-white/10 to-transparent pointer-events-none" />

        <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-start justify-between pt-5 sm:pt-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-white/15 text-white/90 backdrop-blur-md border border-white/20 uppercase tracking-wider">
              Customer Portal
            </span>
            <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white mt-1.5 sm:mt-2 tracking-tight drop-shadow-xs">
              {activeTab === 'profile' ? 'Profile & Account Settings' : getTabTitle(activeTab)}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsAvatarPickerOpen(true)}
            className="gap-2 bg-black/35 hover:bg-black/55 text-white border-white/25 backdrop-blur-md rounded-xl text-xs font-semibold transition-all shadow-sm hover:scale-102 cursor-pointer shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Change Character</span>
          </Button>
        </div>
      </div>

      {/* 3. Main Content Area (Cards overlay the red cover banner by -mt-10 sm:-mt-14) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 sm:-mt-14 lg:-mt-16 pb-24 relative z-10">
        {/* Pending Application Banner */}
        {pendingApplication && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-white/95 backdrop-blur-md p-5 shadow-sm">
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

        {/* 12-Column Grid Aligning Sidebar with Profile Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Card 1: Desktop Navigation Sidebar Card (Sticky/Static on scroll) */}
          <aside aria-label="Customer dashboard sidebar" className="hidden lg:flex flex-col lg:col-span-3 bg-white rounded-2xl border border-neutral-200/90 shadow-md p-3.5 space-y-3 lg:sticky lg:top-20 lg:self-start z-20 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-none">
            <nav aria-label="Customer navigation menu" className="space-y-1">
              {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
                const isActive = activeTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectTab(id)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-neutral-500'}`} aria-hidden="true" />
                      <span>{label}</span>
                    </div>
                    {id === 'orders' && pendingOrdersCount > 0 && (
                      <span
                        className={`h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full text-[10px] font-black ${
                          isActive ? 'bg-white text-primary' : 'bg-primary text-white'
                        }`}
                      >
                        {pendingOrdersCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="pt-3 border-t border-neutral-100 space-y-1 bg-neutral-50/50 rounded-xl p-2">
              <Link
                to="/"
                title="Return to public storefront"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:text-primary hover:bg-neutral-100 transition-colors"
              >
                <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Public Portal</span>
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-rose-500" aria-hidden="true" />
                <span>Log Out</span>
              </button>
            </div>
          </aside>

          {/* Active Tab: Profile (Card 2: Identity + Card 3: Settings Form) */}
          {activeTab === 'profile' && (
            <>
              {/* Card 2: Profile Identity Card */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-neutral-200/90 shadow-md p-6 sm:p-7 flex flex-col items-center text-center space-y-4">
                {/* Circular Avatar with Camera/Sparkle */}
                <div
                  className="relative group cursor-pointer"
                  onClick={() => setIsAvatarPickerOpen(true)}
                  title="Click to customize your character avatar"
                >
                  <KingdomAvatar
                    size="2xl"
                    userId={profile?.id}
                    name={profile?.full_name}
                    avatarUrl={profile?.avatar_url}
                    role={profile?.role}
                    showBadge={false}
                    className="ring-4 ring-white shadow-xl hover:scale-105 transition-transform"
                  />
                  <button
                    type="button"
                    aria-label="Change character avatar"
                    className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md border-2 border-white hover:bg-primary-hover transition-transform cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsAvatarPickerOpen(true)
                    }}
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Name & Persona */}
                <div className="w-full">
                  <h2 className="text-lg font-bold text-neutral-900 leading-tight">
                    {profile?.full_name || 'Customer Test'}
                  </h2>
                  <p className="text-xs text-neutral-500 font-medium truncate max-w-[220px] mx-auto mt-1">
                    {profile?.email || 'customer@kingdomdash.com'}
                  </p>
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      Royal Persona • Ijebu-Ode
                    </span>
                  </div>
                </div>

                {/* Bordered Metrics Rows */}
                <div className="w-full divide-y divide-neutral-100 border-y border-neutral-100 text-xs">
                  <div className="py-3 flex items-center justify-between text-neutral-600">
                    <span className="font-medium">Total Orders Placed</span>
                    <span className="font-bold text-neutral-900 text-sm">{totalOrdersCount}</span>
                  </div>
                  <div className="py-3 flex items-center justify-between text-neutral-600">
                    <span className="font-medium">Completed Deliveries</span>
                    <span className="font-bold text-emerald-600 text-sm">{deliveredOrdersCount}</span>
                  </div>
                  <div className="py-3 flex items-center justify-between text-neutral-600">
                    <span className="font-medium">Active In Motion</span>
                    <span className="font-bold text-neutral-700 text-sm">{activeOrdersCount}</span>
                  </div>
                </div>

                {/* Direct Order Button */}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl border-neutral-200 hover:border-primary/50 text-neutral-800 hover:text-primary font-bold text-xs h-10 shadow-2xs"
                >
                  <Link to="/food" className="flex items-center justify-center gap-2">
                    <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                    <span>Order Food &amp; Groceries</span>
                  </Link>
                </Button>

                {/* Shareable Link Box */}
                <div className="w-full pt-1">
                  <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs">
                    <span className="truncate text-neutral-500 font-mono text-[11px] flex-1 text-left">
                      {customerRefCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRef}
                      title="Copy referral link"
                      className="ml-2 p-1 text-neutral-500 hover:text-primary transition-colors cursor-pointer shrink-0"
                    >
                      {hasCopiedRef ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {hasCopiedRef && (
                    <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                      Copied to clipboard!
                    </span>
                  )}
                </div>
              </div>

              {/* Card 3: Account Settings Form Card */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200/90 shadow-md overflow-hidden">
                {/* Horizontal Navigation Tabs */}
                <div className="flex items-center border-b border-neutral-200 px-6 sm:px-8 bg-white overflow-x-auto scrollbar-none">
                  <button
                    type="button"
                    className="py-4 px-2 text-xs font-bold border-b-2 border-primary text-primary transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Account Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('addresses')}
                    className="py-4 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Saved Addresses
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('orders')}
                    className="py-4 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Order History
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('settings')}
                    className="py-4 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Preferences
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('notifications')}
                    className="py-4 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Notifications
                  </button>
                </div>

                {/* Account Form Body */}
                <form onSubmit={handleSaveProfile} className="p-6 sm:p-8 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-full-name" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Full Name <span className="text-rose-600">*</span>
                      </Label>
                      <Input
                        id="profile-full-name"
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Customer Test"
                        required
                        className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="profile-phone" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Contact Phone Number
                      </Label>
                      <Input
                        id="profile-phone"
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+234 801 234 5678"
                        className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-email" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Registered Email Address
                      </Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={profile?.email || ''}
                        disabled
                        className="rounded-xl bg-neutral-50 border-neutral-200 text-neutral-500 text-xs h-10 px-3.5 shadow-2xs font-medium cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="profile-city" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                        City / Campus
                      </Label>
                      <Input
                        id="profile-city"
                        type="text"
                        value={profileCity}
                        onChange={(e) => setProfileCity(e.target.value)}
                        placeholder="Ijebu-Ode, Ogun State"
                        className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-country" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Country
                      </Label>
                      <Input
                        id="profile-country"
                        type="text"
                        value={profileCountry}
                        onChange={(e) => setProfileCountry(e.target.value)}
                        placeholder="Nigeria"
                        className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="profile-service-area" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Delivery Coverage
                      </Label>
                      <Input
                        id="profile-service-area"
                        type="text"
                        value={profileCoverage}
                        onChange={(e) => setProfileCoverage(e.target.value)}
                        placeholder="Ijebu-Ode Metropolis & Campuses"
                        className="rounded-xl bg-white border-neutral-200 focus:border-primary text-neutral-900 text-xs h-10 px-3.5 shadow-2xs font-medium"
                      />
                    </div>
                  </div>

                  {profileFeedback && (
                    <div
                      className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        profileFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                      role="alert"
                    >
                      {profileFeedback.type === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      )}
                      <span>{profileFeedback.message}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSavingProfile}
                      aria-label="Save Changes"
                      className="bg-primary hover:bg-primary-hover text-white font-bold px-7 h-10 rounded-xl shadow-xs transition-all gap-2 cursor-pointer"
                    >
                      {isSavingProfile ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* Active Tab: Other Views (Takes 9 columns on desktop) */}
          {activeTab !== 'profile' && (
            <div className="lg:col-span-9 space-y-6">
              {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-md p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">My Orders</h2>
        {pendingOrdersCount > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            {pendingOrdersCount} Awaiting Payment
          </span>
        )}
      </div>
      <p className="text-xs sm:text-sm text-neutral-500 mt-1">
        Track current meal and grocery deliveries, complete pending payments, or reorder past favorites.
      </p>
    </div>
    <div className="flex items-center gap-2.5 shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={loadCustomerOrders}
        disabled={isLoadingOrders}
        className="gap-1.5 text-neutral-700 h-9 text-xs rounded-xl"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin text-primary' : ''}`} />
        <span>Refresh</span>
      </Button>
      <Button asChild variant="primary" size="sm" className="font-bold text-white bg-primary hover:bg-primary-hover h-9 text-xs rounded-xl shadow-xs">
        <Link to="/food" className="text-white">Order Food</Link>
      </Button>
    </div>
  </div>

                {/* Active Order Hero Tracker Banner */}
                {activeInTransitOrder && (
                  <div
                    data-testid="active-order-hero-tracker"
                    className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-primary/5 p-5 sm:p-6 shadow-xs transition-all hover:shadow-md"
                  >
                    <div className="absolute top-0 right-0 -mt-6 -mr-6 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-xs">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                            </span>
                            <span>Live Order In Progress</span>
                          </span>
                          <span className="font-mono text-xs font-bold text-neutral-700 bg-neutral-200/70 px-2 py-0.5 rounded-md">
                            #{activeInTransitOrder.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                            <Clock className="h-3 w-3 text-emerald-600" />
                            <span>ETA ~15-25 mins</span>
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight">
                            {activeInTransitOrder.vendors?.business_name ||
                              (activeInTransitOrder.service_type === 'courier'
                                ? 'Express Courier Dispatch'
                                : 'KingdomDash Store')}
                          </h3>
                          <p className="text-xs text-neutral-600 line-clamp-1 mt-0.5">
                            Delivering to:{' '}
                            <span className="font-semibold text-neutral-800">
                              {activeInTransitOrder.delivery_address || 'Ijebu-Ode Destination'}
                            </span>
                          </p>
                        </div>

                        {activeInTransitOrder.order_items && activeInTransitOrder.order_items.length > 0 && (
                          <p className="text-xs text-neutral-500 line-clamp-1">
                            {activeInTransitOrder.order_items.slice(0, 2).map((item) => `${item.quantity}× ${item.product_name}`).join(', ')}
                            {activeInTransitOrder.order_items.length > 2
                              ? ` +${activeInTransitOrder.order_items.length - 2} more`
                              : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                        {activeInTransitOrder.delivery_pin && (
                          <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-3.5 py-1.5 border border-neutral-200 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                              Security PIN
                            </span>
                            <span className="font-mono text-xs font-black text-primary tracking-widest">
                              ••••••
                            </span>
                          </div>
                        )}

                        <Button
                          asChild
                          variant="primary"
                          size="sm"
                          className="font-bold text-white bg-primary hover:bg-primary-hover h-10 px-4 rounded-xl gap-2 shadow-xs"
                        >
                          <Link to={`/order/${activeInTransitOrder.id}/confirmation`}>
                            <span>Track on Live Radar</span>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1-Click Quick Reorder Bar */}
                <QuickReorderBar />

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
                  <div className="space-y-4" role="status" aria-label="Loading your orders">
                    <OrderCardSkeleton count={3} />
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

              {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-md p-5 sm:p-6 flex items-center justify-between gap-4">
    <div>
      <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">Saved Addresses</h2>
      <p className="text-xs sm:text-sm text-neutral-500 mt-1">
        Manage your home, office, and delivery pickup locations.
      </p>
    </div>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => handleSelectTab('settings')}
      className="gap-1.5 rounded-xl text-xs h-9"
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

              {/* Tab: Corporate Dispatch Portal */}
            {activeTab === 'corporate' && (
              <CustomerCorporateTab />
            )}

            {/* Tab: Rewards & Passes */}
            {activeTab === 'rewards' && (
              <CustomerRewardsTab
                userId={profile?.id || 'guest'}
                userName={profile?.full_name || profile?.email?.split('@')[0]}
              />
            )}

            {/* Tab: Support & Reference Tracking */}
            {activeTab === 'support' && (
              <CustomerSupportTab />
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
          )}
        </div>
      </main>

      {/* Backdrop overlay for Mobile More Menu */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 lg:hidden"
          aria-hidden="true"
          onClick={() => setIsMoreOpen(false)}
        />
      )}

      {/* Mobile More Menu Bottom Sheet */}
      {isMoreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More navigation options"
          id="mobile-more-menu"
          className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 mx-auto max-w-md px-4 pb-2 animate-in slide-in-from-bottom-4 duration-200 lg:hidden"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
            {/* Sheet Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-neutral-50/70">
              <span className="text-sm font-bold text-text-primary tracking-tight">More Dashboard Options</span>
              <button
                type="button"
                aria-label="Close more options menu"
                className="rounded-lg p-1.5 text-text-secondary hover:bg-neutral-200/60 hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setIsMoreOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Secondary Navigation List */}
            <nav aria-label="Secondary dashboard navigation" className="p-2 space-y-1">
              {SECONDARY_NAV_ITEMS.map(({ id, icon: Icon, label, description }) => {
                const isActive = activeTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectTab(id)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-text-primary hover:bg-neutral-100 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-neutral-100 text-text-secondary'
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-text-primary">{label}</span>
                        <span className="text-[11px] text-text-muted">{description}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  </button>
                )
              })}
            </nav>

            {/* Quick Actions (Sign Out / Website) */}
            <div className="border-t border-border p-2 bg-neutral-50/50 flex items-center justify-between gap-2">
              <Link
                to="/"
                onClick={() => setIsMoreOpen(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-border bg-white text-xs font-semibold text-text-secondary hover:text-primary transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Website</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false)
                  signOut()
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Navigation Bar (4 primary items + More) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-border bg-white px-2 py-1 shadow-lg lg:hidden"
        aria-label="Mobile bottom navigation"
      >
        {PRIMARY_NAV_ITEMS.map(({ id, icon: Icon, label }) => {
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

        {/* More Button */}
        <button
          type="button"
          aria-label="More navigation options"
          aria-expanded={isMoreOpen}
          onClick={() => setIsMoreOpen((prev) => !prev)}
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors ${
            isMoreActive
              ? 'text-primary font-bold'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <div className="relative">
            <MoreHorizontal className={`h-5 w-5 ${isMoreActive ? 'stroke-[2.5px]' : 'stroke-2'}`} aria-hidden="true" />
          </div>
          <span className="truncate max-w-[54px]">More</span>
        </button>
      </nav>

      {/* Royal Character Avatar Picker Modal */}
      <AvatarPickerModal
        open={isAvatarPickerOpen}
        onOpenChange={setIsAvatarPickerOpen}
      />
    </div>
  )
}
