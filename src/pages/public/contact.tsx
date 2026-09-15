import { useState } from 'react'
import { Mail, Phone, Clock, MapPin } from 'lucide-react'
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
    label: 'Phone',
    value: appConfig.support.phoneDisplay,
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
    // Clear the error for this field as the user types
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
    <>
      {/* ─── HERO SECTION ─────────────────────────────────────────────────── */}
      <section
        data-navbar-theme="light"
        className="relative overflow-hidden bg-white border-b border-border/60 py-16 sm:py-24 lg:py-28"
      >
        {/* Background Team Photo with Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/contact-team-hero.png"
            alt="KingdomDash Support and Operations Team in Ijebu-Ode"
            className="h-full w-full object-cover object-right lg:object-center"
          />
          {/* Smooth gradient fading into white on the left for maximum text contrast */}
          <div
            className="absolute inset-0 bg-white/70 sm:hidden"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/40 sm:via-white/90 sm:to-transparent"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent sm:hidden"
            aria-hidden="true"
          />
        </div>

        <PageContainer className="relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 leading-[1.12]">
              Get in Touch With
              <span className="block text-neutral-900">KingdomDash.</span>
              <span className="sr-only">We'd love to hear from you.</span>
            </h1>
            <p className="mt-4 sm:mt-6 max-w-lg text-sm sm:text-base leading-relaxed text-neutral-600 font-normal">
              We're here to help. Whether you have a question, feedback, or need support with an order, our team is ready to assist you. We strive to respond to all inquiries within 24 hours.
            </p>
          </div>
        </PageContainer>
      </section>

      {/* Contact info + form */}
      <Section id="contact" tone="soft" spacing="loose">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* Left: contact details */}
          <div>
            <SectionHeading
              eyebrow="Contact Details"
              title="Reach us directly."
              description="Use any of the channels below to get in touch with the KingdomDash support team."
              size="large"
            />

            <ul className="mt-10 space-y-6" aria-label="Contact information">
              {CONTACT_INFO.map(({ icon: Icon, label, value }) => (
                <li key={label} className="flex items-start gap-4 border-b border-border pb-6 last:border-0 last:pb-0">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-eyebrow font-semibold uppercase tracking-[0.18em] text-text-muted">
                      {label}
                    </p>
                    <p className="mt-1.5 text-body text-text-primary">{value}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <p className="mb-4 text-body text-text-secondary">
                Prefer a faster response? Chat with us on WhatsApp.
              </p>
              <WhatsAppCta
                label="Chat on WhatsApp"
                message="Hello KingdomDash, I need support."
              />
            </div>
          </div>

          {/* Right: contact form */}
          <div className="rounded-xl border border-border bg-white p-6 sm:p-8">
            <h2 className="mb-6 text-h2 font-bold text-text-primary">Send us a message.</h2>
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-5">
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
                  />
                </FormField>

                <FormField
                  id="contact-phone"
                  label="Phone"
                  hint="Optional — we may use this to follow up on your enquiry."
                >
                  <Input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+234 800 000 0000"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                  />
                </FormField>

                <FormField id="contact-subject" label="Subject" required error={errors.subject}>
                  <Input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    placeholder="What is your message about?"
                    value={form.subject}
                    onChange={(e) => handleChange('subject', e.target.value)}
                    aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
                    aria-invalid={!!errors.subject}
                  />
                </FormField>

                <FormField id="contact-message" label="Message" required error={errors.message}>
                  <Textarea
                    id="contact-message"
                    name="message"
                    placeholder="Tell us how we can help…"
                    rows={5}
                    value={form.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    aria-describedby={errors.message ? 'contact-message-error' : undefined}
                    aria-invalid={!!errors.message}
                  />
                </FormField>

                <Button type="submit" size="lg" className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                  Send Message
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Section>
    </>
  )
}
