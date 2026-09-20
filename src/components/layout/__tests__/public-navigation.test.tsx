import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from '../bottom-nav'
import { Navbar } from '../navbar'
import { PublicLayout } from '../public-layout'
import { useCartStore } from '@/stores/cart-store'
import { useAuthStore } from '@/stores/auth-store'

describe('Public Mobile Navigation & Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCartStore.setState({
      items: [],
      isOpen: false,
    })
    useAuthStore.setState({
      session: null,
      profile: null,
    })
  })

  describe('BottomNav Component', () => {
    it('renders exactly 5 navigation items: Home, Food, Grocery, Courier, and More', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <BottomNav />
        </MemoryRouter>
      )

      const nav = screen.getByRole('navigation', { name: 'Mobile bottom navigation' })
      expect(nav).toBeInTheDocument()

      expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
      expect(screen.getByRole('link', { name: /food/i })).toHaveAttribute('href', '/food')
      expect(screen.getByRole('link', { name: /grocery/i })).toHaveAttribute('href', '/groceries')
      expect(screen.getByRole('link', { name: /courier/i })).toHaveAttribute('href', '/courier')
      expect(screen.getByRole('button', { name: /more navigation options/i })).toBeInTheDocument()
    })

    it('sets active styling for the current route', () => {
      render(
        <MemoryRouter initialEntries={['/food']}>
          <BottomNav />
        </MemoryRouter>
      )

      const foodLink = screen.getByRole('link', { name: /food/i })
      expect(foodLink.className).toContain('text-primary')
      expect(foodLink.className).toContain('font-bold')
    })

    it('opens the More sheet when More button is clicked, showing About, Services, Contact', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <BottomNav />
        </MemoryRouter>
      )

      const moreBtn = screen.getByRole('button', { name: /more navigation options/i })
      expect(screen.queryByRole('dialog', { name: 'More navigation options' })).not.toBeInTheDocument()

      // Click More
      fireEvent.click(moreBtn)

      const dialog = screen.getByRole('dialog', { name: 'More navigation options' })
      expect(dialog).toBeInTheDocument()

      expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute('href', '/about')
      expect(screen.getByRole('link', { name: /services/i })).toHaveAttribute('href', '/services')
      expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '/contact')
    })

    it('closes the More sheet when close button is clicked or Escape key is pressed', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <BottomNav />
        </MemoryRouter>
      )

      const moreBtn = screen.getByRole('button', { name: /more navigation options/i })
      fireEvent.click(moreBtn)
      expect(screen.getByRole('dialog', { name: 'More navigation options' })).toBeInTheDocument()

      // Click Close button inside sheet
      const closeBtn = screen.getByRole('button', { name: /close more options menu/i })
      fireEvent.click(closeBtn)
      expect(screen.queryByRole('dialog', { name: 'More navigation options' })).not.toBeInTheDocument()

      // Re-open and test Escape
      fireEvent.click(moreBtn)
      expect(screen.getByRole('dialog', { name: 'More navigation options' })).toBeInTheDocument()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('dialog', { name: 'More navigation options' })).not.toBeInTheDocument()
    })

    it('highlights More button as active when on secondary routes like /about', () => {
      render(
        <MemoryRouter initialEntries={['/about']}>
          <BottomNav />
        </MemoryRouter>
      )

      const moreBtn = screen.getByRole('button', { name: /more navigation options/i })
      expect(moreBtn.className).toContain('text-primary')
    })
  })

  describe('Navbar Header Component', () => {
    it('does NOT render any mobile hamburger menu button', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Navbar />
        </MemoryRouter>
      )

      expect(screen.queryByRole('button', { name: /open navigation menu/i })).not.toBeInTheDocument()
    })

    it('renders logo, cart trigger with count, and desktop navigation links', () => {
      useCartStore.setState({
        items: [
          {
            productId: 'p1',
            vendorId: 'v1',
            serviceType: 'food',
            name: 'Burger',
            price: 2500,
            quantity: 3,
            imageUrl: null,
          },
        ],
      })

      render(
        <MemoryRouter initialEntries={['/']}>
          <Navbar />
        </MemoryRouter>
      )

      // Logo
      expect(screen.getByRole('link', { name: /kingdomdash/i })).toBeInTheDocument()

      // Cart button with badge
      const cartBtn = screen.getByRole('button', { name: /open shopping cart with 3 items/i })
      expect(cartBtn).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()

      // Desktop navigation
      const desktopNav = screen.getByRole('navigation', { name: 'Main navigation' })
      expect(desktopNav).toBeInTheDocument()
      expect(desktopNav.className).toContain('hidden lg:flex')
    })

    it('renders profile control in header for unauthenticated and authenticated users', () => {
      // Unauthenticated
      const { unmount } = render(
        <MemoryRouter initialEntries={['/']}>
          <Navbar />
        </MemoryRouter>
      )

      expect(screen.getByRole('button', { name: /account options/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
      unmount()

      // Authenticated
      useAuthStore.setState({
        session: { user: { id: 'u1' } } as any,
        profile: {
          id: 'u1',
          full_name: 'David Adeleke',
          role: 'customer',
        } as any,
      })

      render(
        <MemoryRouter initialEntries={['/']}>
          <Navbar />
        </MemoryRouter>
      )

      const profileBtn = screen.getByRole('button', { name: /user account menu/i })
      expect(profileBtn).toBeInTheDocument()
      expect(screen.getByText('David')).toBeInTheDocument()
    })
  })

  describe('PublicLayout Integration', () => {
    it('renders public layout with Navbar, BottomNav, and mobile padding', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <PublicLayout />
        </MemoryRouter>
      )

      // Main container has mobile padding for bottom nav
      const outerWrapper = container.firstChild as HTMLElement
      expect(outerWrapper.className).toContain('pb-[calc(4rem+env(safe-area-inset-bottom,0px))]')
      expect(outerWrapper.className).toContain('lg:pb-0')

      // Bottom nav is mounted
      expect(screen.getByRole('navigation', { name: 'Mobile bottom navigation' })).toBeInTheDocument()
    })
  })
})
