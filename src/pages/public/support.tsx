import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Mail, Phone, Clock, MapPin, AlertCircle, CheckCircle2, ShieldAlert, Send } from 'lucide-react'
import { WhatsAppCta } from '@/components/shared/whatsapp-cta'
import { SectionHeading } from '@/components/shared/section-heading'
import { Section, PageContainer } from '@/components/layout/section'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useToast } from '@/hooks/use-toast'
import { useSeo } from '@/hooks/use-seo'
import { submitSupportTicket } from '@/services/supabase/support'

interface SupportFormState {
  name: string
  email: string
  phone: string
  category: string
  subject: string
  message: string
}

interface SupportFormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
}

const CATEGORIES = [
  { value: 'account_inactive', label: 'Account Suspension / Inactivity' },
  { value: 'order_issue', label: 'Order or Delivery Issue' },
  { value: 'vendor_inquiry', label: 'Merchant / Vendor Support' },
  { value: 'rider_inquiry', label: 'Rider & Fleet Support' },
  { value: 'payment_issue', label: 'Billing & Payments' },
  { value: 'general', label: 'General Questions / Feedback' },
]

export default function SupportPage() {
  useSeo({
    title: 'Customer Support & Help Center',
    description: `Need assistance with your KingdomDash account, order, or deliveries in ${appConfig.launchMarket}? Contact our dedicated support team 24/7.`,
  })

  const location = useLocation()
  const { pushToast } = useToast()

  const queryParams = new URLSearchParams(location.search)
  const isInactiveReason = queryParams.get('reason') === 'account_inactive'

  const [form, setForm] = useState<SupportFormState>({
    name: '',
    email: '',
    phone: '',
    category: isInactiveReason ? 'account_inactive' : 'general',
    subject: isInactiveReason ? 'Account Re-activation Request' : '',
    message: isInactiveReason
      ? 'Hello Support Team, my account appears to be deactivated. Please help me review and reactivate my profile.'
      : '',
  })

  const [errors, setErrors] = useState<SupportFormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedTicket, setSubmittedTicket] = useState<{ id: string } | null>(null)

  useEffect(() => {
    if (isInactiveReason) {
      setForm((prev) => ({
        ...prev,
        category: 'account_inactive',
        subject: prev.subject || 'Account Re-activation Request',
      }))
    }
  }, [isInactiveReason])

  const validate = (): boolean => {
    const errs: SupportFormErrors = {}
    if (!form.name.trim() || form.name.trim().length < 2) {
      errs.name = 'Please provide your full name (minimum 2 characters).'
    }
    if (
      !form.email.trim() ||
      form.email.length < 5 ||
      !form.email.includes('@') ||
      !form.email.includes('.')
    ) {
      errs.email = 'Please provide a valid email address.'
    }
    if (!form.subject.trim() || form.subject.trim().length < 3) {
      errs.subject = 'Subject is required (minimum 3 characters).'
    }
    if (!form.message.trim() || form.message.trim().length < 10) {
      errs.message = 'Please provide a descriptive message (minimum 10 characters).'
    } else if (form.message.trim().length > 3000) {
      errs.message = 'Message cannot exceed 3,000 characters.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleChange = (field: keyof SupportFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const fullSubject = `[${form.category.toUpperCase()}] ${form.subject.trim()}`
      const { data, error } = await submitSupportTicket({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: fullSubject,
        message: form.message.trim(),
      })

      if (error || !data?.success) {
        pushToast({
          variant: 'error',
          title: 'Submission Failed',
          message: error?.message || 'Unable to submit support request. Please try again.',
        })
        return
      }

      setSubmittedTicket({ id: data.ticket_id || 'KD-SUPPORT' })
      pushToast({
        variant: 'success',
        title: 'Support Request Dispatched',
        message: "We've received your request. Our support team will respond shortly.",
      })
    } catch {
      pushToast({
        variant: 'error',
        title: 'Network Error',
        message: 'Could not connect to the support service. Please check your connection.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const CONTACT_CHANNELS = [
    {
      icon: Phone,
      title: 'Telephone Support',
      value: appConfig.support.phoneDisplay,
      desc: 'Direct line to our operational support desk in Ijebu-Ode.',
      href: `tel:${appConfig.support.phoneRaw}`,
    },
    {
      icon: Mail,
      title: 'Email Inquiries',
      value: appConfig.support.email,
      desc: 'Official dispatch & customer service mailbox.',
      href: `mailto:${appConfig.support.email}`,
    },
    {
      icon: Clock,
      title: 'Operating Hours',
      value: appConfig.support.hours,
      desc: 'Continuous delivery supervision and live dispatch.',
    },
    {
      icon: MapPin,
      title: 'Operations Hub',
      value: appConfig.support.address,
      desc: 'Physical headquarters and dispatch station.',
    },
  ]

  return (
    <div className="min-h-screen bg-page-background">
      {/* ─── HERO HEADER ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-near-black border-b border-dark-border py-12 sm:py-16 lg:py-20 text-white">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 20% 50%, rgba(229,9,20,0.35) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />
        <PageContainer>
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-primary/20 text-white border border-primary/40">
              Customer Support Center
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
              We&apos;re Here to Help You Move <span className="text-primary">Swiftly.</span>
            </h1>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl font-normal">
              Have an urgent issue with an active order, your merchant storefront, rider dispatch, or
              your account access? Submit a ticket below or reach our team directly.
            </p>
          </div>
        </PageContainer>
      </section>

      {/* ─── INACTIVE ACCOUNT NOTICE BANNER ─────────────────────────────────── */}
      {isInactiveReason && (
        <div className="bg-rose-50 border-b border-rose-200">
          <PageContainer className="py-4">
            <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm text-rose-900">
              <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <strong className="font-bold text-primary">Account Access Restricted:</strong> Your
                profile is currently marked inactive. Please submit this form with your registered
                email address to request an immediate account review from our administration team.
              </div>
            </div>
          </PageContainer>
        </div>
      )}

      {/* ─── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <Section className="py-10 sm:py-14 lg:py-16">
        <PageContainer>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Contact Form or Success State */}
            <div className="lg:col-span-7 bg-white border border-border rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xs">
              {submittedTicket ? (
                <div className="text-center py-8 space-y-5 animate-fadeIn">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
                      Support Request Received
                    </h2>
                    <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
                      Your inquiry has been logged in our secure dispatch queue. Reference Number:
                    </p>
                    <div className="inline-block font-mono font-bold text-xs bg-light-surface px-4 py-2 rounded-xl border border-border text-text-primary">
                      {submittedTicket.id}
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary max-w-md mx-auto">
                    Our administration and operations officers will follow up via your email address
                    within our working window.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSubmittedTicket(null)
                      setForm({
                        name: '',
                        email: '',
                        phone: '',
                        category: 'general',
                        subject: '',
                        message: '',
                      })
                    }}
                    className="mt-4"
                  >
                    Submit Another Request
                  </Button>
                </div>
              ) : (
                <form noValidate onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary tracking-tight">
                      Send Us a Message
                    </h2>
                    <p className="text-xs text-text-secondary mt-1">
                      Fill out the form below. All fields marked with * are required.
                    </p>
                  </div>

                  {/* Category Selector */}
                  <FormField id="support-category" label="Inquiry Topic *" error={undefined}>
                    <select
                      id="support-category"
                      value={form.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-border bg-white text-xs sm:text-sm text-text-primary focus:outline-none focus:border-primary shadow-xs transition-colors"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  {/* Name and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField id="support-name" label="Full Name *" error={errors.name}>
                      <Input
                        id="support-name"
                        type="text"
                        placeholder="e.g. Samuel Adeleke"
                        value={form.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="h-11 text-xs sm:text-sm"
                      />
                    </FormField>

                    <FormField id="support-email" label="Email Address *" error={errors.email}>
                      <Input
                        id="support-email"
                        type="email"
                        placeholder="you@domain.com"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        className="h-11 text-xs sm:text-sm"
                      />
                    </FormField>
                  </div>

                  {/* Phone and Subject */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField id="support-phone" label="Phone Number (Optional)">
                      <Input
                        id="support-phone"
                        type="tel"
                        placeholder="+234..."
                        value={form.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        className="h-11 text-xs sm:text-sm"
                      />
                    </FormField>

                    <FormField id="support-subject" label="Subject *" error={errors.subject}>
                      <Input
                        id="support-subject"
                        type="text"
                        placeholder="Brief summary of request"
                        value={form.subject}
                        onChange={(e) => handleChange('subject', e.target.value)}
                        className="h-11 text-xs sm:text-sm"
                      />
                    </FormField>
                  </div>

                  {/* Message */}
                  <FormField id="support-message" label="Detailed Message *" error={errors.message}>
                    <Textarea
                      id="support-message"
                      rows={5}
                      maxLength={3000}
                      placeholder="Please include relevant order codes, registered phone numbers, or account details..."
                      value={form.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      className="text-xs sm:text-sm p-3.5 resize-y"
                    />
                    <div className="flex justify-end mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {form.message.length} / 3,000 characters
                      </span>
                    </div>
                  </FormField>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto h-11 px-8 font-bold gap-2 text-xs sm:text-sm"
                  >
                    {isSubmitting ? (
                      'Submitting Ticket...'
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Support Request</span>
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Right Column: Verified Contact Information & Channels */}
            <div className="lg:col-span-5 space-y-6">
              {/* WhatsApp Live Dispatch CTA */}
              <div className="p-6 rounded-2xl sm:rounded-3xl bg-emerald-50 border border-emerald-200/80 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Live WhatsApp Dispatch
                  </span>
                </div>
                <h3 className="text-base font-bold text-emerald-950">
                  Prefer instant messaging?
                </h3>
                <p className="text-xs text-emerald-800/90 leading-relaxed">
                  Connect with our Ijebu-Ode operations desk directly on WhatsApp for real-time order tracking and urgent delivery queries.
                </p>
                <div className="pt-1 flex">
                  <WhatsAppCta
                    message={
                      isInactiveReason
                        ? 'Hello KingdomDash Support, I need assistance reactivating my account.'
                        : 'Hello KingdomDash Support, I need assistance with an order or inquiry.'
                    }
                    variant="primary"
                  />
                </div>
              </div>

              {/* Contact Information Cards */}
              <div className="bg-white border border-border rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
                <SectionHeading
                  title="Direct Contact Desk"
                  description="Official contact channels for the KingdomDash launch market."
                />

                <div className="space-y-4 pt-1">
                  {CONTACT_CHANNELS.map((ch) => (
                    <div key={ch.title} className="flex items-start gap-3.5 text-xs">
                      <div className="w-8 h-8 rounded-xl bg-light-surface border border-border flex items-center justify-center text-primary shrink-0">
                        <ch.icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block">
                          {ch.title}
                        </span>
                        {ch.href ? (
                          <a
                            href={ch.href}
                            className="font-bold text-text-primary hover:text-primary transition-colors truncate block"
                          >
                            {ch.value}
                          </a>
                        ) : (
                          <span className="font-semibold text-text-primary block">{ch.value}</span>
                        )}
                        <span className="text-[11px] text-text-muted block">{ch.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Assurance */}
              <div className="p-4 rounded-xl bg-light-surface border border-border text-xs text-text-secondary flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                <span>
                  All submitted tickets receive an automated reference ID and are reviewed by authorized
                  KingdomDash officers in Ijebu-Ode.
                </span>
              </div>
            </div>
          </div>
        </PageContainer>
      </Section>
    </div>
  )
}
