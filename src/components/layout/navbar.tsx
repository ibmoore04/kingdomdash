import { useState, useEffect, useRef } from 'react'
import { ShoppingBag, User, LogOut, LayoutDashboard, LogIn, UserPlus, Gift, Search, Volume2, VolumeX } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/layout/logo'
import { OmniboxSearchModal } from '@/components/shared/omnibox-search-modal'
import { useCartStore } from '@/stores/cart-store'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { isGlobalSoundEnabled, setGlobalSoundEnabled } from '@/utils/audio-chime'
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

export function Navbar() {
  const itemCount = useCartStore((state) => state.getItemCount())
  const setCartOpen = useCartStore((state) => state.setCartOpen)
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const signOut = useAuthStore((state) => state.signOut)

  const [scrolled, setScrolled] = useState(false)
  const [isCartBouncing, setIsCartBouncing] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSoundMuted, setIsSoundMuted] = useState(false)
  const prevCountRef = useRef(itemCount)

  // Listen for global sound preference changes
  useEffect(() => {
    setIsSoundMuted(!isGlobalSoundEnabled())
    const handleSoundToggle = (e: Event) => {
      const custom = e as CustomEvent<{ enabled: boolean }>
      setIsSoundMuted(!custom.detail?.enabled)
    }
    window.addEventListener('kd:sound-preference-changed', handleSoundToggle)
    return () => window.removeEventListener('kd:sound-preference-changed', handleSoundToggle)
  }, [])

  const handleToggleSound = () => {
    const nextEnabled = isSoundMuted
    setGlobalSoundEnabled(nextEnabled)
    setIsSoundMuted(!nextEnabled)
    useUiStore.getState().pushToast({
      title: nextEnabled ? 'Audio Alerts Enabled' : 'Library Mode Activated',
      message: nextEnabled
        ? 'Synthesized order and dispatch chimes are now audible.'
        : 'All synthesized alerts are muted. Vibration cues remain active.',
      variant: nextEnabled ? 'success' : 'info',
    })
  }

  // Global Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setIsCartBouncing(true)
      const timer = setTimeout(() => setIsCartBouncing(false), 600)
      return () => clearTimeout(timer)
    }
    prevCountRef.current = itemCount
  }, [itemCount])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const dashboardUrl =
    profile?.role === 'vendor'
      ? '/vendor'
      : profile?.role === 'rider'
      ? '/rider'
      : profile?.role === 'admin'
      ? '/admin'
      : '/dashboard'

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
          className="hidden lg:flex items-center gap-0.5 xl:gap-1.5 shrink"
        >
          {navLinks.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative px-2 xl:px-2.5 py-1.5 text-xs xl:text-sm font-medium transition-colors duration-150 rounded-lg whitespace-nowrap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'text-primary font-bold after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary after:rounded-full'
                    : 'text-text-secondary hover:text-text-primary hover:bg-neutral-50'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Action Controls: Search, Cart & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 xl:gap-3 shrink-0 ml-auto">
          {/* Omnibox Search Trigger Button */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search dishes and restaurants"
            className="flex h-9 w-9 sm:h-10 sm:w-auto items-center justify-center sm:justify-start gap-1.5 sm:gap-2 rounded-xl border border-neutral-200/90 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-300 px-0 sm:px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-2xs cursor-pointer"
          >
            <Search className="h-4 w-4 text-neutral-500 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline text-neutral-600 font-medium">Search dishes, stores...</span>
            <span className="hidden sm:inline xl:hidden text-neutral-600 font-medium">Search</span>
            <kbd className="hidden sm:inline-flex items-center rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
              ⌘K
            </kbd>
          </button>

          {/* Quick Sound / Library Mode Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            className={cn(
              'relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer',
              isSoundMuted && 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700'
            )}
            title={isSoundMuted ? 'Library Mode Active (Tap to unmute alerts)' : 'Mute Sound Alerts (Library Mode)'}
            aria-label={isSoundMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {isSoundMuted ? (
              <VolumeX className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-600 hover:text-neutral-900" aria-hidden="true" />
            )}
            {isSoundMuted && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* Cart Trigger */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className={cn(
              'relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isCartBouncing && 'animate-cart-spring text-primary'
            )}
            aria-label={`Open shopping cart with ${itemCount} items`}
          >
            <ShoppingBag
              className={cn(
                'h-5 w-5 transition-transform duration-300',
                isCartBouncing && 'text-primary'
              )}
              aria-hidden="true"
            />
            {itemCount > 0 && (
              <span
                data-testid="cart-badge-desktop"
                className={cn(
                  'absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white shadow-xs transition-all duration-300',
                  isCartBouncing && 'animate-cart-spring ring-2 ring-primary/40'
                )}
              >
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </button>

          {/* Customer Auth / Profile Action */}
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="User account menu"
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-neutral-50 hover:bg-neutral-100 px-2.5 sm:px-3 py-2 text-body-small font-semibold text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <User className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="hidden sm:inline">{profile?.full_name?.split(' ')[0] || 'Account'}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="border-b border-border/80 px-3 py-2">
                  <p className="text-body-small font-bold text-text-primary truncate">
                    {profile?.full_name || 'My Account'}
                  </p>
                  <p className="text-[11px] text-text-muted capitalize">
                    {profile?.role || 'Customer'}
                  </p>
                </div>
                <DropdownMenuItem asChild>
                  <Link to={dashboardUrl} className="flex w-full items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-primary" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                {(!profile?.role || profile?.role === 'customer') && (
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard?tab=rewards" className="flex w-full items-center gap-2">
                      <Gift className="h-4 w-4 text-amber-600" />
                      <span>Rewards &amp; Passes</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2 text-primary focus:bg-primary-soft focus:text-primary"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {/* Mobile Profile Trigger (Unauthenticated) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account options"
                    className="flex h-10 w-10 sm:hidden items-center justify-center rounded-full text-text-secondary hover:bg-neutral-100 hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <User className="h-5 w-5" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link to="/auth/login" className="flex w-full items-center gap-2">
                      <LogIn className="h-4 w-4 text-primary" />
                      <span>Sign In</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/auth/register" className="flex w-full items-center gap-2">
                      <UserPlus className="h-4 w-4 text-primary" />
                      <span>Create Account</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Desktop Sign In Button */}
              <Button
                asChild
                size="sm"
                variant="primary"
                className="hidden sm:inline-flex rounded-lg px-5 py-2 text-button font-bold whitespace-nowrap bg-primary hover:bg-primary-hover text-white hover:text-white shadow-xs"
              >
                <Link to="/auth/login">Sign In</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Universal Omnibox Search Modal */}
      <OmniboxSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </header>
  )
}
