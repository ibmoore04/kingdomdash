import { useState } from 'react'
import { Bike, DollarSign, ClipboardList, ShieldCheck, Zap, Users } from 'lucide-react'
import { Section, PageContainer } from '@/components/layout/section'
import { SectionHeading } from '@/components/shared/section-heading'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiderFormState {
  fullName: string
  email: string
  phone: string
  address: string
  vehicleType: 'petrol' | 'electric' | ''
  vehicleMake: string
  vehicleModel: string
}

interface RiderFormErrors {
  fullName?: string
  email?: string
  phone?: string
  address?: string
  vehicleType?: string
  vehicleMake?: string
  vehicleModel?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_FORM: RiderFormState = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  vehicleType: '',
  vehicleMake: '',
  vehicleModel: '',
}

const RIDER_BENEFITS = [
  {
    icon: DollarSign,
    title: 'Earn on Your Schedule',
    description:
      'Ride when you want, earn what you need. KingdomDash gives you the freedom to set your own hours and keep more of what you earn.',
  },
  {
    icon: Bike,
    title: 'Petrol & Electric Bikes Welcome',
    description:
      'Whether you ride a petrol motorcycle or an electric bike, KingdomDash supports both vehicle types on our platform.',
  },
  {
    icon: ShieldCheck,
    title: 'Rider Safety First',
    description:
      'We require valid licensing and provide safety guidelines. Our support team is available seven days a week to assist you on the road.',
  },
  {
    icon: Zap,
    title: 'Fast Onboarding',
    description:
      'Once your application is approved, onboarding is quick. Submit your documents, complete a brief orientation, and start earning.',
  },
  {
    icon: ClipboardList,
    title: 'Simple Application',
    description:
      'Fill in the form below, and our team will review your application within 2–3 business days. No complicated process.',
  },
  {
    icon: Users,
    title: 'Join a Growing Community',
    description:
      `Become part of the KingdomDash rider network — a team of professionals making delivery faster and more reliable across ${appConfig.launchMarket} and subsequent markets.`,
  },
] as const

const REQUIREMENTS = [
  'Valid Nigerian motorcycle rider licence',
  'A roadworthy petrol or electric motorcycle',
  "Nigerian National ID or Voter's Card",
  'A smartphone capable of running the KingdomDash rider app',
  'Willingness to complete a brief orientation session',
]

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(form: RiderFormState): RiderFormErrors {
  const errors: RiderFormErrors = {}

  if (!form.fullName.trim()) {
    errors.fullName = 'Full name is required.'
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!form.email.includes('@') || !form.email.includes('.')) {
    errors.email = 'Please enter a valid email address.'
  }

  if (!form.phone.trim()) {
    errors.phone = 'Phone number is required.'
  }

  if (!form.address.trim()) {
    errors.address = 'Address is required.'
  }

  if (!form.vehicleType) {
    errors.vehicleType = 'Please select a vehicle type.'
  }

  if (!form.vehicleMake.trim()) {
    errors.vehicleMake = 'Vehicle make is required.'
  }

  if (!form.vehicleModel.trim()) {
    errors.vehicleModel = 'Vehicle model is required.'
  }

  return errors
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BecomeRiderPage() {
  useSeo({
    title: 'Become a Rider',
    description: `Earn on your terms as a verified KingdomDash delivery rider in ${appConfig.launchMarket}. Swift in Motion.`,
  })

  const { pushToast } = useToast()
  const [form, setForm] = useState<RiderFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<RiderFormErrors>({})

  function handleChange(field: keyof RiderFormState, value: string) {
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
      title: 'Application received!',
      message: 'Our team will review your application and reach out within 2–3 business days.',
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
            Ride with Us
          </p>
          <h1 className="max-w-2xl text-display-xl font-bold leading-[0.97] tracking-tight text-white">
            Earn on your terms with KingdomDash.
          </h1>
          <p className="mt-5 max-w-xl text-body-large text-white/60">
            Join our network of verified riders and deliver food, groceries, and packages across {appConfig.launchMarket} — on your schedule, at your pace.
          </p>
        </PageContainer>
      </section>

      {/* Benefits section */}
      <Section id="rider-benefits" tone="soft" spacing="loose">
        <SectionHeading
          eyebrow="Why Ride with Us"
          title="Perks of Being a KingdomDash Rider"
          description="We built our rider programme to be fair, flexible, and rewarding. Here is what you get when you join."
        />

        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3" aria-label="Rider benefits">
          {RIDER_BENEFITS.map(({ icon: Icon, title, description }) => (
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

      {/* Requirements section */}
      <Section id="rider-requirements" tone="light" spacing="tight">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            eyebrow="What You Need"
            title="Rider Requirements"
            description="To ensure safety and reliability for our customers, all KingdomDash riders must meet the following requirements."
          />
          <ul className="mt-8 space-y-3" aria-label="Rider requirements">
            {REQUIREMENTS.map((req) => (
              <li key={req} className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="text-body text-text-secondary">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Application form */}
      <Section id="rider-application" tone="soft" spacing="loose">
        <div className="mx-auto max-w-2xl">
          <SectionHeading
            eyebrow="Apply Now"
            title="Rider Application"
            description="Complete the form below and our team will be in touch within 2–3 business days to discuss the next steps."
          />

          <div className="mt-10 rounded-xl bg-page-background p-6 shadow-sm sm:p-8">
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-5">
                <FormField
                  id="rider-full-name"
                  label="Full Name"
                  required
                  error={errors.fullName}
                >
                  <Input
                    id="rider-full-name"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Your full legal name"
                    value={form.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    aria-describedby={errors.fullName ? 'rider-full-name-error' : undefined}
                    aria-invalid={!!errors.fullName}
                  />
                </FormField>

                <FormField id="rider-email" label="Email" required error={errors.email}>
                  <Input
                    id="rider-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    aria-describedby={errors.email ? 'rider-email-error' : undefined}
                    aria-invalid={!!errors.email}
                  />
                </FormField>

                <FormField id="rider-phone" label="Phone" required error={errors.phone}>
                  <Input
                    id="rider-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+234 800 000 0000"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    aria-describedby={errors.phone ? 'rider-phone-error' : undefined}
                    aria-invalid={!!errors.phone}
                  />
                </FormField>

                <FormField id="rider-address" label="Address" required error={errors.address}>
                  <Input
                    id="rider-address"
                    name="address"
                    type="text"
                    autoComplete="street-address"
                    placeholder="Your residential address"
                    value={form.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    aria-describedby={errors.address ? 'rider-address-error' : undefined}
                    aria-invalid={!!errors.address}
                  />
                </FormField>

                <FormField
                  id="rider-vehicle-type"
                  label="Vehicle Type"
                  required
                  error={errors.vehicleType}
                >
                  <Select
                    value={form.vehicleType}
                    onValueChange={(value) => handleChange('vehicleType', value)}
                  >
                    <SelectTrigger
                      id="rider-vehicle-type"
                      aria-describedby={
                        errors.vehicleType ? 'rider-vehicle-type-error' : undefined
                      }
                      aria-invalid={!!errors.vehicleType}
                    >
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="petrol">Petrol Motorcycle</SelectItem>
                      <SelectItem value="electric">Electric Motorcycle</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  id="rider-vehicle-make"
                  label="Vehicle Make"
                  required
                  error={errors.vehicleMake}
                >
                  <Input
                    id="rider-vehicle-make"
                    name="vehicleMake"
                    type="text"
                    placeholder="e.g. Honda, Yamaha, TVS"
                    value={form.vehicleMake}
                    onChange={(e) => handleChange('vehicleMake', e.target.value)}
                    aria-describedby={errors.vehicleMake ? 'rider-vehicle-make-error' : undefined}
                    aria-invalid={!!errors.vehicleMake}
                  />
                </FormField>

                <FormField
                  id="rider-vehicle-model"
                  label="Vehicle Model"
                  required
                  error={errors.vehicleModel}
                >
                  <Input
                    id="rider-vehicle-model"
                    name="vehicleModel"
                    type="text"
                    placeholder="e.g. CB125, FZ150, Apache 160"
                    value={form.vehicleModel}
                    onChange={(e) => handleChange('vehicleModel', e.target.value)}
                    aria-describedby={errors.vehicleModel ? 'rider-vehicle-model-error' : undefined}
                    aria-invalid={!!errors.vehicleModel}
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
