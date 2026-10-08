import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Flame,
  Bike,
  ShieldCheck,
  Award,
  ArrowRight,
  Store,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { useSeo } from '@/hooks/use-seo'

const CORE_VALUES = [
  {
    title: 'Reliable & Fast',
    description: 'Empowering local businesses and simplifying your daily life with swift, reliable dispatch across Ijebu-Ode.',
    icon: Bike,
  },
  {
    title: 'Safe & Secure',
    description: 'Safe handling, temperature-conscious food transport, and protected transactions for total peace of mind.',
    icon: ShieldCheck,
  },
  {
    title: 'Local & Trusted',
    description: 'Deeply rooted in the Ijebu-Ode community, partnering with verified local merchants committed to excellence.',
    icon: Award,
  },
]

const OPERATIONAL_PILLARS = [
  {
    title: 'Local First for Ijebu-Ode',
    description: 'Purpose-built for the unique geography, landmarks, and road networks of Ijebu-Ode, ensuring genuine 30–45 minute doorstep delivery.',
    icon: Bike,
  },
  {
    title: 'Transparent Pricing Engine',
    description: 'No inflated guesswork. Fair distance-based fees calculated by geodesic kilometers, ensuring clarity for customers and fair wages for riders.',
    icon: ShieldCheck,
  },
  {
    title: 'Merchant & Rider Empowerment',
    description: 'Providing local kitchens, grocers, and freelance dispatch riders with modern digital tools to expand their businesses and livelihoods.',
    icon: Store,
  },
  {
    title: 'Powered by Excellence. Guided by Grace.',
    description: 'Our driving philosophy is simple: serve every customer with utmost diligence, speed, and integrity on every single order.',
    icon: Award,
  },
]

export default function AboutPage() {
  useSeo({
    title: 'About Us — Swift in Motion',
    description: `Learn about KingdomDash — Nigeria's multi-service delivery platform launching in ${appConfig.launchMarket}. Food, groceries, and courier dispatch. Swift in Motion.`,
  })

  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<'vendor' | 'rider'>('vendor')
  const [contactInput, setContactInput] = useState('')

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedRole === 'vendor') {
      navigate('/become-vendor')
    } else {
      navigate('/become-rider')
    }
  }

  return (
    <div className="bg-white text-text-primary overflow-x-hidden">
      {/* ─── 1. STREAMLINED HERO SECTION ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50/70 via-white to-white pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-14 lg:pb-20">
        <PageContainer>
          <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Title & Mission intro */}
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-bold text-primary">
                <Flame className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>About KingdomDash</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.1]">
                About KingdomDash:
                <br />
                <span className="text-primary">{appConfig.tagline}</span>
              </h1>

              <p className="max-w-xl text-sm sm:text-base text-neutral-600 leading-relaxed">
                Founded in <strong className="text-neutral-900 font-semibold">{appConfig.launchMarket}</strong>, KingdomDash is more than just a delivery service; we are a local partner committed to connecting you with your community. Our purpose is to empower local businesses and simplify your daily life with reliable, fast, and secure delivery solutions.
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  variant="primary"
                  className="rounded-xl px-7 py-2.5 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
                >
                  <Link to="/food">Order Now</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-xl px-5 py-2.5 text-sm font-bold border-neutral-300"
                >
                  <Link to="/services">Explore Services</Link>
                </Button>
              </div>
            </div>

            {/* Right Column: Hero Visual */}
            <div className="lg:col-span-5 relative">
              <div className="relative w-full overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-md aspect-[16/11]">
                <img
                  src="/images/about-team-hero.jpg"
                  alt="KingdomDash team and dispatch riders at the operations headquarters"
                  className="h-full w-full object-cover object-center"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. MISSION & CORE VALUES SECTION ─────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="max-w-3xl space-y-4 mb-10 sm:mb-12">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
              OUR MISSION
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
              Delivery made simple.
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
              Founded in <strong className="text-neutral-900 font-semibold">{appConfig.launchMarket}</strong>, KingdomDash is dedicated to eliminating friction from everyday commerce. We connect consumers, local vendors, and dispatch riders through intuitive technology and dependable on-the-ground operations.
            </p>
            <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
              <strong className="text-neutral-800 font-semibold">Our Vision:</strong> Nigeria&apos;s premier multi-service platform where distance is never an obstacle to great food, essential groceries, and prompt parcel delivery.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-xl font-bold text-neutral-900">
              Our Core Values
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              {CORE_VALUES.map((value) => {
                const Icon = value.icon
                return (
                  <div
                    key={value.title}
                    className="flex flex-col p-5 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 hover:bg-white hover:border-primary/30 hover:shadow-2xs transition-all space-y-2.5"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h4 className="text-base font-bold text-neutral-900">{value.title}</h4>
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. OPERATIONAL COMMITMENT ────────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-neutral-50/60 border-t border-neutral-100">
        <PageContainer>
          <div className="max-w-2xl mb-8 sm:mb-10 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
              AUTHENTIC LOGISTICS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              Built for Ijebu-Ode. Backed by Real Operations.
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600">
              We have built the physical infrastructure, local partnerships, and technology to make every order reliable.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OPERATIONAL_PILLARS.map((pillar) => {
              const Icon = pillar.icon
              return (
                <div
                  key={pillar.title}
                  className="p-5 rounded-2xl border border-neutral-200/80 bg-white shadow-2xs space-y-2"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900">{pillar.title}</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              )
            })}
          </div>
        </PageContainer>
      </section>

      {/* ─── 4. JOIN OUR JOURNEY (ONBOARDING) ─────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="max-w-2xl mx-auto rounded-3xl border border-neutral-200/90 bg-white p-6 sm:p-10 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                CAREERS &amp; PARTNERSHIPS
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                Join Our Journey
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 max-w-lg mx-auto">
                We&apos;re building the future of on-demand commerce in Ijebu-Ode. Grow your business as a vendor or earn flexibly as a dispatch rider.
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-100 p-1">
                <button
                  type="button"
                  onClick={() => setSelectedRole('vendor')}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs sm:text-sm font-bold transition-all ${
                    selectedRole === 'vendor'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Store className="h-4 w-4" aria-hidden="true" />
                  <span>Vendor Partner</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('rider')}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs sm:text-sm font-bold transition-all ${
                    selectedRole === 'rider'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Bike className="h-4 w-4" aria-hidden="true" />
                  <span>Dispatch Rider</span>
                </button>
              </div>

              <div className="space-y-1">
                <label htmlFor="contact-input" className="block text-xs font-semibold text-neutral-700">
                  {selectedRole === 'vendor' ? 'Business email or phone' : 'Rider mobile phone number'}
                </label>
                <input
                  id="contact-input"
                  type="text"
                  value={contactInput}
                  onChange={(e) => setContactInput(e.target.value)}
                  placeholder={
                    selectedRole === 'vendor'
                      ? 'e.g. vendor@restaurant.com or 08012345678'
                      : 'e.g. 08012345678'
                  }
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full rounded-xl py-3 text-xs sm:text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
              >
                <span>Register as {selectedRole === 'vendor' ? 'Vendor' : 'Rider'}</span>
                <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden="true" />
              </Button>

              <div className="pt-2 text-center">
                <p className="text-xs text-neutral-500">
                  Already registered?{' '}
                  <Link to="/auth/login" className="font-bold text-primary hover:underline">
                    Sign in to dashboard
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
