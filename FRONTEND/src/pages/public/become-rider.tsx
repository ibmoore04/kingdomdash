import { useState } from 'react'
import {
  Bike,
  DollarSign,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Check,
  PhoneCall,
  Sparkles,
  ArrowRight,
  BatteryCharging,
  Fuel,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/section'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'
import { generateWhatsAppLink } from '@/utils/whatsapp'

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

const INITIAL_FORM: RiderFormState = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  vehicleType: 'petrol',
  vehicleMake: '',
  vehicleModel: '',
}

const PERKS = [
  {
    icon: DollarSign,
    title: 'Earn Weekly, Keep Tips',
    description: 'Competitive per-drop rates + 100% of tips. Automated payouts straight to your bank every Monday.',
  },
  {
    icon: Zap,
    title: 'Flexible Shifts',
    description: 'Log in whenever you want. Work mornings, evenings, or weekends around your schedule.',
  },
  {
    icon: Fuel,
    title: 'Petrol & EV Welcome',
    description: 'Ride petrol bikes or modern electric motorcycles — both are fully supported across our fleet.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety & Local Support',
    description: 'Local Ijebu-Ode dispatch desk available 7 days a week for route or delivery assistance.',
  },
] as const

const REQUIREMENTS = [
  'Valid Nigerian rider licence (motorcycle)',
  'Roadworthy motorcycle (petrol or electric)',
  'National ID (NIN) or Voter’s Card',
  'Android or iOS smartphone with data',
  'Age 18+ with knowledge of Ijebu-Ode routes',
]

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

export default function BecomeRiderPage() {
  useSeo({
    title: 'Become a Rider',
    description: `Earn on your terms as a verified KingdomDash delivery rider in ${appConfig.launchMarket}. Fast weekly payouts and flexible shifts.`,
  })

  const { pushToast } = useToast()
  const [form, setForm] = useState<RiderFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<RiderFormErrors>({})
  const [activeTab, setActiveTab] = useState<'perks' | 'requirements'>('perks')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [calcLevel, setCalcLevel] = useState<'part_time' | 'full_time'>('full_time')

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
      message: 'Our operations team will review your application within 2–3 business days.',
    })

    setIsSubmitted(true)
  }

  function handleReset() {
    setForm(INITIAL_FORM)
    setErrors({})
    setIsSubmitted(false)
  }

  const whatsappInquiryUrl = generateWhatsAppLink(
    `Hello KingdomDash! I have a question about applying as a delivery rider in ${appConfig.launchMarket}.`
  )

  return (
    <div className="bg-white text-neutral-900 min-h-[calc(100vh-140px)]">
      {/* ─── COMPACT PAGE HEADER (NO HERO BANNER) ─────────────────────────── */}
      <section className="pt-8 pb-6 border-b border-neutral-100 bg-neutral-50/60">
        <PageContainer>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-0.5 text-xs font-semibold text-primary mb-2.5">
              <Bike className="w-3.5 h-3.5 text-primary" />
              Rider Fleet Onboarding
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              Ride & Earn on Your Terms
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-neutral-600">
              Join Ijebu-Ode’s fastest delivery fleet. Pick your hours, earn steady weekly income, and enjoy full dispatch support.
            </p>
          </div>
        </PageContainer>
      </section>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <section className="py-8 sm:py-12">
        <PageContainer>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            
            {/* Left Column: Interactive Overview & Perks */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Tab Switcher */}
              <div className="flex p-1 bg-neutral-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('perks')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    activeTab === 'perks'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  Why Ride With Us
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('requirements')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    activeTab === 'requirements'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  What You Need
                </button>
              </div>

              {/* Tab 1: Perks */}
              {activeTab === 'perks' && (
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  {PERKS.map((perk) => {
                    const Icon = perk.icon
                    return (
                      <div
                        key={perk.title}
                        className="group flex items-start gap-3.5 p-4 rounded-xl border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 hover:shadow-xs transition-all"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-neutral-900">{perk.title}</h3>
                          <p className="mt-0.5 text-xs sm:text-sm text-neutral-600 leading-relaxed">
                            {perk.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}

                  {/* Interactive Earnings Estimate Card */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 bg-neutral-900 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Estimated Earnings
                      </span>
                      <div className="flex gap-1 bg-neutral-800 p-0.5 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => setCalcLevel('part_time')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                            calcLevel === 'part_time'
                              ? 'bg-primary text-white'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Part-time
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalcLevel('full_time')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                            calcLevel === 'full_time'
                              ? 'bg-primary text-white'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          Full-time
                        </button>
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className="text-2xl font-black text-white tracking-tight">
                        {calcLevel === 'full_time' ? '₦75,000 – ₦110,000+' : '₦35,000 – ₦55,000'}
                        <span className="text-xs font-normal text-neutral-400 ml-1.5">/ week</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        {calcLevel === 'full_time'
                          ? 'Based on ~25–35 completed deliveries/day + peak-hour surge bonuses.'
                          : 'Based on ~10–15 deliveries/day during lunch or evening shifts.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Requirements */}
              {activeTab === 'requirements' && (
                <div className="p-5 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 space-y-4 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Application Checklist</h3>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      Ensure you have these essentials before proceeding with the form:
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {REQUIREMENTS.map((req) => (
                      <li key={req} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-700">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t border-neutral-200/60">
                    <p className="text-xs text-neutral-500">
                      Orientation is held weekly in Ijebu-Ode. You'll receive full safety gear and rider kit upon document verification.
                    </p>
                  </div>
                </div>
              )}

              {/* Need help badge */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-100 bg-neutral-50 text-xs text-neutral-600">
                <span className="flex items-center gap-2 font-medium">
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                  Have onboarding questions?
                </span>
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                >
                  Chat on WhatsApp &rarr;
                </a>
              </div>
            </div>

            {/* Right Column: Application Form */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs">
                {isSubmitted ? (
                  /* ─── SUCCESS CONFIRMATION STATE ────────────────────────── */
                  <div className="text-center py-8 space-y-4 animate-in fade-in">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-neutral-900">
                        Application Received!
                      </h2>
                      <p className="text-sm text-neutral-600 max-w-md mx-auto mt-2">
                        Thank you for applying, <strong className="text-neutral-900">{form.fullName}</strong>. Our fleet management team will review your details and contact you within 2–3 business days.
                      </p>
                    </div>

                    <div className="max-w-md mx-auto p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-left text-xs space-y-2">
                      <p className="font-semibold text-neutral-800">What happens next?</p>
                      <ul className="space-y-1.5 text-neutral-600 list-disc list-inside">
                        <li>We verify your motorcycle and rider licence info.</li>
                        <li>You'll receive a phone call and invitation to rider orientation in Ijebu-Ode.</li>
                        <li>Get your KingdomDash app access and start delivering!</li>
                      </ul>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReset}
                        className="rounded-xl w-full sm:w-auto text-xs font-semibold"
                      >
                        Submit Another Application
                      </Button>
                      <Link to="/" className="w-full sm:w-auto">
                        <Button className="rounded-xl w-full text-xs font-semibold text-white bg-primary hover:bg-primary-hover">
                          Back to Public Website
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* ─── APPLICATION FORM ─────────────────────────────────── */
                  <div>
                    <div className="flex items-center justify-between pb-5 border-b border-neutral-100 mb-6">
                      <div>
                        <h2 className="text-lg font-bold text-neutral-900">Rider Application Form</h2>
                        <p className="text-xs text-neutral-500 mt-0.5">Quick 2-minute registration</p>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        Fast Review
                      </span>
                    </div>

                    <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                      {/* Full Name */}
                      <FormField
                        id="rider-full-name"
                        label="Full Legal Name"
                        required
                        error={errors.fullName}
                      >
                        <Input
                          id="rider-full-name"
                          name="fullName"
                          type="text"
                          autoComplete="name"
                          placeholder="e.g. Babatunde Adeleke"
                          value={form.fullName}
                          onChange={(e) => handleChange('fullName', e.target.value)}
                          aria-describedby={errors.fullName ? 'rider-full-name-error' : undefined}
                          aria-invalid={!!errors.fullName}
                        />
                      </FormField>

                      {/* Email & Phone Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField id="rider-email" label="Email Address" required error={errors.email}>
                          <Input
                            id="rider-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="babatunde@example.com"
                            value={form.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            aria-describedby={errors.email ? 'rider-email-error' : undefined}
                            aria-invalid={!!errors.email}
                          />
                        </FormField>

                        <FormField id="rider-phone" label="Phone Number" required error={errors.phone}>
                          <Input
                            id="rider-phone"
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            placeholder="0801 234 5678"
                            value={form.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            aria-describedby={errors.phone ? 'rider-phone-error' : undefined}
                            aria-invalid={!!errors.phone}
                          />
                        </FormField>
                      </div>

                      {/* Residential Address */}
                      <FormField id="rider-address" label="Residential Address in Ijebu-Ode" required error={errors.address}>
                        <Input
                          id="rider-address"
                          name="address"
                          type="text"
                          autoComplete="street-address"
                          placeholder="e.g. 14 Awujale Street, Ijebu-Ode"
                          value={form.address}
                          onChange={(e) => handleChange('address', e.target.value)}
                          aria-describedby={errors.address ? 'rider-address-error' : undefined}
                          aria-invalid={!!errors.address}
                        />
                      </FormField>

                      {/* Interactive Vehicle Type Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                          Vehicle Type <span className="text-primary">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Vehicle Type">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={form.vehicleType === 'petrol'}
                            onClick={() => handleChange('vehicleType', 'petrol')}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              form.vehicleType === 'petrol'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50'
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                form.vehicleType === 'petrol'
                                  ? 'bg-primary text-white'
                                  : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              <Fuel className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-neutral-900">Petrol Bike</p>
                              <p className="text-[11px] text-neutral-500 truncate">Standard motorcycle</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            role="radio"
                            aria-checked={form.vehicleType === 'electric'}
                            onClick={() => handleChange('vehicleType', 'electric')}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              form.vehicleType === 'electric'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50'
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                form.vehicleType === 'electric'
                                  ? 'bg-primary text-white'
                                  : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              <BatteryCharging className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-neutral-900">Electric Bike</p>
                              <p className="text-[11px] text-neutral-500 truncate">Eco-friendly EV</p>
                            </div>
                          </button>
                        </div>
                        {errors.vehicleType && (
                          <p id="rider-vehicle-type-error" className="mt-1 text-xs text-primary">
                            {errors.vehicleType}
                          </p>
                        )}
                      </div>

                      {/* Make & Model Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            placeholder="e.g. Bajaj, Honda, TVS"
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
                            placeholder="e.g. Boxer 100, Ace 110"
                            value={form.vehicleModel}
                            onChange={(e) => handleChange('vehicleModel', e.target.value)}
                            aria-describedby={errors.vehicleModel ? 'rider-vehicle-model-error' : undefined}
                            aria-invalid={!!errors.vehicleModel}
                          />
                        </FormField>
                      </div>

                      <div className="pt-2">
                        <Button
                          type="submit"
                          size="lg"
                          className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-xs transition-all"
                        >
                          Submit Rider Application
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>

                      <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
                        By submitting, you agree to KingdomDash’s rider terms and confirm that you possess a roadworthy motorcycle and valid riding licence.
                      </p>
                    </form>
                  </div>
                )}
              </div>
            </div>

          </div>
        </PageContainer>
      </section>
    </div>
  )
}
