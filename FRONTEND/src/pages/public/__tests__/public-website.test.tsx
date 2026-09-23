import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'
import { appConfig } from '@/config/app.config'

function renderWithProviders(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Public Website — Phase 4 Core Verification', () => {
  it('renders Homepage with official branding, tagline, and launch market', async () => {
    renderWithProviders(['/'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 5000 })

    // Check tagline
    const taglines = screen.getAllByText(appConfig.tagline)
    expect(taglines.length).toBeGreaterThan(0)

    // Check launch market mention
    const marketMentions = screen.getAllByText(new RegExp(appConfig.launchMarket, 'i'))
    expect(marketMentions.length).toBeGreaterThan(0)

    // Check core services cards
    expect(screen.getByRole('heading', { name: /three services, one platform/i })).toBeInTheDocument()
    expect(screen.getAllByText('Food Delivery').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Grocery Delivery').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Courier Dispatch').length).toBeGreaterThan(0)
  })

  it('renders Navigation with all required public routes and no dead links', async () => {
    renderWithProviders(['/'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 5000 })

    const nav = screen.getByRole('navigation', { name: /main navigation/i })
    expect(nav).toBeInTheDocument()

    // Required links in navigation: Home, About, Services, Food, Grocery, Courier, Contact
    const expectedNav = ['Home', 'About', 'Services', 'Food', 'Grocery', 'Courier', 'Contact']
    for (const label of expectedNav) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
    }

    // Verify all links in the document have valid hrefs (no href="#" or empty href)
    const allLinks = document.querySelectorAll('a')
    expect(allLinks.length).toBeGreaterThan(0)
    allLinks.forEach((link) => {
      const href = link.getAttribute('href')
      expect(href).toBeTruthy()
      expect(href).not.toBe('#')
    })
  })

  it('renders About page with mission, vision, and launch market context', async () => {
    renderWithProviders(['/about'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 5000 })

    expect(screen.getByRole('heading', { name: /delivery made simple/i })).toBeInTheDocument()
    expect(screen.getByText(/our mission/i)).toBeInTheDocument()
    expect(screen.getByText(/our vision/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /our core values/i })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toContain('About Us'))
  })

  it('renders Services page with overview and direct CTAs to all 3 services', async () => {
    renderWithProviders(['/services'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 5000 })

    expect(screen.getByRole('heading', { name: /all the delivery services you need/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /explore food delivery/i })).toHaveAttribute('href', '/food')
    expect(screen.getByRole('link', { name: /explore grocery delivery/i })).toHaveAttribute('href', '/groceries')
    expect(screen.getByRole('link', { name: /explore courier dispatch/i })).toHaveAttribute('href', '/courier')
    await waitFor(() => expect(document.title).toContain('Our Services'))
  })

  it('renders Food Delivery page with catalog and partner CTA', async () => {
    renderWithProviders(['/food'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 5000 })

    expect(screen.getByRole('heading', { name: /hot meals, delivered swift/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /join as a food vendor/i })).toHaveAttribute('href', '/become-vendor')
    await waitFor(() => expect(document.title).toContain('Food Delivery'))
  })

  it('renders Grocery Delivery page via both /groceries and /grocery alias', async () => {
    // Test /groceries
    const { unmount } = renderWithProviders(['/groceries'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 10000 })
    expect(screen.getByRole('heading', { name: /fresh groceries, delivered today/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /need help ordering groceries/i })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toContain('Grocery Delivery'))
    unmount()

    // Test /grocery alias
    renderWithProviders(['/grocery'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 10000 })
    expect(screen.getByRole('heading', { name: /fresh groceries, delivered today/i })).toBeInTheDocument()
  })

  it('renders Courier Dispatch page with simplified booking form', async () => {
    renderWithProviders(['/courier'])
    await waitFor(() => expect(screen.getByRole('heading', { name: /send anything, anywhere/i })).toBeInTheDocument(), { timeout: 10000 })

    expect(screen.getByRole('heading', { name: /courier booking form/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/pickup address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send booking via whatsapp/i })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toContain('Courier Dispatch'))
  })

  it('renders Contact page with accessible form and validates input fields', async () => {
    renderWithProviders(['/contact'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 5000 })

    expect(screen.getByRole('heading', { name: /we'd love to hear from you/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /reach us directly/i })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toContain('Contact Us'))

    // Submit without input -> should show validation errors
    const submitBtn = screen.getByRole('button', { name: /send message/i })
    fireEvent.click(submitBtn)

    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/subject is required/i)).toBeInTheDocument()
    expect(screen.getByText(/message is required/i)).toBeInTheDocument()
  })

  it('renders 404 page for unknown routes with a link back to home', async () => {
    renderWithProviders(['/some-completely-unknown-route-12345'])
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 5000 })

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})
