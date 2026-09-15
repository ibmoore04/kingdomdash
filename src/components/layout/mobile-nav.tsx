import { useEffect, useRef } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { X, ShoppingBag, User } from 'lucide-react'
import { useUiStore } from '@/stores/ui-store'
import { useCartStore } from '@/stores/cart-store'
import { useAuthStore } from '@/stores/auth-store'
import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
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

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function MobileNav() {
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)
  const itemCount = useCartStore((state) => state.getItemCount())
  const setCartOpen = useCartStore((state) => state.setCartOpen)
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)

  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mobileNavOpen) return

    const dialog = dialogRef.current
    if (!dialog) return

    const focusableElements = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    const firstFocusable = focusableElements[0]
    firstFocusable?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileNavOpen(false)
        return
      }

      if (event.key === 'Tab') {
        const currentFocusableElements = dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        const currentFirst = currentFocusableElements[0]
        const currentLast = currentFocusableElements[currentFocusableElements.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === currentFirst) {
            event.preventDefault()
            currentLast?.focus()
          }
        } else {
          if (document.activeElement === currentLast) {
            event.preventDefault()
            currentFirst?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileNavOpen, setMobileNavOpen])

  if (!mobileNavOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-near-black/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
        onClick={() => setMobileNavOpen(false)}
      />

      {/* Drawer Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
        className="fixed inset-y-0 right-0 flex w-full max-w-xs flex-col bg-white text-text-primary shadow-2xl z-50 border-l border-border"
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border">
          <Logo />
          <button
            type="button"
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-text-secondary hover:bg-neutral-100 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setMobileNavOpen(false)}
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Links — Exact 7 items */}
        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-4 py-6">
          <ul className="flex flex-col gap-1.5">
            {navLinks.map(({ label, to }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between rounded-xl px-4 py-3 text-body-small font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-text-secondary hover:bg-neutral-50 hover:text-text-primary'
                    )
                  }
                >
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom Actions: Cart & Auth */}
        <div className="border-t border-border p-5 space-y-3 bg-neutral-50/50">
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false)
              setCartOpen(true)
            }}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-body-small font-semibold text-text-primary shadow-xs hover:bg-neutral-50"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>Your Cart</span>
            </div>
            {itemCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                {itemCount}
              </span>
            ) : (
              <span className="text-caption text-text-muted">Empty</span>
            )}
          </button>

          {session ? (
            <Button asChild variant="outline" className="w-full justify-center rounded-xl py-2.5">
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
                onClick={() => setMobileNavOpen(false)}
              >
                <User className="h-4 w-4 mr-2 text-primary" aria-hidden="true" />
                <span>Dashboard ({profile?.full_name?.split(' ')[0] || 'Account'})</span>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="primary" className="w-full justify-center rounded-xl py-2.5 text-button font-bold bg-primary hover:bg-primary-hover text-white hover:text-white shadow-xs">
              <Link to="/auth/login" onClick={() => setMobileNavOpen(false)}>
                Sign In
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
