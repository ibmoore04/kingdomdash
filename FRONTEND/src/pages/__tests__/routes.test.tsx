import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'

function AppWithProviders({ initialEntries }: { initialEntries: string[] }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

const publicRoutes = [
  '/',
  '/about',
  '/services',
  '/food',
  '/groceries',
  '/grocery',
  '/courier',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/refund-policy',
]

const authRoutes = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/login',
  '/register',
  '/forgot-password',
]

const appRoutes = ['/become-vendor', '/become-rider']

describe('Public routes render without error', () => {
  publicRoutes.forEach((path) => {
    it(`renders ${path}`, async () => {
      render(<AppWithProviders initialEntries={[path]} />)
      // Wait for lazy-loaded page to replace the loading fallback
      await waitFor(
        () => expect(screen.getByRole('main')).toBeInTheDocument(),
        { timeout: 5000 },
      )
    })
  })
})

describe('Auth shell routes render without error', () => {
  authRoutes.forEach((path) => {
    it(`renders ${path}`, async () => {
      render(<AppWithProviders initialEntries={[path]} />)
      await waitFor(
        () => expect(screen.getByRole('main')).toBeInTheDocument(),
        { timeout: 5000 },
      )
    })
  })
})

describe('Application routes render without error', () => {
  appRoutes.forEach((path) => {
    it(`renders ${path}`, async () => {
      render(<AppWithProviders initialEntries={[path]} />)
      await waitFor(
        () => expect(screen.getByRole('main')).toBeInTheDocument(),
        { timeout: 5000 },
      )
    })
  })
})
