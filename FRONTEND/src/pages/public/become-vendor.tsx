import { useState } from 'react'
import {
  Store,
  ShoppingBasket,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  PhoneCall,
  Sparkles,
  ArrowRight,
  UtensilsCrossed,
  Layers,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/section'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'
import { generateWhatsAppLink } from '@/utils/whatsapp'

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

const INITIAL_FORM: VendorFormState = {
  businessName: '',
  businessType: 'restaurant',
  ownerName: '',
  email: '',
  phone: '',
  businessAddress: '',
  description: '',
}

const VENDOR_PERKS = [
  {
    icon: TrendingUp,
    title: 'More Orders Every Day',
    description: 'Connect with hungry customers and grocery shoppers in Ijebu-Ode who want rapid delivery to their doorstep.',
  },
  {
    icon: Store,
    title: 'Dedicated Rider Fleet',
    description: 'No need to hire your own dispatch riders. Verified KingdomDash couriers handle pickup and delivery seamlessly.',
  },
  {
    icon: CreditCard,
    title: 'Zero Upfront Fees & Fast Payouts',
    description: 'Free onboarding with no initial setup cost. Automated weekly settlements straight to your designated bank account.',
  },
  {
    icon: Sparkles,
    title: 'Live Merchant Dashboard',
    description: 'Track ongoing orders, toggle item availability, manage menus, and monitor customer reviews in real time.',
  },
] as const

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Submit Application',
    description: 'Fill in your business details, operating address, and menu/inventory overview in the form.',
  },
  {
    step: '02',
    title: 'Menu & Store Setup',
    description: 'Our merchant success team will digitize your catalog and configure your vendor dashboard account.',
  },
  {
    step: '03',
    title: 'Start Receiving Orders',
    description: 'Receive orders on your tablet or smartphone, pack the item, and hand it to our dispatch rider!',
  },
]

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

export default function BecomeVendorPage() {
  useSeo({
    title: 'Become a Vendor',
    description: `Partner with KingdomDash as a restaurant or grocery store in ${appConfig.launchMarket}. Grow your orders with zero setup fees.`,
  })

  const { pushToast } = useToast()
  const [form, setForm] = useState<VendorFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<VendorFormErrors>({})
  const [activeTab, setActiveTab] = useState<'perks' | 'steps'>('perks')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [volumeTier, setVolumeTier] = useState<'moderate' | 'high'>('moderate')

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
      message: 'Our merchant team will review your application and be in touch within 2–3 business days.',
    })

    setIsSubmitted(true)
  }

  function handleReset() {
    setForm(INITIAL_FORM)
    setErrors({})
    setIsSubmitted(false)
  }

  const whatsappInquiryUrl = generateWhatsAppLink(
    `Hello KingdomDash! I want to inquire about listing my restaurant or grocery store in ${appConfig.launchMarket}.`
  )

  return (
    <div className="bg-white text-neutral-900 min-h-[calc(100vh-140px)]">
      {/* ─── COMPACT PAGE HEADER (NO HERO BANNER) ─────────────────────────── */}
      <section className="pt-8 pb-6 border-b border-neutral-100 bg-neutral-50/60">
        <PageContainer>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-0.5 text-xs font-semibold text-primary mb-2.5">
              <Store className="w-3.5 h-3.5 text-primary" />
              Merchant Partner Programme
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              Grow Your Kitchen or Store with KingdomDash
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-neutral-600">
              Reach thousands of loyal customers in Ijebu-Ode. Zero upfront listing fees, seamless dispatch, and prompt weekly bank payouts.
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
                  Partner Benefits
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('steps')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                    activeTab === 'steps'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  How It Works
                </button>
              </div>

              {/* Tab 1: Perks */}
              {activeTab === 'perks' && (
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  {VENDOR_PERKS.map((perk) => {
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

                  {/* Interactive Growth Projection Card */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-neutral-200 bg-neutral-900 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        Projected Monthly Sales Boost
                      </span>
                      <div className="flex gap-1 bg-neutral-800 p-0.5 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => setVolumeTier('moderate')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                            volumeTier === 'moderate'
                              ? 'bg-primary text-white'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          ~20 orders/day
                        </button>
                        <button
                          type="button"
                          onClick={() => setVolumeTier('high')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                            volumeTier === 'high'
                              ? 'bg-primary text-white'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          ~50+ orders/day
                        </button>
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className="text-2xl font-black text-white tracking-tight">
                        {volumeTier === 'high' ? '+ ₦1,200,000 – ₦2,500,000' : '+ ₦450,000 – ₦900,000'}
                        <span className="text-xs font-normal text-neutral-400 ml-1.5">est. monthly volume</span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        {volumeTier === 'high'
                          ? 'Estimated new gross sales generated for established restaurants and grocery hubs.'
                          : 'Estimated extra sales from nearby diners and delivery customers in Ijebu-Ode.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: How It Works */}
              {activeTab === 'steps' && (
                <div className="p-5 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 space-y-4 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">3-Step Onboarding Process</h3>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      From application to first order in under 48 hours:
                    </p>
                  </div>
                  <div className="space-y-4 pt-1">
                    {HOW_IT_WORKS_STEPS.map((item) => (
                      <div key={item.step} className="flex items-start gap-3.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white text-xs font-bold">
                          {item.step}
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-neutral-900">{item.title}</h4>
                          <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-neutral-200/60">
                    <p className="text-xs text-neutral-500">
                      Our onboarding managers provide full photo assistance and digital catalog upload for your store.
                    </p>
                  </div>
                </div>
              )}

              {/* Need help badge */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-100 bg-neutral-50 text-xs text-neutral-600">
                <span className="flex items-center gap-2 font-medium">
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                  Need merchant assistance?
                </span>
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                >
                  Chat with Vendor Desk &rarr;
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
                        Thank you for applying, <strong className="text-neutral-900">{form.businessName}</strong>. Our merchant success team will review your submission and contact you within 2–3 business days.
                      </p>
                    </div>

                    <div className="max-w-md mx-auto p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-left text-xs space-y-2">
                      <p className="font-semibold text-neutral-800">Next steps for your store:</p>
                      <ul className="space-y-1.5 text-neutral-600 list-disc list-inside">
                        <li>Our team verifies your store location and operational menu/catalog.</li>
                        <li>You'll receive vendor portal login credentials and training on managing orders.</li>
                        <li>Your store goes live on KingdomDash Food & Groceries!</li>
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
                        <h2 className="text-lg font-bold text-neutral-900">Vendor Application Form</h2>
                        <p className="text-xs text-neutral-500 mt-0.5">Quick 3-minute onboarding setup</p>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        Free Onboarding
                      </span>
                    </div>

                    <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
                      {/* Business Type Selector (Interactive Pill Cards) */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                          Business Type <span className="text-primary">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Business Type">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={form.businessType === 'restaurant'}
                            onClick={() => handleChange('businessType', 'restaurant')}
                            className={`flex sm:flex-col items-center sm:items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                              form.businessType === 'restaurant'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50'
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                form.businessType === 'restaurant'
                                  ? 'bg-primary text-white'
                                  : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              <UtensilsCrossed className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm font-bold text-neutral-900">Restaurant</p>
                              <p className="text-[11px] text-neutral-500">Cooked meals</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            role="radio"
                            aria-checked={form.businessType === 'grocery_store'}
                            onClick={() => handleChange('businessType', 'grocery_store')}
                            className={`flex sm:flex-col items-center sm:items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                              form.businessType === 'grocery_store'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50'
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                form.businessType === 'grocery_store'
                                  ? 'bg-primary text-white'
                                  : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              <ShoppingBasket className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm font-bold text-neutral-900">Grocery Store</p>
                              <p className="text-[11px] text-neutral-500">Foodstuffs & items</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            role="radio"
                            aria-checked={form.businessType === 'both'}
                            onClick={() => handleChange('businessType', 'both')}
                            className={`flex sm:flex-col items-center sm:items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                              form.businessType === 'both'
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50'
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                form.businessType === 'both'
                                  ? 'bg-primary text-white'
                                  : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              <Layers className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm font-bold text-neutral-900">Both Services</p>
                              <p className="text-[11px] text-neutral-500">Meals & groceries</p>
                            </div>
                          </button>
                        </div>
                        {errors.businessType && (
                          <p id="vendor-business-type-error" className="mt-1 text-xs text-primary">
                            {errors.businessType}
                          </p>
                        )}
                      </div>

                      {/* Business Name & Owner Name Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          id="vendor-business-name"
                          label="Business / Store Name"
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
                          id="vendor-owner-name"
                          label="Owner / Contact Person"
                          required
                          error={errors.ownerName}
                        >
                          <Input
                            id="vendor-owner-name"
                            name="ownerName"
                            type="text"
                            autoComplete="name"
                            placeholder="e.g. Titilayo Adeleke"
                            value={form.ownerName}
                            onChange={(e) => handleChange('ownerName', e.target.value)}
                            aria-describedby={errors.ownerName ? 'vendor-owner-name-error' : undefined}
                            aria-invalid={!!errors.ownerName}
                          />
                        </FormField>
                      </div>

                      {/* Email & Phone Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField id="vendor-email" label="Contact Email Address" required error={errors.email}>
                          <Input
                            id="vendor-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="store@example.com"
                            value={form.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            aria-describedby={errors.email ? 'vendor-email-error' : undefined}
                            aria-invalid={!!errors.email}
                          />
                        </FormField>

                        <FormField id="vendor-phone" label="Phone / WhatsApp Number" required error={errors.phone}>
                          <Input
                            id="vendor-phone"
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            placeholder="0801 234 5678"
                            value={form.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            aria-describedby={errors.phone ? 'vendor-phone-error' : undefined}
                            aria-invalid={!!errors.phone}
                          />
                        </FormField>
                      </div>

                      {/* Business Address */}
                      <FormField
                        id="vendor-business-address"
                        label="Physical Store Address in Ijebu-Ode"
                        required
                        error={errors.businessAddress}
                      >
                        <Input
                          id="vendor-business-address"
                          name="businessAddress"
                          type="text"
                          autoComplete="street-address"
                          placeholder="e.g. 28 Ibadan Road, Beside Total Filling Station, Ijebu-Ode"
                          value={form.businessAddress}
                          onChange={(e) => handleChange('businessAddress', e.target.value)}
                          aria-describedby={errors.businessAddress ? 'vendor-business-address-error' : undefined}
                          aria-invalid={!!errors.businessAddress}
                        />
                      </FormField>

                      {/* Business Description / Menu Highlights */}
                      <FormField
                        id="vendor-description"
                        label="Store Description & Popular Offerings"
                        required
                        error={errors.description}
                        hint="Tell us about your specialties (e.g. Jollof rice, shawarma, fresh fruits, daily provisions)."
                      >
                        <Textarea
                          id="vendor-description"
                          name="description"
                          placeholder="Briefly describe what you sell, your popular dishes/products, and current operating hours…"
                          rows={3}
                          value={form.description}
                          onChange={(e) => handleChange('description', e.target.value)}
                          aria-describedby={errors.description ? 'vendor-description-error' : undefined}
                          aria-invalid={!!errors.description}
                        />
                      </FormField>

                      <div className="pt-2">
                        <Button
                          type="submit"
                          size="lg"
                          className="w-full rounded-xl font-bold text-white bg-primary hover:bg-primary-hover shadow-xs transition-all"
                        >
                          Submit Merchant Application
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>

                      <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
                        By submitting, you agree to partner with KingdomDash under standard merchant terms. No upfront listing fees apply.
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
