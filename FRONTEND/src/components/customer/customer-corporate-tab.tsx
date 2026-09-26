import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Building2,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  Sparkles,
  PhoneCall,
  Package,
  FileText,
  Send,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  CreditCard,
  Layers,
  MapPin,
  Clock,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { useToast } from '@/hooks/use-toast'
import { formatNgn } from '@/utils/formatting'
import { generateWhatsAppLink } from '@/utils/whatsapp'
import { appConfig } from '@/config/app.config'
import {
  getUserCorporateLead,
  submitCorporateLeadInquiry,
  type CorporateLead,
} from '@/services/supabase/corporate'
import { createCourierOrderSecure, getOrdersByCustomer } from '@/services/supabase/orders'
import { IJEBU_ODE_CENTER } from '@/utils/geo'

interface RecipientItem {
  id: string
  recipientName: string
  recipientPhone: string
  deliveryAddress: string
  packageType: string
  notes: string
}

export function CustomerCorporateTab() {
  const { profile } = useAuthStore()
  const { pushToast } = useToast()

  const [lead, setLead] = useState<CorporateLead | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Form states for new application
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState(profile?.full_name || '')
  const [email, setEmail] = useState(profile?.email || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [address, setAddress] = useState('')
  const [businessType, setBusinessType] = useState('E-commerce & Retail')
  const [estimatedVolume, setEstimatedVolume] = useState('100 deliveries/mo')
  const [notes, setNotes] = useState('')

  // Corporate Dispatch Modal & Form State
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)
  const [dispatchMode, setDispatchMode] = useState<'single' | 'batch'>('single')
  const [pickupAddress, setPickupAddress] = useState('')
  const [senderContact, setSenderContact] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'monthly_invoice' | 'cash_on_pickup'>('monthly_invoice')
  
  const [recipients, setRecipients] = useState<RecipientItem[]>([
    {
      id: '1',
      recipientName: '',
      recipientPhone: '',
      deliveryAddress: '',
      packageType: 'Commercial Parcel',
      notes: '',
    },
  ])

  const [isCreatingDispatch, setIsCreatingDispatch] = useState(false)
  const [createdOrderIds, setCreatedOrderIds] = useState<string[]>([])
  const [dispatchSuccess, setDispatchSuccess] = useState(false)

  // Recent Corporate Orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recentCorporateOrders, setRecentCorporateOrders] = useState<any[]>([])
  const [isLoadingRecentOrders, setIsLoadingRecentOrders] = useState(false)

  const refreshLead = useCallback(async (showToast = false) => {
    if (!profile?.email && !profile?.phone) {
      setIsLoading(false)
      return
    }
    if (showToast) setIsRefreshing(true)
    const { data } = await getUserCorporateLead(profile?.email || '', profile?.phone || '')
    if (data) {
      setLead(data)
      if (showToast) {
        pushToast({
          variant: 'info',
          title: 'Status Refreshed',
          message: `Current Status: ${data.status.toUpperCase()}`,
        })
      }
    }
    setIsLoading(false)
    if (showToast) setIsRefreshing(false)
  }, [profile?.email, profile?.phone, pushToast])

  const loadCorporateOrders = useCallback(async () => {
    if (!profile?.id) return
    try {
      setIsLoadingRecentOrders(true)
      const res = await getOrdersByCustomer(profile.id)
      if (!res.error && Array.isArray(res.data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const corpOrders = (res.data as any[]).filter(
          (o) => o.service_type === 'courier' || o.special_instructions?.includes('CORPORATE')
        )
        setRecentCorporateOrders(corpOrders.slice(0, 10))
      }
    } catch (err) {
      console.warn('[CustomerCorporateTab] Failed to fetch corporate orders:', err)
    } finally {
      setIsLoadingRecentOrders(false)
    }
  }, [profile?.id])

  useEffect(() => {
    refreshLead()
    const interval = setInterval(() => {
      refreshLead()
    }, 8000)
    return () => clearInterval(interval)
  }, [refreshLead])

  useEffect(() => {
    if (lead?.status === 'onboarded') {
      loadCorporateOrders()
      setPickupAddress((prev) => prev || lead.address || '15 Folagbade Street, Ijebu-Ode')
      setSenderContact((prev) => prev || lead.contact_name || profile?.full_name || '')
      setSenderPhone((prev) => prev || lead.phone || profile?.phone || '')
    }
  }, [lead?.status, lead?.address, lead?.contact_name, lead?.phone, profile?.full_name, profile?.phone, loadCorporateOrders])

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()

    if (lead && ['pending', 'contacted', 'onboarded'].includes(lead.status)) {
      const statusMsg =
        lead.status === 'onboarded'
          ? 'Your corporate account is already approved and onboarded.'
          : `You already have an active application under review (${lead.status.toUpperCase()}). Please wait for admin approval.`
      pushToast({
        variant: 'warning',
        title: 'Active Application Exists',
        message: statusMsg,
      })
      return
    }

    if (!companyName.trim() || !contactName.trim() || !phone.trim()) {
      pushToast({
        variant: 'error',
        title: 'Missing Required Fields',
        message: 'Please fill in Company Name, Contact Name, and Phone Number.',
      })
      return
    }

    setIsSubmitting(true)
    const { data, error } = await submitCorporateLeadInquiry({
      company_name: companyName,
      contact_name: contactName,
      email: email || profile?.email || 'contact@business.com',
      phone: phone || profile?.phone || '',
      address: address || null,
      business_type: businessType,
      estimated_volume: estimatedVolume,
      notes: notes || null,
    })

    setIsSubmitting(false)

    if (error) {
      pushToast({
        variant: error.message.includes('already') ? 'warning' : 'error',
        title: error.message.includes('already') ? 'Active Application Exists' : 'Submission Error',
        message: error.message || 'Failed to submit corporate account request.',
      })
      return
    }

    if (data) {
      setLead(data)
      pushToast({
        variant: 'success',
        title: 'Application Received!',
        message: 'Your corporate account request has been submitted for admin approval.',
      })
    }
  }

  const handleWhatsAppDesk = () => {
    const text = `Hello KingdomDash Corporate Team, I am inquiring about my Corporate Dispatch Account (${lead?.company_name || 'My Business'}).`
    window.open(generateWhatsAppLink(text), '_blank', 'noopener,noreferrer')
  }

  // Recipient array handlers
  const addRecipientField = () => {
    setRecipients((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        recipientName: '',
        recipientPhone: '',
        deliveryAddress: '',
        packageType: 'Commercial Parcel',
        notes: '',
      },
    ])
  }

  const removeRecipientField = (id: string) => {
    if (recipients.length <= 1) return
    setRecipients((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRecipientField = (id: string, field: keyof RecipientItem, value: string) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  // Create Corporate Dispatch Orders
  const handleCreateCorporateDispatch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!profile?.id) {
      pushToast({
        variant: 'error',
        title: 'Authentication Required',
        message: 'You must be signed in to create corporate dispatch orders.',
      })
      return
    }

    if (!pickupAddress.trim() || !senderContact.trim() || !senderPhone.trim()) {
      pushToast({
        variant: 'error',
        title: 'Missing Pickup Details',
        message: 'Please complete the Pickup Address, Contact Person, and Phone Number.',
      })
      return
    }

    for (const [idx, r] of recipients.entries()) {
      if (!r.recipientName.trim() || !r.recipientPhone.trim() || !r.deliveryAddress.trim()) {
        pushToast({
          variant: 'error',
          title: `Recipient #${idx + 1} Incomplete`,
          message: 'Please provide Recipient Name, Phone Number, and Delivery Address.',
        })
        return
      }
    }

    setIsCreatingDispatch(true)
    const newOrderIds: string[] = []

    try {
      for (const [idx, r] of recipients.entries()) {
        const idempotencyKey = `corp-dispatch-${profile.id}-${Date.now()}-${idx}`
        const specialInstructions = `[CORPORATE DISPATCH - ${lead?.company_name || 'Business'}] Billing: ${
          paymentMethod === 'monthly_invoice' ? 'Consolidated Monthly Invoice' : 'Cash on Pickup'
        } | Package: ${r.packageType} | Rate: Flat ₦540 Tier | ${r.notes ? `Notes: ${r.notes}` : ''}`

        const res = await createCourierOrderSecure({
          pickupAddress: pickupAddress.trim(),
          pickupContact: `${lead?.company_name || 'Corp'}: ${senderContact.trim()}`,
          pickupPhone: senderPhone.trim(),
          pickupLat: IJEBU_ODE_CENTER.latitude,
          pickupLon: IJEBU_ODE_CENTER.longitude,
          deliveryAddress: r.deliveryAddress.trim(),
          deliveryContact: r.recipientName.trim(),
          deliveryPhone: r.recipientPhone.trim(),
          deliveryLat: IJEBU_ODE_CENTER.latitude,
          deliveryLon: IJEBU_ODE_CENTER.longitude,
          idempotencyKey,
          specialInstructions,
        })

        if (res.error) {
          const errMsg =
            typeof res.error === 'object' && res.error !== null && 'message' in res.error
              ? String((res.error as { message?: string }).message)
              : 'Failed to create courier dispatch order'
          throw new Error(`Recipient #${idx + 1} failed: ${errMsg}`)
        }

        if (res.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw = res.data as any
          const createdId = typeof raw === 'string' ? raw : raw?.order_id || raw?.id || null
          if (createdId) newOrderIds.push(createdId)
        }
      }

      if (newOrderIds.length === 0) {
        throw new Error('No dispatch orders were created. Please verify your details and try again.')
      }

      setCreatedOrderIds(newOrderIds)
      setDispatchSuccess(true)
      loadCorporateOrders()
      pushToast({
        variant: 'success',
        title: 'Corporate Dispatch Placed!',
        message: `${newOrderIds.length} enterprise parcel dispatch order${newOrderIds.length > 1 ? 's' : ''} successfully logged.`,
      })
    } catch (err) {
      console.error('[CustomerCorporateTab] Corporate Dispatch creation failed:', err)
      pushToast({
        variant: 'error',
        title: 'Dispatch Order Failed',
        message: err instanceof Error ? err.message : 'Unable to create corporate dispatch orders.',
      })
    } finally {
      setIsCreatingDispatch(false)
    }
  }

  const handleResetDispatchForm = () => {
    setDispatchSuccess(false)
    setCreatedOrderIds([])
    setRecipients([
      {
        id: String(Date.now()),
        recipientName: '',
        recipientPhone: '',
        deliveryAddress: '',
        packageType: 'Commercial Parcel',
        notes: '',
      },
    ])
    setIsDispatchModalOpen(false)
  }

  const handleSendWhatsAppNotification = () => {
    const idsText = createdOrderIds.map((id) => `#${id.slice(0, 8).toUpperCase()}`).join(', ')
    const message = `*KingdomDash Corporate Dispatch Notification*\nCompany: ${lead?.company_name}\nOrder IDs: ${idsText}\nTotal Parcels: ${recipients.length}\nPickup Address: ${pickupAddress}\nBilling: ${paymentMethod === 'monthly_invoice' ? 'Monthly Invoice' : 'Pay on Pickup'}\n\nPlease assign priority riders.`
    window.open(generateWhatsAppLink(message), '_blank', 'noopener,noreferrer')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="mt-3 text-xs font-semibold text-text-muted">Loading Corporate Dispatch Portal…</span>
      </div>
    )
  }

  // ── 1. ACTIVE ONBOARDED CORPORATE DISPATCH PORTAL ─────────────────────────
  if (lead && lead.status === 'onboarded') {
    return (
      <div className="space-y-6">
        {/* Header Hero Banner (Compact & Streamlined) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-neutral-900 to-slate-900 border border-white/10 p-3.5 sm:p-4 text-white shadow-xl">
          {/* Subtle ambient lighting glows */}
          <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 h-32 w-32 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left side: Company Monogram + Details */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/40 text-primary shadow-xs">
                <Building2 className="h-5 w-5 sm:h-5 sm:w-5" />
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                {/* Badging row */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold tracking-wide">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <span>ONBOARDED PARTNER</span>
                  </span>

                  <span className="text-[10px] text-neutral-400 font-mono">
                    ID: {lead.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                {/* Company Heading - strictly on ONE line without breaking */}
                <h1
                  className="text-base sm:text-lg font-bold text-white tracking-tight truncate whitespace-nowrap block"
                  title={lead.company_name}
                >
                  {lead.company_name}
                </h1>

                {/* Single-line concise meta */}
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-300 truncate whitespace-nowrap">
                  <span>{lead.business_type || 'Corporate Partner'}</span>
                  <span className="text-neutral-600">•</span>
                  <span className="text-white/80">{lead.contact_name}</span>
                  <span className="text-neutral-600">•</span>
                  <span className="font-mono text-neutral-400">{lead.phone}</span>
                </div>
              </div>
            </div>

            {/* Right side: Action Center (Compact single row) */}
            <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0">
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(true)}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary text-white text-xs font-bold shadow-md shadow-primary/25 transition-all active:scale-95 whitespace-nowrap"
              >
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span>Create Dispatch</span>
                <ArrowRight className="h-3 w-3 shrink-0 opacity-80" />
              </button>

              <button
                type="button"
                onClick={handleWhatsAppDesk}
                className="inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                title="Corporate WhatsApp Desk"
              >
                <PhoneCall className="h-3.5 w-3.5 text-[#25D366] shrink-0" />
                <span className="hidden sm:inline">Desk</span>
              </button>

              <button
                type="button"
                onClick={() => refreshLead(true)}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center h-8 sm:h-9 w-8 sm:w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white transition-all active:scale-95 disabled:opacity-50 shrink-0"
                title="Refresh corporate status"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Corporate Benefits & Tier Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-medium">Volume Discount Rate</span>
              <TrendingDown className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-text-primary">
              Up to 32% Off
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 rounded-lg p-1.5 border border-emerald-200/60">
              ⚡ Flat {formatNgn(540)} / parcel tier active
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-medium">Estimated Monthly Volume</span>
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl font-extrabold text-text-primary">
              {lead.estimated_volume || '100+ deliveries/mo'}
            </div>
            <div className="text-[11px] text-text-secondary">
              Priority Rider Allocation Enabled
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span className="font-medium">Account Manager</span>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="text-sm font-bold text-text-primary truncate">
              KingdomDash Business Desk
            </div>
            <div className="text-[11px] text-primary font-semibold">
              Direct Phone: {appConfig.support.phoneDisplay}
            </div>
          </div>
        </div>

        {/* Dispatch Quick Actions & Modal Trigger Banner */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-text-primary">
                Corporate Logistics &amp; Invoicing Portal
              </h2>
            </div>
            <Badge variant="info" className="text-xs font-semibold">
              Consolidated Monthly Billing
            </Badge>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            As an onboarded corporate partner, your parcel dispatches automatically qualify for corporate rate discounts (flat {formatNgn(540)}/parcel tier), digital proof of delivery, and consolidated monthly billing reports.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsDispatchModalOpen(true)}
              className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.08] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Create Corporate Dispatch Order</span>
                  <span className="text-[11px] text-text-secondary">Single or batch multi-stop deliveries</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>

            <button
              type="button"
              onClick={handleWhatsAppDesk}
              className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/80 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Request Billing Statement</span>
                  <span className="text-[11px] text-text-secondary">Contact account manager for PDF invoice</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Recent Corporate Dispatches Table */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-text-primary">Recent Corporate Dispatches</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadCorporateOrders}
              disabled={isLoadingRecentOrders}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingRecentOrders ? 'animate-spin' : ''}`} />
              <span>Refresh Orders</span>
            </Button>
          </div>

          {isLoadingRecentOrders ? (
            <div className="py-8 text-center text-xs text-text-muted">Loading corporate orders…</div>
          ) : recentCorporateOrders.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Package className="h-8 w-8 text-text-muted mx-auto" />
              <p className="text-xs text-text-secondary font-medium">No corporate dispatches recorded yet.</p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsDispatchModalOpen(true)}
                className="text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl"
              >
                Create First Corporate Dispatch
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted font-semibold">
                    <th className="pb-2">Order ID</th>
                    <th className="pb-2">Recipient / Delivery Address</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Rate Tier</th>
                    <th className="pb-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {recentCorporateOrders.map((ord: any) => (
                    <tr key={ord.id} className="hover:bg-page-background/60 transition-colors">
                      <td className="py-3 font-mono font-bold text-primary">#{ord.id.slice(0, 8).toUpperCase()}</td>
                      <td className="py-3 max-w-xs truncate">
                        <div className="font-semibold text-text-primary">{ord.delivery_contact || 'Corporate Recipient'}</div>
                        <div className="text-[11px] text-text-muted truncate">{ord.delivery_address}</div>
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {ord.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 text-emerald-700 font-semibold">{formatNgn(ord.total || 540)} (Corp Tier)</td>
                      <td className="py-3 text-right text-text-muted">{new Date(ord.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── CORPORATE DISPATCH MODAL ──────────────────────────────────────── */}
        {isDispatchModalOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn"
              onClick={(e) => {
                if (e.target === e.currentTarget) handleResetDispatchForm()
              }}
            >
              <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">Corporate Dispatch Request</h2>
                    <p className="text-xs text-text-secondary">
                      Account: <strong>{lead.company_name}</strong> • Flat ₦540/parcel Corporate Rate Applied
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetDispatchForm}
                  className="rounded-full p-2 text-text-muted hover:bg-neutral-100 hover:text-text-primary transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {dispatchSuccess ? (
                /* Success Screen inside Modal */
                <div className="py-6 text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-extrabold text-text-primary">Corporate Dispatch Logged!</h3>
                  <p className="text-xs text-text-secondary max-w-md mx-auto leading-relaxed">
                    {createdOrderIds.length} parcel dispatch order(s) have been successfully registered under your corporate account.
                  </p>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 font-mono">
                    Order IDs: {createdOrderIds.map((id) => `#${id.slice(0, 8).toUpperCase()}`).join(', ')}
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleSendWhatsAppNotification}
                      className="rounded-xl font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2 text-xs h-10 px-4"
                    >
                      <PhoneCall className="h-4 w-4" />
                      <span>Notify Dispatch Desk on WhatsApp</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetDispatchForm}
                      className="rounded-xl font-semibold text-xs h-10 px-4"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                /* Order Form inside Modal */
                <form onSubmit={handleCreateCorporateDispatch} className="space-y-6">
                  {/* Mode Selector */}
                  <div className="flex items-center gap-2 p-1.5 rounded-xl bg-neutral-100 border border-neutral-200 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setDispatchMode('single')
                        setRecipients((prev) => (prev.length > 1 ? prev.slice(0, 1) : prev))
                      }}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                        dispatchMode === 'single'
                          ? 'bg-white text-primary shadow-xs font-bold'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Package className="h-4 w-4" />
                      <span>Single Parcel Dispatch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDispatchMode('batch')}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                        dispatchMode === 'batch'
                          ? 'bg-white text-primary shadow-xs font-bold'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Layers className="h-4 w-4" />
                      <span>Batch Multi-Stop Dispatch</span>
                    </button>
                  </div>

                  {/* Pickup Details */}
                  <div className="space-y-3 rounded-2xl bg-neutral-50 p-4 border border-neutral-200 text-xs">
                    <div className="flex items-center gap-2 font-bold text-text-primary text-xs uppercase tracking-wider">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>Corporate Pickup Location</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-text-primary mb-1">
                          Contact Person *
                        </label>
                        <input
                          type="text"
                          required
                          value={senderContact}
                          onChange={(e) => setSenderContact(e.target.value)}
                          className="w-full rounded-xl border border-border bg-white p-2.5 text-xs focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-text-primary mb-1">
                          Contact Phone *
                        </label>
                        <input
                          type="tel"
                          required
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          className="w-full rounded-xl border border-border bg-white p-2.5 text-xs focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-text-primary mb-1">
                        Pickup Address in Ijebu-Ode *
                      </label>
                      <input
                        type="text"
                        required
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        placeholder="e.g. 15 Folagbade Street, Ijebu-Ode"
                        className="w-full rounded-xl border border-border bg-white p-2.5 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Recipients List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span>Delivery Recipients ({recipients.length})</span>
                      </span>
                      {dispatchMode === 'batch' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addRecipientField}
                          className="h-7 text-[11px] font-bold gap-1 rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Recipient</span>
                        </Button>
                      )}
                    </div>

                    {recipients.map((r, index) => (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3 relative shadow-2xs"
                      >
                        {recipients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRecipientField(r.id)}
                            className="absolute top-3 right-3 text-rose-500 hover:text-rose-700 p-1"
                            title="Remove recipient"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                        <div className="text-xs font-bold text-primary">
                          Recipient #{index + 1}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-text-primary mb-1">
                              Recipient Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={r.recipientName}
                              onChange={(e) => updateRecipientField(r.id, 'recipientName', e.target.value)}
                              placeholder="Full Name"
                              className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs focus:border-primary focus:bg-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-text-primary mb-1">
                              Recipient Phone *
                            </label>
                            <input
                              type="tel"
                              required
                              value={r.recipientPhone}
                              onChange={(e) => updateRecipientField(r.id, 'recipientPhone', e.target.value)}
                              placeholder="08012345678"
                              className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs focus:border-primary focus:bg-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-text-primary mb-1">
                              Delivery Address *
                            </label>
                            <input
                              type="text"
                              required
                              value={r.deliveryAddress}
                              onChange={(e) => updateRecipientField(r.id, 'deliveryAddress', e.target.value)}
                              placeholder="Street address in Ijebu-Ode"
                              className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs focus:border-primary focus:bg-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-text-primary mb-1">
                              Package Type
                            </label>
                            <select
                              value={r.packageType}
                              onChange={(e) => updateRecipientField(r.id, 'packageType', e.target.value)}
                              className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs focus:border-primary focus:bg-white focus:outline-none"
                            >
                              <option value="Commercial Parcel">Commercial Parcel</option>
                              <option value="Legal & Office Documents">Legal &amp; Office Documents</option>
                              <option value="Pharmacy / Medical Supplies">Pharmacy / Medical Supplies</option>
                              <option value="Food & Catering">Food &amp; Catering Order</option>
                              <option value="Fragile Inventory">Fragile Inventory</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">
                            Dispatch Notes / Drop-off Instructions
                          </label>
                          <input
                            type="text"
                            value={r.notes}
                            onChange={(e) => updateRecipientField(r.id, 'notes', e.target.value)}
                            placeholder="e.g. Leave at front desk or call on arrival"
                            className="w-full rounded-xl border border-border bg-page-background p-2 text-xs focus:border-primary focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment & Billing Preference */}
                  <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-text-primary text-xs">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span>Corporate Account Billing Choice</span>
                      </div>
                      <Badge variant="success" className="text-[10px] font-bold">
                        Corporate Tier: {formatNgn(540)} / parcel
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <label
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'monthly_invoice'
                            ? 'border-primary bg-white shadow-xs font-bold text-primary'
                            : 'border-border bg-page-background text-text-secondary'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'monthly_invoice'}
                          onChange={() => setPaymentMethod('monthly_invoice')}
                          className="accent-primary"
                        />
                        <div>
                          <span className="block text-xs">Consolidated Monthly Invoice</span>
                          <span className="text-[10px] text-text-muted font-normal">Add to corporate statement</span>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          paymentMethod === 'cash_on_pickup'
                            ? 'border-primary bg-white shadow-xs font-bold text-primary'
                            : 'border-border bg-page-background text-text-secondary'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'cash_on_pickup'}
                          onChange={() => setPaymentMethod('cash_on_pickup')}
                          className="accent-primary"
                        />
                        <div>
                          <span className="block text-xs">Pay Rider on Pickup</span>
                          <span className="text-[10px] text-text-muted font-normal">Cash / Transfer to rider</span>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-primary/10 text-xs font-bold text-text-primary">
                      <span>Total Estimated Cost ({recipients.length} parcel{recipients.length > 1 ? 's' : ''}):</span>
                      <span className="text-base text-primary font-extrabold">{formatNgn(recipients.length * 540)}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isCreatingDispatch}
                    className="w-full h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2"
                  >
                    <Send className={`h-4 w-4 ${isCreatingDispatch ? 'animate-spin' : ''}`} />
                    <span>
                      {isCreatingDispatch
                        ? 'Logging Corporate Dispatch...'
                        : `Confirm Corporate Dispatch (${recipients.length} Parcel${recipients.length > 1 ? 's' : ''})`}
                    </span>
                  </Button>
                </form>
              )}
              </div>
            </div>,
            document.body
          )}
      </div>
    )
  }

  // ── 2. PENDING / CONTACTED CORPORATE APPLICATION ──────────────────────────
  if (lead && (lead.status === 'pending' || lead.status === 'contacted')) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 shrink-0">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-amber-950">
                    Corporate Account Application Under Review
                  </h2>
                  <Badge variant="warning" className="uppercase text-[10px] font-bold">
                    {lead.status}
                  </Badge>
                </div>
                <p className="text-xs text-amber-800">
                  Your application for <strong>{lead.company_name}</strong> was received and is currently being processed by our corporate desk.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refreshLead(true)}
              disabled={isRefreshing}
              className="rounded-xl border-amber-300 bg-amber-100/60 text-amber-950 hover:bg-amber-100 font-bold gap-1.5 text-xs shrink-0 self-start sm:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/80 rounded-xl p-4 border border-amber-200/80">
            <div>
              <span className="text-text-muted block">Company Name:</span>
              <span className="font-bold text-text-primary">{lead.company_name}</span>
            </div>
            <div>
              <span className="text-text-muted block">Business Sector:</span>
              <span className="font-bold text-text-primary">{lead.business_type}</span>
            </div>
            <div>
              <span className="text-text-muted block">Estimated Volume:</span>
              <span className="font-bold text-text-primary">{lead.estimated_volume || 'N/A'}</span>
            </div>
            <div>
              <span className="text-text-muted block">Submitted Date:</span>
              <span className="font-bold text-text-primary">{new Date(lead.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="rounded-xl bg-amber-100/60 p-3 border border-amber-200/60 text-xs text-amber-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0" />
            <span>
              <strong>Application Lock Active:</strong> You can only submit 1 application at a time until the admin reviews and approves your request.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-amber-200/60">
            <p className="text-xs text-amber-900">
              Need immediate onboarding? Connect directly with our business account manager:
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleWhatsAppDesk}
              className="rounded-xl border-amber-300 bg-amber-100/60 text-amber-950 hover:bg-amber-100 font-bold gap-2 text-xs"
            >
              <PhoneCall className="h-3.5 w-3.5 text-[#25D366]" />
              <span>Contact Business Desk</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── 3. APPLY FOR CORPORATE ACCOUNT FORM (Only shown if no active lead) ──────
  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent p-6 sm:p-8 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          <Building2 className="h-3.5 w-3.5" />
          <span>Enterprise Logistics &amp; Corporate Courier</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-text-primary">
          Open a KingdomDash Corporate Account
        </h2>
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-2xl">
          Discounted volume delivery rates (up to 32% off), dedicated rider fleets, priority dispatch, and consolidated monthly invoicing for businesses in Ijebu-Ode.
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-white p-4 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-text-primary">
            <TrendingDown className="h-4 w-4 text-emerald-600" />
            <span>Volume Tier Savings</span>
          </div>
          <p className="text-text-muted text-[11px]">
            Rates starting as low as ₦540 per parcel for active business accounts.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-text-primary">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Proof of Delivery</span>
          </div>
          <p className="text-text-muted text-[11px]">
            Digital signatures and photo proof upon drop-off for every delivery.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-text-primary">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Dedicated Dispatch</span>
          </div>
          <p className="text-text-muted text-[11px]">
            Priority allocation of top-rated riders in Ijebu-Ode and campus zones.
          </p>
        </div>
      </div>

      {/* Application Form */}
      <div className="rounded-2xl border border-border bg-white p-6 sm:p-8 shadow-2xs space-y-5">
        <div>
          <h3 className="text-base font-bold text-text-primary">Submit Business Details</h3>
          <p className="text-xs text-text-secondary">
            Fill in your business details below to request corporate status activation. You can submit 1 application for admin approval.
          </p>
        </div>

        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Company / Business Name *
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Apex Pharmacy & Stores"
              className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs text-text-primary focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Contact Person *
              </label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Full Name"
                className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs text-text-primary focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Phone / WhatsApp Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08012345678"
                className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs text-text-primary focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Business Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@company.com"
                className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs text-text-primary focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Industry / Business Sector
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs text-text-primary focus:border-primary focus:bg-white focus:outline-none"
              >
                <option value="E-commerce & Retail">E-commerce, Boutique &amp; Fashion</option>
                <option value="Pharmacy & Healthcare">Pharmacy, Medical Supplies &amp; Health</option>
                <option value="Restaurant & Bakery">Restaurant, Bakery &amp; Food Services</option>
                <option value="Legal & Corporate Office">Legal, Financial &amp; Corporate Office</option>
                <option value="Campus & Student Services">Campus Merchant (TASUED / OOU / Health)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Estimated Monthly Parcel Volume
              </label>
              <select
                value={estimatedVolume}
                onChange={(e) => setEstimatedVolume(e.target.value)}
                className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs text-text-primary focus:border-primary focus:bg-white focus:outline-none"
              >
                <option value="20-50 deliveries/mo">20 - 50 deliveries / month (10% Off)</option>
                <option value="51-150 deliveries/mo">51 - 150 deliveries / month (18% Off)</option>
                <option value="151-400 deliveries/mo">151 - 400 deliveries / month (25% Off)</option>
                <option value="400+ deliveries/mo">400+ deliveries / month (32% Off)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Primary Pickup Address in Ijebu-Ode
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 15 Folagbade Street, Ijebu-Ode"
                className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs text-text-primary focus:border-primary focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Dispatch Requirements / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific delivery hours, fragile items, or multi-stop dispatch needs..."
              className="w-full rounded-xl border border-border bg-page-background p-2.5 text-xs text-text-primary focus:border-primary focus:bg-white focus:outline-none"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-2 mt-2"
          >
            <Send className="h-4 w-4" />
            <span>{isSubmitting ? 'Submitting Application...' : 'Submit Corporate Account Request'}</span>
          </Button>
        </form>
      </div>
    </div>
  )
}
