import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/section'
import { appConfig } from '@/config/app.config'

const companyLinks = [
  { label: 'About Us', to: '/about' },
  { label: 'Our Services', to: '/services' },
  { label: 'Become a Vendor', to: '/become-vendor' },
  { label: 'Become a Rider', to: '/become-rider' },
]

const serviceLinks = [
  { label: 'Food Delivery', to: '/food' },
  { label: 'Grocery Delivery', to: '/groceries' },
  { label: 'Courier Dispatch', to: '/courier' },
  { label: 'Personal Shopper', to: '/personal-shopper' },
]

const supportLinks = [
  { label: 'Contact Us', to: '/contact' },
  { label: 'Help & FAQs', to: '/faq' },
  { label: 'Support Center', to: '/support' },
  { label: 'Refund Policy', to: '/refund-policy' },
]

const accountLinks = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Orders', to: '/dashboard/orders' },
  { label: 'Saved Addresses', to: '/dashboard/addresses' },
  { label: 'Rewards & Passes', to: '/dashboard/rewards' },
  { label: 'Profile', to: '/dashboard/profile' },
]

const businessLinks = [
  { label: 'Corporate Courier', to: '/business' },
  { label: 'Vendor Portal', to: '/vendor' },
  { label: 'Rider Portal', to: '/rider' },
  { label: 'Partner Onboarding', to: '/become-vendor' },
]

export function Footer() {
  const currentYear = new Date().getFullYear()
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubscribed(true)
    setEmail('')
  }

  return (
    <footer className="border-t border-white/10 bg-near-black text-white">
      <PageContainer className="py-14 sm:py-18">
        {/* Main Grid: Brand + 5 Nav Columns */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          {/* Brand & Mission Column */}
          <div className="lg:col-span-4 space-y-5">
            <Logo inverted />
            <p className="text-body-small leading-relaxed text-white/60 max-w-sm">
              Nigeria&apos;s fast, dependable multi-service delivery platform. Ordering meals, fresh groceries, and dispatching parcels across <strong className="text-white">Ijebu-Ode, Ogun State</strong> with speed and care.
            </p>

            <p className="text-xs italic text-primary/90 font-medium">
              &ldquo;{appConfig.philosophy}&rdquo;
            </p>

            <div className="space-y-2 pt-1 text-caption text-white/60">
              <a
                href={`mailto:${appConfig.support.email}`}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Mail className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <span>{appConfig.support.email}</span>
              </a>
              <a
                href={`tel:${appConfig.support.phoneRaw}`}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Phone className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <span>{appConfig.support.phoneDisplay} (Calls)</span>
              </a>
              <a
                href={appConfig.socials.whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4 text-emerald-500 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.971.53 1.777.781 2.796.781 3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.769-5.768zm3.389 8.163c-.144.405-.837.774-1.17.822-.312.043-.687.069-2.12-.524-1.722-.713-2.83-2.47-2.916-2.584-.086-.115-.694-.925-.694-1.764s.434-1.25.59-1.42c.156-.17.34-.213.454-.213.114 0 .227.002.326.006.104.004.244-.04.382.291.144.344.492 1.2.535 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.287-.087.101-.182.226-.26.304-.087.087-.178.182-.077.355.101.173.45 1.002 1.203 1.671.97.863 1.789 1.131 2.043 1.257.254.126.402.105.552-.068.15-.173.642-.748.814-1.005.173-.257.346-.214.582-.127.236.087 1.498.706 1.755.834.257.128.428.19.49.297.062.107.062.622-.082 1.027z" />
                </svg>
                <span>{appConfig.whatsapp.phoneDisplay} (WhatsApp)</span>
              </a>
            </div>

            {/* Official Social Media Channels (Instagram & TikTok) */}
            <div className="flex items-center gap-3 pt-2 text-white/60">
              {/* Instagram */}
              <a
                href={appConfig.socials.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-full border border-white/15 flex items-center justify-center hover:text-white hover:border-primary hover:bg-primary transition-all"
                aria-label={`Instagram @${appConfig.socials.instagram.handle}`}
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>

              {/* TikTok */}
              <a
                href={appConfig.socials.tiktok.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-full border border-white/15 flex items-center justify-center hover:text-white hover:border-primary hover:bg-primary transition-all"
                aria-label={`TikTok @${appConfig.socials.tiktok.handle}`}
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </a>

              {/* WhatsApp Quick Chat */}
              <a
                href={appConfig.socials.whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-full border border-white/15 flex items-center justify-center hover:text-white hover:border-emerald-500 hover:bg-emerald-600 transition-all"
                aria-label="Chat on WhatsApp"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.971.53 1.777.781 2.796.781 3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.769-5.768zm3.389 8.163c-.144.405-.837.774-1.17.822-.312.043-.687.069-2.12-.524-1.722-.713-2.83-2.47-2.916-2.584-.086-.115-.694-.925-.694-1.764s.434-1.25.59-1.42c.156-.17.34-.213.454-.213.114 0 .227.002.326.006.104.004.244-.04.382.291.144.344.492 1.2.535 1.288.043.088.072.19.014.305-.058.115-.087.187-.173.287-.087.101-.182.226-.26.304-.087.087-.178.182-.077.355.101.173.45 1.002 1.203 1.671.97.863 1.789 1.131 2.043 1.257.254.126.402.105.552-.068.15-.173.642-.748.814-1.005.173-.257.346-.214.582-.127.236.087 1.498.706 1.755.834.257.128.428.19.49.297.062.107.062.622-.082 1.027z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links Columns: 5 Columns (Company, Services, Support, Account, Business) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8">
            {/* 1. Company */}
            <div>
              <h3 className="text-eyebrow font-bold uppercase tracking-[0.16em] text-white/50 mb-4">
                Company
              </h3>
              <ul className="space-y-2.5 text-body-small">
                {companyLinks.map(({ label, to }) => (
                  <li key={to}>
                    <Link to={to} className="text-white/60 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Services */}
            <div>
              <h3 className="text-eyebrow font-bold uppercase tracking-[0.16em] text-white/50 mb-4">
                Services
              </h3>
              <ul className="space-y-2.5 text-body-small">
                {serviceLinks.map(({ label, to }) => (
                  <li key={to}>
                    <Link to={to} className="text-white/60 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. Support */}
            <div>
              <h3 className="text-eyebrow font-bold uppercase tracking-[0.16em] text-white/50 mb-4">
                Support
              </h3>
              <ul className="space-y-2.5 text-body-small">
                {supportLinks.map(({ label, to }) => (
                  <li key={to}>
                    <Link to={to} className="text-white/60 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. Account */}
            <div>
              <h3 className="text-eyebrow font-bold uppercase tracking-[0.16em] text-white/50 mb-4">
                Account
              </h3>
              <ul className="space-y-2.5 text-body-small">
                {accountLinks.map(({ label, to }) => (
                  <li key={to}>
                    <Link to={to} className="text-white/60 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 5. Business */}
            <div>
              <h3 className="text-eyebrow font-bold uppercase tracking-[0.16em] text-white/50 mb-4">
                Business
              </h3>
              <ul className="space-y-2.5 text-body-small">
                {businessLinks.map(({ label, to }) => (
                  <li key={to}>
                    <Link to={to} className="text-white/60 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="mt-12 pt-8 border-t border-white/10 grid gap-6 md:grid-cols-12 md:items-center">
          <div className="md:col-span-6 space-y-1">
            <h3 className="text-body font-bold text-white">
              Stay in Motion with KingdomDash
            </h3>
            <p className="text-body-small text-white/60">
              Get updates on new restaurant launches, seasonal menus, and delivery promotions in Ijebu-Ode.
            </p>
          </div>
          <div className="md:col-span-6">
            {subscribed ? (
              <div className="rounded-xl bg-primary/15 border border-primary/30 p-3.5 text-caption text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <span>Thank you! You&apos;re on the KingdomDash list.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex rounded-2xl overflow-hidden border border-white/20 focus-within:border-primary transition-colors bg-white/5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="w-full bg-transparent px-4 py-2.5 text-body-small text-white placeholder:text-white/40 focus:outline-none"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="rounded-none rounded-r-2xl px-5 bg-primary hover:bg-primary-hover text-white font-bold shrink-0 border-0"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Bar: Copyright, Philosophy & Legal Policy Links */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-caption text-white/50">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-center md:text-left">
            <p>&copy; {currentYear} {appConfig.name}. All rights reserved.</p>
            <span className="hidden md:inline">&bull;</span>
            <p className="text-primary font-bold">{appConfig.tagline}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-white/60">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <span>&bull;</span>
            <Link to="/refund-policy" className="hover:text-white transition-colors">
              Refund & Cancellation
            </Link>
          </div>

          <p className="flex items-center gap-1.5">
            <span>Ijebu-Ode, Ogun State, Nigeria</span>
          </p>
        </div>
      </PageContainer>
    </footer>
  )
}

