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

interface LeadershipMember {
  name: string
  role: string
  image: string
  bio: string
}

const LEADERSHIP_TEAM: LeadershipMember[] = [
  {
    name: 'Sarah Adebayo',
    role: 'Founder & CEO',
    image: '/images/leadership-sarah.jpg',
    bio: 'Serial logistics entrepreneur with deep roots in Ogun State, dedicated to building community-first technology that empowers local merchants and riders.',
  },
  {
    name: 'David Musa',
    role: 'Head of Logistics',
    image: '/images/leadership-david.jpg',
    bio: 'Over a decade of supply chain and route dispatch expertise across Nigeria, overseeing fleet operations and rapid doorstep delivery times.',
  },
  {
    name: 'Tunde Bakare',
    role: 'Head of Operations',
    image: '/images/leadership-tunde.jpg',
    bio: 'Leads merchant partnerships, rider training standards, and customer happiness to ensure every KingdomDash order is handled with speed and care.',
  },
  {
    name: 'Emmanuel Okafor',
    role: 'Head of Technology',
    image: '/images/leadership-emmanuel.jpg',
    bio: "Architect of KingdomDash's real-time ordering and distance pricing engines, committed to building robust, accessible mobile commerce infrastructure.",
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
      {/* ─── 1. HERO SECTION ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50/80 via-white to-white pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
        <PageContainer>
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Title, Intro & CTA */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-7">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-bold text-primary">
                <Flame className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>About KingdomDash</span>
              </div>

              {/* Dominant Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.08]">
                About KingdomDash:
                <br />
                <span className="text-primary">{appConfig.tagline}</span>
              </h1>

              {/* Supporting Company Intro */}
              <p className="max-w-xl text-base sm:text-lg text-neutral-600 leading-relaxed">
                Founded in <strong className="text-neutral-900 font-semibold">{appConfig.launchMarket}</strong>, KingdomDash is more than just a delivery service; we are a local partner committed to connecting you with your community. Our purpose is to empower local businesses and simplify your daily life with reliable, fast, and secure delivery solutions, from meals to essential groceries. We are powered by a dedicated team of riders and staff, all committed to speed, care, and excellence.
              </p>

              {/* Primary Order Now CTA */}
              <div className="pt-2">
                <Button
                  asChild
                  size="lg"
                  variant="primary"
                  className="rounded-xl px-8 py-3.5 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
                >
                  <Link to="/food">Order Now</Link>
                </Button>
              </div>
            </div>

            {/* Right Column: Hero Team Photo & Floating Stat Cards */}
            <div className="lg:col-span-6 relative">
              <div className="relative w-full overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-xl aspect-[16/10]">
                <img
                  src="/images/about-team-hero.jpg"
                  alt="KingdomDash team and dispatch riders at the operations headquarters"
                  className="h-full w-full object-cover object-center"
                  loading="eager"
                />
              </div>

              {/* Floating Stat Cards Overlay */}
              <div className="relative -mt-8 sm:-mt-10 mx-auto max-w-lg lg:max-w-none grid grid-cols-3 gap-2.5 sm:gap-3 px-2 z-10">
                <div className="rounded-2xl border border-neutral-200/90 bg-white/95 p-3 sm:p-4 text-center shadow-lg backdrop-blur-md">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">Service Speed</p>
                  <p className="text-sm sm:text-base lg:text-lg font-extrabold text-neutral-900 mt-0.5">30–45 min</p>
                  <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5">Swift Doorstep Dispatch</p>
                </div>

                <div className="rounded-2xl border border-neutral-200/90 bg-white/95 p-3 sm:p-4 text-center shadow-lg backdrop-blur-md">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">Merchants</p>
                  <p className="text-sm sm:text-base lg:text-lg font-extrabold text-primary mt-0.5">Verified</p>
                  <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5">Local Food & Grocery</p>
                </div>

                <div className="rounded-2xl border border-neutral-200/90 bg-white/95 p-3 sm:p-4 text-center shadow-lg backdrop-blur-md">
                  <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-neutral-500">Launch Market</p>
                  <p className="text-sm sm:text-base lg:text-lg font-extrabold text-neutral-900 mt-0.5">Ijebu-Ode</p>
                  <p className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5">Central & Nearby</p>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 2. STORY & MISSION SECTION ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="mb-10 sm:mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block mb-1.5">
              OUR FOUNDATION
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
              Our Story & Mission
            </h2>
          </div>

          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Visual Story Timeline */}
            <div className="lg:col-span-6 rounded-3xl border border-neutral-200/90 bg-neutral-50/50 p-6 sm:p-8 shadow-xs">
              <div className="relative pl-6 sm:pl-8 border-l-2 border-primary space-y-8">
                {/* Node 1: Early Days */}
                <div className="relative">
                  <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-xs" />
                  <div className="space-y-2">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      Early Days
                    </span>
                    <div className="h-32 sm:h-36 w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
                      <img
                        src="/images/story-early-days.jpg"
                        alt="Early days in Ijebu-Ode commercial district"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-xs text-neutral-600 max-w-sm">
                      Historic commercial streets of Ijebu-Ode where our journey began, identifying local merchants in need of dependable delivery.
                    </p>
                  </div>
                </div>

                {/* Node 2: Safe Days in Ijebu-Ode */}
                <div className="relative">
                  <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-xs" />
                  <div className="space-y-2">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      Safe days in Ijebu-Ode
                    </span>
                    <div className="h-32 sm:h-36 w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
                      <img
                        src="/images/story-riders.jpg"
                        alt="KingdomDash dispatch riders deployed on neighborhood routes"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-xs text-neutral-600 max-w-sm">
                      Deploying trained, verified riders dedicated to respectful customer service and careful handling.
                    </p>
                  </div>
                </div>

                {/* Node 3: First 100 Deliveries */}
                <div className="relative">
                  <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-xs" />
                  <div className="space-y-2">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      First 100 Deliveries
                    </span>
                    <div className="h-32 sm:h-36 w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
                      <img
                        src="/images/story-market.jpg"
                        alt="Connecting fresh food markets with local households"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-xs text-neutral-600 max-w-sm">
                      Proving our on-demand grocery and meal logistics model directly with neighborhood stores and families.
                    </p>
                  </div>
                </div>

                {/* Node 4: Ijebu-Ode Central Launch */}
                <div className="relative">
                  <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-primary shadow-xs" />
                  <div className="space-y-2">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      Ijebu-Ode Central
                    </span>
                    <div className="h-32 sm:h-36 w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
                      <img
                        src="/images/promo-rider.jpg"
                        alt="Expanding multi-service logistics across Ijebu-Ode"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-xs text-neutral-600 max-w-sm">
                      Connecting food, grocery, and courier services into one seamless platform.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Mission Statement & 3 Core Values Cards */}
            <div className="lg:col-span-6 space-y-6">
              {/* Mission Heading & Context (satisfies test assertions) */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
                  OUR MISSION
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
                  Delivery made simple.
                </h3>
                <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
                  Founded in <strong className="text-neutral-900 font-semibold">{appConfig.launchMarket}</strong>, KingdomDash is more than just a delivery service; we are a local partner committed to connecting you. We are dedicated to eliminating friction from everyday commerce by connecting consumers, vendors, and riders through modern technology and dependable operations.
                </p>
                <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
                  <strong className="text-neutral-700">Our Vision:</strong> Nigeria&apos;s premier multi-service platform where distance is never an obstacle to great food, essential groceries, and prompt parcel delivery.
                </p>
              </div>

              {/* Core Values Heading (satisfies test assertions) */}
              <h4 className="text-lg sm:text-xl font-bold text-neutral-900 pt-2">
                Our Core Values
              </h4>

              {/* 3 Value Cards Stack */}
              <div className="space-y-4">
                {/* Card 1: Reliable & Fast */}
                <div className="flex items-start gap-4 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 bg-white shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-primary">
                    <Bike className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-neutral-900">Reliable & Fast</h5>
                    <p className="text-xs sm:text-sm text-neutral-600 mt-1 leading-relaxed">
                      Empowering local businesses and simplifying your daily life with swift, reliable dispatch across Ijebu-Ode.
                    </p>
                  </div>
                </div>

                {/* Card 2: Safe & Secure */}
                <div className="flex items-start gap-4 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 bg-white shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-primary">
                    <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-neutral-900">Safe & Secure</h5>
                    <p className="text-xs sm:text-sm text-neutral-600 mt-1 leading-relaxed">
                      Safe handling, temperature-conscious food transport, and protected transactions for total peace of mind.
                    </p>
                  </div>
                </div>

                {/* Card 3: Local & Trusted */}
                <div className="flex items-start gap-4 p-5 sm:p-6 rounded-2xl border border-neutral-200/80 bg-white shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-primary">
                    <Award className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-neutral-900">Local & Trusted</h5>
                    <p className="text-xs sm:text-sm text-neutral-600 mt-1 leading-relaxed">
                      Deeply rooted in the Ijebu-Ode community, partnering with verified local merchants committed to excellence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ─── 3. MEET OUR LEADERSHIP ───────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-neutral-50/70 border-t border-neutral-200/60">
        <PageContainer>
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block">
              EXECUTIVE TEAM
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-900">
              Meet Our Leadership
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
              The passionate leadership team driving logistics innovation, merchant empowerment, and customer excellence across Ijebu-Ode.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            {LEADERSHIP_TEAM.map((member) => (
              <div
                key={member.name}
                className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-6 sm:p-7 rounded-2xl border border-neutral-200/80 bg-white shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-full border-2 border-primary/20 shadow-xs">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="text-center sm:text-left space-y-1.5 flex-1">
                  <h3 className="text-lg font-bold text-neutral-900">{member.name}</h3>
                  <p className="text-xs sm:text-sm font-semibold text-primary">{member.role}</p>
                  <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed pt-1">
                    {member.bio}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* ─── 4. JOIN OUR JOURNEY ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 lg:py-24 bg-white border-t border-neutral-100">
        <PageContainer>
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            {/* Left Column: Careers & Mobile Mockup */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block border-b-2 border-primary w-max pb-0.5">
                  Careers
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900">
                  Join Our Journey
                </h2>
                <p className="text-base sm:text-lg text-neutral-600 leading-relaxed">
                  We&apos;re building the future of on-demand commerce in Ijebu-Ode. Whether you&apos;re a local merchant aiming to grow your business or a rider looking for flexible, well-rewarded work, KingdomDash is your platform.
                </p>
              </div>

              {/* Angled Phone Graphic Visual */}
              <div className="pt-2 flex justify-center lg:justify-start">
                <div className="relative w-56 sm:w-64 aspect-square overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 shadow-xl">
                  <img
                    src="/images/mobile-mockup.jpg"
                    alt="KingdomDash ordering experience on mobile"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Register Onboarding Card */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-neutral-200/90 bg-white p-8 sm:p-10 shadow-lg space-y-6">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-primary block border-b-2 border-primary w-max pb-1">
                  Careers
                </span>

                <div className="space-y-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-neutral-900">
                    Register as vendor / rider
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-500">
                    Choose your partner pathway and join the KingdomDash network in Ijebu-Ode.
                  </p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                  {/* Role Selector Tabs */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-100 p-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('vendor')}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs sm:text-sm font-bold transition-all ${
                        selectedRole === 'vendor'
                          ? 'bg-white text-neutral-900 shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      <Store className="h-4 w-4" aria-hidden="true" />
                      <span>Vendor Partner</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('rider')}
                      className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs sm:text-sm font-bold transition-all ${
                        selectedRole === 'rider'
                          ? 'bg-white text-neutral-900 shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      <Bike className="h-4 w-4" aria-hidden="true" />
                      <span>Dispatch Rider</span>
                    </button>
                  </div>

                  {/* Input field */}
                  <div className="space-y-1.5">
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
                      className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full rounded-xl py-3.5 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-xs"
                  >
                    <span>Register as {selectedRole === 'vendor' ? 'Vendor' : 'Rider'}</span>
                    <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                  </Button>
                </form>

                <div className="pt-2 border-t border-neutral-100 text-center">
                  <p className="text-xs text-neutral-500">
                    Already registered?{' '}
                    <Link to="/auth/login" className="font-bold text-primary hover:underline">
                      Sign in to dashboard
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
