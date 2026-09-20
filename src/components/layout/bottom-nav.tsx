import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  MoreHorizontal,
  Info,
  Briefcase,
  Phone,
  X,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface NavItem {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const primaryNavItems: NavItem[] = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Food', to: '/food', icon: UtensilsCrossed },
  { label: 'Grocery', to: '/groceries', icon: ShoppingBag },
  { label: 'Courier', to: '/courier', icon: Bike },
]

const secondaryNavItems = [
  { label: 'About', to: '/about', icon: Info, description: 'Learn about our mission & story' },
  { label: 'Services', to: '/services', icon: Briefcase, description: 'Explore all platform solutions' },
  { label: 'Contact', to: '/contact', icon: Phone, description: 'Get in touch with support' },
] as const

export function BottomNav() {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const location = useLocation()
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const isMoreActive = ['/about', '/services', '/contact'].some((path) =>
    location.pathname.startsWith(path)
  )

  // Close sheet on route change
  useEffect(() => {
    setIsMoreOpen(false)
  }, [location.pathname])

  // Handle escape key and focus management
  useEffect(() => {
    if (!isMoreOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreOpen(false)
        moreButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMoreOpen])

  return (
    <>
      {/* Backdrop overlay for More Menu */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-40 bg-near-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 lg:hidden"
          aria-hidden="true"
          onClick={() => setIsMoreOpen(false)}
        />
      )}

      {/* More Menu Bottom Sheet */}
      {isMoreOpen && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="More navigation options"
          id="mobile-more-menu"
          className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 mx-auto max-w-md px-4 pb-2 animate-in slide-in-from-bottom-4 duration-200 lg:hidden"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
            {/* Sheet Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-neutral-50/70">
              <span className="text-body-small font-bold text-text-primary tracking-tight">More</span>
              <button
                type="button"
                aria-label="Close more options menu"
                className="rounded-lg p-1.5 text-text-secondary hover:bg-neutral-200/60 hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => {
                  setIsMoreOpen(false)
                  moreButtonRef.current?.focus()
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Secondary Navigation List */}
            <nav aria-label="Secondary navigation" className="p-2">
              <ul className="space-y-1">
                {secondaryNavItems.map(({ label, to, icon: Icon, description }) => {
                  const isActive = location.pathname === to
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        onClick={() => setIsMoreOpen(false)}
                        className={cn(
                          'flex items-center justify-between rounded-xl px-3.5 py-3 text-body-small transition-all',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          isActive
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-text-primary hover:bg-neutral-100/80 font-medium'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                              isActive
                                ? 'bg-primary text-white shadow-xs'
                                : 'bg-neutral-100 text-text-secondary'
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-semibold text-[13px]">{label}</span>
                            <span className="text-[11px] text-text-muted">{description}</span>
                          </div>
                        </div>
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 shrink-0 transition-transform',
                            isActive ? 'text-primary' : 'text-neutral-400'
                          )}
                          aria-hidden="true"
                        />
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/95 backdrop-blur-md shadow-lg lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-1">
          {/* Primary Nav Links */}
          {primaryNavItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative flex min-h-[48px] flex-col items-center justify-center rounded-xl py-1 text-center transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-text-secondary hover:text-text-primary font-medium'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span
                      className="absolute top-1 h-1 w-6 rounded-full bg-primary transition-all"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-transform duration-150',
                      isActive ? 'scale-110 text-primary' : 'group-hover:scale-105'
                    )}
                    aria-hidden="true"
                  />
                  <span className="mt-1 text-[11px] leading-tight tracking-tight">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* More Menu Trigger */}
          <button
            ref={moreButtonRef}
            type="button"
            aria-label="More navigation options"
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-menu"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={cn(
              'group relative flex min-h-[48px] flex-col items-center justify-center rounded-xl py-1 text-center transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isMoreOpen || isMoreActive
                ? 'text-primary font-bold'
                : 'text-text-secondary hover:text-text-primary font-medium'
            )}
          >
            {(isMoreOpen || isMoreActive) && (
              <span
                className="absolute top-1 h-1 w-6 rounded-full bg-primary transition-all"
                aria-hidden="true"
              />
            )}
            <MoreHorizontal
              className={cn(
                'h-5 w-5 transition-transform duration-150',
                isMoreOpen || isMoreActive ? 'scale-110 text-primary' : 'group-hover:scale-105'
              )}
              aria-hidden="true"
            />
            <span className="mt-1 text-[11px] leading-tight tracking-tight">
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
