import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/section'
import { appConfig } from '@/config/app.config'

const companyLinks = [
  { label: 'About Us', to: '/about' },
  { label: 'Become a Vendor', to: '/become-vendor' },
  { label: 'Become a Rider', to: '/become-rider' },
  { label: 'Our Services', to: '/services' },
]

const serviceLinks = [
  { label: 'Food Delivery', to: '/food' },
  { label: 'Grocery Delivery', to: '/groceries' },
  { label: 'Courier Dispatch', to: '/courier' },
]

const supportLinks = [
  { label: 'Contact Us', to: '/contact' },
  { label: 'Frequently Asked Questions', to: '/faq' },
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
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Brand & Mission Column */}
          <div className="lg:col-span-4 space-y-5">
            <Logo inverted />
            <p className="text-body-small leading-relaxed text-white/60 max-w-sm">
              Nigeria&apos;s fast, dependable multi-service delivery platform. Ordering meals, fresh groceries, and dispatching parcels across <strong className="text-white">Ijebu-Ode, Ogun State</strong> with speed and care.
            </p>

            <div className="space-y-2 pt-2 text-caption text-white/50">
              <a
                href={`mailto:${appConfig.support.email}`}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Mail className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <span>{appConfig.support.email}</span>
              </a>
              <a
                href={`tel:${appConfig.support.phoneDisplay.replace(/\s/g, '')}`}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Phone className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <span>{appConfig.support.phoneDisplay}</span>
              </a>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2 text-white/60">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-full border border-white/15 flex items-center justify-center hover:text-white hover:border-primary hover:bg-primary transition-all"
                aria-label="Facebook"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-full border border-white/15 flex items-center justify-center hover:text-white hover:border-primary hover:bg-primary transition-all"
                aria-label="Instagram"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-full border border-white/15 flex items-center justify-center hover:text-white hover:border-primary hover:bg-primary transition-all"
                aria-label="X (Twitter)"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links Columns */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {/* Company */}
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

            {/* Services */}
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

            {/* Support & Legal */}
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
                <li>
                  <Link to="/about" className="text-white/60 hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-white/60 hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Newsletter / Updates Column */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-eyebrow font-bold uppercase tracking-[0.16em] text-white/50">
              Stay in Motion
            </h3>
            <p className="text-body-small text-white/60">
              Get updates on new restaurant launches, seasonal menus, and delivery promotions in Ijebu-Ode.
            </p>

            {subscribed ? (
              <div className="rounded-xl bg-primary/15 border border-primary/30 p-3.5 text-caption text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <span>Thank you! You&apos;re on the KingdomDash list.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <div className="flex rounded-2xl overflow-hidden border border-white/20 focus-within:border-primary transition-colors bg-white/5">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full bg-transparent px-3.5 py-2.5 text-body-small text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="rounded-none rounded-r-2xl px-4 bg-primary hover:bg-primary-hover text-white font-bold shrink-0 border-0"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-caption text-white/40">
          <p>&copy; {currentYear} {appConfig.name}. All rights reserved. <span className="text-primary font-bold">{appConfig.tagline}</span></p>
          <p className="flex items-center gap-1.5">
            <span>Made with <span className="text-primary">❤️</span> in Ijebu-Ode, Ogun State, Nigeria</span>
          </p>
        </div>
      </PageContainer>
    </footer>
  )
}
