import { useState } from 'react'
import {
  Package,
  MapPin,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Bike,
  FileText,
  Phone,
  User,
  MessageSquare,
  Send,
  AlertCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { appConfig } from '@/config/app.config'
import { generateWhatsAppLink } from '@/utils/whatsapp'
import { useSeo } from '@/hooks/use-seo'
import { useAuthStore } from '@/stores/auth-store'
import { createCourierOrderSecure } from '@/services/supabase/orders'
import { IJEBU_ODE_CENTER } from '@/utils/geo'

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: FileText,
    title: 'Fill the Form',
    description: 'Enter your pickup address, drop-off address, and contact details below.',
  },
  {
    step: '02',
    icon: Send,
    title: 'Submit & Connect',
    description: 'Your request opens a pre-filled WhatsApp message directly to our dispatch desk.',
  },
  {
    step: '03',
    icon: Bike,
    title: 'Rider Assigned',
    description: 'Our operations team confirms pricing and assigns a verified rider to you.',
  },
] as const

type PackageType = 'documents' | 'parcel' | 'food' | 'fragile' | 'other'

const PACKAGE_TYPES: { value: PackageType; label: string }[] = [
  { value: 'documents', label: 'Documents / Letters' },
  { value: 'parcel', label: 'Parcel / Package' },
  { value: 'food', label: 'Food / Beverages' },
  { value: 'fragile', label: 'Fragile Items' },
  { value: 'other', label: 'Other' },
]

interface BookingForm {
  senderName: string
  senderPhone: string
  pickupAddress: string
  recipientName: string
  recipientPhone: string
  deliveryAddress: string
  packageType: PackageType | ''
  specialInstructions: string
}

const INITIAL_FORM: BookingForm = {
  senderName: '',
  senderPhone: '',
  pickupAddress: '',
  recipientName: '',
  recipientPhone: '',
  deliveryAddress: '',
  packageType: '',
  specialInstructions: '',
}

function buildWhatsAppMessage(form: BookingForm, orderId?: string | null): string {
  const lines = [
    `*KingdomDash Courier Booking*`,
    orderId ? `Order Reference: #${orderId.slice(0, 8).toUpperCase()}` : '',
    ``,
    `*Sender*`,
    `Name: ${form.senderName}`,
    `Phone: ${form.senderPhone}`,
    `Pickup Address: ${form.pickupAddress}`,
    ``,
    `*Recipient*`,
    `Name: ${form.recipientName}`,
    `Phone: ${form.recipientPhone}`,
    `Delivery Address: ${form.deliveryAddress}`,
    ``,
    `*Package*`,
    `Type: ${PACKAGE_TYPES.find(p => p.value === form.packageType)?.label ?? form.packageType}`,
    form.specialInstructions ? `Notes: ${form.specialInstructions}` : '',
  ].filter(Boolean)

  return lines.join('\n')
}

export default function CourierPage() {
  useSeo({
    title: 'Courier Dispatch — Book a Rider | KingdomDash',
    description: `Same-day parcel and package delivery across ${appConfig.launchMarket}. Book a verified rider instantly.`,
  })

  const [form, setForm] = useState<BookingForm>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof BookingForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const profile = useAuthStore((s) => s.profile)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof BookingForm]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof BookingForm, string>> = {}
    if (!form.senderName.trim()) newErrors.senderName = 'Your name is required'
    if (!form.senderPhone.trim()) newErrors.senderPhone = 'Your phone number is required'
    if (!form.pickupAddress.trim()) newErrors.pickupAddress = 'Pickup address is required'
    if (!form.recipientName.trim()) newErrors.recipientName = "Recipient's name is required"
    if (!form.recipientPhone.trim()) newErrors.recipientPhone = "Recipient's phone is required"
    if (!form.deliveryAddress.trim()) newErrors.deliveryAddress = 'Delivery address is required'
    if (!form.packageType) newErrors.packageType = 'Please select a package type'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || isSubmitting) return

    let orderId: string | null = null
    if (profile?.id) {
      try {
        setIsSubmitting(true)
        const idempotencyKey = `courier-${profile.id}-${Date.now()}`
        const res = await createCourierOrderSecure({
          pickupAddress: form.pickupAddress.trim(),
          pickupContact: form.senderName.trim(),
          pickupPhone: form.senderPhone.trim(),
          pickupLat: IJEBU_ODE_CENTER.latitude,
          pickupLon: IJEBU_ODE_CENTER.longitude,
          deliveryAddress: form.deliveryAddress.trim(),
          deliveryContact: form.recipientName.trim(),
          deliveryPhone: form.recipientPhone.trim(),
          deliveryLat: IJEBU_ODE_CENTER.latitude,
          deliveryLon: IJEBU_ODE_CENTER.longitude,
          idempotencyKey,
          specialInstructions: form.specialInstructions.trim() || undefined,
        })
        if (!res.error && res.data) {
          const raw = res.data as { order_id?: string; id?: string } | string
          orderId = typeof raw === 'string' ? raw : raw?.order_id || raw?.id || null
          setCreatedOrderId(orderId)
        }
      } catch (err) {
        console.error('[CourierPage] Failed to create database courier order:', err)
      } finally {
        setIsSubmitting(false)
      }
    }

    const message = buildWhatsAppMessage(form, orderId)
    const link = generateWhatsAppLink(message)
    setSubmitted(true)
    window.open(link, '_blank', 'noreferrer')
  }

  function handleReset() {
    setForm(INITIAL_FORM)
    setErrors({})
    setSubmitted(false)
    setCreatedOrderId(null)
  }

  return (
    <div className="bg-white text-neutral-900 overflow-x-hidden">

      {/* ─── PAGE HEADER (NO HERO BANNER) ─────────────────────────────────── */}
      <section className="pt-8 pb-4 border-b border-neutral-100 bg-neutral-50/50">
        <PageContainer>
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary mb-3">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Live Dispatch — {appConfig.launchMarket}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
              Send anything, anywhere <span className="text-primary">across Ijebu-Ode.</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-neutral-500 max-w-lg mx-auto">
              Book a verified dispatch rider instantly for parcels, documents, and packages across {appConfig.launchMarket}.
            </p>
          </div>
        </PageContainer>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section className="border-b border-neutral-100 bg-neutral-50 py-14 sm:py-18">
        <PageContainer>
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Simple Process</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              How it works
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }) => (
              <div
                key={step}
                className="relative flex gap-4 items-start rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">Step {step}</p>
                  <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
                  <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* ─── BOOKING FORM ────────────────────────────────────────────────── */}
      <section id="booking-form" className="py-16 sm:py-24 bg-neutral-50/70 border-t border-neutral-100">
        <PageContainer>
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Book a Rider</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                Courier Booking Form
              </h2>
              <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
                Fill in your details and submit. Your information opens a pre-filled WhatsApp
                message to our dispatch desk — we respond instantly.
              </p>
            </div>

            {submitted ? (
              /* ── SUCCESS STATE ── */
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900">Request Sent!</h3>
                {createdOrderId && (
                  <p className="mt-2 text-sm text-emerald-800 font-bold">
                    Order Reference: #{createdOrderId.slice(0, 8).toUpperCase()} has been recorded in your account.
                  </p>
                )}
                <p className="mt-2 text-sm text-neutral-600 max-w-sm mx-auto leading-relaxed">
                  Your booking details have been sent to WhatsApp. Our dispatch team will
                  confirm your pickup and assign a rider shortly.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {createdOrderId && (
                    <Button asChild variant="primary" size="sm" className="rounded-full font-bold text-white bg-primary hover:bg-primary-hover">
                      <Link to="/dashboard?tab=orders" className="text-white">View in Customer Dashboard</Link>
                    </Button>
                  )}
                  <button
                    onClick={handleReset}
                    className="rounded-full border border-neutral-200 bg-white px-6 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    Book Another
                  </button>
                </div>
              </div>
            ) : (
              /* ── FORM ── */
              <form
                onSubmit={handleSubmit}
                noValidate
                className="rounded-3xl border border-neutral-200 bg-white p-8 sm:p-10 shadow-sm space-y-8"
              >
                {/* Sender Details */}
                <fieldset>
                  <legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-5 pb-2 border-b border-neutral-100 w-full">
                    <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Pickup Details
                  </legend>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Sender Name */}
                    <div>
                      <label htmlFor="senderName" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Your Name <span className="text-primary">*</span>
                      </label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden="true" />
                        <input
                          id="senderName"
                          name="senderName"
                          type="text"
                          value={form.senderName}
                          onChange={handleChange}
                          placeholder="e.g. Adebayo Okon"
                          autoComplete="name"
                          className={`w-full rounded-xl border bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${errors.senderName ? 'border-red-400 bg-red-50/40' : 'border-neutral-200'}`}
                        />
                      </div>
                      {errors.senderName && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.senderName}
                        </p>
                      )}
                    </div>

                    {/* Sender Phone */}
                    <div>
                      <label htmlFor="senderPhone" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Your Phone <span className="text-primary">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden="true" />
                        <input
                          id="senderPhone"
                          name="senderPhone"
                          type="tel"
                          value={form.senderPhone}
                          onChange={handleChange}
                          placeholder="e.g. 0812 345 6789"
                          autoComplete="tel"
                          className={`w-full rounded-xl border bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${errors.senderPhone ? 'border-red-400 bg-red-50/40' : 'border-neutral-200'}`}
                        />
                      </div>
                      {errors.senderPhone && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.senderPhone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pickup Address */}
                  <div className="mt-4">
                    <label htmlFor="pickupAddress" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Pickup Address <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-400" aria-hidden="true" />
                      <textarea
                        id="pickupAddress"
                        name="pickupAddress"
                        rows={2}
                        value={form.pickupAddress}
                        onChange={handleChange}
                        placeholder="e.g. 12 Folagbade Street, Oke-Aje, Ijebu-Ode"
                        className={`w-full resize-none rounded-xl border bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${errors.pickupAddress ? 'border-red-400 bg-red-50/40' : 'border-neutral-200'}`}
                      />
                    </div>
                    {errors.pickupAddress && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {errors.pickupAddress}
                      </p>
                    )}
                  </div>
                </fieldset>

                {/* Recipient Details */}
                <fieldset>
                  <legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-5 pb-2 border-b border-neutral-100 w-full">
                    <ArrowRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Delivery Details
                  </legend>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Recipient Name */}
                    <div>
                      <label htmlFor="recipientName" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Recipient Name <span className="text-primary">*</span>
                      </label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden="true" />
                        <input
                          id="recipientName"
                          name="recipientName"
                          type="text"
                          value={form.recipientName}
                          onChange={handleChange}
                          placeholder="e.g. Fatima Bello"
                          className={`w-full rounded-xl border bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${errors.recipientName ? 'border-red-400 bg-red-50/40' : 'border-neutral-200'}`}
                        />
                      </div>
                      {errors.recipientName && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.recipientName}
                        </p>
                      )}
                    </div>

                    {/* Recipient Phone */}
                    <div>
                      <label htmlFor="recipientPhone" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                        Recipient Phone <span className="text-primary">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden="true" />
                        <input
                          id="recipientPhone"
                          name="recipientPhone"
                          type="tel"
                          value={form.recipientPhone}
                          onChange={handleChange}
                          placeholder="e.g. 0901 234 5678"
                          className={`w-full rounded-xl border bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${errors.recipientPhone ? 'border-red-400 bg-red-50/40' : 'border-neutral-200'}`}
                        />
                      </div>
                      {errors.recipientPhone && (
                        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.recipientPhone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="mt-4">
                    <label htmlFor="deliveryAddress" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Delivery Address <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-400" aria-hidden="true" />
                      <textarea
                        id="deliveryAddress"
                        name="deliveryAddress"
                        rows={2}
                        value={form.deliveryAddress}
                        onChange={handleChange}
                        placeholder="e.g. 7 Molipa Road, Ijebu-Ode"
                        className={`w-full resize-none rounded-xl border bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${errors.deliveryAddress ? 'border-red-400 bg-red-50/40' : 'border-neutral-200'}`}
                      />
                    </div>
                    {errors.deliveryAddress && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {errors.deliveryAddress}
                      </p>
                    )}
                  </div>
                </fieldset>

                {/* Package Details */}
                <fieldset>
                  <legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-5 pb-2 border-b border-neutral-100 w-full">
                    <Package className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Package Details
                  </legend>

                  {/* Package Type */}
                  <div>
                    <label htmlFor="packageType" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Package Type <span className="text-primary">*</span>
                    </label>
                    <Select
                      value={form.packageType}
                      onValueChange={(value) => {
                        setForm((prev) => ({ ...prev, packageType: value as typeof form.packageType }))
                        if (errors.packageType) {
                          setErrors((prev) => ({ ...prev, packageType: undefined }))
                        }
                      }}
                    >
                      <SelectTrigger
                        id="packageType"
                        className={`w-full rounded-xl border bg-neutral-50 py-2.5 px-4 text-sm text-neutral-900 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${errors.packageType ? 'border-red-400 bg-red-50/40' : 'border-neutral-200'} ${!form.packageType ? 'text-neutral-400' : ''}`}
                      >
                        <SelectValue placeholder="Select package type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PACKAGE_TYPES.map((pt) => (
                          <SelectItem key={pt.value} value={pt.value}>
                            {pt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.packageType && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {errors.packageType}
                      </p>
                    )}
                  </div>

                  {/* Special Instructions */}
                  <div className="mt-4">
                    <label htmlFor="specialInstructions" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                      Additional Notes <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-400" aria-hidden="true" />
                      <textarea
                        id="specialInstructions"
                        name="specialInstructions"
                        rows={3}
                        value={form.specialInstructions}
                        onChange={handleChange}
                        placeholder="e.g. Handle with care — fragile contents. Call on arrival."
                        className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Info banner */}
                <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Submitting opens a WhatsApp chat pre-filled with your booking details. Our
                    dispatch team will confirm pricing and assign your rider in real time.
                  </p>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 font-bold text-white py-4 shadow-md transition-all disabled:opacity-60"
                >
                  <Send className={`mr-2 h-4 w-4 ${isSubmitting ? 'animate-spin' : ''}`} aria-hidden="true" />
                  {isSubmitting ? 'Recording Dispatch...' : 'Send Booking via WhatsApp'}
                </Button>
              </form>
            )}
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
