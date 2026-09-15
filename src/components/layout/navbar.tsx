import { useState, useEffect } from 'react'
import { Menu, ShoppingBag, User } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/layout/logo'
import { useUiStore } from '@/stores/ui-store'
import { useCartStore } from '@/stores/cart-store'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/cn'

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Food', to: '/food' },
  { label: 'Grocery', to: '/groceries' },
  { label: 'Courier', to: '/courier' },
  { label: 'Contact', to: '/contact' },
] as const

const DESKTOP_BREAKPOINT = 1024

export function Navbar() {
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const itemCount = useCartStore((state) => state.getItemCount())
  const setCartOpen = useCartStore((state) => state.setCartOpen)
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)

  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= DESKTOP_BREAKPOINT) {
        setMobileNavOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setMobileNavOpen])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b transition-all duration-200',
        scrolled ? 'border-border shadow-xs py-2.5' : 'border-border/60 py-3.5'
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Logo */}
        <div className="shrink-0">
          <Logo />
        </div>

        {/* Desktop Navigation Links — Exact 7 items in order */}
        <nav
          aria-label="Main navigation"
          className="hidden lg:flex items-center gap-1 xl:gap-2 shrink-0"
        >
          {navLinks.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative px-3 py-1.5 text-body-small font-medium transition-colors duration-150 rounded-lg whitespace-nowrap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'text-primary font-bold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-primary after:rounded-full'
                    : 'text-text-secondary hover:text-text-primary hover:bg-neutral-50'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Action Controls: Cart & Sign In */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Cart Trigger */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-text-secondary hover:bg-neutral-100 hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Open shopping cart with ${itemCount} items`}
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {itemCount > 0 && (
              <span
                data-testid="cart-badge-desktop"
                className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white shadow-xs"
              >
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </button>

          {/* Customer Auth Action */}
          {session ? (
            <Link
              to={
                profile?.role === 'vendor'
                  ? '/vendor'
                  : profile?.role === 'rider'
                  ? '/rider'
                  : profile?.role === 'admin'
                  ? '/admin'
                  : '/dashboard'
              }
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-neutral-50 hover:bg-neutral-100 px-3 py-2 text-body-small font-semibold text-text-primary transition-colors"
            >
              <User className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>{profile?.full_name?.split(' ')[0] || 'Account'}</span>
            </Link>
          ) : (
            <Button
              asChild
              size="sm"
              variant="primary"
              className="hidden sm:inline-flex rounded-lg px-5 py-2 text-button font-bold whitespace-nowrap bg-primary hover:bg-primary-hover text-white hover:text-white shadow-xs"
            >
              <Link to="/auth/login">Sign In</Link>
            </Button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            aria-label="Open navigation menu"
            className="lg:hidden rounded-lg p-2 text-text-secondary hover:bg-neutral-100 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
