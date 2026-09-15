import { useState } from 'react'
import { Store, ShoppingBasket, ClipboardList, CheckCircle } from 'lucide-react'
import { Section, PageContainer } from '@/components/layout/section'
import { SectionHeading } from '@/components/shared/section-heading'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useSeo } from '@/hooks/use-seo'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorFormState {
  businessName: string
  businessType: 'restaurant' | 'grocery_store' | 'both' | ''
  ownerName: string
  email: string
  phone: string
  businessAddress: string
  description: string
}

interface VendorFormErrors {
  businessName?: string
  businessType?: string
  ownerName?: string
  email?: string
  phone?: string
  businessAddress?: string
  description?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_FORM: VendorFormState = {
  businessName: '',
  businessType: '',
  ownerName: '',
  email: '',
  phone: '',
  businessAddress: '',
  description: '',
}

const VENDOR_BENEFITS = [
  {
    icon: Store,
    title: 'Restaurants & Food Vendors',
    description:
      'List your menu, receive orders directly from hungry customers nearby, and grow your delivery reach without the overhead of building your own logistics.',
  },
  {
    icon: ShoppingBasket,
    title: 'Grocery Stores & Markets',
    description:
      'Offer your full inventory to shoppers who want fresh groceries delivered to their door. We handle the riders — you focus on stocking great products.',
  },
  {
    icon: ClipboardList,
    title: 'Simple Application Process',
    description:
      'Fill in the form below and our team will review your application. We aim to respond within 2–3 business days. Once approved, onboarding takes under an hour.',
  },
  {
    icon: CheckCircle,
    title: 'Grow with KingdomDash',
    description:
      'Access real-time dashboards, order management tools, and a growing customer base — all with zero upfront fees during your first month.',
  },
] as const

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(form: VendorFormState): VendorFormErrors {
  const errors: VendorFormErrors = {}

  if (!form.businessName.trim()) {
    errors.businessName = 'Business name is required.'
  }

  if (!form.businessType) {
    errors.businessType = 'Please select a business type.'
  }

  if (!form.ownerName.trim()) {
    errors.ownerName = 'Owner name is required.'
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!form.email.includes('@') || !form.email.includes('.')) {
    errors.email = 'Please enter a valid email address.'
  }

  if (!form.phone.trim()) {
    errors.phone = 'Phone number is required.'
  }

  if (!form.businessAddress.trim()) {
    errors.businessAddress = 'Business address is required.'
  }

  if (!form.description.trim()) {
    errors.description = 'Description is required.'
  }

  return errors
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BecomeVendorPage() {
  useSeo({
    title: 'Become a Vendor',
    description: 'Partner with KingdomDash as a restaurant or grocery store in Ijebu-Ode, Ogun State. Swift in Motion.',
  })

  const { pushToast } = useToast()
  const [form, setForm] = useState<VendorFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<VendorFormErrors>({})

  function handleChange(field: keyof VendorFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
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
      title: 'Application submitted!',
      message: 'Our team will review your application and be in touch within 2–3 business days.',
    })

    setForm(INITIAL_FORM)
    setErrors({})
  }

  return (
    <>
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────── */}
      <section data-navbar-theme="dark" className="bg-near-black py-20 sm:py-28">
        <PageContainer>
          <p className="mb-4 text-eyebrow font-semibold uppercase tracking-[0.22em] text-primary">
            Partner with Us
          </p>
          <h1 className="max-w-2xl text-display-xl font-bold leading-[0.97] tracking-tight text-white">
            Grow your business with KingdomDash.
          </h1>
          <p className="mt-5 max-w-xl text-body-large text-white/60">
            Join our network of restaurants and grocery stores — connect with thousands of customers looking for fast, reliable delivery.
          </p>
        </PageContainer>
      </section>

      {/* Benefits section */}
      <Section id="vendor-benefits" tone="soft" spacing="loose">
        <SectionHeading
          eyebrow="Why Join"
          title="Everything You Need to Succeed"
          description="Whether you run a restaurant or a grocery store, KingdomDash gives you the tools and reach to grow your business without the hassle."
        />

        <ul className="mt-12 grid gap-8 sm:grid-cols-2" aria-label="Vendor benefits">
          {VENDOR_BENEFITS.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-hover">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-h4 text-text-primary">{title}</h3>
                <p className="mt-1 text-body text-text-secondary">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Application form */}
      <Section id="vendor-application" tone="light" spacing="loose">
        <div className="mx-auto max-w-2xl">
          <SectionHeading
            eyebrow="Apply Now"
            title="Vendor Application"
            description="Complete the form below and our team will be in touch within 2–3 business days to discuss next steps."
          />

          <div className="mt-10 rounded-xl bg-page-background p-6 shadow-sm sm:p-8">
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-5">
                <FormField
                  id="vendor-business-name"
                  label="Business Name"
                  required
                  error={errors.businessName}
                >
                  <Input
                    id="vendor-business-name"
                    name="businessName"
                    type="text"
                    autoComplete="organization"
                    placeholder="e.g. Mama Tee's Kitchen"
                    value={form.businessName}
                    onChange={(e) => handleChange('businessName', e.target.value)}
                    aria-describedby={errors.businessName ? 'vendor-business-name-error' : undefined}
                    aria-invalid={!!errors.businessName}
                  />
                </FormField>

                <FormField
                  id="vendor-business-type"
                  label="Business Type"
                  required
                  error={errors.businessType}
                >
                  <Select
                    value={form.businessType}
                    onValueChange={(value) => handleChange('businessType', value)}
                  >
                    <SelectTrigger
                      id="vendor-business-type"
                      aria-describedby={
                        errors.businessType ? 'vendor-business-type-error' : undefined
                      }
                      aria-invalid={!!errors.businessType}
                    >
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">Restaurant (Food)</SelectItem>
                      <SelectItem value="grocery_store">Grocery Store</SelectItem>
                      <SelectItem value="both">Both (Food & Grocery Store)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  id="vendor-owner-name"
                  label="Owner Name"
                  required
                  error={errors.ownerName}
                >
                  <Input
                    id="vendor-owner-name"
                    name="ownerName"
                    type="text"
                    autoComplete="name"
                    placeholder="Full name of the business owner"
                    value={form.ownerName}
                    onChange={(e) => handleChange('ownerName', e.target.value)}
                    aria-describedby={errors.ownerName ? 'vendor-owner-name-error' : undefined}
                    aria-invalid={!!errors.ownerName}
                  />
                </FormField>

                <FormField id="vendor-email" label="Email" required error={errors.email}>
                  <Input
                    id="vendor-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    aria-describedby={errors.email ? 'vendor-email-error' : undefined}
                    aria-invalid={!!errors.email}
                  />
                </FormField>

                <FormField id="vendor-phone" label="Phone" required error={errors.phone}>
                  <Input
                    id="vendor-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+234 800 000 0000"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    aria-describedby={errors.phone ? 'vendor-phone-error' : undefined}
                    aria-invalid={!!errors.phone}
                  />
                </FormField>

                <FormField
                  id="vendor-business-address"
                  label="Business Address"
                  required
                  error={errors.businessAddress}
                >
                  <Input
                    id="vendor-business-address"
                    name="businessAddress"
                    type="text"
                    autoComplete="street-address"
                    placeholder="Full address of your business"
                    value={form.businessAddress}
                    onChange={(e) => handleChange('businessAddress', e.target.value)}
                    aria-describedby={
                      errors.businessAddress ? 'vendor-business-address-error' : undefined
                    }
                    aria-invalid={!!errors.businessAddress}
                  />
                </FormField>

                <FormField
                  id="vendor-description"
                  label="Description"
                  required
                  error={errors.description}
                  hint="Tell us about your business, what you offer, and why you want to join KingdomDash."
                >
                  <Textarea
                    id="vendor-description"
                    name="description"
                    placeholder="Describe your business and what makes it special…"
                    rows={5}
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    aria-describedby={errors.description ? 'vendor-description-error' : undefined}
                    aria-invalid={!!errors.description}
                  />
                </FormField>

                <Button type="submit" size="lg" className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                  Submit Application
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Section>
    </>
  )
}
