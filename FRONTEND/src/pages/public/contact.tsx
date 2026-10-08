import { useState } from 'react'
import { Mail, Phone, Clock, MapPin, Send } from 'lucide-react'
import { WhatsAppCta } from '@/components/shared/whatsapp-cta'
import { PageContainer } from '@/components/layout/section'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useToast } from '@/hooks/use-toast'
import { useSeo } from '@/hooks/use-seo'

interface ContactFormState {
  name: string
  email: string
  phone: string
  subject: string
  message: string
}

interface ContactFormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
}

const INITIAL_FORM: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
}

const CONTACT_INFO = [
  {
    icon: Mail,
    label: 'Email',
    value: appConfig.support.email,
  },
  {
    icon: Phone,
    label: 'Phone (Direct Calls)',
    value: appConfig.support.phoneDisplay,
  },
  {
    icon: Phone,
    label: 'WhatsApp Line',
    value: appConfig.whatsapp.phoneDisplay,
  },
  {
    icon: Clock,
    label: 'Hours',
    value: appConfig.support.hours,
  },
  {
    icon: MapPin,
    label: 'Address',
    value: appConfig.support.address,
  },
] as const

function validateForm(form: ContactFormState): ContactFormErrors {
  const errors: ContactFormErrors = {}

  if (!form.name.trim()) {
    errors.name = 'Name is required.'
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!form.email.includes('@') || !form.email.includes('.')) {
    errors.email = 'Please enter a valid email address.'
  }

  if (!form.subject.trim()) {
    errors.subject = 'Subject is required.'
  }

  if (!form.message.trim()) {
    errors.message = 'Message is required.'
  }

  return errors
}

export default function ContactPage() {
  useSeo({
    title: 'Contact Us',
    description: `Get in touch with KingdomDash support in ${appConfig.launchMarket}. Phone, email, WhatsApp, or send a direct message. Swift in Motion.`,
  })

  const { pushToast } = useToast()
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<ContactFormErrors>({})

  function handleChange(field: keyof ContactFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const validationErrors = validateForm(form)

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    pushToast({
      variant: 'success',
      title: 'Message sent!',
      message: "We'll get back to you within 24 hours.",
    })

    setForm(INITIAL_FORM)
    setErrors({})
  }

  return (
    <div className="bg-white text-text-primary overflow-x-hidden">
      {/* ─── 1. CLEAN HERO SECTION ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50/70 via-white to-white pt-8 pb-10 sm:pt-12 sm:pb-14 border-b border-neutral-100">
        <PageContainer>
          <div className="max-w-2xl space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
              SUPPORT &amp; INQUIRIES
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900 leading-[1.15]">
              We&apos;d love to hear from you.
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-neutral-600 leading-relaxed">
              Have a question about an order, merchant partnership, or courier dispatch in {appConfig.launchMarket}? Reach out directly or send us a message below.
            </p>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. CONTACT CHANNELS + MESSAGE FORM ───────────────────────────── */}
      <section className="py-10 sm:py-16 bg-neutral-50/40">
        <PageContainer>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 items-start">
            {/* Left: Contact Channels */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
                  Reach us directly.
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                  Our local support desk in Ijebu-Ode is on standby.
                </p>
              </div>

              <div className="space-y-3" aria-label="Contact information">
                {CONTACT_INFO.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="flex items-start gap-3.5 p-3.5 rounded-xl border border-neutral-200/80 bg-white shadow-2xs"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        {label}
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-neutral-900 mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* WhatsApp Quick Trigger */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <p className="text-xs font-semibold text-emerald-900">
                  Prefer instant messaging? Chat with our dispatcher directly.
                </p>
                <WhatsAppCta
                  label="Chat on WhatsApp"
                  message="Hello KingdomDash, I need support."
                />
              </div>

              {/* Social Channels */}
              <div className="pt-2 border-t border-neutral-200/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Follow Our Updates
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={appConfig.socials.instagram.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:text-primary hover:border-primary transition-colors"
                  >
                    <span>@{appConfig.socials.instagram.handle}</span>
                  </a>
                  <a
                    href={appConfig.socials.tiktok.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:text-primary hover:border-primary transition-colors"
                  >
                    <span>@{appConfig.socials.tiktok.handle}</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Clean Message Form */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-5">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-neutral-900">
                    Send us a message
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Fill out the form below and we will respond within 24 hours.
                  </p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField id="contact-name" label="Name" required error={errors.name}>
                      <Input
                        id="contact-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        placeholder="Your full name"
                        value={form.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        aria-describedby={errors.name ? 'contact-name-error' : undefined}
                        aria-invalid={!!errors.name}
                        className="rounded-xl"
                      />
                    </FormField>

                    <FormField id="contact-email" label="Email" required error={errors.email}>
                      <Input
                        id="contact-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        aria-describedby={errors.email ? 'contact-email-error' : undefined}
                        aria-invalid={!!errors.email}
                        className="rounded-xl"
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="contact-phone"
                      label="Phone (Optional)"
                    >
                      <Input
                        id="contact-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="0800 000 0000"
                        value={form.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        className="rounded-xl"
                      />
                    </FormField>

                    <FormField id="contact-subject" label="Subject" required error={errors.subject}>
                      <Input
                        id="contact-subject"
                        name="subject"
                        type="text"
                        placeholder="Topic of inquiry"
                        value={form.subject}
                        onChange={(e) => handleChange('subject', e.target.value)}
                        aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
                        aria-invalid={!!errors.subject}
                        className="rounded-xl"
                      />
                    </FormField>
                  </div>

                  <FormField id="contact-message" label="Message" required error={errors.message}>
                    <Textarea
                      id="contact-message"
                      name="message"
                      placeholder="Tell us how we can help you…"
                      rows={4}
                      value={form.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      aria-describedby={errors.message ? 'contact-message-error' : undefined}
                      aria-invalid={!!errors.message}
                      className="rounded-xl"
                    />
                  </FormField>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-xs"
                  >
                    <span>Send Message</span>
                    <Send className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
