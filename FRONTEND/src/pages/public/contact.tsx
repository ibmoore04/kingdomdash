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

            {/* Official Social Media Channels */}
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-eyebrow font-semibold uppercase tracking-[0.18em] text-text-muted mb-3">
                Follow Us Online
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={appConfig.socials.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-text-primary hover:border-primary hover:text-primary transition-colors shadow-xs"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span>@{appConfig.socials.instagram.handle}</span>
                </a>
                <a
                  href={appConfig.socials.tiktok.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-text-primary hover:border-primary hover:text-primary transition-colors shadow-xs"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                  <span>@{appConfig.socials.tiktok.handle}</span>
                </a>
              </div>
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
